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
    string Ticker,
    string? Name,
    string? AssetType,
    string? Market,
    string? Currency,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
