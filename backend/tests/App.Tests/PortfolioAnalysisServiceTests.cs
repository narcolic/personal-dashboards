using System.Text.Json;
using PortfolioTerminal.Portfolio.Analytics;
using PortfolioTerminal.Portfolio.Holdings;
using PortfolioTerminal.Portfolio.MarketData;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.Snapshots;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioAnalysisServiceTests
{
    private static readonly Guid UserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PortfolioId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly DateTimeOffset Now = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SummaryConvertsMarketValueCostAndDayChangeWithoutFallbacks()
    {
        var service = CreateService();

        var result = await service.GetSummaryAsync(UserId, "Growth", "EUR", 5);

        Assert.Equal("portfolio:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", result.Scope);
        Assert.Equal(1350m, result.Totals.MarketValue);
        Assert.Equal(900m, result.Totals.CostBasis);
        Assert.Equal(450m, result.Totals.UnrealizedPnl);
        Assert.Equal(45m, result.Totals.DayChange);
        Assert.Equal(50m, result.Totals.UnrealizedReturnPct);
        Assert.Single(result.TopPositions);
        Assert.Contains(result.Warnings, warning => warning.Code == "buy_only_cost_basis");
    }

    [Fact]
    public async Task MissingQuoteFailsClosed()
    {
        var service = CreateService(quotes: new QuoteLookupResult(
            [],
            [new QuoteFailure("MSFT", "not found")]));

        var exception = await Assert.ThrowsAsync<PortfolioAnalysisException>(() =>
            service.GetSummaryAsync(UserId, "all", "EUR", 5));

        Assert.Equal("market_data_incomplete", exception.Code);
    }

    [Fact]
    public async Task PurchaseSimulationDoesNotMutateAndReportsBeforeAfterConcentration()
    {
        var quotes = new QuoteLookupResult(
        [
            new("MSFT", "Microsoft", "Microsoft Corporation", 150m, 145m, "USD", null, null, null, "EQUITY"),
            new("GOOGL", "Alphabet", "Alphabet Inc.", 100m, 98m, "USD", null, null, null, "EQUITY"),
        ], []);
        var service = CreateService(quotes);

        var result = await service.SimulatePurchaseAsync(
            UserId,
            "Growth",
            "googl",
            900m,
            "EUR",
            "EUR");

        Assert.True(result.SimulationOnly);
        Assert.Equal(10m, result.Investment.EstimatedShares);
        Assert.Equal(1350m, result.BeforeAfter.PortfolioValueBefore);
        Assert.Equal(2250m, result.BeforeAfter.PortfolioValueAfter);
        Assert.Equal(40m, result.BeforeAfter.NewPositionWeightPct);
    }

    [Fact]
    public async Task HistoryIsTruthfullyLabelledAndBucketed()
    {
        var snapshots = new FakeSnapshotQueries(
        [
            Snapshot(new DateOnly(2026, 1, 1), 1000m, 800m),
            Snapshot(new DateOnly(2026, 1, 2), 1100m, 800m),
            Snapshot(new DateOnly(2026, 2, 1), 1200m, 850m),
        ]);
        var service = CreateService(snapshotQueries: snapshots);

        var result = await service.GetHistoryAsync(
            UserId,
            "all",
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 2, 28),
            "EUR",
            "monthly",
            60);

        Assert.Equal("portfolio_value_change", result.MetricKind);
        Assert.Equal(2, result.Points.Count);
        Assert.Equal(100m, result.Summary?.ValueChange);
        Assert.Contains(result.Warnings, warning => warning.Code == "not_investment_return");
    }

    private static PortfolioAnalysisService CreateService(
        QuoteLookupResult? quotes = null,
        IPortfolioSnapshotQueries? snapshotQueries = null) =>
        new(
            new FakePortfolioQueries(),
            new FakeHoldingQueries(),
            snapshotQueries ?? new FakeSnapshotQueries([]),
            new FakeQuoteService(quotes ?? new QuoteLookupResult(
            [
                new("MSFT", "Microsoft", "Microsoft Corporation", 150m, 145m, "USD", null, null, null, "EQUITY"),
            ], [])),
            new FakeFxRateService(),
            new FixedTimeProvider(Now));

    private static PortfolioSnapshotListItem Snapshot(DateOnly date, decimal value, decimal cost) =>
        new(
            Guid.NewGuid(),
            UserId,
            date,
            date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            "total",
            "total",
            null,
            null,
            value,
            value / 0.9m,
            cost,
            cost / 0.9m,
            value - cost,
            (value - cost) / 0.9m,
            JsonSerializer.SerializeToElement(new { }),
            JsonSerializer.SerializeToElement(new { }),
            Now,
            Now);

    private sealed class FakePortfolioQueries : IPortfolioQueries
    {
        public Task<IReadOnlyList<PortfolioListItem>> ListAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PortfolioListItem>>(
            [
                new(PortfolioId, "Growth", null, null),
            ]);
    }

    private sealed class FakeHoldingQueries : IPortfolioHoldingQueries
    {
        public Task<IReadOnlyList<PortfolioHolding>> ListAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PortfolioHolding>>(
            [
                new("MSFT", "MSFT", "Microsoft", "Stock", "NASDAQ", "USD", 10m, 100m, null, PortfolioId, 1, new(2025, 1, 1), new(2025, 1, 1)),
            ]);
    }

    private sealed class FakeQuoteService(QuoteLookupResult result) : IQuoteService
    {
        public Task<QuoteLookupResult> GetAsync(IReadOnlyList<string> symbols, CancellationToken cancellationToken = default)
        {
            var requested = result.Quotes
                .Where(quote => symbols.Contains(quote.Symbol, StringComparer.OrdinalIgnoreCase))
                .ToArray();
            var failures = result.Failed
                .Where(failure => symbols.Contains(failure.Symbol, StringComparer.OrdinalIgnoreCase))
                .ToArray();
            return Task.FromResult(new QuoteLookupResult(requested, failures));
        }
    }

    private sealed class FakeFxRateService : IFxRateService
    {
        public Task<JsonElement> GetAsync(string baseCurrency, CancellationToken cancellationToken = default) =>
            Task.FromResult(JsonSerializer.SerializeToElement(baseCurrency == "USD"
                ? new { rates = new Dictionary<string, decimal> { ["EUR"] = 0.9m } }
                : new { rates = new Dictionary<string, decimal> { ["USD"] = 1.111111111111m } }));
    }

    private sealed class FakeSnapshotQueries(IReadOnlyList<PortfolioSnapshotListItem> snapshots)
        : IPortfolioSnapshotQueries
    {
        public Task<IReadOnlyList<PortfolioSnapshotListItem>> ListAsync(Guid userId, int limit, CancellationToken cancellationToken = default) =>
            Task.FromResult(snapshots);

        public Task<IReadOnlyList<PortfolioSnapshotListItem>> SearchAsync(Guid userId, string scopeKey, DateOnly dateFrom, DateOnly dateTo, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PortfolioSnapshotListItem>>(
                [.. snapshots.Where(item => item.ScopeKey == scopeKey && item.SnapshotDate >= dateFrom && item.SnapshotDate <= dateTo)]);
    }

    private sealed class FixedTimeProvider(DateTimeOffset value) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => value;
    }
}
