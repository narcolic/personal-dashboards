using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace PortfolioTerminal.Api.Auth;

internal sealed class ConfigureSupabaseJwtBearerOptions(
    SupabaseOpenIdConfigurationManager configurationManager,
    IOptions<SupabaseAuthOptions> supabaseOptions)
    : IConfigureNamedOptions<JwtBearerOptions>
{
    public void Configure(JwtBearerOptions options) =>
        Configure(JwtBearerDefaults.AuthenticationScheme, options);

    public void Configure(string? name, JwtBearerOptions options)
    {
        if (name != JwtBearerDefaults.AuthenticationScheme)
        {
            return;
        }

        var auth = supabaseOptions.Value;

        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = true;
        options.RefreshOnIssuerKeyNotFound = true;
        options.ConfigurationManager = configurationManager;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = auth.Issuer,
            ValidateAudience = true,
            ValidAudience = auth.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "sub",
            RoleClaimType = "role",
        };
    }
}
