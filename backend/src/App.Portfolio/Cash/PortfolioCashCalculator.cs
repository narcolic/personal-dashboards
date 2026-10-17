namespace PortfolioTerminal.Portfolio.Cash;

public static class PortfolioCashCalculator
{
    // Cash settles at the two-decimal precision used by the portfolio ledger.
    // Round legacy float-derived withdrawals too, so a full withdrawal leaves zero.
    public static decimal CashAmount(decimal amount) =>
        decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    public static decimal SaleProceeds(decimal shares, decimal price, decimal fee) =>
        CashAmount(shares * price - fee);

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
