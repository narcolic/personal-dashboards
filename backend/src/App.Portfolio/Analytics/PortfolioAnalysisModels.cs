namespace PortfolioTerminal.Portfolio.Analytics;

public sealed record PortfolioAnalysisScope(
    string Selector,
    Guid? PortfolioId,
    string DisplayName,
    bool IsAll,
    bool IsUnassigned);

public sealed record PortfolioAnalysisWarning(string Code, string Message);

public sealed record PortfolioAnalysisPosition(
    string Ticker,
    string? Name,
    string AssetType,
    decimal Quantity,
    string QuoteCurrency,
    decimal CurrentPrice,
    decimal CurrentValue,
    decimal CostBasis,
    decimal AverageCost,
    decimal UnrealizedPnl,
    decimal UnrealizedReturnPct,
    decimal DayChange,
    decimal WeightPct,
    IReadOnlyList<string> PortfolioRefs);

public sealed record PortfolioAnalysisTotals(
    decimal MarketValue,
    decimal CostBasis,
    decimal UnrealizedPnl,
    decimal UnrealizedReturnPct,
    decimal DayChange,
    decimal DayChangePct,
    int HoldingCount);

public sealed record PortfolioRankedPosition(
    string Ticker,
    decimal Value,
    decimal WeightPct,
    decimal UnrealizedPnl,
    decimal UnrealizedReturnPct);

public sealed record PortfolioSummaryResult(
    DateTimeOffset AsOf,
    string Scope,
    string Currency,
    PortfolioAnalysisTotals Totals,
    IReadOnlyList<PortfolioRankedPosition> TopPositions,
    IReadOnlyList<PortfolioRankedPosition> BestUnrealized,
    IReadOnlyList<PortfolioRankedPosition> WorstUnrealized,
    IReadOnlyList<PortfolioAnalysisWarning> Warnings);

public sealed record PortfolioHoldingsResult(
    DateTimeOffset AsOf,
    string Scope,
    string Currency,
    int Count,
    int TotalCount,
    IReadOnlyList<PortfolioAnalysisPosition> Holdings,
    IReadOnlyList<PortfolioAnalysisWarning> Warnings);

public sealed record PortfolioAllocationItem(string Label, decimal Value, decimal WeightPct);

public sealed record PortfolioAllocationResult(
    DateTimeOffset AsOf,
    string Scope,
    string Currency,
    string Dimension,
    decimal TotalValue,
    IReadOnlyList<PortfolioAllocationItem> Items,
    PortfolioAllocationItem? Other,
    IReadOnlyList<PortfolioAnalysisWarning> Warnings);

public sealed record PortfolioHistoryPoint(
    DateOnly Date,
    decimal MarketValue,
    decimal CostBasis,
    decimal UnrealizedPnl);

public sealed record PortfolioHistorySummary(
    decimal StartValue,
    decimal EndValue,
    decimal ValueChange,
    decimal ValueChangePct,
    decimal StartUnrealized,
    decimal EndUnrealized,
    decimal UnrealizedChange,
    decimal HighValue,
    decimal LowValue);

public sealed record PortfolioHistoryResult(
    DateTimeOffset AsOf,
    string Scope,
    string Currency,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    string MetricKind,
    PortfolioHistorySummary? Summary,
    IReadOnlyList<PortfolioHistoryPoint> Points,
    IReadOnlyList<PortfolioAnalysisWarning> Warnings);

public sealed record PortfolioSimulationQuote(
    string Ticker,
    string? Name,
    decimal Price,
    string Currency);

public sealed record PortfolioSimulationInvestment(
    decimal Amount,
    string Currency,
    decimal EstimatedShares);

public sealed record PortfolioSimulationBeforeAfter(
    decimal PortfolioValueBefore,
    decimal PortfolioValueAfter,
    decimal ExistingPositionWeightPct,
    decimal NewPositionWeightPct,
    decimal LargestPositionWeightPctBefore,
    decimal LargestPositionWeightPctAfter,
    decimal TopFiveWeightPctBefore,
    decimal TopFiveWeightPctAfter);

public sealed record PortfolioSimulationAllocationChanges(
    IReadOnlyList<PortfolioAllocationItem> AssetTypeBefore,
    IReadOnlyList<PortfolioAllocationItem> AssetTypeAfter,
    IReadOnlyList<PortfolioAllocationItem> CurrencyBefore,
    IReadOnlyList<PortfolioAllocationItem> CurrencyAfter);

public sealed record PortfolioSimulationResult(
    DateTimeOffset AsOf,
    string Scope,
    string Currency,
    bool SimulationOnly,
    PortfolioSimulationQuote Quote,
    PortfolioSimulationInvestment Investment,
    PortfolioSimulationBeforeAfter BeforeAfter,
    PortfolioSimulationAllocationChanges AllocationChanges,
    IReadOnlyList<PortfolioAnalysisWarning> Warnings);

public sealed class PortfolioAnalysisException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
