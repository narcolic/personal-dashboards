namespace PortfolioTerminal.CarService.Visits;

public interface IServiceVisitQueries
{
    Task<ServiceVisitListItem?> GetAsync(
        Guid userId,
        Guid visitId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ServiceVisitListItem>> ListAsync(
        Guid userId,
        Guid? vehicleId,
        CancellationToken cancellationToken = default);
}

public sealed record ServiceVisitListItem(
    Guid Id,
    Guid VehicleId,
    Guid UserId,
    DateOnly ServiceDate,
    int OdometerKm,
    string? Workshop,
    string? Notes,
    decimal VatRate,
    decimal SubtotalExVat,
    decimal VatAmount,
    decimal TotalAmount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    bool IsAnnualService,
    IReadOnlyList<ServiceJobListItem> Jobs);

public sealed record ServiceJobListItem(
    Guid Id,
    Guid ServiceVisitId,
    Guid? JobCatalogId,
    string JobNameSnapshot,
    string? CategorySnapshot,
    decimal Quantity,
    decimal UnitPriceExVat,
    decimal LineTotalExVat,
    string? Notes,
    bool IsCustom,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
