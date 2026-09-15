using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Snapshots;

public sealed class PortfolioSnapshotStore(AppDataSource dataSource) : IPortfolioSnapshotStore
{
    public Task<IReadOnlyList<SnapshotTransaction>> ReadTransactionsAsync(
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsSystemAsync(
            ReadTransactionsAsync,
            cancellationToken);

    public Task<IReadOnlyList<SnapshotWithdrawal>> ReadWithdrawalsAsync(
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsSystemAsync(ReadWithdrawalsAsync, cancellationToken);

    public async Task UpsertAsync(
        IReadOnlyList<PortfolioSnapshotRecord> records,
        CancellationToken cancellationToken = default)
    {
        await dataSource.ExecuteAsSystemAsync(
            async (connection, transaction, token) =>
            {
                foreach (var record in records)
                {
                    await UpsertOneAsync(connection, transaction, record, token)
                        .ConfigureAwait(false);
                }
                return true;
            },
            cancellationToken).ConfigureAwait(false);
    }

    private static async Task<IReadOnlyList<SnapshotTransaction>> ReadTransactionsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select t.id, t.user_id, t.security_listing_id, listing.symbol,
                   t.transaction_currency, t.shares::numeric, t.price::numeric,
                   t.transaction_date, t.portfolio_id, p.name,
                   t.action, t.cash_used::numeric, t.fee_amount::numeric,
                   t.settles_to_cash, t.created_at
            from public.transactions t
            left join public.security_listings listing on listing.id = t.security_listing_id
            left join public.portfolios p
              on p.id = t.portfolio_id and p.user_id = t.user_id
            where t.user_id is not null
            order by t.transaction_date, t.id;
            """;

        var rows = new List<SnapshotTransaction>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new SnapshotTransaction(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? 0m : reader.GetDecimal(5),
                reader.IsDBNull(6) ? 0m : reader.GetDecimal(6),
                reader.GetFieldValue<DateOnly>(7),
                reader.IsDBNull(8) ? null : reader.GetGuid(8),
                reader.IsDBNull(9) ? null : reader.GetString(9),
                reader.GetString(10),
                reader.GetDecimal(11),
                reader.GetDecimal(12),
                reader.GetBoolean(13),
                reader.GetFieldValue<DateTimeOffset>(14)));
        }
        return rows;
    }

    private static async Task<IReadOnlyList<SnapshotWithdrawal>> ReadWithdrawalsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select w.id, w.user_id, w.portfolio_id, p.name,
                   w.currency, w.amount::numeric, w.withdrawal_date
            from public.portfolio_cash_withdrawals w
            left join public.portfolios p on p.id = w.portfolio_id and p.user_id = w.user_id
            order by w.withdrawal_date, w.id;
            """;
        var rows = new List<SnapshotWithdrawal>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new(
                reader.GetGuid(0), reader.GetGuid(1),
                reader.IsDBNull(2) ? null : reader.GetGuid(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.GetString(4), reader.GetDecimal(5),
                reader.GetFieldValue<DateOnly>(6)));
        }
        return rows;
    }

    private static async Task UpsertOneAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        PortfolioSnapshotRecord record,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.portfolio_value_snapshots (
                user_id, snapshot_date, snapshot_at, scope, scope_key,
                portfolio_id, portfolio_name,
                market_value_eur, market_value_usd,
                cost_basis_eur, cost_basis_usd,
                unrealized_eur, unrealized_usd,
                quote_metadata, fx_metadata,
                cash_balance_eur, cash_balance_usd,
                total_value_eur, total_value_usd,
                realized_eur, realized_usd,
                total_pnl_eur, total_pnl_usd,
                external_flow_eur, external_flow_usd,
                accounting_version)
            values (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
            on conflict (user_id, snapshot_date, scope_key)
            do update set
                snapshot_at = excluded.snapshot_at,
                scope = excluded.scope,
                portfolio_id = excluded.portfolio_id,
                portfolio_name = excluded.portfolio_name,
                market_value_eur = excluded.market_value_eur,
                market_value_usd = excluded.market_value_usd,
                cost_basis_eur = excluded.cost_basis_eur,
                cost_basis_usd = excluded.cost_basis_usd,
                unrealized_eur = excluded.unrealized_eur,
                unrealized_usd = excluded.unrealized_usd,
                quote_metadata = excluded.quote_metadata,
                fx_metadata = excluded.fx_metadata,
                cash_balance_eur = excluded.cash_balance_eur,
                cash_balance_usd = excluded.cash_balance_usd,
                total_value_eur = excluded.total_value_eur,
                total_value_usd = excluded.total_value_usd,
                realized_eur = excluded.realized_eur,
                realized_usd = excluded.realized_usd,
                total_pnl_eur = excluded.total_pnl_eur,
                total_pnl_usd = excluded.total_pnl_usd,
                external_flow_eur = excluded.external_flow_eur,
                external_flow_usd = excluded.external_flow_usd,
                accounting_version = excluded.accounting_version;
            """;
        Add(command, NpgsqlDbType.Uuid, record.UserId);
        Add(command, NpgsqlDbType.Date, record.SnapshotDate);
        Add(command, NpgsqlDbType.TimestampTz, record.SnapshotAt);
        Add(command, NpgsqlDbType.Text, record.Scope);
        Add(command, NpgsqlDbType.Text, record.ScopeKey);
        Add(command, NpgsqlDbType.Uuid, record.PortfolioId);
        Add(command, NpgsqlDbType.Text, record.PortfolioName);
        Add(command, NpgsqlDbType.Numeric, record.MarketValueEur);
        Add(command, NpgsqlDbType.Numeric, record.MarketValueUsd);
        Add(command, NpgsqlDbType.Numeric, record.CostBasisEur);
        Add(command, NpgsqlDbType.Numeric, record.CostBasisUsd);
        Add(command, NpgsqlDbType.Numeric, record.UnrealizedEur);
        Add(command, NpgsqlDbType.Numeric, record.UnrealizedUsd);
        Add(command, NpgsqlDbType.Jsonb, JsonSerializer.Serialize(record.QuoteMetadata));
        Add(command, NpgsqlDbType.Jsonb, JsonSerializer.Serialize(record.FxMetadata));
        Add(command, NpgsqlDbType.Numeric, record.CashBalanceEur);
        Add(command, NpgsqlDbType.Numeric, record.CashBalanceUsd);
        Add(command, NpgsqlDbType.Numeric, record.TotalValueEur);
        Add(command, NpgsqlDbType.Numeric, record.TotalValueUsd);
        Add(command, NpgsqlDbType.Numeric, record.RealizedEur);
        Add(command, NpgsqlDbType.Numeric, record.RealizedUsd);
        Add(command, NpgsqlDbType.Numeric, record.TotalPnlEur);
        Add(command, NpgsqlDbType.Numeric, record.TotalPnlUsd);
        Add(command, NpgsqlDbType.Numeric, record.ExternalFlowEur);
        Add(command, NpgsqlDbType.Numeric, record.ExternalFlowUsd);
        Add(command, NpgsqlDbType.Smallint, record.AccountingVersion);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static void Add(NpgsqlCommand command, NpgsqlDbType type, object? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = type,
            Value = value ?? DBNull.Value,
        });
}
