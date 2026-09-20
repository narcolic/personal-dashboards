using Npgsql;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Subscriptions;

public sealed class SubscriptionStore(AppDataSource dataSource, TimeProvider clock)
{
    private DateOnly Today => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

    public Task<SubscriptionState> GetStateAsync(Guid userId, CancellationToken token = default) =>
        dataSource.ExecuteAsUserAsync(userId, async (connection, transaction, ct) =>
        {
            await CatchUpAsync(connection, transaction, userId, ct);
            return await ReadStateAsync(connection, transaction, userId, ct);
        }, token);

    public Task<string> SaveHomeCurrencyAsync(Guid userId, string currency, CancellationToken token = default) =>
        dataSource.ExecuteAsUserAsync(userId, async (connection, transaction, ct) =>
        {
            await using var command = Cmd(connection, transaction, """
                insert into public.subscription_settings (user_id, home_currency) values ($1, $2)
                on conflict (user_id) do update set home_currency = excluded.home_currency;
                """, userId, currency);
            await command.ExecuteNonQueryAsync(ct);
            return currency;
        }, token);

    public Task<Guid> SavePersonAsync(Guid userId, Guid? id, string name, bool isActive,
        CancellationToken token = default) =>
        dataSource.ExecuteAsUserAsync(userId, async (connection, transaction, ct) =>
        {
            var sql = id is null
                ? """insert into public.subscription_people (user_id, name, is_active) values ($1,$2,$3) returning id;"""
                : """update public.subscription_people set name=$3, is_active=$4 where user_id=$1 and id=$2 returning id;""";
            await using var command = id is null
                ? Cmd(connection, transaction, sql, userId, name, isActive)
                : Cmd(connection, transaction, sql, userId, id.Value, name, isActive);
            var result = await command.ExecuteScalarAsync(ct);
            return result is Guid savedId ? savedId : Guid.Empty;
        }, token);

    public Task<Guid> SaveSubscriptionAsync(Guid userId, Guid? id, SubscriptionInput input,
        CancellationToken token = default) =>
        dataSource.ExecuteAsUserAsync(userId, async (connection, transaction, ct) =>
        {
            await CatchUpAsync(connection, transaction, userId, ct);
            var memberIds = input.Members.Select(member => member.PersonId).ToArray();
            if (memberIds.Length != memberIds.Distinct().Count())
                throw new ArgumentException("A person can only appear once per subscription.");
            foreach (var personId in memberIds)
            {
                await using var personCommand = Cmd(connection, transaction,
                    "select exists(select 1 from public.subscription_people where user_id=$1 and id=$2);",
                    userId, personId);
                if (await personCommand.ExecuteScalarAsync(ct) is not true)
                    throw new ArgumentException("Select a person belonging to your account.");
            }

            var savedId = id ?? Guid.Empty;
            var anchorDay = input.NextBillingDate.Day;
            if (id is not null)
            {
                await using var oldCommand = Cmd(connection, transaction,
                    "select next_billing_date, billing_anchor_day from public.subscriptions where user_id=$1 and id=$2 for update;",
                    userId, id.Value);
                await using var reader = await oldCommand.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct)) return Guid.Empty;
                if (reader.GetFieldValue<DateOnly>(0) == input.NextBillingDate)
                    anchorDay = reader.GetInt32(1);
            }

            if (id is null)
            {
                await using var create = Cmd(connection, transaction, """
                    insert into public.subscriptions
                    (user_id,name,description,category,notes,amount,currency,interval_months,
                     next_billing_date,billing_anchor_day,split_mode,is_active)
                    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id;
                    """, userId, input.Name.Trim(), input.Description, input.Category,
                    input.Notes, input.Amount, input.Currency, input.IntervalMonths,
                    input.NextBillingDate, anchorDay, input.SplitMode, input.IsActive);
                savedId = (Guid)(await create.ExecuteScalarAsync(ct))!;
            }
            else
            {
                await using var update = Cmd(connection, transaction, """
                    update public.subscriptions set name=$3, description=$4, category=$5, notes=$6,
                    amount=$7, currency=$8, interval_months=$9, next_billing_date=$10,
                    billing_anchor_day=$11, split_mode=$12, is_active=$13, updated_at=now()
                    where user_id=$1 and id=$2;
                    """, userId, id.Value, input.Name.Trim(), input.Description,
                    input.Category, input.Notes, input.Amount, input.Currency,
                    input.IntervalMonths, input.NextBillingDate, anchorDay,
                    input.SplitMode, input.IsActive);
                await update.ExecuteNonQueryAsync(ct);
                savedId = id.Value;
                await using var remove = Cmd(connection, transaction,
                    "delete from public.subscription_memberships where user_id=$1 and subscription_id=$2;",
                    userId, savedId);
                await remove.ExecuteNonQueryAsync(ct);
            }

