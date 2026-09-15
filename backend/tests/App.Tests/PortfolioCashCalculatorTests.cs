using PortfolioTerminal.Portfolio.Cash;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioCashCalculatorTests
{
    [Fact]
    public void FullyCoveredPurchaseLeavesRemainingCash()
    {
        var result = PortfolioCashCalculator.FundPurchase(3000m, 1000m, true);
        Assert.Equal(1000m, result.CashUsed);
        Assert.Equal(2000m, result.RemainingCash);
        Assert.Equal(0m, result.ExternalPurchaseAmount);
    }

    [Fact]
    public void PartiallyCoveredPurchaseUsesAllCash()
    {
        var result = PortfolioCashCalculator.FundPurchase(1000m, 3000m, true);
        Assert.Equal(1000m, result.CashUsed);
        Assert.Equal(0m, result.RemainingCash);
        Assert.Equal(2000m, result.ExternalPurchaseAmount);
    }

    [Fact]
    public void PurchaseWithoutCashOptionPreservesCash()
    {
        var result = PortfolioCashCalculator.FundPurchase(1000m, 3000m, false);
        Assert.Equal(0m, result.CashUsed);
        Assert.Equal(1000m, result.RemainingCash);
        Assert.Equal(3000m, result.ExternalPurchaseAmount);
    }

    [Fact]
    public void WithdrawalReducesCash()
    {
        var result = PortfolioCashCalculator.Withdraw(3000m, 1000m);
        Assert.True(result.Allowed);
        Assert.Equal(2000m, result.RemainingCash);
    }

    [Fact]
    public void WithdrawalGreaterThanAvailableCashIsRejected()
    {
        var result = PortfolioCashCalculator.Withdraw(1000m, 1000.01m);
        Assert.False(result.Allowed);
        Assert.Equal(1000m, result.RemainingCash);
    }
}
