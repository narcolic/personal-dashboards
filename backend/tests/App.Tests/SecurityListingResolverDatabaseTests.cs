using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Tests;

public sealed class SecurityListingResolverDatabaseTests
{
    // Uses a disposable database, never the application's database.
    [SecurityListingDatabaseFact]
    public async Task NewEtfRegistersProvidersIsReusedAndRollsBackOnRefreshFailure()
    {
        var adminString = Environment.GetEnvironmentVariable("SECURITY_LISTING_TEST_DATABASE")!;
        var databaseName = "listing_qa_" + Guid.NewGuid().ToString("N");
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
            await using (var setup = new NpgsqlCommand("""
                create schema private;
                create table public.companies(id uuid primary key default gen_random_uuid(), legal_name text);
                create table public.securities(id uuid primary key default gen_random_uuid(),
                  security_type_code text, name text, company_id uuid references public.companies(id));
                create table public.exchanges(id uuid primary key, code text, mic text, name text);
                create table public.security_listings(id uuid primary key default gen_random_uuid(),
                  security_id uuid references public.securities(id), symbol text, exchange_id uuid,
                  trading_currency_code text, status text);
                create table public.security_listing_provider_identifiers(
                  listing_id uuid references public.security_listings(id), provider_code text,
                  provider_symbol text, last_verified_at timestamptz,
                  primary key(listing_id, provider_code), unique(provider_code, provider_symbol));
                create table private.security_metadata_refresh_state(
                  listing_id uuid references public.security_listings(id), provider_code text,
                  status text, next_attempt_at timestamptz, primary key(listing_id, provider_code));
                """, connection))
                await setup.ExecuteNonQueryAsync();

            await using var source = new AppDataSource(builder.ConnectionString);
            var resolver = new SecurityListingResolver(source);
            var request = new SecurityListingResolutionRequest(null, " new_etf ", null, "etf", null, "EUR");
            var created = await resolver.ResolveAsync(request);
            Assert.True(created.Created);
            Assert.Equal("NEW_ETF", created.Symbol);
            await using (var query = new NpgsqlCommand("""
                select s.security_type_code, l.trading_currency_code, l.status,
                       p.provider_symbol, r.status
                from public.security_listings l
                join public.securities s on s.id = l.security_id
                join public.security_listing_provider_identifiers p on p.listing_id = l.id
                join private.security_metadata_refresh_state r on r.listing_id = l.id
                where l.id = $1 and p.provider_code = 'yahoo' and r.provider_code = 'alpha_vantage';
                """, connection))
            {
                query.Parameters.AddWithValue(created.ListingId);
                await using var reader = await query.ExecuteReaderAsync();
                Assert.True(await reader.ReadAsync());
                Assert.Equal("etf", reader.GetString(0));
                Assert.Equal("EUR", reader.GetString(1));
                Assert.Equal("provisional", reader.GetString(2));
                Assert.Equal("NEW_ETF", reader.GetString(3));
                Assert.Equal("pending", reader.GetString(4));
                Assert.False(await reader.ReadAsync());
            }

            var reused = await resolver.ResolveAsync(request);
            Assert.False(reused.Created);
            Assert.Equal(created.ListingId, reused.ListingId);
            var byId = await resolver.ResolveAsync(request with { ListingId = created.ListingId });
            Assert.Equal(created.ListingId, byId.ListingId);

            // Force the final write to fail; none of the new listing may remain.
            await using (var constraint = new NpgsqlCommand("""
                alter table private.security_metadata_refresh_state
                add constraint reject_new_refresh check (status <> 'pending') not valid;
                """, connection))
                await constraint.ExecuteNonQueryAsync();
            var error = await Assert.ThrowsAsync<PostgresException>(() =>
                resolver.ResolveAsync(request with { Symbol = "FAIL_ETF" }));
            Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
            await using var counts = new NpgsqlCommand("""
                select (select count(*) from public.securities),
                       (select count(*) from public.security_listings),
                       (select count(*) from public.security_listing_provider_identifiers),
                       (select count(*) from private.security_metadata_refresh_state);
                """, connection);
            await using var countReader = await counts.ExecuteReaderAsync();
            Assert.True(await countReader.ReadAsync());
            for (var column = 0; column < 4; column++)
                Assert.Equal(1L, countReader.GetInt64(column));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {databaseName} with (force);", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}

public sealed class SecurityListingDatabaseFactAttribute : FactAttribute
{
    public SecurityListingDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SECURITY_LISTING_TEST_DATABASE")))
            Skip = "Set SECURITY_LISTING_TEST_DATABASE to a disposable PostgreSQL instance to run listing regression tests.";
    }
}
