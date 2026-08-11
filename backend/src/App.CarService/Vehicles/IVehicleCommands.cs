using PortfolioTerminal.CarService;

namespace PortfolioTerminal.CarService.Vehicles;

public interface IVehicleCommands
{
    Task<MutationResult> CreateAsync(
        Guid userId,
        VehicleMutation mutation,
        CancellationToken cancellationToken = default);

    Task<MutationResult> UpdateAsync(
        Guid userId,
        Guid vehicleId,
        VehicleMutation mutation,
        CancellationToken cancellationToken = default);

    Task<MutationResult> DeleteAsync(
        Guid userId,
        Guid vehicleId,
        CancellationToken cancellationToken = default);
}

public sealed record VehicleMutation(
    string Make,
    string Model,
    int Year,
    string Plate,
    string? Colour,
    string? Notes,
    int AnnualServiceIntervalKm,
    int AnnualServiceIntervalMonths);
