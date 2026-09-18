using System.Text.Json;
using PortfolioTerminal.Portfolio.MarketData;
using PortfolioTerminal.Portfolio.Snapshots;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioSnapshotJobTests
{
    [Fact]
    public async Task ForcedRunCalculatesAndUpsertsTotalAndPortfolioSnapshots()
    {
        var userId = Guid.Parse("4d089c0f-9bb8-4d74-b4bf-6048b1b07044");
        var portfolioId = Guid.Parse("df912e75-1c7b-4767-a798-110a636aa3c8");
        var store = new RecordingStore(
        [
            Transaction(userId, portfolioId, 2m, 100m, new DateOnly(2026, 1, 1)),
            Transaction(userId, portfolioId, 3m, 120m, new DateOnly(2026, 2, 1)),
        ]);
        var quotes = new FixedQuoteService(new QuoteLookupResult(
        [
            new MarketQuote("ABC", "ABC", "ABC Fund", 150m, 145m, "EUR", "XETRA", "GER", null, "ETF"),
        ],
        []));
        var fx = new FixedFxRateService(JsonSerializer.SerializeToElement(new
        {
            @base = "USD",
            rates = new { USD = 1m, EUR = 0.8m },
        }));
        var now = new DateTimeOffset(2026, 8, 11, 12, 0, 0, TimeSpan.Zero);
        var job = new PortfolioSnapshotJob(store, quotes, fx, new FixedTimeProvider(now));

        var result = await job.RunAsync(new PortfolioSnapshotRunRequest(
            Force: true,
            Date: new DateOnly(2026, 8, 10)));

        Assert.False(result.Skipped);
        Assert.Equal(2, result.Rows);
        Assert.Equal(1, result.Users);
        Assert.Equal(1, result.Symbols);
        Assert.Equal(2, store.Upserted.Count);

        var total = Assert.Single(store.Upserted, record => record.Scope == "total");
        Assert.Equal(750m, total.MarketValueEur);
        Assert.Equal(937.5m, total.MarketValueUsd);
        Assert.Equal(560m, total.CostBasisEur);
        Assert.Equal(700m, total.CostBasisUsd);
        Assert.Equal(190m, total.UnrealizedEur);
        Assert.Equal(237.5m, total.UnrealizedUsd);
        Assert.Equal(new DateOnly(2026, 8, 10), total.SnapshotDate);

        var portfolio = Assert.Single(store.Upserted, record => record.Scope == "portfolio");
        Assert.Equal(portfolioId, portfolio.PortfolioId);
        Assert.Equal("Main", portfolio.PortfolioName);
    }

    [Fact]
    public async Task ScheduledRunOutsideAthensMidnightWindowDoesNotReadOrWriteData()
    {
        var store = new RecordingStore([]);
        var now = new DateTimeOffset(2026, 8, 11, 12, 0, 0, TimeSpan.Zero);
        var job = new PortfolioSnapshotJob(
            store,
            new FixedQuoteService(new QuoteLookupResult([], [])),
            new FixedFxRateService(JsonSerializer.SerializeToElement(new { rates = new { USD = 1m } })),
            new FixedTimeProvider(now));

        var result = await job.RunAsync(new PortfolioSnapshotRunRequest());

        Assert.True(result.Skipped);
        Assert.Equal("outside_athens_midnight_window", result.Reason);
        Assert.Equal(0, store.ReadCount);
        Assert.Empty(store.Upserted);
    }

    [Fact]
    public async Task IncompleteQuoteDataDoesNotWritePartialSnapshot()
    {
        var userId = Guid.Parse("4d089c0f-9bb8-4d74-b4bf-6048b1b07044");
        var store = new RecordingStore(
        [Transaction(userId, null, 1m, 100m, new DateOnly(2026, 1, 1))]);
        var job = new PortfolioSnapshotJob(
            store,
            new FixedQuoteService(new QuoteLookupResult([], [new QuoteFailure("ABC", "Unavailable")])),
            new FixedFxRateService(JsonSerializer.SerializeToElement(new { rates = new { USD = 1m } })),
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 11, 12, 0, 0, TimeSpan.Zero)));

        var result = await job.RunAsync(new PortfolioSnapshotRunRequest(Force: true));

        Assert.True(result.Skipped);
        Assert.Equal("incomplete_quote_data", result.Reason);
        Assert.Contains("ABC", result.FailedSymbols);
        Assert.Empty(store.Upserted);
    }

    [Fact]
    public async Task SellRetainsCashAndRealizedPnlWithoutReducingTotalValue()
    {
        var userId = Guid.NewGuid();
        var portfolioId = Guid.NewGuid();
        var store = new RecordingStore([
            Transaction(userId, portfolioId, 10m, 100m, new DateOnly(2026, 1, 1)),
            Transaction(userId, portfolioId, 4m, 150m, new DateOnly(2026, 8, 10), "sell", true),
        ]);
        var quotes = new FixedQuoteService(new QuoteLookupResult(
            [new MarketQuote("ABC", "ABC", "ABC Fund", 150m, 145m, "EUR", null, null, null, "ETF")], []));
        var fx = new FixedFxRateService(JsonSerializer.SerializeToElement(new
        {
            @base = "USD",
            rates = new { USD = 1m, EUR = 1m },
        }));
        var job = new PortfolioSnapshotJob(
            store, quotes, fx,
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 10, 22, 0, 0, TimeSpan.Zero)));

        await job.RunAsync(new PortfolioSnapshotRunRequest(Force: true, Date: new(2026, 8, 10)));

        var total = Assert.Single(store.Upserted, row => row.Scope == "total");
        Assert.Equal(900m, total.MarketValueEur);
        Assert.Equal(600m, total.CashBalanceEur);
        Assert.Equal(1500m, total.TotalValueEur);
        Assert.Equal(200m, total.RealizedEur);
        Assert.Equal(300m, total.UnrealizedEur);
        Assert.Equal(500m, total.TotalPnlEur);
        Assert.Equal(0m, total.ExternalFlowEur);
    }

    [Fact]
    public async Task LaterSameDayPurchasePreservesRealizedSnapshotAndRemainingBasis()
    {
        var userId = Guid.NewGuid();
        var portfolioId = Guid.NewGuid();
        var date = new DateOnly(2026, 8, 10);
        var sale = Transaction(userId, portfolioId, 5m, 120m, date, "sell", true) with
        {
            CreatedAt = new DateTimeOffset(2026, 8, 10, 10, 0, 0, TimeSpan.Zero),
        };
        var buy = Transaction(userId, portfolioId, 5m, 200m, date, cashUsed: 600m) with
        {
            CreatedAt = new DateTimeOffset(2026, 8, 10, 11, 0, 0, TimeSpan.Zero),
        };
        var store = new RecordingStore([
            buy, sale,
            Transaction(userId, portfolioId, 10m, 100m, new DateOnly(2026, 1, 1)),
        ]);
        var job = new PortfolioSnapshotJob(
            store,
            new FixedQuoteService(new QuoteLookupResult(
                [new MarketQuote("ABC", "ABC", "ABC Fund", 150m, 145m, "EUR", null, null, null, "ETF")], [])),
            new FixedFxRateService(JsonSerializer.SerializeToElement(new
            {
                @base = "USD",
                rates = new { USD = 1m, EUR = 1m },
            })),
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 10, 22, 0, 0, TimeSpan.Zero)));

        await job.RunAsync(new PortfolioSnapshotRunRequest(Force: true, Date: date));

        var total = Assert.Single(store.Upserted, row => row.Scope == "total");
        Assert.Equal(100m, total.RealizedEur);
        Assert.Equal(1500m, total.CostBasisEur);
        Assert.Equal(0m, total.CashBalanceEur);
    }

    [Fact]
    public async Task WithdrawalReducesCashWithoutChangingInvestmentPnl()
    {
        var userId = Guid.NewGuid();
        var portfolioId = Guid.NewGuid();
        var date = new DateOnly(2026, 8, 10);
        var store = new RecordingStore(
        [
            Transaction(userId, portfolioId, 10m, 100m, new DateOnly(2026, 1, 1)),
            Transaction(userId, portfolioId, 4m, 150m, date, "sell", true),
        ],
        [
            new SnapshotWithdrawal(Guid.NewGuid(), userId, portfolioId, "Main", "EUR", 400m, date),
        ]);
        var job = new PortfolioSnapshotJob(
            store,
            new FixedQuoteService(new QuoteLookupResult(
                [new MarketQuote("ABC", "ABC", "ABC Fund", 150m, 145m, "EUR", null, null, null, "ETF")], [])),
            new FixedFxRateService(JsonSerializer.SerializeToElement(new
            { @base = "USD", rates = new { USD = 1m, EUR = 1m } })),
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 10, 22, 0, 0, TimeSpan.Zero)));

        await job.RunAsync(new PortfolioSnapshotRunRequest(Force: true, Date: date));

        var total = Assert.Single(store.Upserted, row => row.Scope == "total");
        Assert.Equal(200m, total.CashBalanceEur);
        Assert.Equal(1100m, total.TotalValueEur);
        Assert.Equal(500m, total.TotalPnlEur);
        Assert.Equal(-400m, total.ExternalFlowEur);
    }

    [Fact]
    public async Task ReinvestingSaleCashIsNotAnExternalFlow()
    {
        var userId = Guid.NewGuid();
        var portfolioId = Guid.NewGuid();
        var snapshotDate = new DateOnly(2026, 8, 10);
        var store = new RecordingStore([
            Transaction(userId, portfolioId, 10m, 100m, new DateOnly(2026, 1, 1)),
            Transaction(userId, portfolioId, 4m, 150m, new DateOnly(2026, 8, 9), "sell", true),
            Transaction(userId, portfolioId, 4m, 125m, snapshotDate, cashUsed: 500m),
        ]);
        var job = new PortfolioSnapshotJob(
            store,
            new FixedQuoteService(new QuoteLookupResult(
                [new MarketQuote("ABC", "ABC", "ABC Fund", 150m, 145m, "EUR", null, null, null, "ETF")], [])),
            new FixedFxRateService(JsonSerializer.SerializeToElement(new
            { @base = "USD", rates = new { USD = 1m, EUR = 1m } })),
            new FixedTimeProvider(new DateTimeOffset(2026, 8, 10, 22, 0, 0, TimeSpan.Zero)));

        await job.RunAsync(new PortfolioSnapshotRunRequest(Force: true, Date: snapshotDate));

        var total = Assert.Single(store.Upserted, row => row.Scope == "total");
        Assert.Equal(100m, total.CashBalanceEur);
        Assert.Equal(1600m, total.TotalValueEur);
        Assert.Equal(600m, total.TotalPnlEur);
        Assert.Equal(0m, total.ExternalFlowEur);
    }

    private static SnapshotTransaction Transaction(
        Guid userId,
        Guid? portfolioId,
        decimal shares,
        decimal price,
        DateOnly date,
        string action = "buy",
        bool settlesToCash = false,
        decimal cashUsed = 0m) =>
        new(
            Guid.NewGuid(),
            userId,
            Guid.Parse("4484e031-9d31-4cd5-83f8-a699f52a803e"),
            "ABC",
            "EUR",
            shares,
            price,
            date,
            portfolioId,
            portfolioId is null ? null : "Main",
            action,
            CashUsed: cashUsed,
            SettlesToCash: settlesToCash);

    private sealed class RecordingStore(
        IReadOnlyList<SnapshotTransaction> transactions,
        IReadOnlyList<SnapshotWithdrawal>? withdrawals = null) : IPortfolioSnapshotStore
    {
        public int ReadCount { get; private set; }
        public IReadOnlyList<PortfolioSnapshotRecord> Upserted { get; private set; } = [];

        public Task<IReadOnlyList<SnapshotTransaction>> ReadTransactionsAsync(
            CancellationToken cancellationToken = default)
        {
            ReadCount++;
            return Task.FromResult(transactions);
        }

        public Task<IReadOnlyList<SnapshotWithdrawal>> ReadWithdrawalsAsync(
            CancellationToken cancellationToken = default) =>
            Task.FromResult(withdrawals ?? (IReadOnlyList<SnapshotWithdrawal>)[]);

        public Task UpsertAsync(
            IReadOnlyList<PortfolioSnapshotRecord> records,
            CancellationToken cancellationToken = default)
        {
            Upserted = records;
            return Task.CompletedTask;
        }
    }

    private sealed class FixedQuoteService(QuoteLookupResult result) : IQuoteService
    {
        public Task<QuoteLookupResult> GetAsync(
            IReadOnlyList<string> symbols,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(result);
    }

    private sealed class FixedFxRateService(JsonElement payload) : IFxRateService
    {
        public Task<JsonElement> GetAsync(
            string baseCurrency,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(payload);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
