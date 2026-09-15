using System.Text.Json;

namespace PortfolioTerminal.Portfolio.Snapshots;

public interface IPortfolioSnapshotStore
{
    Task<IReadOnlyList<SnapshotTransaction>> ReadTransactionsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SnapshotWithdrawal>> ReadWithdrawalsAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SnapshotWithdrawal>>([]);

    Task UpsertAsync(
        IReadOnlyList<PortfolioSnapshotRecord> records,
        CancellationToken cancellationToken = default);
}

public sealed record SnapshotTransaction(
    Guid Id,
    Guid UserId,
    Guid SecurityListingId,
    string Ticker,
    string? Currency,
    decimal Shares,
    decimal Price,
    DateOnly TransactionDate,
    Guid? PortfolioId,
    string? PortfolioName,
    string Action = "buy",
    decimal CashUsed = 0m,
    decimal FeeAmount = 0m,
    bool SettlesToCash = false,
    DateTimeOffset? CreatedAt = null);

public sealed record SnapshotWithdrawal(
    Guid Id,
    Guid UserId,
    Guid? PortfolioId,
    string? PortfolioName,
    string Currency,
    decimal Amount,
    DateOnly WithdrawalDate);

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
    JsonElement FxMetadata,
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
    short AccountingVersion = 2);
