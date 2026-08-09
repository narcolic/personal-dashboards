using System.Text.Json.Serialization;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.CarService.Analytics;
using PortfolioTerminal.CarService.Reminders;
using PortfolioTerminal.CarService.Visits;
using PortfolioTerminal.CarService.Vehicles;

namespace PortfolioTerminal.Api.Endpoints;

public static class CarServiceEndpoints
{
    public static IEndpointRouteBuilder MapCarServiceEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/car-service")
            .WithTags("Car Service")
            .RequireAuthorization();

        group.MapGet("/vehicles", async (
                IVehicleQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var vehicles = await queries.ListAsync(
                    currentUser.UserId,
                    cancellationToken);
                return TypedResults.Ok(vehicles.Select(VehicleResponse.From));
            })
            .WithName("ListVehicles");

        group.MapGet("/visits", async (
                Guid? vehicleId,
                IServiceVisitQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var visits = await queries.ListAsync(
                    currentUser.UserId,
                    vehicleId,
                    cancellationToken);
                return TypedResults.Ok(visits.Select(ServiceVisitResponse.From));
            })
            .WithName("ListServiceVisits");

        group.MapGet("/visits/{visitId:guid}", async Task<IResult> (
                Guid visitId,
                IServiceVisitQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var visit = await queries.GetAsync(
                    currentUser.UserId,
                    visitId,
                    cancellationToken);
                return visit is null
                    ? TypedResults.NotFound()
                    : TypedResults.Ok(ServiceVisitResponse.From(visit));
            })
            .WithName("GetServiceVisit");

        group.MapGet("/analytics", async (
                Guid? vehicleId,
                ICarServiceAnalytics analytics,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var result = await analytics.GetAsync(
                    currentUser.UserId,
                    vehicleId,
                    cancellationToken);
                return TypedResults.Ok(result);
            })
            .WithName("GetCarServiceAnalytics");

        group.MapGet("/reminders", async (
                Guid? vehicleId,
                bool? activeOnly,
                IServiceReminderService reminders,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var result = await reminders.ListAsync(
                    currentUser.UserId,
                    vehicleId,
                    activeOnly ?? false,
                    cancellationToken);
                return TypedResults.Ok(result.Select(ServiceReminderResponse.From));
            })
            .WithName("ListServiceReminders");

        return endpoints;
    }
}

public sealed record ServiceReminderResponse(
    Guid Id,
    [property: JsonPropertyName("user_id")] Guid UserId,
    [property: JsonPropertyName("vehicle_id")] Guid VehicleId,
    [property: JsonPropertyName("job_name")] string JobName,
    [property: JsonPropertyName("interval_km")] int? IntervalKm,
    [property: JsonPropertyName("interval_months")] int? IntervalMonths,
    [property: JsonPropertyName("warning_km")] int? WarningKm,
    [property: JsonPropertyName("warning_days")] int? WarningDays,
    string? Notes,
    [property: JsonPropertyName("is_active")] bool IsActive,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    string Status,
    DateOnly? LastDoneDate,
    int? LastDoneKm,
    int? KmRemaining,
    int? DaysRemaining)
{
    public static ServiceReminderResponse From(ServiceReminderWithStatus reminder) =>
        new(
            reminder.Id,
            reminder.UserId,
            reminder.VehicleId,
            reminder.JobName,
            reminder.IntervalKm,
            reminder.IntervalMonths,
            reminder.WarningKm,
            reminder.WarningDays,
            reminder.Notes,
            reminder.IsActive,
            reminder.CreatedAt,
            reminder.Status,
            reminder.LastDoneDate,
            reminder.LastDoneKm,
            reminder.KmRemaining,
            reminder.DaysRemaining);
}

public sealed record ServiceVisitResponse(
    Guid Id,
    [property: JsonPropertyName("vehicle_id")] Guid VehicleId,
    [property: JsonPropertyName("user_id")] Guid UserId,
    [property: JsonPropertyName("service_date")] DateOnly ServiceDate,
    [property: JsonPropertyName("odometer_km")] int OdometerKm,
    string? Workshop,
    string? Notes,
    [property: JsonPropertyName("vat_rate")] decimal VatRate,
    [property: JsonPropertyName("subtotal_ex_vat")] decimal SubtotalExVat,
    [property: JsonPropertyName("vat_amount")] decimal VatAmount,
    [property: JsonPropertyName("total_amount")] decimal TotalAmount,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt,
    [property: JsonPropertyName("is_annual_service")] bool IsAnnualService,
    IReadOnlyList<ServiceJobResponse> Jobs)
{
    public static ServiceVisitResponse From(ServiceVisitListItem visit) =>
        new(
            visit.Id,
            visit.VehicleId,
            visit.UserId,
            visit.ServiceDate,
            visit.OdometerKm,
            visit.Workshop,
            visit.Notes,
            visit.VatRate,
            visit.SubtotalExVat,
            visit.VatAmount,
            visit.TotalAmount,
            visit.CreatedAt,
            visit.UpdatedAt,
            visit.IsAnnualService,
            visit.Jobs.Select(ServiceJobResponse.From).ToArray());
}

public sealed record ServiceJobResponse(
    Guid Id,
    [property: JsonPropertyName("service_visit_id")] Guid ServiceVisitId,
    [property: JsonPropertyName("job_catalog_id")] Guid? JobCatalogId,
    [property: JsonPropertyName("job_name_snapshot")] string JobNameSnapshot,
    [property: JsonPropertyName("category_snapshot")] string? CategorySnapshot,
    decimal Quantity,
    [property: JsonPropertyName("unit_price_ex_vat")] decimal UnitPriceExVat,
    [property: JsonPropertyName("line_total_ex_vat")] decimal LineTotalExVat,
    string? Notes,
    [property: JsonPropertyName("is_custom")] bool IsCustom,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt)
{
    public static ServiceJobResponse From(ServiceJobListItem job) =>
        new(
            job.Id,
            job.ServiceVisitId,
            job.JobCatalogId,
            job.JobNameSnapshot,
            job.CategorySnapshot,
            job.Quantity,
            job.UnitPriceExVat,
            job.LineTotalExVat,
            job.Notes,
            job.IsCustom,
            job.CreatedAt,
            job.UpdatedAt);
}

public sealed record VehicleResponse(
    Guid Id,
    [property: JsonPropertyName("user_id")] Guid UserId,
    string Name,
    string? Make,
    string? Model,
    string? Plate,
    int? Year,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt)
{
    public static VehicleResponse From(VehicleListItem vehicle) =>
        new(
            vehicle.Id,
            vehicle.UserId,
            vehicle.Name,
            vehicle.Make,
            vehicle.Model,
            vehicle.Plate,
            vehicle.Year,
            vehicle.CreatedAt,
            vehicle.UpdatedAt);
}
