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
            select t.id, t.user_id, t.ticker, t.name, t.asset_type, t.market,
                   t.currency, t.shares::numeric, t.price::numeric,
                   t.transaction_date, t.portfolio_id, p.name
            from public.transactions t
            left join public.portfolios p
              on p.id = t.portfolio_id and p.user_id = t.user_id
            where t.user_id is not null and t.ticker is not null
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
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? 0m : reader.GetDecimal(7),
                reader.IsDBNull(8) ? 0m : reader.GetDecimal(8),
                reader.GetFieldValue<DateOnly>(9),
                reader.IsDBNull(10) ? null : reader.GetGuid(10),
                reader.IsDBNull(11) ? null : reader.GetString(11)));
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
                quote_metadata, fx_metadata)
            values (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14, $15)
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
                fx_metadata = excluded.fx_metadata;
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
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static void Add(NpgsqlCommand command, NpgsqlDbType type, object? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = type,
            Value = value ?? DBNull.Value,
        });
}
