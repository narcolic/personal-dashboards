using Npgsql;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Energy;

namespace PortfolioTerminal.Api.Endpoints;

public static class EnergyEndpoints
{
    public static IEndpointRouteBuilder MapEnergyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/energy/bills").WithTags("Energy").RequireAuthorization();
        group.MapGet("", (IEnergyStore store, ICurrentUser user, CancellationToken ct) => store.ListAsync(user.UserId, ct));
        group.MapPost("", (EnergyInput input, IEnergyStore store, ICurrentUser user, CancellationToken ct) => Save(null, input, store, user, ct));
        group.MapPut("/{id:guid}", (Guid id, EnergyInput input, IEnergyStore store, ICurrentUser user, CancellationToken ct) => Save(id, input, store, user, ct));
        group.MapDelete("/{id:guid}", async Task<IResult> (Guid id, IEnergyStore store, ICurrentUser user, CancellationToken ct) =>
            await store.DeleteAsync(user.UserId, id, ct) ? Results.NoContent() : Results.NotFound());
        return endpoints;
    }

    private static async Task<IResult> Save(Guid? id, EnergyInput input, IEnergyStore store, ICurrentUser user, CancellationToken ct)
    {
        var errors = EnergyValidation.Validate(input);
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        try
        {
            var bill = await store.SaveAsync(user.UserId, id, input, ct);
            if (bill is null) return Results.NotFound();
            return id.HasValue ? Results.Ok(bill) : Results.Created($"/api/energy/bills/{bill.Id}", bill);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Results.Problem(statusCode: StatusCodes.Status409Conflict,
                detail: "This PDF or invoice has already been saved. Open the existing bill to edit it.");
        }
    }
}
