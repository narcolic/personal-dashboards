using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Energy;

namespace PortfolioTerminal.Tests;

public sealed class EnergyDatabaseTests
{
    [EnergyDatabaseFact]
    public async Task RealMigrationCrudConstraintsAndRls()
    {
        var adminString = Environment.GetEnvironmentVariable("ENERGY_TEST_DATABASE")!;
        var name = "energy_qa_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"create database {name};", admin)) await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminString) { Database = name, Pooling = false };
        try
        {
            await using var c = new NpgsqlConnection(builder.ConnectionString); await c.OpenAsync();
            await using (var setup = new NpgsqlCommand("""
                create schema auth;
                create table auth.users(id uuid primary key);
                create function auth.uid() returns uuid language sql stable as $$
                  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
                $$;
                do $$ begin
                  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
                  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
                end $$;
                grant usage on schema auth,public to authenticated;
                grant execute on function auth.uid() to authenticated;
                """, c)) await setup.ExecuteNonQueryAsync();
            var root = new DirectoryInfo(AppContext.BaseDirectory);
            while (root is not null && !Directory.Exists(Path.Combine(root.FullName, "supabase", "migrations"))) root = root.Parent;
            Assert.NotNull(root);
            var path = Directory.GetFiles(Path.Combine(root.FullName, "supabase", "migrations"), "*_energy_bills.sql").Single();
            await using (var migration = new NpgsqlCommand(await File.ReadAllTextAsync(path), c)) await migration.ExecuteNonQueryAsync();
            var owner = Guid.NewGuid(); var other = Guid.NewGuid();
            await using (var users = new NpgsqlCommand("insert into auth.users(id) values ($1),($2)", c))
            { users.Parameters.AddWithValue(owner); users.Parameters.AddWithValue(other); await users.ExecuteNonQueryAsync(); }
            await using var source = new AppDataSource(builder.ConnectionString);
            var store = new EnergyStore(source); var valid = EnergyEndpointTests.Valid;
            var saved = await store.SaveAsync(owner, null, valid, default); Assert.NotNull(saved);
            Assert.Equal(valid, saved.Summary); Assert.Single(await store.ListAsync(owner, default));
            Assert.Empty(await store.ListAsync(other, default));
            Assert.Null(await store.SaveAsync(other, saved.Id, valid, default));
            Assert.False(await store.DeleteAsync(other, saved.Id, default));
            var hidden = await source.ExecuteAsUserAsync(other, async (db, tx, ct) =>
            {
                await using var command = new NpgsqlCommand("select count(*) from public.energy_bills", db, tx);
                return (long)(await command.ExecuteScalarAsync(ct))!;
            });
            Assert.Equal(0, hidden);
            var reassignment = await Assert.ThrowsAsync<PostgresException>(() => source.ExecuteAsUserAsync(owner, async (db, tx, ct) =>
            {
                await using var command = new NpgsqlCommand("update public.energy_bills set user_id=$1", db, tx);
                command.Parameters.AddWithValue(other); return await command.ExecuteNonQueryAsync(ct);
            }));
            Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, reassignment.SqlState);
            var duplicate = await Assert.ThrowsAsync<PostgresException>(() => store.SaveAsync(owner, null, valid, default));
            Assert.Equal(PostgresErrorCodes.UniqueViolation, duplicate.SqlState);
            var duplicateInvoice = await Assert.ThrowsAsync<PostgresException>(() => store.SaveAsync(owner, null, valid with { DocumentHash = new string('b',64) }, default));
            Assert.Equal(PostgresErrorCodes.UniqueViolation, duplicateInvoice.SqlState);
            var otherSaved = await store.SaveAsync(other, null, valid, default); Assert.NotNull(otherSaved);
            var invalid = await Assert.ThrowsAsync<PostgresException>(() => store.SaveAsync(owner, null,
                valid with { InvoiceNumber = "INV-INVALID", DocumentHash = null, CurrentTotal = 100 }, default));
            Assert.Equal(PostgresErrorCodes.CheckViolation, invalid.SqlState);
            var updated = await store.SaveAsync(owner, saved.Id, valid with { PreviousBalance = 10, AmountDue = 89.09m }, default);
            Assert.NotNull(updated); Assert.Equal(89.09m, updated.Summary.AmountDue);
            Assert.Equal(79.09m, (await store.ListAsync(owner, default)).Single().Summary.CurrentTotal);
            Assert.True(await store.DeleteAsync(owner, saved.Id, default)); Assert.Empty(await store.ListAsync(owner, default));
            Assert.Single(await store.ListAsync(other, default));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {name} with (force);", admin); await drop.ExecuteNonQueryAsync();
        }
    }
}

public sealed class EnergyDatabaseFactAttribute : FactAttribute
{
    public EnergyDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ENERGY_TEST_DATABASE")))
            Skip = "Set ENERGY_TEST_DATABASE to a disposable PostgreSQL server.";
    }
}
