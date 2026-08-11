using PortfolioTerminal.CarService;

namespace PortfolioTerminal.CarService.Visits;

public interface IServiceVisitCommands
{
    Task<MutationResult> CreateAsync(
        Guid userId,
        ServiceVisitMutation mutation,
        CancellationToken cancellationToken = default);

    Task<MutationResult> UpdateAsync(
        Guid userId,
        Guid visitId,
        ServiceVisitMutation mutation,
        CancellationToken cancellationToken = default);

    Task<MutationResult> DeleteAsync(
        Guid userId,
        Guid visitId,
        CancellationToken cancellationToken = default);
}

public sealed record ServiceVisitMutation(
    Guid VehicleId,
    DateOnly ServiceDate,
    int OdometerKm,
    string? Workshop,
    string? Notes,
    decimal VatRate,
    bool IsAnnualService,
    IReadOnlyList<ServiceJobMutation> Jobs);

public sealed record ServiceJobMutation(
    string JobName,
    string? Category,
    decimal Quantity,
    decimal UnitPriceExVat,
    string? Notes);
