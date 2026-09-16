using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.Activity;
using PortfolioTerminal.Portfolio.SecurityMetadata;
using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Tests;

public sealed class ActivityDatabaseTests
{
    private static readonly string[] ExpectedKinds = ["transaction", "withdrawal", "transaction", "transaction"];
    private static readonly string[] Directions = ["asc", "desc"];
    // Run against a disposable PostgreSQL instance, never an application database.
    [ActivityDatabaseFact]
    public async Task MixedHistoryIsFilteredSortedPaginatedAndIsolatedInPostgres()
    {
        var adminString = Environment.GetEnvironmentVariable("ACTIVITY_TEST_DATABASE")!;
        var databaseName = "activity_qa_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"create database {databaseName};", admin))
            await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminString) { Database = databaseName, Pooling = false };
        try
        {
            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync();
            var user = Guid.Parse(TestAuthHandler.UserId);
            var other = Guid.NewGuid(); var portfolio = Guid.NewGuid();
            var listing = Guid.NewGuid(); var secondListing = Guid.NewGuid();
            await using var seed = new NpgsqlCommand($"""
                do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then
                  create role authenticated nologin; end if; end $$;
                create table public.portfolios (id uuid primary key, user_id uuid, name text);
                create table public.securities (id uuid primary key, security_type_code text);
                create table public.security_listings (id uuid primary key, security_id uuid, symbol text);
                create table public.transactions (id uuid primary key, user_id uuid, action text,
                  transaction_currency text, shares numeric, price numeric, transaction_date date,
                  notes text, portfolio_id uuid, security_listing_id uuid, cash_used numeric default 0,
                  fee_amount numeric default 0, settles_to_cash boolean default false);
                create table public.portfolio_cash_withdrawals (id uuid primary key, user_id uuid,
                  currency text, amount numeric, withdrawal_date date, notes text, portfolio_id uuid);
                alter table public.transactions enable row level security;
                alter table public.portfolio_cash_withdrawals enable row level security;
                alter table public.portfolios enable row level security;
                create policy own_transactions on public.transactions for select to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                create policy own_withdrawals on public.portfolio_cash_withdrawals for select to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                create policy own_portfolios on public.portfolios for select to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                grant usage on schema public to authenticated;
                grant select on all tables in schema public to authenticated;
                insert into public.portfolios values ('{portfolio}', '{user}', 'Main');
                insert into public.securities values ('{listing}', 'stock'), ('{secondListing}', 'stock');
                insert into public.security_listings values
                  ('{listing}', '{listing}', 'AAPL'), ('{secondListing}', '{secondListing}', 'MSFT');
                insert into public.transactions (id,user_id,action,transaction_currency,shares,price,
                  transaction_date,portfolio_id,security_listing_id,fee_amount) values
                  ('00000000-0000-0000-0000-000000000001','{user}','buy','USD',2,10,'2026-09-16','{portfolio}','{listing}',1),
                  ('00000000-0000-0000-0000-000000000002','{user}','sell','USD',1,30,'2026-09-14','{portfolio}','{secondListing}',2),
                  ('00000000-0000-0000-0000-000000000003','{user}','buy','USD',1,5,'2026-09-15',null,'{listing}',0),
                  ('00000000-0000-0000-0000-000000000004','{other}','buy','USD',1,999,'2026-09-16',null,'{listing}',0);
                insert into public.portfolio_cash_withdrawals values
                  ('00000000-0000-0000-0000-000000000005','{user}','EUR',125,'2026-09-16',null,'{portfolio}'),
                  ('00000000-0000-0000-0000-000000000006','{other}','EUR',999,'2026-09-16',null,null);
                """, connection);
            await seed.ExecuteNonQueryAsync();
            await using var source = new AppDataSource(builder.ConnectionString);
            var metadata = new TestMetadata(listing);
            var queries = new ActivityQueries(source, metadata);
            var allFilter = new TransactionListFilter(null, null, false, null, null, null, null, null, null);
            var all = await queries.ListAsync(user, new ActivityListFilter(allFilter));
            Assert.Equal(4, all.Count);
            Assert.Equal(ExpectedKinds, all.Rows.Select(row => row.Kind));
            Assert.Equal(20m, all.Rows[0].Amount); // Table totals remain gross, even with a fee.
            Assert.Equal(125m, all.Rows[1].Amount);
            Assert.Null(all.Rows[1].Security);
            Assert.NotNull(all.Rows[0].Security);
            Assert.Equal(user, metadata.LastUser);
            var paged = allFilter with { Offset = 1, Limit = 2 };
            var page = await queries.ListAsync(user, new ActivityListFilter(paged));
            Assert.Equal(4, page.Count);
            Assert.Equal(all.Rows.Skip(1).Take(2).Select(row => row.Id), page.Rows.Select(row => row.Id));
            Assert.Equal(page.Rows.Select(row => row.Id), (await queries.ListAsync(user, new ActivityListFilter(paged))).Rows.Select(row => row.Id));
            Assert.Equal(2, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { Ticker = "aap" }))).Count);
            Assert.Equal(3, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { AssetType = "stock" }))).Count);
            Assert.Equal(3, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { PortfolioId = portfolio }))).Count);
            Assert.Equal(1, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { UnassignedPortfolio = true }))).Count);
            Assert.Equal(1, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { Currency = "eur" }))).Count);
            Assert.Equal(2, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { DateFrom = new DateOnly(2026, 9, 16) }))).Count);
            Assert.Equal(1, (await queries.ListAsync(user, new ActivityListFilter(allFilter with { DateTo = new DateOnly(2026, 9, 14) }))).Count);
            foreach (var key in ActivityQueries.SortColumns.Keys)
            foreach (var direction in Directions)
            {
                var sorted = await queries.ListAsync(user, new ActivityListFilter(allFilter, key, direction));
                Assert.Equal(4, sorted.Rows.Count);
                if (key is "ticker" or "asset_type" or "shares" or "price") Assert.Equal("withdrawal", sorted.Rows[^1].Kind);
            }
            var otherRows = await queries.ListAsync(other, new ActivityListFilter(allFilter));
            Assert.Equal(2, otherRows.Count);
            Assert.All(otherRows.Rows, row => Assert.Equal(999m, row.Amount));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {databaseName} with (force);", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private sealed class TestMetadata(Guid listing) : ISecurityMetadataQueries
    {
        public Guid LastUser { get; private set; }
        public Task<IReadOnlyDictionary<Guid, SecurityMetadataView>> GetByListingIdsAsync(Guid userId,
            IReadOnlyCollection<Guid> listingIds, CancellationToken cancellationToken = default)
        {
            LastUser = userId;
            return Task.FromResult<IReadOnlyDictionary<Guid, SecurityMetadataView>>(listingIds.ToDictionary(id => id,
                id => new SecurityMetadataView(id, id, id == listing ? "AAPL" : "MSFT", "Security", "stock", "XNAS", "Nasdaq", "USD",
                    null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, "succeeded", DateTimeOffset.UtcNow, false)));
        }
    }
}

public sealed class ActivityDatabaseFactAttribute : FactAttribute
{
    public ActivityDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ACTIVITY_TEST_DATABASE")))
            Skip = "Set ACTIVITY_TEST_DATABASE to a disposable PostgreSQL instance to run database regression tests.";
    }
}
