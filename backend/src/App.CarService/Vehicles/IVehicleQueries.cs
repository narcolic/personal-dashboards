namespace PortfolioTerminal.CarService.Vehicles;

public interface IVehicleQueries
{
    Task<VehicleListItem?> GetAsync(
        Guid userId,
        Guid vehicleId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<VehicleListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}

public sealed record VehicleListItem(
    Guid Id,
    Guid UserId,
    string Name,
    string? Make,
    string? Model,
    string? Plate,
    int? Year,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
