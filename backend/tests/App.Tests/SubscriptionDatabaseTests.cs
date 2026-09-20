using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Subscriptions;

namespace PortfolioTerminal.Tests;

public sealed class SubscriptionDatabaseTests
{
    [SubscriptionDatabaseFact]
    public async Task PeriodPaymentsStayIndependentAndUsersAreIsolated()
    {
        var adminString = Environment.GetEnvironmentVariable("SUBSCRIPTION_TEST_DATABASE")!;
        var databaseName = "subscription_qa_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"create database {databaseName};", admin))
            await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminString)
        { Database = databaseName, Pooling = false };
        try
        {
            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync();
            var user = Guid.NewGuid();
            var other = Guid.NewGuid();
            await using (var setup = new NpgsqlCommand("""
                create schema auth;
                create table auth.users (id uuid primary key);
                create function auth.uid() returns uuid language sql stable as $$
                  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
                $$;
                do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then
                  create role authenticated nologin; end if; end $$;
                grant usage on schema auth, public to authenticated;
                grant execute on function auth.uid() to authenticated;
                """, connection))
                await setup.ExecuteNonQueryAsync();

            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "supabase", "migrations")))
                directory = directory.Parent;
            Assert.NotNull(directory);
            var migrationPath = Path.Combine(directory.FullName, "supabase", "migrations",
                "20260920214208_subscription_tracker.sql");
            var migration = await File.ReadAllTextAsync(migrationPath);
            await using (var apply = new NpgsqlCommand(migration, connection))
                await apply.ExecuteNonQueryAsync();
            await using (var grant = new NpgsqlCommand(
                "grant all on all tables in schema public to authenticated;", connection))
                await grant.ExecuteNonQueryAsync();
            await using (var users = new NpgsqlCommand(
                "insert into auth.users(id) values ($1),($2);", connection))
            {
                users.Parameters.AddWithValue(user);
                users.Parameters.AddWithValue(other);
                await users.ExecuteNonQueryAsync();
            }

            var clock = new TestClock(new DateTimeOffset(2026, 9, 21, 12, 0, 0, TimeSpan.Zero));
            await using var source = new AppDataSource(builder.ConnectionString);
            var store = new SubscriptionStore(source, clock);
            var dad = await store.SavePersonAsync(user, null, "Dad", true);
            var friend = await store.SavePersonAsync(user, null, "Friend", true);
            var otherPerson = await store.SavePersonAsync(other, null, "Other", true);
            await Assert.ThrowsAsync<ArgumentException>(() => store.SaveSubscriptionAsync(
                user, null, new SubscriptionInput("Invalid", null, null, null, 10m,
                    "EUR", 1, new DateOnly(2026, 10, 1), "equal", true, false,
                    [new(otherPerson, "manual", null)])));
            var subscription = await store.SaveSubscriptionAsync(user, null, new SubscriptionInput(
                "Netflix", null, "Streaming", null, 20m, "EUR", 1,
                new DateOnly(2026, 10, 1), "equal", true, true,
                [new(dad, "manual", null), new(friend, "auto", null)]));

            var september = await store.GetStateAsync(user);
            Assert.Single(september.Periods);
            Assert.Equal(new DateOnly(2026, 9, 1), september.Periods[0].BillingDate);
            Assert.Equal(6.68m, september.Periods[0].MyAmount);
            Assert.Equal("unpaid", september.Periods[0].Contributions.Single(c => c.PersonId == dad).Status);
            Assert.Equal("auto_received", september.Periods[0].Contributions.Single(c => c.PersonId == friend).Status);
            Assert.True(await store.SetPaidAsync(user,
                september.Periods[0].Contributions.Single(c => c.PersonId == dad).Id, true));

            clock.Current = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
            var october = await store.GetStateAsync(user);
            Assert.Equal(2, october.Periods.Count);
            Assert.Equal("unpaid", october.Periods.Single(p => p.BillingDate.Month == 10)
                .Contributions.Single(c => c.PersonId == dad).Status);
            Assert.Equal("paid", october.Periods.Single(p => p.BillingDate.Month == 9)
                .Contributions.Single(c => c.PersonId == dad).Status);
            Assert.Equal(new DateOnly(2026, 11, 1), october.Subscriptions.Single(s => s.Id == subscription).NextBillingDate);
            await store.SaveSubscriptionAsync(user, subscription, new SubscriptionInput(
                "Netflix", null, "Streaming", null, 30m, "EUR", 1,
                new DateOnly(2026, 11, 1), "fixed", true, false,
                [new(dad, "manual", 8m)]));
            clock.Current = new DateTimeOffset(2026, 11, 1, 12, 0, 0, TimeSpan.Zero);
            var november = await store.GetStateAsync(user);
            Assert.Equal(30m, november.Periods.Single(p => p.BillingDate.Month == 11).FullAmount);
            Assert.Equal(22m, november.Periods.Single(p => p.BillingDate.Month == 11).MyAmount);
            Assert.Equal(20m, november.Periods.Single(p => p.BillingDate.Month == 10).FullAmount);
            Assert.Contains(november.Periods.Single(p => p.BillingDate.Month == 10).Contributions,
                c => c.PersonId == friend && c.Status == "auto_received");
            Assert.Empty((await store.GetStateAsync(other)).Subscriptions);
            var visibleToOther = await source.ExecuteAsUserAsync(other, async (db, transaction, ct) =>
            {
                await using var count = db.CreateCommand();
                count.Transaction = transaction;
                count.CommandText = "select count(*) from public.subscriptions;";
                return (long)(await count.ExecuteScalarAsync(ct))!;
            });
            Assert.Equal(0, visibleToOther);
            Assert.False(await store.SetPaidAsync(other,
                november.Periods[0].Contributions.Single(c => c.PersonId == dad).Id, true));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {databaseName} with (force);", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class TestClock(DateTimeOffset initial) : TimeProvider
    {
        public DateTimeOffset Current { get; set; } = initial;
        public override DateTimeOffset GetUtcNow() => Current;
    }
}

public sealed class SubscriptionDatabaseFactAttribute : FactAttribute
{
    public SubscriptionDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SUBSCRIPTION_TEST_DATABASE")))
            Skip = "Set SUBSCRIPTION_TEST_DATABASE to a disposable PostgreSQL server.";
    }
}
