namespace PortfolioTerminal.Portfolio.Analytics;

public interface IPortfolioAnalysisService
{
    Task<PortfolioSummaryResult> GetSummaryAsync(Guid userId, string? portfolio, string displayCurrency, int top, CancellationToken cancellationToken = default);
    Task<PortfolioHoldingsResult> GetHoldingsAsync(Guid userId, string? portfolio, IReadOnlyList<string>? tickers, string displayCurrency, string sort, int limit, CancellationToken cancellationToken = default);
    Task<PortfolioAllocationResult> GetAllocationAsync(Guid userId, string? portfolio, string dimension, string displayCurrency, int limit, CancellationToken cancellationToken = default);
    Task<PortfolioHistoryResult> GetHistoryAsync(Guid userId, string? portfolio, DateOnly? dateFrom, DateOnly? dateTo, string displayCurrency, string interval, int maxPoints, CancellationToken cancellationToken = default);
    Task<PortfolioSimulationResult> SimulatePurchaseAsync(Guid userId, string? portfolio, string ticker, decimal amount, string amountCurrency, string displayCurrency, CancellationToken cancellationToken = default);
}
