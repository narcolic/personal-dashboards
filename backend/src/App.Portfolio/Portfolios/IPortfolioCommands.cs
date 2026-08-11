using PortfolioTerminal.Portfolio;

namespace PortfolioTerminal.Portfolio.Portfolios;

public interface IPortfolioCommands
{
    Task<PortfolioMutationResult> CreateAsync(
        Guid userId,
        PortfolioMutation mutation,
        CancellationToken cancellationToken = default);

    Task<PortfolioMutationResult> DeleteAsync(
        Guid userId,
        Guid portfolioId,
        CancellationToken cancellationToken = default);
}

public sealed record PortfolioMutation(
    string Name,
    string? Broker,
    string? Notes);
