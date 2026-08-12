using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Snapshots;

public sealed class PortfolioSnapshotQueries(AppDataSource dataSource) : IPortfolioSnapshotQueries
{
    public Task<IReadOnlyList<PortfolioSnapshotListItem>> ListAsync(
        Guid userId,
        int limit,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) =>
                ReadAsync(connection, transaction, userId, limit, token),
            cancellationToken);

    public Task<IReadOnlyList<PortfolioSnapshotListItem>> SearchAsync(
        Guid userId,
        string scopeKey,
        DateOnly dateFrom,
        DateOnly dateTo,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) =>
                ReadRangeAsync(connection, transaction, userId, scopeKey, dateFrom, dateTo, token),
            cancellationToken);

    private static async Task<IReadOnlyList<PortfolioSnapshotListItem>> ReadAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        int limit,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, snapshot_date, snapshot_at, scope, scope_key,
                   portfolio_id, portfolio_name,
                   market_value_eur::numeric, market_value_usd::numeric,
                   cost_basis_eur::numeric, cost_basis_usd::numeric,
                   unrealized_eur::numeric, unrealized_usd::numeric,
                   quote_metadata::text, fx_metadata::text,
                   created_at, updated_at
            from public.portfolio_value_snapshots
            where user_id = $1
            order by snapshot_date desc, scope, id
            limit $2;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = userId,
        });
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Integer,
            Value = limit,
        });

        var items = new List<PortfolioSnapshotListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            items.Add(new PortfolioSnapshotListItem(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetFieldValue<DateOnly>(2),
                reader.GetFieldValue<DateTimeOffset>(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetGuid(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.GetDecimal(8),
                reader.GetDecimal(9),
                reader.GetDecimal(10),
                reader.GetDecimal(11),
                reader.GetDecimal(12),
                reader.GetDecimal(13),
                JsonDocument.Parse(reader.GetString(14)).RootElement.Clone(),
                JsonDocument.Parse(reader.GetString(15)).RootElement.Clone(),
                reader.GetFieldValue<DateTimeOffset>(16),
                reader.GetFieldValue<DateTimeOffset>(17)));
        }

        return items;
    }

    private static async Task<IReadOnlyList<PortfolioSnapshotListItem>> ReadRangeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        string scopeKey,
        DateOnly dateFrom,
        DateOnly dateTo,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, snapshot_date, snapshot_at, scope, scope_key,
                   portfolio_id, portfolio_name,
                   market_value_eur::numeric, market_value_usd::numeric,
                   cost_basis_eur::numeric, cost_basis_usd::numeric,
                   unrealized_eur::numeric, unrealized_usd::numeric,
                   quote_metadata::text, fx_metadata::text,
                   created_at, updated_at
            from public.portfolio_value_snapshots
            where user_id = $1
              and scope_key = $2
              and snapshot_date between $3 and $4
            order by snapshot_date, id
            limit 2000;
            """;
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Uuid, Value = userId });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = scopeKey });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = dateFrom });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = dateTo });

        var items = new List<PortfolioSnapshotListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            items.Add(ReadItem(reader));
        }
        return items;
    }

    private static PortfolioSnapshotListItem ReadItem(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetGuid(1),
        reader.GetFieldValue<DateOnly>(2),
        reader.GetFieldValue<DateTimeOffset>(3),
        reader.GetString(4),
        reader.GetString(5),
        reader.IsDBNull(6) ? null : reader.GetGuid(6),
        reader.IsDBNull(7) ? null : reader.GetString(7),
        reader.GetDecimal(8),
        reader.GetDecimal(9),
        reader.GetDecimal(10),
        reader.GetDecimal(11),
        reader.GetDecimal(12),
        reader.GetDecimal(13),
        JsonDocument.Parse(reader.GetString(14)).RootElement.Clone(),
        JsonDocument.Parse(reader.GetString(15)).RootElement.Clone(),
        reader.GetFieldValue<DateTimeOffset>(16),
        reader.GetFieldValue<DateTimeOffset>(17));
}
