using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.CarService.Reminders;

public sealed class ServiceReminderService(
    IServiceReminderQueries reminderQueries,
    IServiceVisitQueries visitQueries,
    TimeProvider timeProvider) : IServiceReminderService
{
    public async Task<IReadOnlyList<ServiceReminderWithStatus>> ListAsync(
        Guid userId,
        Guid? vehicleId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var remindersTask = reminderQueries.ListAsync(
            userId,
            vehicleId,
            activeOnly,
            cancellationToken);
        var visitsTask = visitQueries.ListAsync(userId, vehicleId, cancellationToken);
        await Task.WhenAll(remindersTask, visitsTask).ConfigureAwait(false);

        return ServiceReminderCalculator.Calculate(
            await remindersTask.ConfigureAwait(false),
            [.. (await visitsTask.ConfigureAwait(false))],
            timeProvider.GetUtcNow(),
            useLatestVisitOdometer: vehicleId.HasValue);
    }
}
