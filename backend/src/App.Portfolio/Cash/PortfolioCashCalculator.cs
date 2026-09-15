namespace PortfolioTerminal.Portfolio.Cash;

public static class PortfolioCashCalculator
{
    public static CashFundingResult FundPurchase(
        decimal availableCash,
        decimal purchaseCost,
        bool useAvailableCash)
    {
        var used = useAvailableCash ? Math.Min(Math.Max(availableCash, 0m), purchaseCost) : 0m;
        return new(
            used,
            Math.Max(0m, availableCash - used),
            purchaseCost - used);
    }

    public static CashWithdrawalResult Withdraw(decimal availableCash, decimal requestedAmount)
    {
        var available = Math.Max(availableCash, 0m);
        var allowed = requestedAmount > 0m && requestedAmount <= available;
        return new(allowed, allowed ? available - requestedAmount : available);
    }
}

public sealed record CashFundingResult(
    decimal CashUsed,
    decimal RemainingCash,
    decimal ExternalPurchaseAmount);

public sealed record CashWithdrawalResult(bool Allowed, decimal RemainingCash);
