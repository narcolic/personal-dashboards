using System.Text.Json;

namespace PortfolioTerminal.Portfolio.Snapshots;

public interface IPortfolioSnapshotStore
{
    Task<IReadOnlyList<SnapshotTransaction>> ReadTransactionsAsync(
        CancellationToken cancellationToken = default);

    Task UpsertAsync(
        IReadOnlyList<PortfolioSnapshotRecord> records,
        CancellationToken cancellationToken = default);
}

public sealed record SnapshotTransaction(
    Guid Id,
    Guid UserId,
    string Ticker,
    string? Name,
    string? AssetType,
    string? Market,
    string? Currency,
    decimal Shares,
    decimal Price,
    DateOnly TransactionDate,
    Guid? PortfolioId,
    string? PortfolioName);

public sealed record PortfolioSnapshotRecord(
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
    JsonElement FxMetadata);
