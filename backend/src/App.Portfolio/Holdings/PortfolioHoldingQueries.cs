using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Portfolio.Holdings;

public sealed class PortfolioHoldingQueries(ITransactionQueries transactionQueries)
    : IPortfolioHoldingQueries
{
    public async Task<IReadOnlyList<PortfolioHolding>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var transactions = await transactionQueries.ListAsync(
            userId,
            new TransactionListFilter(
                Ticker: null,
                PortfolioId: null,
                UnassignedPortfolio: false,
                AssetType: null,
                Currency: null,
                DateFrom: null,
                DateTo: null,
                Offset: null,
                Limit: null),
            cancellationToken);

        return PortfolioHoldingCalculator.Aggregate(transactions.Rows);
    }
}
