using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Travel;

namespace PortfolioTerminal.Tests;

public sealed class TravelDatabaseTests
{
    [TravelDatabaseFact]
    public async Task MigrationCrudAndRlsIsolateUsers()
    {
        var adminString = Environment.GetEnvironmentVariable("TRAVEL_TEST_DATABASE")!;
        var databaseName = "travel_qa_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"create database {databaseName};", admin))
            await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminString) { Database = databaseName, Pooling = false };
        try
        {
            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync();
            await using (var setup = new NpgsqlCommand("""
                create schema auth;
                create table auth.users(id uuid primary key);
                create function auth.uid() returns uuid language sql stable as $$
                  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
                $$;
                do $$ begin
                  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
                  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
                end $$;
                grant usage on schema auth, public to authenticated;
                grant execute on function auth.uid() to authenticated;
                """, connection)) await setup.ExecuteNonQueryAsync();
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "supabase", "migrations"))) directory = directory.Parent;
            Assert.NotNull(directory);
            var path = Directory.GetFiles(Path.Combine(directory.FullName, "supabase", "migrations"), "*_travel_places.sql").Single();
            await using (var migration = new NpgsqlCommand(await File.ReadAllTextAsync(path), connection)) await migration.ExecuteNonQueryAsync();
            var owner = Guid.NewGuid();
            var other = Guid.NewGuid();
            await using (var users = new NpgsqlCommand("insert into auth.users(id) values ($1),($2)", connection))
            { users.Parameters.AddWithValue(owner); users.Parameters.AddWithValue(other); await users.ExecuteNonQueryAsync(); }
            await using var source = new AppDataSource(builder.ConnectionString);
            var store = new TravelStore(source);
            var input = new TravelInput(" Athens ", " Greece ", 37.98, 23.72, new DateOnly(2024, 6, 1), " hello ");
            var saved = await store.SaveAsync(owner, null, input, default);
            Assert.NotNull(saved);
            Assert.Equal("Athens", saved.Name);
            Assert.Equal("hello", saved.Note);
            Assert.Single(await store.ListAsync(owner, default));
            Assert.Empty(await store.ListAsync(other, default));
            Assert.Null(await store.SaveAsync(other, saved.Id, input, default));
            Assert.False(await store.DeleteAsync(other, saved.Id, default));
            // No application WHERE clause here: this verifies the database policy itself.
            var visible = await source.ExecuteAsUserAsync(other, async (c, tx, ct) =>
            {
                await using var command = new NpgsqlCommand("select count(*) from public.travel_places", c, tx);
                return (long)(await command.ExecuteScalarAsync(ct))!;
            });
            Assert.Equal(0, visible);
            await Assert.ThrowsAsync<PostgresException>(() => source.ExecuteAsUserAsync(owner, async (c, tx, ct) =>
            {
                await using var command = new NpgsqlCommand("update public.travel_places set user_id=$1", c, tx);
                command.Parameters.AddWithValue(other);
                return await command.ExecuteNonQueryAsync(ct);
            }));
            var updated = await store.SaveAsync(owner, saved.Id, input with { VisitDate = null, Note = null, Name = "Piraeus" }, default);
            Assert.NotNull(updated);
            Assert.Null(updated.VisitDate);
            Assert.Null(updated.Note);
            Assert.Equal("Piraeus", (await store.ListAsync(owner, default)).Single().Name);
            Assert.True(await store.DeleteAsync(owner, saved.Id, default));
            Assert.Empty(await store.ListAsync(owner, default));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {databaseName} with (force);", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}

public sealed class TravelDatabaseFactAttribute : FactAttribute
{
    public TravelDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TRAVEL_TEST_DATABASE")))
            Skip = "Set TRAVEL_TEST_DATABASE to a disposable PostgreSQL server.";
    }
}
