using System.Text.Json;
using PortfolioTerminal.Portfolio.Snapshots;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioSnapshotFeeAdjustmentTests
{
    private static readonly Guid User = Guid.NewGuid();
    private static readonly Guid Portfolio = Guid.NewGuid();
    private static readonly Guid Listing = Guid.NewGuid();
    private static readonly DateOnly Date = new(2026, 2, 1);

    [Fact]
    public void HistoricalQuotesAndFxArePreservedWhileAllFeeEffectsAreRemoved()
    {
        var old = Snapshot();
        var result = PortfolioSnapshotFeeAdjustment.Apply(old, [Trade("buy", 10, 100, 10), Trade("sell", 4, 150, 5)]);
        Assert.Equal(600m, result.CostBasisEur);
        Assert.Equal(750m, result.CostBasisUsd);
        Assert.Equal(300m, result.UnrealizedEur);
        Assert.Equal(200m, result.RealizedEur);
        Assert.Equal(595m, result.CashBalanceEur);
        Assert.Equal(1495m, result.TotalValueEur);
        Assert.Equal(500m, result.TotalPnlEur);
        Assert.Equal(625m, result.TotalPnlUsd);
        Assert.Equal(old.MarketValueEur, result.MarketValueEur);
        Assert.Equal(old.SnapshotAt, result.SnapshotAt);
        Assert.Equal(3, result.AccountingVersion);
        Assert.Equal(result, PortfolioSnapshotFeeAdjustment.Apply(result, [Trade("buy", 10, 100, 10)]));
    }

    [Fact]
    public void FeesAreExcludedFromInvestmentFlowsWithoutInventingSpendableCash()
    {
        var purchase = Trade("buy", 1, 100, 5) with { CashUsed = 105, TransactionDate = Date };
        var old = Snapshot() with { ExternalFlowEur = 0m, ExternalFlowUsd = 0m };
        var result = PortfolioSnapshotFeeAdjustment.Apply(old, [purchase]);
        Assert.Equal(old.CashBalanceEur, result.CashBalanceEur);
        Assert.Equal(0m, result.ExternalFlowEur);
    }

    [Fact]
    public void AdjustmentRespectsUserPortfolioDateAndFullyClosedPositions()
    {
        var history = new[] {
            Trade("buy", 10, 100, 10), Trade("sell", 10, 150, 5),
            Trade("buy", 1, 100, 99) with { UserId = Guid.NewGuid() },
            Trade("buy", 1, 100, 99) with { PortfolioId = Guid.NewGuid() },
            Trade("buy", 1, 100, 99) with { TransactionDate = Date.AddDays(1) },
        };
        var old = Snapshot();
        var result = PortfolioSnapshotFeeAdjustment.Apply(old, history);
        Assert.Equal(old.CostBasisEur, result.CostBasisEur);
        Assert.Equal(old.RealizedEur + 15m, result.RealizedEur);
        Assert.Equal(old.CashBalanceEur, result.CashBalanceEur);
    }

    private static SnapshotTransaction Trade(string action, decimal shares, decimal price, decimal fee) =>
        new(Guid.NewGuid(), User, Listing, "ABC", "EUR", shares, price,
            action == "buy" ? new(2026, 1, 1) : Date, Portfolio, "Main", action,
            FeeAmount: fee, SettlesToCash: action == "sell");

    private static PortfolioSnapshotListItem Snapshot() => new(
        Guid.NewGuid(), User, Date, DateTimeOffset.UtcNow, "portfolio", $"portfolio:{Portfolio}", Portfolio, "Main",
        900m, 1125m, 606m, 757.5m, 294m, 367.5m,
        JsonSerializer.SerializeToElement(new {}),
        JsonSerializer.SerializeToElement(new { rates = new { USD = 1m, EUR = 0.8m } }),
        DateTimeOffset.UtcNow, DateTimeOffset.UtcNow,
        CashBalanceEur: 595m, CashBalanceUsd: 743.75m,
        TotalValueEur: 1495m, TotalValueUsd: 1868.75m,
        RealizedEur: 191m, RealizedUsd: 238.75m,
        TotalPnlEur: 485m, TotalPnlUsd: 606.25m, AccountingVersion: 2);
}
