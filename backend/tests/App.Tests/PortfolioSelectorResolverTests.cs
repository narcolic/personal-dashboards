using PortfolioTerminal.Portfolio.Analytics;
using PortfolioTerminal.Portfolio.Portfolios;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioSelectorResolverTests
{
    private static readonly PortfolioListItem[] Portfolios =
    [
        new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "Growth", "Broker A", null),
        new(Guid.Parse("22222222-2222-2222-2222-222222222222"), "Income", null, null),
    ];

    [Theory]
    [InlineData(null, "all")]
    [InlineData("all", "all")]
    [InlineData("unassigned", "unassigned")]
    [InlineData("Growth", "portfolio:11111111-1111-1111-1111-111111111111")]
    [InlineData("portfolio:22222222-2222-2222-2222-222222222222", "portfolio:22222222-2222-2222-2222-222222222222")]
    public void ResolvesSupportedSelectors(string? selector, string expected)
    {
        var scope = PortfolioSelectorResolver.Resolve(selector, Portfolios);

        Assert.Equal(expected, scope.Selector);
    }

    [Fact]
    public void RejectsDuplicatePortfolioNamesWithoutGuessing()
    {
        PortfolioListItem[] duplicated =
        [
            .. Portfolios,
            new(Guid.Parse("33333333-3333-3333-3333-333333333333"), "Growth", null, null),
        ];

        var exception = Assert.Throws<PortfolioAnalysisException>(() =>
            PortfolioSelectorResolver.Resolve("growth", duplicated));

        Assert.Equal("ambiguous_portfolio", exception.Code);
        Assert.Contains("portfolio:11111111", exception.Message, StringComparison.Ordinal);
        Assert.Contains("portfolio:33333333", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void RejectsForeignOrUnknownOpaqueReference()
    {
        var exception = Assert.Throws<PortfolioAnalysisException>(() =>
            PortfolioSelectorResolver.Resolve(
                "portfolio:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                Portfolios));

        Assert.Equal("portfolio_not_found", exception.Code);
    }
}
