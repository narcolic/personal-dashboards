using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Travel;

namespace PortfolioTerminal.Api.Endpoints;

public static class TravelEndpoints
{
    public static IEndpointRouteBuilder MapTravelEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/travel/places").WithTags("Travel").RequireAuthorization();
        group.MapGet("", (ITravelStore store, ICurrentUser user, CancellationToken ct) => store.ListAsync(user.UserId, ct));
        group.MapPost("", (TravelInput input, ITravelStore store, ICurrentUser user, CancellationToken ct) =>
            Save(null, input, store, user, ct));
        group.MapPut("/{id:guid}", (Guid id, TravelInput input, ITravelStore store, ICurrentUser user, CancellationToken ct) =>
            Save(id, input, store, user, ct));
        group.MapDelete("/{id:guid}", async Task<IResult> (Guid id, ITravelStore store, ICurrentUser user, CancellationToken ct) =>
            await store.DeleteAsync(user.UserId, id, ct) ? Results.NoContent() : Results.NotFound());
        return endpoints;
    }

    private static async Task<IResult> Save(Guid? id, TravelInput input, ITravelStore store, ICurrentUser user, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160)
            errors["name"] = ["Place name must be between 1 and 160 characters."];
        if (string.IsNullOrWhiteSpace(input.Country) || input.Country.Trim().Length > 100)
            errors["country"] = ["Country must be between 1 and 100 characters."];
        if (input.Latitude is not { } lat || !double.IsFinite(lat) || lat is < -90 or > 90)
            errors["latitude"] = ["Latitude must be between -90 and 90."];
        if (input.Longitude is not { } lng || !double.IsFinite(lng) || lng is < -180 or > 180)
            errors["longitude"] = ["Longitude must be between -180 and 180."];
        if (input.Note?.Length > 4000) errors["note"] = ["Note must be at most 4000 characters."];
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        var place = await store.SaveAsync(user.UserId, id, input, ct);
        if (place is null) return Results.NotFound();
        return id.HasValue ? Results.Ok(place) : Results.Created($"/api/travel/places/{place.Id}", place);
    }
}
