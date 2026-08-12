using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace PortfolioTerminal.Api.Auth;

internal sealed class ConfigureSupabaseJwtBearerOptions(
    SupabaseOpenIdConfigurationManager configurationManager,
    IOptions<SupabaseAuthOptions> supabaseOptions,
    IOptions<McpAuthOptions> mcpOptions)
    : IConfigureNamedOptions<JwtBearerOptions>
{
    public void Configure(JwtBearerOptions options) =>
        Configure(JwtBearerDefaults.AuthenticationScheme, options);

    public void Configure(string? name, JwtBearerOptions options)
    {
        if (name is not (JwtBearerDefaults.AuthenticationScheme or McpAuthOptions.AuthenticationScheme))
        {
            return;
        }

        var auth = supabaseOptions.Value;
        var audience = name == McpAuthOptions.AuthenticationScheme
            ? mcpOptions.Value.ResourceUri
            : auth.Audience;

        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = true;
        options.RefreshOnIssuerKeyNotFound = true;
        options.ConfigurationManager = configurationManager;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = auth.Issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "sub",
            RoleClaimType = "role",
        };

        if (name == McpAuthOptions.AuthenticationScheme)
        {
            options.Events = new JwtBearerEvents
            {
                OnChallenge = context =>
                {
                    var metadata = new Uri(new Uri(mcpOptions.Value.ResourceUri), "/.well-known/oauth-protected-resource");
                    context.Response.Headers.WWWAuthenticate =
                        $"Bearer resource_metadata=\"{metadata.AbsoluteUri}\", scope=\"openid\"";
                    return Task.CompletedTask;
                },
            };
        }
    }
}
