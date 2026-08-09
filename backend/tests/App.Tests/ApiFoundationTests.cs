using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PortfolioTerminal.Api.Auth;

namespace PortfolioTerminal.Tests;

public sealed class ApiFoundationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string SupabaseUrl = "https://xcqxfyylqtcgmugpnjzt.supabase.co";
    private const string TestSupabaseUrl = "https://auth.test.invalid";
    private const string TestKeyId = "test-es256-key";
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public void SupabaseAuthorityBuildsTheExpectedJwksUri()
    {
        var options = factory.Services.GetRequiredService<IOptions<SupabaseAuthOptions>>().Value;

        Assert.Equal(SupabaseUrl, options.Url);
        Assert.Equal(
            $"{SupabaseUrl}/auth/v1/.well-known/jwks.json",
            options.JwksUri.AbsoluteUri);
    }

    [Fact]
    public async Task LivenessIsHealthy()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Healthy", payload.GetProperty("status").GetString());
    }

    [Fact]
    public async Task ReadinessReportsMissingDatabaseConfiguration()
    {
        var response = await _client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Unhealthy", payload.GetProperty("status").GetString());
        Assert.Equal(
            "Unhealthy",
            payload.GetProperty("checks").GetProperty("database").GetProperty("status").GetString());
    }

    [Fact]
    public async Task OpenApiDocumentContainsProtectedIdentityEndpoint()
    {
        var response = await _client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(document.GetProperty("paths").TryGetProperty("/api/me", out _));
    }

    [Fact]
    public async Task IdentityEndpointRequiresBearerToken()
    {
        var response = await _client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task IdentityEndpointReturnsAuthenticatedSubject()
    {
        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                        options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                    })
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.SchemeName,
                        _ => { });
            });
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TestAuthHandler.UserId, payload.GetProperty("id").GetString());
        Assert.Equal(TestAuthHandler.Email, payload.GetProperty("email").GetString());
    }

    [Fact]
    public async Task IdentityEndpointValidatesEs256TokenFromConfiguredJwksAndCachesKeys()
    {
        using var signingAlgorithm = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var signingKey = new ECDsaSecurityKey(signingAlgorithm)
        {
            KeyId = TestKeyId,
        };
        var expectedJwksUri = new Uri(
            $"{TestSupabaseUrl}/auth/v1/.well-known/jwks.json");
        var jwksHandler = new JwksTestHandler(
            expectedJwksUri,
            signingAlgorithm.ExportParameters(includePrivateParameters: false),
            TestKeyId);

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Supabase:Url"] = TestSupabaseUrl,
                    ["Supabase:Audience"] = "authenticated",
                });
            });
            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient("SupabaseAuth")
                    .ConfigurePrimaryHttpMessageHandler(() => jwksHandler);
            });
        });
        using var client = authenticatedFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateAccessToken(signingKey));

        var firstResponse = await client.GetAsync("/api/me");
        var secondResponse = await client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        var payload = await firstResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TestAuthHandler.UserId, payload.GetProperty("id").GetString());
        Assert.Equal(TestAuthHandler.Email, payload.GetProperty("email").GetString());
        Assert.Equal(expectedJwksUri, jwksHandler.RequestUri);
        Assert.Equal(1, jwksHandler.RequestCount);
    }

    private static string CreateAccessToken(SecurityKey signingKey)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = $"{TestSupabaseUrl}/auth/v1",
            Audience = "authenticated",
            Subject = new ClaimsIdentity(
            [
                new Claim("sub", TestAuthHandler.UserId),
                new Claim("email", TestAuthHandler.Email),
            ]),
            NotBefore = DateTime.UtcNow.AddMinutes(-1),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new SigningCredentials(
                signingKey,
                SecurityAlgorithms.EcdsaSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
