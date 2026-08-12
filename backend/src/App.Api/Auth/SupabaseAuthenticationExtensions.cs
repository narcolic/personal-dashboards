using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;

namespace PortfolioTerminal.Api.Auth;

public static class SupabaseAuthenticationExtensions
{
    public static IServiceCollection AddSupabaseAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<SupabaseAuthOptions>()
            .Bind(configuration.GetSection(SupabaseAuthOptions.SectionName))
            .Validate(
                options => Uri.TryCreate(options.Url, UriKind.Absolute, out var uri)
                    && uri.Scheme == Uri.UriSchemeHttps,
                "Supabase:Url must be an absolute HTTPS URL.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.Audience),
                "Supabase:Audience is required.")
            .Validate(
                options => options.JwksRefreshMinutes is >= 1 and <= 1440,
                "Supabase:JwksRefreshMinutes must be between 1 and 1440.")
            .ValidateOnStart();

        services.AddOptions<McpAuthOptions>()
            .Bind(configuration.GetSection(McpAuthOptions.SectionName))
            .Validate(
                options => Uri.TryCreate(options.ResourceUri, UriKind.Absolute, out var uri)
                    && uri.Scheme == Uri.UriSchemeHttps,
                "Mcp:ResourceUri must be an absolute HTTPS URL.")
            .Validate(
                options => Uri.TryCreate(options.AuthorizationServer, UriKind.Absolute, out var uri)
                    && uri.Scheme == Uri.UriSchemeHttps,
                "Mcp:AuthorizationServer must be an absolute HTTPS URL.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.RequiredAccessClaim),
                "Mcp:RequiredAccessClaim is required.")
            .Validate(
                options => options.MaxHoldings is >= 1 and <= 500,
                "Mcp:MaxHoldings must be between 1 and 500.")
            .ValidateOnStart();

        services.AddHttpClient(SupabaseOpenIdConfigurationManager.HttpClientName, client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
        });

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<SupabaseOpenIdConfigurationManager>();
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, ConfigureSupabaseJwtBearerOptions>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer()
            .AddJwtBearer(McpAuthOptions.AuthenticationScheme, _ => { });
        services.AddAuthorization(options =>
        {
            options.AddPolicy(McpAuthOptions.AuthorizationPolicy, policy =>
            {
                policy.AddAuthenticationSchemes(McpAuthOptions.AuthenticationScheme);
                policy.RequireAuthenticatedUser();
                policy.RequireClaim("client_id");
                policy.RequireClaim("portfolio_access", configuration[$"{McpAuthOptions.SectionName}:RequiredAccessClaim"] ?? "read");
            });
        });

        return services;
    }
}
