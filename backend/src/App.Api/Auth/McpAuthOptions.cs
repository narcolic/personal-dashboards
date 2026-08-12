namespace PortfolioTerminal.Api.Auth;

public sealed class McpAuthOptions
{
    public const string SectionName = "Mcp";
    public const string AuthenticationScheme = "McpBearer";
    public const string AuthorizationPolicy = "McpReadOnly";

    public string ResourceUri { get; init; } = string.Empty;
    public string AuthorizationServer { get; init; } = string.Empty;
    public string RequiredAccessClaim { get; init; } = "read";
    public int MaxHoldings { get; init; } = 100;
}
