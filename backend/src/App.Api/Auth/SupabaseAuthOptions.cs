namespace PortfolioTerminal.Api.Auth;

public sealed class SupabaseAuthOptions
{
    public const string SectionName = "Supabase";

    public string Url { get; init; } = string.Empty;

    public string Audience { get; init; } = "authenticated";

    public int JwksRefreshMinutes { get; init; } = 15;

    public string Issuer => $"{Url.TrimEnd('/')}/auth/v1";

    public Uri JwksUri => new($"{Issuer}/.well-known/jwks.json");
}
