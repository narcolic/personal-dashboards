using System.Text.Json.Serialization;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.CarService;
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

        group.MapPost("/vehicles", CreateVehicleAsync)
            .WithName("CreateVehicle");
        group.MapPut("/vehicles/{vehicleId:guid}", UpdateVehicleAsync)
            .WithName("UpdateVehicle");
        group.MapDelete("/vehicles/{vehicleId:guid}", DeleteVehicleAsync)
            .WithName("DeleteVehicle");

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

        group.MapPost("/visits", CreateServiceVisitAsync)
            .WithName("CreateServiceVisit");
        group.MapPut("/visits/{visitId:guid}", UpdateServiceVisitAsync)
            .WithName("UpdateServiceVisit");
        group.MapDelete("/visits/{visitId:guid}", DeleteServiceVisitAsync)
            .WithName("DeleteServiceVisit");

        group.MapGet("/analytics", async Task<IResult> (
                Guid? vehicleId,
                string? period,
                ICarServiceAnalytics analytics,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                if (!CarServiceAnalyticsPeriods.TryParse(period, out var parsedPeriod))
                {
                    return TypedResults.BadRequest(new
                    {
                        error = "Invalid analytics period. Use last12m, ytd, last3y, or all.",
                    });
                }

                var result = await analytics.GetAsync(
                    currentUser.UserId,
                    vehicleId,
                    parsedPeriod,
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

        group.MapPost("/reminders", CreateServiceReminderAsync)
            .WithName("CreateServiceReminder");
        group.MapPut("/reminders/{reminderId:guid}", UpdateServiceReminderAsync)
            .WithName("UpdateServiceReminder");
        group.MapDelete("/reminders/{reminderId:guid}", DeleteServiceReminderAsync)
            .WithName("DeleteServiceReminder");

        return endpoints;
    }

    private static async Task<IResult> CreateVehicleAsync(
        VehicleMutationRequest request,
        IVehicleCommands commands,
        IVehicleQueries queries,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.CreateAsync(
            currentUser.UserId,
            request.ToMutation(),
            cancellationToken);
        if (result.Status != MutationStatus.Success)
        {
            return ToErrorResult(result);
        }

        var vehicle = await queries.GetAsync(
            currentUser.UserId,
            result.Id!.Value,
            cancellationToken);
        return vehicle is null
            ? ToErrorResult(MutationResult.Missing("Vehicle not found."))
            : TypedResults.Created(
                $"/api/car-service/vehicles/{result.Id}",
                VehicleResponse.From(vehicle));
    }

    private static async Task<IResult> UpdateVehicleAsync(
        Guid vehicleId,
        VehicleMutationRequest request,
        IVehicleCommands commands,
        IVehicleQueries queries,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.UpdateAsync(
            currentUser.UserId,
            vehicleId,
            request.ToMutation(),
            cancellationToken);
        if (result.Status != MutationStatus.Success)
        {
            return ToErrorResult(result);
        }

        var vehicle = await queries.GetAsync(
            currentUser.UserId,
            vehicleId,
            cancellationToken);
        return vehicle is null
            ? ToErrorResult(MutationResult.Missing("Vehicle not found."))
            : TypedResults.Ok(VehicleResponse.From(vehicle));
    }

    private static async Task<IResult> DeleteVehicleAsync(
        Guid vehicleId,
        IVehicleCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken) =>
        ToDeleteResult(await commands.DeleteAsync(
            currentUser.UserId,
            vehicleId,
            cancellationToken));

    private static async Task<IResult> CreateServiceVisitAsync(
        ServiceVisitMutationRequest request,
        IServiceVisitCommands commands,
        IServiceVisitQueries queries,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.CreateAsync(
            currentUser.UserId,
            request.ToMutation(),
            cancellationToken);
        if (result.Status != MutationStatus.Success)
        {
            return ToErrorResult(result);
        }

        var visit = await queries.GetAsync(
            currentUser.UserId,
            result.Id!.Value,
            cancellationToken);
        return visit is null
            ? ToErrorResult(MutationResult.Missing("Service visit not found."))
            : TypedResults.Created(
                $"/api/car-service/visits/{result.Id}",
                ServiceVisitResponse.From(visit));
    }

    private static async Task<IResult> UpdateServiceVisitAsync(
        Guid visitId,
        ServiceVisitMutationRequest request,
        IServiceVisitCommands commands,
        IServiceVisitQueries queries,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.UpdateAsync(
            currentUser.UserId,
            visitId,
            request.ToMutation(),
            cancellationToken);
        if (result.Status != MutationStatus.Success)
        {
            return ToErrorResult(result);
        }

        var visit = await queries.GetAsync(
            currentUser.UserId,
            visitId,
            cancellationToken);
        return visit is null
            ? ToErrorResult(MutationResult.Missing("Service visit not found."))
            : TypedResults.Ok(ServiceVisitResponse.From(visit));
    }

    private static async Task<IResult> DeleteServiceVisitAsync(
        Guid visitId,
        IServiceVisitCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken) =>
        ToDeleteResult(await commands.DeleteAsync(
            currentUser.UserId,
            visitId,
            cancellationToken));

    private static async Task<IResult> CreateServiceReminderAsync(
        ServiceReminderMutationRequest request,
        IServiceReminderCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.CreateAsync(
            currentUser.UserId,
            request.ToMutation(),
            cancellationToken);
        return result.Status == MutationStatus.Success
            ? TypedResults.Created(
                $"/api/car-service/reminders/{result.Id}",
                new MutationIdResponse(result.Id!.Value))
            : ToErrorResult(result);
    }

    private static async Task<IResult> UpdateServiceReminderAsync(
        Guid reminderId,
        ServiceReminderMutationRequest request,
        IServiceReminderCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.UpdateAsync(
            currentUser.UserId,
            reminderId,
            request.ToMutation(),
            cancellationToken);
        return result.Status == MutationStatus.Success
            ? TypedResults.Ok(new MutationIdResponse(reminderId))
            : ToErrorResult(result);
    }

    private static async Task<IResult> DeleteServiceReminderAsync(
        Guid reminderId,
        IServiceReminderCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken) =>
        ToDeleteResult(await commands.DeleteAsync(
            currentUser.UserId,
            reminderId,
            cancellationToken));

    private static IResult ToDeleteResult(MutationResult result) =>
        result.Status == MutationStatus.Success
            ? TypedResults.NoContent()
            : ToErrorResult(result);

    private static IResult ToErrorResult(MutationResult result) =>
        result.Status switch
        {
            MutationStatus.NotFound => Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Resource not found.",
                detail: result.Detail),
            MutationStatus.Conflict => Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "The request conflicts with existing data.",
                detail: result.Detail),
            _ => Results.Problem(statusCode: StatusCodes.Status500InternalServerError),
        };

    private static Dictionary<string, string[]> Validate(VehicleMutationRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Make)) errors["make"] = ["Make is required."];
        if (string.IsNullOrWhiteSpace(request.Model)) errors["model"] = ["Model is required."];
        if (string.IsNullOrWhiteSpace(request.Plate)) errors["plate"] = ["License plate is required."];
        if (request.Year < 1886) errors["year"] = ["Year must be 1886 or later."];
        if (request.AnnualServiceIntervalKm <= 0) errors["annualServiceIntervalKm"] = ["Distance interval must be greater than zero."];
        if (request.AnnualServiceIntervalMonths <= 0) errors["annualServiceIntervalMonths"] = ["Month interval must be greater than zero."];
        return errors;
    }

    private static Dictionary<string, string[]> Validate(ServiceVisitMutationRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.VehicleId == Guid.Empty) errors["vehicle_id"] = ["Vehicle is required."];
        if (request.OdometerKm < 0) errors["odometer_km"] = ["Odometer must not be negative."];
        if (request.VatRate is < 0 or > 1) errors["vat_rate"] = ["VAT rate must be between zero and one."];
        for (var index = 0; index < request.Jobs.Count; index++)
        {
            var job = request.Jobs[index];
            if (string.IsNullOrWhiteSpace(job.JobName)) errors[$"jobs[{index}].jobName"] = ["Job name is required."];
            if (job.Quantity <= 0) errors[$"jobs[{index}].quantity"] = ["Quantity must be greater than zero."];
            if (job.UnitPriceExVat < 0) errors[$"jobs[{index}].unitPriceExVat"] = ["Unit price must not be negative."];
        }
        return errors;
    }

    private static Dictionary<string, string[]> Validate(ServiceReminderMutationRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.VehicleId == Guid.Empty) errors["vehicle_id"] = ["Vehicle is required."];
        if (string.IsNullOrWhiteSpace(request.JobName)) errors["job_name"] = ["Job name is required."];
        if (request.IntervalKm is null && request.IntervalMonths is null) errors["interval"] = ["A distance or month interval is required."];
        if (request.IntervalKm is <= 0) errors["interval_km"] = ["Distance interval must be greater than zero."];
        if (request.IntervalMonths is <= 0) errors["interval_months"] = ["Month interval must be greater than zero."];
        if (request.WarningKm is < 0) errors["warning_km"] = ["Distance warning must not be negative."];
        if (request.WarningDays is < 0) errors["warning_days"] = ["Day warning must not be negative."];
        return errors;
    }
}

