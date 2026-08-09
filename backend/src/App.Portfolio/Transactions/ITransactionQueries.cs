namespace PortfolioTerminal.Portfolio.Transactions;

public interface ITransactionQueries
{
    Task<TransactionListResult> ListAsync(
        Guid userId,
        TransactionListFilter filter,
        CancellationToken cancellationToken = default);
}

public sealed record TransactionListFilter(
    string? Ticker,
    Guid? PortfolioId,
    bool UnassignedPortfolio,
    string? AssetType,
    string? Currency,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    int? Offset,
    int? Limit);

public sealed record TransactionListResult(
    IReadOnlyList<TransactionListItem> Rows,
    long Count);

public sealed record TransactionListItem(
    Guid Id,
    string? Ticker,
    string Action,
    string? Name,
    string? AssetType,
    string? Market,
    string? Currency,
    decimal? Shares,
    decimal? Price,
    DateOnly? TransactionDate,
    string? Notes,
    Guid? PortfolioId);
