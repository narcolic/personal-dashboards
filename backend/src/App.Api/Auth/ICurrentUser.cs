namespace PortfolioTerminal.Api.Auth;

public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    Guid UserId { get; }

    string? Email { get; }

    string? ClientId { get; }
}
