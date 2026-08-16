using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.CarService.Analytics;

public sealed class CarServiceAnalyticsService(
    IServiceVisitQueries visitQueries,
    TimeProvider timeProvider) : ICarServiceAnalytics
{
    public async Task<CarServiceAnalyticsResult> GetAsync(
        Guid userId,
        Guid? vehicleId,
        CarServiceAnalyticsPeriod period = CarServiceAnalyticsPeriod.All,
        CancellationToken cancellationToken = default)
    {
        var visits = await visitQueries.ListAsync(userId, vehicleId, cancellationToken)
            .ConfigureAwait(false);

        return CarServiceAnalyticsCalculator.Calculate(
            visits,
            DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime),
            period);
    }
}
