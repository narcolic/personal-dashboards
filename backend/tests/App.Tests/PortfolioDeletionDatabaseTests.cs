using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio;
using PortfolioTerminal.Portfolio.Portfolios;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioDeletionDatabaseTests
{
    [ActivityDatabaseTheory]
    [InlineData("cascade", "transactions_portfolio_id_fkey")]
    [InlineData("set null", "positions_portfolio_id_fkey")]
    public async Task DeletionRequiresAllTransactionsToBeRemovedAndDatabaseRejectsRaces(string oldAction, string oldConstraint)
    {
        var adminString = Environment.GetEnvironmentVariable("ACTIVITY_TEST_DATABASE")!;
        var databaseName = "portfolio_delete_qa_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"create database {databaseName};", admin))
            await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminString) { Database = databaseName, Pooling = false };
        try
        {
            var user = Guid.NewGuid(); var other = Guid.NewGuid();
            var occupied = Guid.NewGuid(); var empty = Guid.NewGuid();
            var foreign = Guid.NewGuid(); var hiddenReference = Guid.NewGuid(); var racing = Guid.NewGuid();
            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync();
            await using (var seed = new NpgsqlCommand($"""
                do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then
                  create role authenticated nologin; end if; end $$;
                create table public.portfolios (id uuid primary key, user_id uuid, name text);
                create table public.transactions (id uuid primary key default gen_random_uuid(), user_id uuid,
                  portfolio_id uuid constraint {oldConstraint} references public.portfolios(id) on delete {oldAction},
                  action text);
                create index on public.transactions(portfolio_id);
                alter table public.portfolios enable row level security;
                alter table public.transactions enable row level security;
                create policy own_portfolios on public.portfolios for all to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid)
                  with check (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                create policy own_transactions on public.transactions for all to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid)
                  with check (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                grant usage on schema public to authenticated;
                grant select, insert, update, delete on all tables in schema public to authenticated;
                insert into public.portfolios values
                  ('{occupied}','{user}','Sold out'), ('{empty}','{user}','Empty'),
                  ('{foreign}','{other}','Other user'), ('{hiddenReference}','{user}','Legacy reference'),
                  ('{racing}','{user}','Concurrent');
                insert into public.transactions (user_id,portfolio_id,action) values
                  ('{user}','{occupied}','buy'), ('{user}','{occupied}','sell'),
                  ('{user}','{occupied}','dividend'), ('{user}','{occupied}','fee'),
                  ('{other}','{foreign}','buy'), ('{other}','{hiddenReference}','buy');
                """, connection))
                await seed.ExecuteNonQueryAsync();

            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "supabase", "migrations")))
                directory = directory.Parent;
            Assert.NotNull(directory);
            var migrationPath = Assert.Single(Directory.GetFiles(Path.Combine(directory.FullName, "supabase", "migrations"),
                "*_restrict_portfolio_deletion_with_transactions.sql"));
            await using (var migrationTransaction = await connection.BeginTransactionAsync())
            {
                await using var migration = new NpgsqlCommand(await File.ReadAllTextAsync(migrationPath), connection, migrationTransaction);
                await migration.ExecuteNonQueryAsync();
                await migrationTransaction.CommitAsync();
            }
            await using var source = new AppDataSource(builder.ConnectionString);
            var commands = new PortfolioCommands(source);

            var blocked = await commands.DeleteAsync(user, occupied);
            Assert.Equal(PortfolioMutationStatus.Conflict, blocked.Status);
            Assert.Contains("Delete all transactions", blocked.Detail);
            Assert.Equal(PortfolioMutationStatus.NotFound, (await commands.DeleteAsync(user, foreign)).Status);
            Assert.Equal(PortfolioMutationStatus.NotFound, (await commands.DeleteAsync(user, Guid.NewGuid())).Status);
            Assert.Equal(PortfolioMutationStatus.Conflict, (await commands.DeleteAsync(user, hiddenReference)).Status);
            Assert.Equal(PortfolioMutationStatus.Success, (await commands.DeleteAsync(user, empty)).Status);

            // Direct SQL cannot bypass the rule or cascade away the history.
            await using (var directDelete = new NpgsqlCommand($"delete from public.portfolios where id='{occupied}'", connection))
            {
                var exception = await Assert.ThrowsAsync<PostgresException>(() => directDelete.ExecuteNonQueryAsync());
                Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, exception.SqlState);
            }
            await using (var count = new NpgsqlCommand($"select count(*) from public.transactions where portfolio_id='{occupied}'", connection))
                Assert.Equal(4L, (long)(await count.ExecuteScalarAsync())!);

            // Even a standalone fee prevents deletion after every buy/sell was removed.
            await using (var removeTrades = new NpgsqlCommand($"delete from public.transactions where portfolio_id='{occupied}' and action<>'fee'", connection))
                await removeTrades.ExecuteNonQueryAsync();
            Assert.Equal(PortfolioMutationStatus.Conflict, (await commands.DeleteAsync(user, occupied)).Status);
            await using (var removeLast = new NpgsqlCommand($"delete from public.transactions where portfolio_id='{occupied}'", connection))
                await removeLast.ExecuteNonQueryAsync();
            Assert.Equal(PortfolioMutationStatus.Success, (await commands.DeleteAsync(user, occupied)).Status);

            // An insert already in progress holds a key-share lock. A concurrent raw
            // deletion must fail once the insert commits, rather than losing the trade.
            await using var writer = new NpgsqlConnection(builder.ConnectionString);
            await writer.OpenAsync();
            await using var writerTransaction = await writer.BeginTransactionAsync();
            await using (var insert = new NpgsqlCommand($"insert into public.transactions(user_id,portfolio_id,action) values ('{user}','{racing}','buy')", writer, writerTransaction))
                await insert.ExecuteNonQueryAsync();
            await using var racingDelete = new NpgsqlCommand($"delete from public.portfolios where id='{racing}'", connection);
            var deletion = racingDelete.ExecuteNonQueryAsync();
            await writerTransaction.CommitAsync();
            var raceError = await Assert.ThrowsAsync<PostgresException>(() => deletion);
            Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, raceError.SqlState);
            Assert.Equal(PortfolioMutationStatus.Conflict, (await commands.DeleteAsync(user, racing)).Status);
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {databaseName} with (force);", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}

public sealed class ActivityDatabaseTheoryAttribute : TheoryAttribute
{
    public ActivityDatabaseTheoryAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ACTIVITY_TEST_DATABASE")))
            Skip = "Set ACTIVITY_TEST_DATABASE to a disposable PostgreSQL instance to run database regression tests.";
    }
}
