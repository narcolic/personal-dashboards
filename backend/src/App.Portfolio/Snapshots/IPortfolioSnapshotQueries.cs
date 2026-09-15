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
    DateTimeOffset UpdatedAt,
    decimal CashBalanceEur = 0m,
    decimal CashBalanceUsd = 0m,
    decimal TotalValueEur = 0m,
    decimal TotalValueUsd = 0m,
    decimal RealizedEur = 0m,
    decimal RealizedUsd = 0m,
    decimal TotalPnlEur = 0m,
    decimal TotalPnlUsd = 0m,
    decimal ExternalFlowEur = 0m,
    decimal ExternalFlowUsd = 0m,
    short AccountingVersion = 1);
