namespace PortfolioTerminal.CarService.Analytics;

public interface ICarServiceAnalytics
{
    Task<CarServiceAnalyticsResult> GetAsync(
        Guid userId,
        Guid? vehicleId,
        CarServiceAnalyticsPeriod period = CarServiceAnalyticsPeriod.All,
        CancellationToken cancellationToken = default);
}

public enum CarServiceAnalyticsPeriod
{
    All,
    Last12Months,
    YearToDate,
    Last3Years,
}

public static class CarServiceAnalyticsPeriods
{
    public static bool TryParse(string? value, out CarServiceAnalyticsPeriod period)
    {
        period = value?.ToLowerInvariant() switch
        {
            null or "" or "all" => CarServiceAnalyticsPeriod.All,
            "last12m" => CarServiceAnalyticsPeriod.Last12Months,
            "ytd" => CarServiceAnalyticsPeriod.YearToDate,
            "last3y" => CarServiceAnalyticsPeriod.Last3Years,
            _ => (CarServiceAnalyticsPeriod)(-1),
        };

        return Enum.IsDefined(period);
    }

    public static string ToKey(this CarServiceAnalyticsPeriod period) => period switch
    {
        CarServiceAnalyticsPeriod.Last12Months => "last12m",
        CarServiceAnalyticsPeriod.YearToDate => "ytd",
        CarServiceAnalyticsPeriod.Last3Years => "last3y",
        _ => "all",
    };
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
    IReadOnlyList<TopJobResult> TopJobs,
    AnalyticsPeriodResult Period,
    IReadOnlyList<SpendTrendResult> SpendTrend,
    IReadOnlyList<ExpensiveVisitResult> ExpensiveVisits,
    IReadOnlyList<VehicleComparisonResult> VehicleComparison);

public sealed record MostExpensiveVisitResult(
    Guid Id,
    DateOnly ServiceDate,
    decimal TotalAmount);

public sealed record AnnualSpendResult(string Year, decimal Total);

public sealed record CategorySpendResult(string Category, decimal Total);

public sealed record TopJobResult(string JobName, int Count, decimal TotalSpent);

public sealed record AnalyticsPeriodResult(
    string Key,
    DateOnly? StartDate,
    DateOnly EndDate,
    int VisitCount,
    decimal TotalSpend,
    decimal AverageVisitCost,
    decimal? CostPer1000Km,
    decimal? PreviousTotalSpend,
    decimal? SpendChangePercent);

public sealed record SpendTrendResult(
    DateOnly BucketStart,
    decimal Total,
    decimal? PreviousTotal);

public sealed record ExpensiveVisitResult(
    Guid Id,
    Guid VehicleId,
    DateOnly ServiceDate,
    string? Workshop,
    decimal TotalAmount);

public sealed record VehicleComparisonResult(
    Guid VehicleId,
    int VisitCount,
    decimal TotalSpend,
    decimal AverageVisitCost,
    decimal? CostPer1000Km);
