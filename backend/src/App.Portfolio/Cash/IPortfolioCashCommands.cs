using PortfolioTerminal.Portfolio;

namespace PortfolioTerminal.Portfolio.Cash;

public interface IPortfolioCashCommands
{
    Task<PortfolioMutationResult> WithdrawAsync(
        Guid userId,
        CashWithdrawalMutation mutation,
        CancellationToken cancellationToken = default);
}

public sealed record CashWithdrawalMutation(
    Guid? PortfolioId,
    string Currency,
    decimal Amount,
    DateOnly WithdrawalDate,
    string? Notes);
