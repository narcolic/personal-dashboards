namespace PortfolioTerminal.CarService.Analytics;

public interface ICarServiceAnalytics
{
    Task<CarServiceAnalyticsResult> GetAsync(
        Guid userId,
        Guid? vehicleId,
        CancellationToken cancellationToken = default);
}

public sealed record CarServiceAnalyticsResult(
    int VisitCount,
    decimal TotalLifetimeCost,
    decimal CostThisYear,
    DateOnly? LastVisitDate,
    int? LatestOdometerKm,
    decimal AverageVisitCost,
    decimal? AverageKmInterval,
    decimal? CostPer1000Km,
    MostExpensiveVisitResult? MostExpensiveVisit,
    IReadOnlyList<AnnualSpendResult> AnnualSpend,
    IReadOnlyList<CategorySpendResult> CategorySpend,
    IReadOnlyList<TopJobResult> TopJobs);

public sealed record MostExpensiveVisitResult(
    Guid Id,
    DateOnly ServiceDate,
    decimal TotalAmount);

public sealed record AnnualSpendResult(string Year, decimal Total);

public sealed record CategorySpendResult(string Category, decimal Total);

public sealed record TopJobResult(string JobName, int Count, decimal TotalSpent);
