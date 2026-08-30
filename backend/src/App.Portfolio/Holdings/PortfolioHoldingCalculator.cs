using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Portfolio.Holdings;

public static class PortfolioHoldingCalculator
{
    public static IReadOnlyList<PortfolioHolding> Aggregate(
        IEnumerable<TransactionListItem> transactions)
    {
        var groups = transactions
            .Where(transaction =>
                string.Equals(transaction.Action, "buy", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(transaction.Ticker))
            .GroupBy(transaction => new HoldingKey(
                transaction.SecurityListingId,
                transaction.Ticker!.Trim().ToUpperInvariant(),
                transaction.PortfolioId,
                NormalizeCurrency(transaction.Currency)));

        var holdings = new List<PortfolioHolding>();
        foreach (var group in groups)
        {
            var rows = group.ToArray();
            var totalShares = rows.Sum(transaction => transaction.Shares ?? 0m);
            if (totalShares <= 0m)
            {
                continue;
            }

            var totalCost = rows.Sum(transaction =>
                (transaction.Shares ?? 0m) * (transaction.Price ?? 0m));
            var first = rows.MinBy(transaction => transaction.TransactionDate);
            var last = rows.MaxBy(transaction => transaction.TransactionDate);
            if (first is null || last is null)
            {
                continue;
            }

            var security = last.Security;
            var ticker = security?.Symbol ?? group.Key.Ticker;
            holdings.Add(new PortfolioHolding(
                $"{group.Key.ListingId?.ToString() ?? ticker}|{group.Key.PortfolioId?.ToString() ?? string.Empty}|{group.Key.Currency}",
                ticker,
                security?.Name ?? last.Name,
                security?.SecurityType ?? last.AssetType ?? "Unknown",
                security?.ExchangeName ?? security?.ExchangeMic ?? last.Market,
                group.Key.Currency,
                totalShares,
                totalCost / totalShares,
                last.Notes,
                group.Key.PortfolioId,
                rows.Length,
                first.TransactionDate,
                last.TransactionDate,
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
        Guid? ListingId,
        string Ticker,
        Guid? PortfolioId,
        string Currency);
}
