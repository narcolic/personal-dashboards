namespace PortfolioTerminal.CarService.Reminders;

public interface IServiceReminderService
{
    Task<IReadOnlyList<ServiceReminderWithStatus>> ListAsync(
        Guid userId,
        Guid? vehicleId,
        bool activeOnly,
        CancellationToken cancellationToken = default);
}

public sealed record ServiceReminderWithStatus(
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
    DateTimeOffset CreatedAt,
    string Status,
    DateOnly? LastDoneDate,
    int? LastDoneKm,
    int? KmRemaining,
    int? DaysRemaining);
