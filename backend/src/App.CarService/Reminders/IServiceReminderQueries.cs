namespace PortfolioTerminal.CarService.Reminders;

public interface IServiceReminderQueries
{
    Task<IReadOnlyList<ServiceReminderListItem>> ListAsync(
        Guid userId,
        Guid? vehicleId,
        bool activeOnly,
        CancellationToken cancellationToken = default);
}

public sealed record ServiceReminderListItem(
    Guid Id,
    Guid UserId,
    Guid VehicleId,
    string JobName,
    int? IntervalKm,
    int? IntervalMonths,
    int? WarningKm,
    int? WarningDays,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAt);
