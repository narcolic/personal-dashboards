using PortfolioTerminal.CarService;

namespace PortfolioTerminal.CarService.Reminders;

public interface IServiceReminderCommands
{
    Task<MutationResult> CreateAsync(
        Guid userId,
        ServiceReminderMutation mutation,
        CancellationToken cancellationToken = default);

    Task<MutationResult> UpdateAsync(
        Guid userId,
        Guid reminderId,
        ServiceReminderMutation mutation,
        CancellationToken cancellationToken = default);

    Task<MutationResult> DeleteAsync(
        Guid userId,
        Guid reminderId,
        CancellationToken cancellationToken = default);
}

public sealed record ServiceReminderMutation(
    Guid VehicleId,
    string JobName,
    int? IntervalKm,
    int? IntervalMonths,
    int? WarningKm,
    int? WarningDays,
    string? Notes,
    bool IsActive);
