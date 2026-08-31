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
            items.Where(item => item.SecurityListingId is not null)
                .Select(item => item.SecurityListingId!.Value).Distinct().ToArray(),
            cancellationToken).ConfigureAwait(false);
        return items.Select(item => item.SecurityListingId is { } listingId
                && metadata.TryGetValue(listingId, out var security)
            ? item with
            {
                Ticker = security.Symbol,
                Name = security.Name,
                AssetType = security.SecurityType,
                Market = security.ExchangeName ?? security.ExchangeMic,
                Currency = security.TradingCurrency,
                Security = security,
            }
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
            select catalog.id, catalog.user_id, listing.symbol, security.name,
                   security.security_type_code, coalesce(exchange.name, exchange.mic),
                   listing.trading_currency_code, catalog.is_active,
                   catalog.created_at, catalog.updated_at, catalog.security_listing_id
            from public.ticker_catalog catalog
            left join public.security_listings listing on listing.id = catalog.security_listing_id
            left join public.securities security on security.id = listing.security_id
            left join public.exchanges exchange on exchange.id = listing.exchange_id
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
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.GetBoolean(7),
                reader.GetFieldValue<DateTimeOffset>(8),
                reader.GetFieldValue<DateTimeOffset>(9),
                reader.IsDBNull(10) ? null : reader.GetGuid(10)));
        }

        return items;
    }
}
