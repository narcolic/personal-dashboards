using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Portfolio.TickerCatalog;

public sealed class TickerCatalogQueries(
    AppDataSource dataSource,
    ISecurityMetadataQueries metadataQueries) : ITickerCatalogQueries
{
    public async Task<IReadOnlyList<TickerCatalogListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var items = await dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) =>
                ReadAsync(connection, transaction, userId, token),
            cancellationToken).ConfigureAwait(false);
        var metadata = await metadataQueries.GetByListingIdsAsync(
            userId,
            items.Select(item => item.SecurityListingId).Distinct().ToArray(),
            cancellationToken).ConfigureAwait(false);
        return items.Select(item => metadata.TryGetValue(item.SecurityListingId, out var security)
            ? item with { Security = security }
            : throw new InvalidOperationException(
                $"Canonical security metadata is missing for catalog row {item.Id}."))
            .ToArray();
    }

    private static async Task<IReadOnlyList<TickerCatalogListItem>> ReadAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select catalog.id, catalog.user_id, catalog.is_active,
                   catalog.created_at, catalog.updated_at, catalog.security_listing_id
            from public.ticker_catalog catalog
            join public.security_listings listing on listing.id = catalog.security_listing_id
            where catalog.user_id = $1
            order by listing.symbol, catalog.id;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = userId,
        });

        var items = new List<TickerCatalogListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            items.Add(new TickerCatalogListItem(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetBoolean(2),
                reader.GetFieldValue<DateTimeOffset>(3),
                reader.GetFieldValue<DateTimeOffset>(4),
                reader.GetGuid(5)));
        }

        return items;
    }
}
