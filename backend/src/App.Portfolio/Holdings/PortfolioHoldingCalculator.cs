using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Portfolio.Holdings;

public static class PortfolioHoldingCalculator
{
    public static IReadOnlyList<PortfolioHolding> Aggregate(
        IEnumerable<TransactionListItem> transactions)
    {
        var canonicalTransactions = transactions
            .Where(transaction =>
                string.Equals(transaction.Action, "buy", StringComparison.OrdinalIgnoreCase))
            .Select(transaction => transaction.SecurityListingId is { } listingId
                && transaction.Security is { } security
                ? new { Transaction = transaction, ListingId = listingId, Security = security }
                : throw new InvalidOperationException(
                    $"Transaction {transaction.Id} has no canonical security metadata."));
        var groups = canonicalTransactions
            .GroupBy(transaction => new HoldingKey(
                transaction.ListingId,
                transaction.Transaction.PortfolioId,
                NormalizeCurrency(transaction.Transaction.Currency)));

        var holdings = new List<PortfolioHolding>();
        foreach (var group in groups)
        {
            var rows = group.ToArray();
            var totalShares = rows.Sum(row => row.Transaction.Shares ?? 0m);
            if (totalShares <= 0m)
            {
                continue;
            }

            var totalCost = rows.Sum(row =>
                (row.Transaction.Shares ?? 0m) * (row.Transaction.Price ?? 0m));
            var first = rows.MinBy(row => row.Transaction.TransactionDate);
            var last = rows.MaxBy(row => row.Transaction.TransactionDate);
            if (first is null || last is null)
            {
                continue;
            }

            var security = last.Security;
            var ticker = security.Symbol;
            holdings.Add(new PortfolioHolding(
                $"{group.Key.ListingId}|{group.Key.PortfolioId?.ToString() ?? string.Empty}|{group.Key.Currency}",
                ticker,
                security.Name,
                security.SecurityType,
                security.ExchangeName ?? security.ExchangeMic,
                group.Key.Currency,
                totalShares,
                totalCost / totalShares,
                last.Transaction.Notes,
                group.Key.PortfolioId,
                rows.Length,
                first.Transaction.TransactionDate,
                last.Transaction.TransactionDate,
                group.Key.ListingId,
                security));
        }

        return [.. holdings
            .OrderBy(holding => holding.Ticker, StringComparer.Ordinal)
            .ThenBy(holding => holding.PortfolioId)
            .ThenBy(holding => holding.Currency, StringComparer.Ordinal)];
    }

    private static string NormalizeCurrency(string? currency) =>
        string.IsNullOrWhiteSpace(currency)
            ? "USD"
            : currency.Trim().ToUpperInvariant();

    private sealed record HoldingKey(
        Guid ListingId,
        Guid? PortfolioId,
        string Currency);
}
