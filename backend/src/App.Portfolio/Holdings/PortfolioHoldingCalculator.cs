using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Portfolio.Holdings;

public static class PortfolioHoldingCalculator
{
    public static IReadOnlyList<PortfolioHolding> Aggregate(
        IEnumerable<TransactionListItem> transactions) =>
        PortfolioAccountingCalculator.Calculate(transactions).Holdings;
}
