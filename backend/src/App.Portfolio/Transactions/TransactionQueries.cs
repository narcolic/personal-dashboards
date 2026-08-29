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
        var ids = result.Rows
            .Where(row => row.SecurityListingId is not null)
            .Select(row => row.SecurityListingId!.Value)
            .Distinct()
            .ToArray();
        var metadata = await metadataQueries.GetByListingIdsAsync(
            userId, ids, cancellationToken).ConfigureAwait(false);
        return result with
        {
            Rows = result.Rows.Select(row => row.SecurityListingId is { } listingId
                    && metadata.TryGetValue(listingId, out var security)
                ? row with { Security = security }
                : row).ToArray(),
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
            from public.transactions
            {whereClause};
            """);
        AddFilterParameters(countCommand, userId, filter, includePagination: false);
        batch.BatchCommands.Add(countCommand);

        var paginationClause = filter.Limit is null
            ? string.Empty
            : "limit @limit offset @offset";
        var rowsCommand = new NpgsqlBatchCommand($"""
            select id, ticker, action, name, asset_type, market, currency,
                   shares::numeric, price::numeric, transaction_date, notes, portfolio_id,
                   security_listing_id
            from public.transactions
            {whereClause}
            order by transaction_date desc, id
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
                reader.IsDBNull(1) ? null : reader.GetString(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetDecimal(7),
                reader.IsDBNull(8) ? null : reader.GetDecimal(8),
                reader.IsDBNull(9) ? null : reader.GetFieldValue<DateOnly>(9),
                reader.IsDBNull(10) ? null : reader.GetString(10),
                reader.IsDBNull(11) ? null : reader.GetGuid(11),
                reader.IsDBNull(12) ? null : reader.GetGuid(12)));
        }

        return new TransactionListResult(rows, count);
    }

    private static string BuildWhereClause(TransactionListFilter filter)
    {
        var sql = new StringBuilder("where user_id = @userId");

        if (!string.IsNullOrWhiteSpace(filter.Ticker))
        {
            sql.AppendLine().Append("""
                  and coalesce((
                    select listing.symbol
                    from public.security_listings listing
                    where listing.id = security_listing_id
                  ), ticker) ilike @ticker
                """);
        }

        if (filter.UnassignedPortfolio)
        {
            sql.AppendLine().Append("  and portfolio_id is null");
        }
        else if (filter.PortfolioId is not null)
        {
            sql.AppendLine().Append("  and portfolio_id = @portfolioId");
        }

        if (!string.IsNullOrWhiteSpace(filter.AssetType))
        {
            sql.AppendLine().Append("""
                  and coalesce((
                    select security.security_type_code
                    from public.security_listings listing
                    join public.securities security on security.id = listing.security_id
                    where listing.id = security_listing_id
                  ), asset_type) = @assetType
                """);
        }

        if (!string.IsNullOrWhiteSpace(filter.Currency))
        {
            sql.AppendLine().Append("  and currency = @currency");
        }

        if (filter.DateFrom is not null)
        {
            sql.AppendLine().Append("  and transaction_date >= @dateFrom");
        }

        if (filter.DateTo is not null)
        {
            sql.AppendLine().Append("  and transaction_date <= @dateTo");
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
