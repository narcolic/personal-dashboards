using PortfolioTerminal.Portfolio.Cash;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioCashCalculatorTests
{
    [Fact]
    public void SaleFeeIsNotSpendableCashAndLegacyFullWithdrawalLeavesZero()
    {
        var proceeds = PortfolioCashCalculator.SaleProceeds(100m, 106.3484m, 0.05m);
        var withdrawn = PortfolioCashCalculator.CashAmount(10634.79033203125m);
        Assert.Equal(10634.79m, proceeds);
        Assert.Equal(0m, proceeds - withdrawn);
        Assert.False(PortfolioCashCalculator.Withdraw(proceeds - withdrawn, 0.01m).Allowed);
    }

    [Fact]
    public void GenuineSmallCashBalancesArePreserved()
    {
        Assert.Equal(0.04m, PortfolioCashCalculator.SaleProceeds(1m, 1.04m, 0m) - 1m);
    }

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
