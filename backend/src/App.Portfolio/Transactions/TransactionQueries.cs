using System.Text;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Portfolio.Transactions;

public sealed class TransactionQueries(
    AppDataSource dataSource,
    ISecurityMetadataQueries metadataQueries) : ITransactionQueries
{
    public async Task<TransactionListResult> ListAsync(
        Guid userId,
        TransactionListFilter filter,
        CancellationToken cancellationToken = default)
    {
        var result = await dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) =>
                ReadTransactionsAsync(connection, transaction, userId, filter, token),
            cancellationToken).ConfigureAwait(false);
        var ids = result.Rows.Select(row => row.SecurityListingId).Distinct().ToArray();
        var metadata = await metadataQueries.GetByListingIdsAsync(
            userId, ids, cancellationToken).ConfigureAwait(false);
        return result with
        {
            Rows = result.Rows.Select(row => metadata.TryGetValue(row.SecurityListingId, out var security)
                ? row with { Security = security }
                : throw new InvalidOperationException(
                    $"Canonical security metadata is missing for transaction {row.Id}."))
                .ToArray(),
        };
    }

    private static async Task<TransactionListResult> ReadTransactionsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        TransactionListFilter filter,
        CancellationToken cancellationToken)
    {
        var whereClause = BuildWhereClause(filter);
        await using var batch = new NpgsqlBatch(connection, transaction);

        var countCommand = new NpgsqlBatchCommand($"""
            select count(*)::bigint
            from public.transactions t
            left join public.security_listings listing on listing.id = t.security_listing_id
            left join public.securities security on security.id = listing.security_id
            {whereClause};
            """);
        AddFilterParameters(countCommand, userId, filter, includePagination: false);
        batch.BatchCommands.Add(countCommand);

        var paginationClause = filter.Limit is null
            ? string.Empty
            : "limit @limit offset @offset";
        var rowsCommand = new NpgsqlBatchCommand($"""
            select t.id, t.action, t.transaction_currency,
                   t.shares::numeric, t.price::numeric, t.transaction_date, t.notes, t.portfolio_id,
                   t.security_listing_id
            from public.transactions t
            join public.security_listings listing on listing.id = t.security_listing_id
            join public.securities security on security.id = listing.security_id
            {whereClause}
            order by t.transaction_date desc, t.id
            {paginationClause};
            """);
        AddFilterParameters(rowsCommand, userId, filter, includePagination: true);
        batch.BatchCommands.Add(rowsCommand);

        await using var reader = await batch.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        await reader.ReadAsync(cancellationToken).ConfigureAwait(false);
        var count = reader.GetInt64(0);

        var rows = new List<TransactionListItem>();
        await reader.NextResultAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new TransactionListItem(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetDecimal(3),
                reader.GetDecimal(4),
                reader.GetFieldValue<DateOnly>(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetGuid(7),
                reader.GetGuid(8)));
        }

        return new TransactionListResult(rows, count);
    }

    private static string BuildWhereClause(TransactionListFilter filter)
    {
        var sql = new StringBuilder("where t.user_id = @userId");

        if (!string.IsNullOrWhiteSpace(filter.Ticker))
        {
            sql.AppendLine().Append("  and listing.symbol ilike @ticker");
        }

        if (filter.UnassignedPortfolio)
        {
            sql.AppendLine().Append("  and t.portfolio_id is null");
        }
        else if (filter.PortfolioId is not null)
        {
            sql.AppendLine().Append("  and t.portfolio_id = @portfolioId");
        }

        if (!string.IsNullOrWhiteSpace(filter.AssetType))
        {
            sql.AppendLine().Append("  and security.security_type_code = @assetType");
        }

        if (!string.IsNullOrWhiteSpace(filter.Currency))
        {
            sql.AppendLine().Append("  and t.transaction_currency = @currency");
        }

        if (filter.DateFrom is not null)
        {
            sql.AppendLine().Append("  and t.transaction_date >= @dateFrom");
        }

        if (filter.DateTo is not null)
        {
            sql.AppendLine().Append("  and t.transaction_date <= @dateTo");
        }

        return sql.ToString();
    }

    private static void AddFilterParameters(
        NpgsqlBatchCommand command,
        Guid userId,
        TransactionListFilter filter,
        bool includePagination)
    {
        AddParameter(command, "userId", NpgsqlDbType.Uuid, userId);

        if (!string.IsNullOrWhiteSpace(filter.Ticker))
        {
            AddParameter(command, "ticker", NpgsqlDbType.Text, $"%{filter.Ticker.Trim()}%");
        }

        if (!filter.UnassignedPortfolio && filter.PortfolioId is not null)
        {
            AddParameter(command, "portfolioId", NpgsqlDbType.Uuid, filter.PortfolioId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.AssetType))
        {
            AddParameter(command, "assetType", NpgsqlDbType.Text, filter.AssetType);
        }

        if (!string.IsNullOrWhiteSpace(filter.Currency))
        {
            AddParameter(command, "currency", NpgsqlDbType.Text, filter.Currency);
        }

        if (filter.DateFrom is not null)
        {
            AddParameter(command, "dateFrom", NpgsqlDbType.Date, filter.DateFrom.Value);
        }

        if (filter.DateTo is not null)
        {
            AddParameter(command, "dateTo", NpgsqlDbType.Date, filter.DateTo.Value);
        }

        if (includePagination && filter.Limit is not null)
        {
            AddParameter(command, "limit", NpgsqlDbType.Integer, filter.Limit.Value);
            AddParameter(command, "offset", NpgsqlDbType.Integer, filter.Offset ?? 0);
        }
    }

    private static void AddParameter(
        NpgsqlBatchCommand command,
        string name,
        NpgsqlDbType type,
        object value) =>
        command.Parameters.Add(new NpgsqlParameter(name, type) { Value = value });
}