            foreach (var member in input.Members)
            {
                await using var add = Cmd(connection, transaction, """
                    insert into public.subscription_memberships
                    (user_id,subscription_id,person_id,payment_behavior,fixed_amount)
                    values ($1,$2,$3,$4,$5);
                    """, userId, savedId, member.PersonId, member.PaymentBehavior,
                    member.FixedAmount);
                await add.ExecuteNonQueryAsync(ct);
            }

            if (id is null && input.IsActive && input.TrackCurrentPeriod &&
                input.NextBillingDate > Today)
            {
                var previous = SubscriptionMath.Advance(input.NextBillingDate,
                    -input.IntervalMonths, anchorDay);
                var item = new SubscriptionItem(savedId, input.Name, input.Description,
                    input.Category, input.Notes, input.Amount, input.Currency,
                    input.IntervalMonths, input.NextBillingDate, anchorDay,
                    input.SplitMode, input.IsActive, input.Members);
                await CreatePeriodAsync(connection, transaction, userId, item, previous, ct);
            }
            return savedId;
        }, token);

    public Task<bool> SetPaidAsync(Guid userId, Guid contributionId, bool paid,
        CancellationToken token = default) =>
        dataSource.ExecuteAsUserAsync(userId, async (connection, transaction, ct) =>
        {
            await using var command = Cmd(connection, transaction, """
                update public.subscription_contributions
                set status=case when $3 then 'paid' else 'unpaid' end,
                    paid_at=case when $3 then now() else null end
                where user_id=$1 and id=$2 and payment_behavior='manual';
                """, userId, contributionId, paid);
            return await command.ExecuteNonQueryAsync(ct) == 1;
        }, token);

    public Task<bool> DeleteSubscriptionAsync(Guid userId, Guid id, CancellationToken token = default) =>
        dataSource.ExecuteAsUserAsync(userId, async (connection, transaction, ct) =>
        {
            await using var command = Cmd(connection, transaction, """
                delete from public.subscriptions s where s.user_id=$1 and s.id=$2
                and not exists(select 1 from public.subscription_periods p where p.subscription_id=s.id);
                """, userId, id);
            return await command.ExecuteNonQueryAsync(ct) == 1;
        }, token);

    private async Task CatchUpAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid userId, CancellationToken ct)
    {
        var today = Today;
        var due = new List<SubscriptionItem>();
        await using (var command = Cmd(connection, transaction, """
            select id,name,description,category,notes,amount,currency,interval_months,
                   next_billing_date,billing_anchor_day,split_mode,is_active
            from public.subscriptions
            where user_id=$1 and is_active and next_billing_date <= $2
            for update;
            """, userId, today))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct)) due.Add(ReadSubscription(reader, []));
        }

        foreach (var item in due)
        {
            var members = await ReadMembersAsync(connection, transaction, userId, item.Id, ct);
            var withMembers = item with { Members = members };
            var next = item.NextBillingDate;
            while (next <= today)
            {
                await CreatePeriodAsync(connection, transaction, userId, withMembers, next, ct);
                next = SubscriptionMath.Advance(next, item.IntervalMonths, item.BillingAnchorDay);
            }
            await using var update = Cmd(connection, transaction,
                "update public.subscriptions set next_billing_date=$3 where user_id=$1 and id=$2;",
                userId, item.Id, next);
            await update.ExecuteNonQueryAsync(ct);
        }
    }

    private static async Task CreatePeriodAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, Guid userId, SubscriptionItem item,
        DateOnly billingDate, CancellationToken ct)
    {
        var (mine, amounts) = SubscriptionMath.Split(item.Amount, item.SplitMode, item.Members);
        await using var create = Cmd(connection, transaction, """
            insert into public.subscription_periods
            (user_id,subscription_id,billing_date,full_amount,my_amount,currency)
            values ($1,$2,$3,$4,$5,$6)
            on conflict (subscription_id,billing_date) do nothing returning id;
            """, userId, item.Id, billingDate, item.Amount, mine, item.Currency);
        if (await create.ExecuteScalarAsync(ct) is not Guid periodId) return;

        for (var index = 0; index < item.Members.Count; index++)
        {
            var member = item.Members[index];
            var auto = member.PaymentBehavior == "auto";
            await using var contribution = Cmd(connection, transaction, """
                insert into public.subscription_contributions
                (user_id,period_id,person_id,amount,payment_behavior,status,paid_at)
                values ($1,$2,$3,$4,$5,$6,$7);
                """, userId, periodId, member.PersonId, amounts[index],
                member.PaymentBehavior, auto ? "auto_received" : "unpaid",
                auto ? new DateTimeOffset(billingDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) : null);
            await contribution.ExecuteNonQueryAsync(ct);
        }
    }

    private static async Task<SubscriptionState> ReadStateAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, Guid userId, CancellationToken ct)
    {
        var home = "EUR";
        await using (var command = Cmd(connection, transaction,
            "select home_currency from public.subscription_settings where user_id=$1;", userId))
        {
            home = (await command.ExecuteScalarAsync(ct) as string) ?? "EUR";
        }

        var people = new List<SubscriptionPerson>();
        await using (var command = Cmd(connection, transaction,
            "select id,name,is_active from public.subscription_people where user_id=$1 order by name,id;", userId))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
                people.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetBoolean(2)));
        }

        var memberMap = new Dictionary<Guid, List<SubscriptionMember>>();
        await using (var command = Cmd(connection, transaction, """
            select subscription_id,person_id,payment_behavior,fixed_amount
            from public.subscription_memberships where user_id=$1 order by id;
            """, userId))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var subscriptionId = reader.GetGuid(0);
                if (!memberMap.TryGetValue(subscriptionId, out var list))
                    memberMap[subscriptionId] = list = [];
                list.Add(new(reader.GetGuid(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetDecimal(3)));
            }
        }

        var subscriptions = new List<SubscriptionItem>();
        await using (var command = Cmd(connection, transaction, """
            select id,name,description,category,notes,amount,currency,interval_months,
                   next_billing_date,billing_anchor_day,split_mode,is_active
            from public.subscriptions where user_id=$1 order by is_active desc,name,id;
            """, userId))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                subscriptions.Add(ReadSubscription(reader, memberMap.GetValueOrDefault(id) ?? []));
            }
        }

        var contributionMap = new Dictionary<Guid, List<MemberContribution>>();
        await using (var command = Cmd(connection, transaction, """
            select c.id,c.period_id,c.person_id,c.amount,c.payment_behavior,c.status,c.paid_at
            from public.subscription_contributions c where c.user_id=$1 order by c.created_at,c.id;
            """, userId))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var periodId = reader.GetGuid(1);
                if (!contributionMap.TryGetValue(periodId, out var list))
                    contributionMap[periodId] = list = [];
                list.Add(new(reader.GetGuid(0), reader.GetGuid(2), reader.GetDecimal(3),
                    reader.GetString(4), reader.GetString(5),
                    reader.IsDBNull(6) ? null : new DateTimeOffset(reader.GetDateTime(6))));
            }
        }

        var periods = new List<SubscriptionPeriod>();
        await using (var command = Cmd(connection, transaction, """
            select id,subscription_id,billing_date,full_amount,my_amount,currency
            from public.subscription_periods where user_id=$1 order by billing_date desc,id;
            """, userId))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                periods.Add(new(id, reader.GetGuid(1), reader.GetFieldValue<DateOnly>(2),
                    reader.GetDecimal(3), reader.GetDecimal(4), reader.GetString(5),
                    contributionMap.GetValueOrDefault(id) ?? []));
            }
        }
        return new(home, people, subscriptions, periods);
    }

    private static async Task<IReadOnlyList<SubscriptionMember>> ReadMembersAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid userId, Guid subscriptionId, CancellationToken ct)
    {
        var members = new List<SubscriptionMember>();
        await using var command = Cmd(connection, transaction, """
            select person_id,payment_behavior,fixed_amount from public.subscription_memberships
            where user_id=$1 and subscription_id=$2 order by id;
            """, userId, subscriptionId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            members.Add(new(reader.GetGuid(0), reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetDecimal(2)));
        return members;
    }

    private static SubscriptionItem ReadSubscription(NpgsqlDataReader reader,
        IReadOnlyList<SubscriptionMember> members) => new(
            reader.GetGuid(0), reader.GetString(1),
            reader.IsDBNull(2) ? null : reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.GetDecimal(5), reader.GetString(6), reader.GetInt32(7),
            reader.GetFieldValue<DateOnly>(8), reader.GetInt32(9),
            reader.GetString(10), reader.GetBoolean(11), members);

    private static NpgsqlCommand Cmd(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string sql, params object?[] values)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var value in values) command.Parameters.AddWithValue(value ?? DBNull.Value);
        return command;
    }
}
