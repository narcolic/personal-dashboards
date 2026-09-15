namespace PortfolioTerminal.Portfolio.Cash;

public interface IPortfolioCashQueries
{
    Task<IReadOnlyList<PortfolioCashBalance>> ListAsync(
        Guid userId,
        DateOnly? asOf = null,
        CancellationToken cancellationToken = default);
}

public sealed record PortfolioCashBalance(
    Guid? PortfolioId,
    string Currency,
    decimal AvailableAmount,
    decimal ExternalFlow);
