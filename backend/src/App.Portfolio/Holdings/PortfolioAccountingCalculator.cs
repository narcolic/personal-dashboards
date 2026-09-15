using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Portfolio.Holdings;

public static class PortfolioAccountingCalculator
{
    public static PortfolioAccountingResult Calculate(
        IEnumerable<TransactionListItem> transactions)
    {
        var holdings = new List<PortfolioHolding>();
        var realizedSales = new List<RealizedSale>();

        foreach (var group in transactions
            .Where(row => row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase) ||
                          row.Action.Equals("sell", StringComparison.OrdinalIgnoreCase))
            .GroupBy(row => new HoldingKey(
                row.SecurityListingId,
                row.PortfolioId,
                NormalizeCurrency(row.TransactionCurrency))))
        {
            decimal quantity = 0m;
            decimal costBasis = 0m;
            TransactionListItem? first = null;
            TransactionListItem? last = null;
            var transactionCount = 0;

            foreach (var row in group
                .OrderBy(row => row.TransactionDate)
                .ThenBy(row => ActionOrder(row.Action))
                .ThenBy(row => row.CreatedAt ?? DateTimeOffset.MinValue)
                .ThenBy(row => row.Id))
            {
                if (row.Security is null)
                {
                    throw new InvalidOperationException(
                        $"Transaction {row.Id} has no canonical security metadata.");
                }

                first ??= row;
                last = row;
                transactionCount++;

                if (row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase))
                {
                    quantity += row.Shares;
                    costBasis += row.Shares * row.Price + row.FeeAmount;
                    continue;
                }

                if (row.Shares > quantity)
                {
                    throw new PortfolioAccountingException(
                        row.Id,
                        $"Cannot sell {row.Shares} shares of {row.Security.Symbol}; only {quantity} are available.");
                }

                var averageCost = quantity == 0m ? 0m : costBasis / quantity;
                var disposedCost = averageCost * row.Shares;
                var grossProceeds = row.Shares * row.Price;
                var netProceeds = grossProceeds - row.FeeAmount;
                quantity -= row.Shares;
                costBasis -= disposedCost;
                if (quantity == 0m)
                {
                    costBasis = 0m;
                }

                realizedSales.Add(new RealizedSale(
                    row.Id,
                    group.Key.ListingId,
                    row.PortfolioId,
                    group.Key.Currency,
                    row.TransactionDate,
                    row.Shares,
                    grossProceeds,
                    netProceeds,
                    disposedCost,
                    netProceeds - disposedCost));
            }

            if (quantity <= 0m || first is null || last is null)
            {
                continue;
            }

            var security = last.Security!;
            holdings.Add(new PortfolioHolding(
                $"{group.Key.ListingId}|{group.Key.PortfolioId?.ToString() ?? string.Empty}|{group.Key.Currency}",
                security.Symbol,
                security.Name,
                security.SecurityType,
                security.ExchangeName ?? security.ExchangeMic,
                group.Key.Currency,
                quantity,
                costBasis / quantity,
                last.Notes,
                group.Key.PortfolioId,
                transactionCount,
                first.TransactionDate,
                last.TransactionDate,
                group.Key.ListingId,
                security));
        }

        return new PortfolioAccountingResult(
            [.. holdings
                .OrderBy(holding => holding.Ticker, StringComparer.Ordinal)
                .ThenBy(holding => holding.PortfolioId)
                .ThenBy(holding => holding.Currency, StringComparer.Ordinal)],
            [.. realizedSales.OrderBy(sale => sale.TransactionDate).ThenBy(sale => sale.TransactionId)]);
    }

    private static int ActionOrder(string action) =>
        action.Equals("buy", StringComparison.OrdinalIgnoreCase) ? 0 : 1;

    private static string NormalizeCurrency(string? currency) =>
        string.IsNullOrWhiteSpace(currency) ? "USD" : currency.Trim().ToUpperInvariant();

    private sealed record HoldingKey(Guid ListingId, Guid? PortfolioId, string Currency);
}

public sealed record PortfolioAccountingResult(
    IReadOnlyList<PortfolioHolding> Holdings,
    IReadOnlyList<RealizedSale> RealizedSales);

public sealed record RealizedSale(
    Guid TransactionId,
    Guid SecurityListingId,
    Guid? PortfolioId,
    string Currency,
    DateOnly TransactionDate,
    decimal Shares,
    decimal GrossProceeds,
    decimal NetProceeds,
    decimal DisposedCostBasis,
    decimal RealizedPnl);

public sealed class PortfolioAccountingException(Guid transactionId, string message)
    : InvalidOperationException(message)
{
    public Guid TransactionId { get; } = transactionId;
}
