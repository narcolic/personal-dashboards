using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Portfolio.Holdings;

public interface IPortfolioHoldingQueries
{
    Task<IReadOnlyList<PortfolioHolding>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}

public sealed record PortfolioHolding(
    string Id,
    string Ticker,
    string? Name,
    string AssetType,
    string? Market,
    string Currency,
    decimal Shares,
    decimal AvgCost,
    string? Notes,
    Guid? PortfolioId,
    int TransactionCount,
    DateOnly? FirstDate,
    DateOnly? LastDate,
    Guid? SecurityListingId = null,
    SecurityMetadataView? Security = null);
