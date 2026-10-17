using System.Globalization;
using System.Text.Json;
using Npgsql;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.Snapshots;
using PortfolioTerminal.Portfolio.Cash;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioSnapshotDatabaseTests
{
    [ActivityDatabaseFact]
    public async Task LegacySnapshotListAndRangeReadRealTransactionColumnsWithoutDecimalCastErrors()
    {
        var adminString = Environment.GetEnvironmentVariable("ACTIVITY_TEST_DATABASE")!;
        var databaseName = "snapshots_qa_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"create database {databaseName};", admin))
            await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminString) { Database = databaseName, Pooling = false };
        try
        {
            var user = Guid.NewGuid();
            var other = Guid.NewGuid();
            var portfolio = Guid.NewGuid();
            var listing = Guid.NewGuid();
            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync();
            await using var seed = new NpgsqlCommand($"""
                do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then
                  create role authenticated nologin; end if; end $$;
                create table public.transactions (
                  id uuid primary key, user_id uuid, security_listing_id uuid, portfolio_id uuid,
                  transaction_currency text, action text, shares real, price double precision,
                  fee_amount real, cash_used real, settles_to_cash boolean,
                  transaction_date date, created_at timestamptz default now());
                create table public.portfolio_value_snapshots (
                  id uuid primary key default gen_random_uuid(), user_id uuid, snapshot_date date,
                  snapshot_at timestamptz, scope text, scope_key text, portfolio_id uuid, portfolio_name text,
                  market_value_eur numeric, market_value_usd numeric, cost_basis_eur numeric, cost_basis_usd numeric,
                  unrealized_eur numeric, unrealized_usd numeric, quote_metadata jsonb, fx_metadata jsonb,
                  created_at timestamptz default now(), updated_at timestamptz default now(),
                  cash_balance_eur numeric, cash_balance_usd numeric, total_value_eur numeric, total_value_usd numeric,
                  realized_eur numeric, realized_usd numeric, total_pnl_eur numeric, total_pnl_usd numeric,
                  external_flow_eur numeric, external_flow_usd numeric, accounting_version smallint,
                  unique(user_id, snapshot_date, scope_key));
                alter table public.transactions enable row level security;
                create table public.portfolio_cash_withdrawals (
                  id uuid primary key default gen_random_uuid(), user_id uuid, portfolio_id uuid,
                  currency text, amount numeric, withdrawal_date date);
                alter table public.portfolio_cash_withdrawals enable row level security;
                create policy own_withdrawals on public.portfolio_cash_withdrawals for select to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                alter table public.portfolio_value_snapshots enable row level security;
                create policy own_transactions on public.transactions for select to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                create policy own_snapshots on public.portfolio_value_snapshots for select to authenticated
                  using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
                grant usage on schema public to authenticated;
                grant select on all tables in schema public to authenticated;
                insert into public.transactions (id,user_id,security_listing_id,portfolio_id,transaction_currency,
                  action,shares,price,fee_amount,cash_used,settles_to_cash,transaction_date) values
                  (gen_random_uuid(),'{user}','{listing}','{portfolio}','EUR','buy',10,100,10,0,false,'2026-01-01'),
                  (gen_random_uuid(),'{user}','{listing}','{portfolio}','EUR','sell',4,150,5,0,true,'2026-02-01'),
                  (gen_random_uuid(),'{other}','{listing}','{portfolio}','EUR','buy',10,100,999,0,false,'2026-01-01');
                """, connection);
            await seed.ExecuteNonQueryAsync();
            await using (var raw = new NpgsqlCommand("select shares from public.transactions limit 1", connection))
            await using (var rawReader = await raw.ExecuteReaderAsync())
            {
                Assert.True(await rawReader.ReadAsync());
                Assert.Throws<InvalidCastException>(() => rawReader.GetDecimal(0));
            }
            await using var source = new AppDataSource(builder.ConnectionString);
            var record = new PortfolioSnapshotRecord(user, new(2026, 2, 1), DateTimeOffset.UtcNow,
                "total", "total", null, null, 900m, 1125m, 606m, 757.5m, 294m, 367.5m,
                JsonSerializer.SerializeToElement(new {}),
                JsonSerializer.SerializeToElement(new { rates = new { USD = 1m, EUR = 0.8m } }),
                CashBalanceEur: 595m, CashBalanceUsd: 743.75m, TotalValueEur: 1495m, TotalValueUsd: 1868.75m,
                RealizedEur: 191m, RealizedUsd: 238.75m, TotalPnlEur: 485m, TotalPnlUsd: 606.25m,
                AccountingVersion: 2);
            await new PortfolioSnapshotStore(source).UpsertAsync([
                record, record with { UserId = other },
                record with { Scope = "portfolio", ScopeKey = $"portfolio:{portfolio}", PortfolioId = portfolio },
                record with { SnapshotDate = new(2026, 2, 2), AccountingVersion = 3, CostBasisEur = 600m },
            ]);
            var queries = new PortfolioSnapshotQueries(source);
            var all = await queries.ListAsync(user, 1000);
            Assert.Equal(3, all.Count);
            Assert.All(all, row => Assert.Equal(user, row.UserId));
            Assert.All(all.Where(row => row.SnapshotDate == new DateOnly(2026, 2, 1)), row =>
            {
                Assert.Equal(4, row.AccountingVersion);
                Assert.Equal(600m, row.CostBasisEur);
                Assert.Equal(595m, row.CashBalanceEur);
                Assert.Equal(200m, row.RealizedEur);
                Assert.Equal(1495m, row.TotalValueEur);
            });
            Assert.Equal(600m, Assert.Single(all, row => row.SnapshotDate == new DateOnly(2026, 2, 2)).CostBasisEur);
            var range = await queries.SearchAsync(user, $"portfolio:{portfolio}", new(2026, 2, 1), new(2026, 2, 1));
            Assert.Equal(600m, Assert.Single(range).CostBasisEur);

            // A Friday close captured at Saturday midnight must be found by Friday's
            // range, with Friday's flows and the original captured values and FX.
            await using (var flows = new NpgsqlCommand($"""
                insert into public.transactions (id,user_id,security_listing_id,portfolio_id,transaction_currency,
                  action,shares,price,fee_amount,cash_used,settles_to_cash,transaction_date) values
                  (gen_random_uuid(),'{user}','{listing}','{portfolio}','EUR','buy',1,100,3,20,false,'2026-10-16'),
                  (gen_random_uuid(),'{other}','{listing}','{portfolio}','EUR','buy',1,999,3,0,false,'2026-10-16');
                insert into public.portfolio_cash_withdrawals (user_id,portfolio_id,currency,amount,withdrawal_date) values
                  ('{user}','{portfolio}','EUR',30,'2026-10-16'),
                  ('{other}','{portfolio}','EUR',999,'2026-10-16');
                """, connection))
                await flows.ExecuteNonQueryAsync();
            var midnight = record with {
                SnapshotDate = new(2026, 10, 17), SnapshotAt = DateTimeOffset.Parse("2026-10-16T21:00:05Z", CultureInfo.InvariantCulture),
                Scope = "portfolio", ScopeKey = $"portfolio:{portfolio}", PortfolioId = portfolio,
                AccountingVersion = 3, ExternalFlowEur = 999m, ExternalFlowUsd = 999m,
            };
            await new PortfolioSnapshotStore(source).UpsertAsync([
                midnight,
                midnight with {
                    SnapshotDate = new(2026, 10, 18), SnapshotAt = DateTimeOffset.Parse("2026-10-17T21:00:05Z", CultureInfo.InvariantCulture),
                    QuoteMetadata = JsonSerializer.SerializeToElement(new { valuationDate = "2026-10-17" }),
                    ExternalFlowEur = 200m,
                },
            ]);
            var friday = Assert.Single(await queries.SearchAsync(user, $"portfolio:{portfolio}", new(2026, 10, 16), new(2026, 10, 16)));
            Assert.Equal(new DateOnly(2026, 10, 16), friday.SnapshotDate);
            Assert.Equal(midnight.SnapshotAt, friday.SnapshotAt);
            Assert.Equal(midnight.MarketValueEur, friday.MarketValueEur);
            Assert.Equal(545m, friday.CashBalanceEur);
            Assert.Equal(50m, friday.ExternalFlowEur);
            Assert.Equal(62.5m, friday.ExternalFlowUsd);
            var saturday = Assert.Single(await queries.SearchAsync(user, $"portfolio:{portfolio}", new(2026, 10, 17), new(2026, 10, 17)));
            Assert.Equal(new DateOnly(2026, 10, 17), saturday.SnapshotDate);
            Assert.Equal(200m, saturday.ExternalFlowEur); // Already computed for the valuation day.
            Assert.Empty(await queries.SearchAsync(user, $"portfolio:{portfolio}", new(2026, 10, 18), new(2026, 10, 18)));
            var correctedList = await queries.ListAsync(user, 1000);
            Assert.Equal(saturday.SnapshotDate, correctedList[0].SnapshotDate);
            Assert.Equal(friday.SnapshotDate, correctedList[1].SnapshotDate);

            var emptiedPortfolio = Guid.NewGuid();
            var smallBalancePortfolio = Guid.NewGuid();
            await using (var cashSeed = new NpgsqlCommand($"""
                insert into public.transactions (id,user_id,security_listing_id,portfolio_id,transaction_currency,
                  action,shares,price,fee_amount,cash_used,settles_to_cash,transaction_date) values
                  (gen_random_uuid(),'{user}','{listing}','{emptiedPortfolio}','USD','sell',100,106.3484,0.05,0,true,'2026-10-16'),
                  (gen_random_uuid(),'{user}','{listing}','{smallBalancePortfolio}','USD','sell',1,1.04,0,0,true,'2026-10-16');
                insert into public.portfolio_cash_withdrawals (user_id,portfolio_id,currency,amount,withdrawal_date) values
                  ('{user}','{emptiedPortfolio}','USD',10634.79033203125,'2026-10-16'),
                  ('{user}','{smallBalancePortfolio}','USD',1,'2026-10-16');
                """, connection))
                await cashSeed.ExecuteNonQueryAsync();
            var cash = await new PortfolioCashQueries(source).ListAsync(user, new(2026, 10, 17));
            Assert.DoesNotContain(cash, row => row.PortfolioId == emptiedPortfolio);
            Assert.Equal(0.04m, Assert.Single(cash, row => row.PortfolioId == smallBalancePortfolio).AvailableAmount);
            var guardedCash = await source.ExecuteAsUserReadOnlyAsync(user, (cashConnection, cashTransaction, token) =>
                PortfolioAccountingGuard.GetAvailableCashAsync(cashConnection, cashTransaction, user, emptiedPortfolio,
                    "USD", new(2026, 10, 17), null, token));
            Assert.Equal(0m, guardedCash);
            Assert.False(PortfolioCashCalculator.Withdraw(guardedCash, 0.01m).Allowed);
            var phantomCashSnapshot = midnight with {
                PortfolioId = emptiedPortfolio, ScopeKey = $"portfolio:{emptiedPortfolio}",
                MarketValueEur = 0m, MarketValueUsd = 0m,
                CashBalanceEur = 0.04m, CashBalanceUsd = 0.04966796875m,
                TotalValueEur = 0.04m, TotalValueUsd = 0.04966796875m,
            };
            await new PortfolioSnapshotStore(source).UpsertAsync([phantomCashSnapshot]);
            var reconciled = Assert.Single(await queries.SearchAsync(user, $"portfolio:{emptiedPortfolio}", new(2026, 10, 16), new(2026, 10, 16)));
            Assert.Equal(0m, reconciled.CashBalanceEur);
            Assert.Equal(0m, reconciled.CashBalanceUsd);
            Assert.Equal(0m, reconciled.TotalValueEur);
            Assert.Equal(phantomCashSnapshot.TotalPnlEur, reconciled.TotalPnlEur);
            Assert.Equal(4, reconciled.AccountingVersion);
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"drop database {databaseName} with (force);", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
