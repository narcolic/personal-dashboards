using PortfolioTerminal.Portfolio.Holdings;
using PortfolioTerminal.Portfolio.SecurityMetadata;
using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioHoldingCalculatorTests
{
    [Fact]
    public void AggregateGroupsBuysAndCalculatesWeightedAverageCost()
    {
        var portfolioId = Guid.Parse("9271fc64-edfb-4e12-bcf4-8e4e5dd270cf");
        var rows = new[]
        {
            Transaction(
                ticker: "vwce.de",
                shares: 2m,
                price: 100m,
                date: new DateOnly(2026, 1, 2),
                portfolioId: portfolioId,
                name: "Old name"),
            Transaction(
                ticker: "VWCE.DE",
                shares: 3m,
                price: 120m,
                date: new DateOnly(2026, 2, 2),
                portfolioId: portfolioId,
                name: "Vanguard FTSE All-World"),
        };

        var holding = Assert.Single(PortfolioHoldingCalculator.Aggregate(rows));

        Assert.Equal("VWCE.DE", holding.Ticker);
        Assert.Equal(5m, holding.Shares);
        Assert.Equal(112m, holding.AvgCost);
        Assert.Equal(2, holding.TransactionCount);
        Assert.Equal(new DateOnly(2026, 1, 2), holding.FirstDate);
        Assert.Equal(new DateOnly(2026, 2, 2), holding.LastDate);
        Assert.Equal("Vanguard FTSE All-World", holding.Name);
        Assert.Equal(portfolioId, holding.PortfolioId);
    }

    [Fact]
    public void AggregateKeepsPortfolioAndCurrencyPositionsSeparate()
    {
        var firstPortfolio = Guid.Parse("62414812-69c4-4544-a227-d78f46ce24af");
        var secondPortfolio = Guid.Parse("14a79414-7493-4ab8-bbb3-9b4336b5cd0a");
        var rows = new[]
        {
            Transaction("ABC", 1m, 10m, new DateOnly(2026, 1, 1), firstPortfolio, currency: "usd"),
            Transaction("ABC", 1m, 10m, new DateOnly(2026, 1, 1), secondPortfolio, currency: "USD"),
            Transaction("ABC", 1m, 10m, new DateOnly(2026, 1, 1), firstPortfolio, currency: "EUR"),
        };

        var holdings = PortfolioHoldingCalculator.Aggregate(rows);

        Assert.Equal(3, holdings.Count);
        Assert.Contains(holdings, holding =>
            holding.PortfolioId == firstPortfolio && holding.Currency == "USD");
        Assert.Contains(holdings, holding =>
            holding.PortfolioId == firstPortfolio && holding.Currency == "EUR");
        Assert.Contains(holdings, holding =>
            holding.PortfolioId == secondPortfolio && holding.Currency == "USD");
    }

    [Fact]
    public void AggregatePreservesCurrentBehaviorByIgnoringNonBuyActionsAndEmptyPositions()
    {
        var rows = new[]
        {
            Transaction("ABC", 2m, 10m, new DateOnly(2026, 1, 1), action: "sell"),
            Transaction("ABC", 0m, 10m, new DateOnly(2026, 1, 2)),
            Transaction("XYZ", 1m, 20m, new DateOnly(2026, 1, 3), action: "dividend"),
        };

        var holdings = PortfolioHoldingCalculator.Aggregate(rows);

        Assert.Empty(holdings);
    }

    [Fact]
    public void AggregateUsesCanonicalListingMetadataWhenLinked()
    {
        var listingId = Guid.NewGuid();
        var security = new SecurityMetadataView(
            listingId, Guid.NewGuid(), "MSFT", "Microsoft Corporation", "stock",
            "XNAS", "Nasdaq", "USD", "Microsoft Corporation", "US",
            "United States", "north_america", "North America",
            "information_technology", "Information Technology", null, null,
            null, null, null, null, null, null, "succeeded",
            DateTimeOffset.UtcNow, false);
        var row = Transaction("LEGACY", 2m, 100m, new DateOnly(2026, 1, 1)) with
        {
            SecurityListingId = listingId,
            Security = security,
        };

        var holding = Assert.Single(PortfolioHoldingCalculator.Aggregate([row]));

        Assert.Equal("MSFT", holding.Ticker);
        Assert.Equal("Microsoft Corporation", holding.Name);
        Assert.Equal("stock", holding.AssetType);
        Assert.Equal(listingId, holding.SecurityListingId);
        Assert.Same(security, holding.Security);
    }

    [Fact]
    public void AggregateFailsClosedWhenBuyTransactionHasNoCanonicalMetadata()
    {
        var row = new TransactionListItem(
            Guid.NewGuid(), "buy", "USD", 1m, 10m,
            new DateOnly(2026, 1, 1), null, null, Guid.NewGuid());

        var exception = Assert.Throws<InvalidOperationException>(() =>
            PortfolioHoldingCalculator.Aggregate([row]));

        Assert.Contains(row.Id.ToString(), exception.Message, StringComparison.Ordinal);
    }

    private static TransactionListItem Transaction(
        string ticker,
        decimal shares,
        decimal price,
        DateOnly date,
        Guid? portfolioId = null,
        string action = "buy",
        string currency = "USD",
        string? name = "Example")
    {
        var listingId = Guid.Parse("12b5f14b-611c-4707-ab1e-e194116f16f8");
        var symbol = ticker.Trim().ToUpperInvariant();
        var security = new SecurityMetadataView(
            listingId, Guid.NewGuid(), symbol, name ?? symbol, "etf",
            null, "Example Market", currency.ToUpperInvariant(), null, null,
            null, null, null, null, null, null, null, null, null, null,
            null, null, null, "succeeded", DateTimeOffset.UtcNow, false);
        return new(
            Guid.NewGuid(),
            action,
            currency,
            shares,
            price,
            date,
            null,
            portfolioId,
            listingId,
            security);
    }
}
