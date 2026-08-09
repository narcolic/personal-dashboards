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

        services.AddHttpClient(SupabaseOpenIdConfigurationManager.HttpClientName, client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
        });

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<SupabaseOpenIdConfigurationManager>();
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, ConfigureSupabaseJwtBearerOptions>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();
        services.AddAuthorization();

        return services;
    }
}
