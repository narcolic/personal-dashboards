namespace PortfolioTerminal.Portfolio.Portfolios;

public interface IPortfolioQueries
{
    Task<IReadOnlyList<PortfolioListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}

public sealed record PortfolioListItem(
    Guid Id,
    string Name,
    string? Broker,
    string? Notes);
