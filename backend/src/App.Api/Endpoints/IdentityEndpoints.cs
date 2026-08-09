using PortfolioTerminal.Api.Auth;

namespace PortfolioTerminal.Api.Endpoints;

public static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/me", (ICurrentUser currentUser) =>
                TypedResults.Ok(new CurrentUserResponse(currentUser.UserId, currentUser.Email)))
            .WithName("GetCurrentUser")
            .WithTags("Identity")
            .RequireAuthorization();

        return endpoints;
    }
}

public sealed record CurrentUserResponse(Guid Id, string? Email);
