using PortfolioTerminal.Portfolio.Cash;

namespace PortfolioTerminal.Portfolio.Snapshots;

// Versions 2/3 keep their historical prices and fee-free P&L, but cash must
// represent spendable proceeds rather than adding fees back into the account.
public static class PortfolioSnapshotCashReconciliation
{
    public static PortfolioSnapshotListItem Apply(PortfolioSnapshotListItem snapshot,
        IReadOnlyList<SnapshotTransaction> history, IReadOnlyList<SnapshotWithdrawal> withdrawals)
    {
        if (snapshot.AccountingVersion is < 2 or >= 4) return snapshot;
        var date = PortfolioSnapshotDates.ValuationDate(snapshot.SnapshotDate, snapshot.SnapshotAt, snapshot.QuoteMetadata);
        bool Matches(Guid user, Guid? portfolio) => user == snapshot.UserId &&
            (snapshot.Scope == "total" || portfolio == snapshot.PortfolioId);
        var cash = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in history.Where(row => row.TransactionDate <= date && Matches(row.UserId, row.PortfolioId)))
        {
            var currency = (row.Currency ?? "USD").ToUpperInvariant();
            var amount = row.Action == "sell" && row.SettlesToCash
                ? PortfolioCashCalculator.SaleProceeds(row.Shares, row.Price, row.FeeAmount)
                : row.Action == "buy" ? -PortfolioCashCalculator.CashAmount(row.CashUsed) : 0m;
            cash[currency] = cash.GetValueOrDefault(currency) + amount;
        }
        foreach (var row in withdrawals.Where(row => row.WithdrawalDate <= date && Matches(row.UserId, row.PortfolioId)))
        {
            var currency = row.Currency.ToUpperInvariant();
            cash[currency] = cash.GetValueOrDefault(currency) - PortfolioCashCalculator.CashAmount(row.Amount);
        }
        decimal Convert(decimal amount, string currency, string target)
        {
            if (amount == 0m || currency == target) return amount;
            decimal Rate(string code) => code == "USD" ? 1m :
                snapshot.FxMetadata.GetProperty("rates").GetProperty(code).GetDecimal();
            return amount / Rate(currency) * Rate(target);
        }
        var eur = cash.Sum(item => Convert(item.Value, item.Key, "EUR"));
        var usd = cash.Sum(item => Convert(item.Value, item.Key, "USD"));
        return snapshot with {
            CashBalanceEur = eur, CashBalanceUsd = usd,
            TotalValueEur = snapshot.MarketValueEur + eur,
            TotalValueUsd = snapshot.MarketValueUsd + usd,
            AccountingVersion = 4,
        };
    }
}
