using System.Text.Json;

namespace PortfolioTerminal.Portfolio.Snapshots;

public interface IPortfolioSnapshotQueries
{
    Task<IReadOnlyList<PortfolioSnapshotListItem>> ListAsync(
        Guid userId,
        int limit,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PortfolioSnapshotListItem>> SearchAsync(
        Guid userId,
        string scopeKey,
        DateOnly dateFrom,
        DateOnly dateTo,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<PortfolioSnapshotListItem>>([]);
}

public sealed record PortfolioSnapshotListItem(
    Guid Id,
    Guid UserId,
    DateOnly SnapshotDate,
    DateTimeOffset SnapshotAt,
    string Scope,
    string ScopeKey,
    Guid? PortfolioId,
    string? PortfolioName,
    decimal MarketValueEur,
    decimal MarketValueUsd,
    decimal CostBasisEur,
    decimal CostBasisUsd,
    decimal UnrealizedEur,
    decimal UnrealizedUsd,
    JsonElement QuoteMetadata,
    JsonElement FxMetadata,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
