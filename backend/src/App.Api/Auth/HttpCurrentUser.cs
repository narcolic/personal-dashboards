using System.Security.Claims;

namespace PortfolioTerminal.Api.Auth;

internal sealed class HttpCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal Principal =>
        httpContextAccessor.HttpContext?.User
        ?? throw new InvalidOperationException("No active HTTP context is available.");

    public bool IsAuthenticated => Principal.Identity?.IsAuthenticated == true;

    public Guid UserId
    {
        get
        {
            var subject = Principal.FindFirstValue("sub");
            return Guid.TryParse(subject, out var userId)
                ? userId
                : throw new InvalidOperationException(
                    "The authenticated access token does not contain a valid subject.");
        }
    }

    public string? Email => Principal.FindFirstValue("email");

    public string? ClientId => Principal.FindFirstValue("client_id");
}
