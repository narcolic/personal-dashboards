using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Portfolio.TickerCatalog;

public interface ITickerCatalogQueries
{
    Task<IReadOnlyList<TickerCatalogListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}

public sealed record TickerCatalogListItem(
    Guid Id,
    Guid UserId,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    Guid SecurityListingId,
    SecurityMetadataView? Security = null);