public sealed record MutationIdResponse(Guid Id);

public sealed record VehicleMutationRequest(
    string Make,
    string Model,
    int Year,
    string Plate,
    string? Colour,
    string? Notes,
    int AnnualServiceIntervalKm = 15000,
    int AnnualServiceIntervalMonths = 12)
{
    public VehicleMutation ToMutation() =>
        new(Make, Model, Year, Plate, Colour, Notes,
            AnnualServiceIntervalKm, AnnualServiceIntervalMonths);
}

public sealed record ServiceVisitMutationRequest(
    [property: JsonPropertyName("vehicle_id")] Guid VehicleId,
    [property: JsonPropertyName("service_date")] DateOnly ServiceDate,
    [property: JsonPropertyName("odometer_km")] int OdometerKm,
    string? Workshop,
    string? Notes,
    [property: JsonPropertyName("vat_rate")] decimal VatRate,
    [property: JsonPropertyName("is_annual_service")] bool IsAnnualService,
    IReadOnlyList<ServiceJobMutationRequest> Jobs)
{
    public ServiceVisitMutation ToMutation() =>
        new(VehicleId, ServiceDate, OdometerKm, Workshop, Notes, VatRate,
            IsAnnualService, Jobs.Select(job => job.ToMutation()).ToArray());
}

public sealed record ServiceJobMutationRequest(
    string JobName,
    string? Category,
    decimal Quantity,
    decimal UnitPriceExVat,
    string? Notes)
{
    public ServiceJobMutation ToMutation() =>
        new(JobName, Category, Quantity, UnitPriceExVat, Notes);
}

public sealed record ServiceReminderMutationRequest(
    [property: JsonPropertyName("vehicle_id")] Guid VehicleId,
    [property: JsonPropertyName("job_name")] string JobName,
    [property: JsonPropertyName("interval_km")] int? IntervalKm,
    [property: JsonPropertyName("interval_months")] int? IntervalMonths,
    [property: JsonPropertyName("warning_km")] int? WarningKm,
    [property: JsonPropertyName("warning_days")] int? WarningDays,
    string? Notes,
    [property: JsonPropertyName("is_active")] bool IsActive)
{
    public ServiceReminderMutation ToMutation() =>
        new(VehicleId, JobName, IntervalKm, IntervalMonths,
            WarningKm, WarningDays, Notes, IsActive);
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
