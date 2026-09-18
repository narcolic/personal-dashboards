using Npgsql;
using NpgsqlTypes;

namespace PortfolioTerminal.Portfolio.Cash;

internal static class PortfolioAccountingGuard
{
    public static async Task LockUserAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select pg_advisory_xact_lock(hashtextextended($1, 0));";
        command.Parameters.AddWithValue(userId.ToString());
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public static async Task<decimal> GetAvailableCashAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? portfolioId,
        string currency,
        DateOnly asOf,
        Guid? excludedTransactionId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select coalesce(sum(event.amount), 0)::numeric
            from (
              select case
                       when t.action = 'sell' and t.settles_to_cash
                         then (t.shares * t.price) - t.fee_amount
                       when t.action = 'buy' then -t.cash_used
                       else 0
                     end::numeric as amount
              from public.transactions t
              where t.user_id = $1
                and t.portfolio_id is not distinct from $2
                and upper(t.transaction_currency) = $3
                and t.transaction_date <= $4
                and ($5::uuid is null or t.id <> $5)
              union all
              select -w.amount::numeric
              from public.portfolio_cash_withdrawals w
              where w.user_id = $1
                and w.portfolio_id is not distinct from $2
                and upper(w.currency) = $3
                and w.withdrawal_date <= $4
            ) event;
            """;
        Add(command, NpgsqlDbType.Uuid, userId);
        Add(command, NpgsqlDbType.Uuid, portfolioId);
        Add(command, NpgsqlDbType.Text, currency.Trim().ToUpperInvariant());
        Add(command, NpgsqlDbType.Date, asOf);
        Add(command, NpgsqlDbType.Uuid, excludedTransactionId);
        return (decimal)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    public static async Task ValidateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await ValidatePositionsAsync(connection, transaction, userId, cancellationToken)
            .ConfigureAwait(false);
        await ValidateCashAsync(connection, transaction, userId, cancellationToken)
            .ConfigureAwait(false);
    }

    private static async Task ValidatePositionsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select symbol, transaction_date, running_shares
            from (
              select listing.symbol,
                     t.transaction_date,
                     sum(case when t.action = 'buy' then t.shares else -t.shares end)
                       over (
                         partition by t.security_listing_id, t.portfolio_id, upper(t.transaction_currency)
                         order by t.transaction_date,
                                  t.created_at,
                                  t.id
                       ) as running_shares
              from public.transactions t
              join public.security_listings listing on listing.id = t.security_listing_id
              where t.user_id = $1 and t.action in ('buy', 'sell')
            ) history
            where running_shares < 0
            order by transaction_date
            limit 1;
            """;
        Add(command, NpgsqlDbType.Uuid, userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new PortfolioAccountingConflictException(
                $"The transaction would oversell {reader.GetString(0)} on {reader.GetFieldValue<DateOnly>(1):yyyy-MM-dd}.");
        }
    }

    private static async Task ValidateCashAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            with daily_events as (
              select portfolio_id, upper(currency) as currency, event_date, sum(amount)::numeric as amount
              from (
                select t.portfolio_id,
                       t.transaction_currency as currency,
                       t.transaction_date as event_date,
                       case
                         when t.action = 'sell' and t.settles_to_cash
                           then (t.shares * t.price) - t.fee_amount
                         when t.action = 'buy' then -t.cash_used
                         else 0
                       end::numeric as amount
                from public.transactions t
                where t.user_id = $1
                union all
                select w.portfolio_id, w.currency, w.withdrawal_date, -w.amount::numeric
                from public.portfolio_cash_withdrawals w
                where w.user_id = $1
              ) events
              group by portfolio_id, upper(currency), event_date
            ), running as (
              select portfolio_id, currency, event_date,
                     sum(amount) over (
                       partition by portfolio_id, currency
                       order by event_date
                     ) as balance
              from daily_events
            )
            select currency, event_date, balance
            from running
            where balance < 0
            order by event_date
            limit 1;
            """;
        Add(command, NpgsqlDbType.Uuid, userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new PortfolioAccountingConflictException(
                $"The transaction would make {reader.GetString(0)} portfolio cash negative on {reader.GetFieldValue<DateOnly>(1):yyyy-MM-dd}.");
        }
    }

    private static void Add(NpgsqlCommand command, NpgsqlDbType type, object? value) =>
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = type, Value = value ?? DBNull.Value });
}

internal sealed class PortfolioAccountingConflictException(string message) : InvalidOperationException(message);
