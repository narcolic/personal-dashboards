using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PortfolioTerminal.Portfolio.Portfolios;

namespace PortfolioTerminal.Tests;

public sealed class McpEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string SupabaseUrl = "https://mcp-auth.test.invalid";
    private const string ResourceUri = "https://portfolio-api.test.invalid/mcp";
    private const string KeyId = "mcp-test-key";

    [Fact]
    public async Task ProtectedResourceMetadataUsesCanonicalConfiguredResource()
    {
        using var configuredFactory = CreateFactory(out _);
        using var client = configuredFactory.CreateClient();

        var response = await client.GetAsync("/.well-known/oauth-protected-resource");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ResourceUri, payload.GetProperty("resource").GetString());
        Assert.Equal($"{SupabaseUrl}/auth/v1", payload.GetProperty("authorization_servers")[0].GetString());
        Assert.Equal("openid", payload.GetProperty("scopes_supported")[0].GetString());
    }

    [Fact]
    public async Task McpEndpointChallengesWithProtectedResourceMetadata()
    {
        using var configuredFactory = CreateFactory(out _);
        using var client = configuredFactory.CreateClient();

        var response = await SendMcpAsync(client, ToolsListRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains(
            "resource_metadata=\"https://portfolio-api.test.invalid/.well-known/oauth-protected-resource\"",
            response.Headers.WwwAuthenticate.ToString(),
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task McpTokenListsExactlySixReadOnlyPortfolioTools()
    {
        using var configuredFactory = CreateFactory(out var signingKey);
        using var client = configuredFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateAccessToken(signingKey, ResourceUri, includeMcpClaims: true));

        var response = await SendMcpAsync(client, ToolsListRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = await ReadMcpPayloadAsync(response);
        var tools = payload.RootElement.GetProperty("result").GetProperty("tools");
        var names = tools.EnumerateArray()
            .Select(tool => tool.GetProperty("name").GetString()!)
            .Order(StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
        [
            "portfolio_get_allocation",
            "portfolio_get_history",
            "portfolio_get_holdings",
            "portfolio_get_summary",
            "portfolio_list",
            "portfolio_simulate_purchase",
        ], names);
        Assert.All(tools.EnumerateArray(), tool =>
        {
            var annotations = tool.GetProperty("annotations");
            Assert.True(annotations.GetProperty("readOnlyHint").GetBoolean());
            Assert.False(annotations.GetProperty("destructiveHint").GetBoolean());
            Assert.False(annotations.GetProperty("openWorldHint").GetBoolean());
            var schemes = tool.GetProperty("_meta").GetProperty("securitySchemes");
            Assert.Equal("oauth2", schemes[0].GetProperty("type").GetString());
            Assert.Equal("openid", schemes[0].GetProperty("scopes")[0].GetString());
        });
    }

    [Fact]
    public async Task FrontendAudienceTokenCannotUseMcp()
    {
        using var configuredFactory = CreateFactory(out var signingKey);
        using var client = configuredFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateAccessToken(signingKey, "authenticated", includeMcpClaims: false));

        var response = await SendMcpAsync(client, ToolsListRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task McpAudienceWithoutReadClaimsIsForbidden()
    {
        using var configuredFactory = CreateFactory(out var signingKey);
        using var client = configuredFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateAccessToken(signingKey, ResourceUri, includeMcpClaims: false));

        var response = await SendMcpAsync(client, ToolsListRequest());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task McpAudienceTokenCannotUseRestApi()
    {
        using var configuredFactory = CreateFactory(out var signingKey);
        using var client = configuredFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateAccessToken(signingKey, ResourceUri, includeMcpClaims: true));

        var response = await client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PortfolioListToolUsesAuthenticatedSubjectAndReturnsStructuredContent()
    {
        var queries = new RecordingPortfolioQueries();
        using var configuredFactory = CreateFactory(out var signingKey, queries);
        using var client = configuredFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CreateAccessToken(signingKey, ResourceUri, includeMcpClaims: true));

        var response = await SendMcpAsync(client, ToolCallRequest("portfolio_list"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = await ReadMcpPayloadAsync(response);
        var result = payload.RootElement.GetProperty("result");
        Assert.False(result.TryGetProperty("isError", out var isError) && isError.GetBoolean());
        var structured = result.GetProperty("structuredContent");
        Assert.Equal("all", structured.GetProperty("defaultScope").GetString());
        Assert.Equal("Growth", structured.GetProperty("portfolios")[0].GetProperty("name").GetString());
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), queries.UserId);
    }

    private WebApplicationFactory<Program> CreateFactory(
        out ECDsaSecurityKey signingKey,
        IPortfolioQueries? portfolioQueries = null)
    {
        var algorithm = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        signingKey = new ECDsaSecurityKey(algorithm) { KeyId = KeyId };
        var jwksUri = new Uri($"{SupabaseUrl}/auth/v1/.well-known/jwks.json");
        var handler = new JwksTestHandler(
            jwksUri,
            algorithm.ExportParameters(includePrivateParameters: false),
            KeyId);

        return factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Supabase:Url"] = SupabaseUrl,
                    ["Mcp:ResourceUri"] = ResourceUri,
                    ["Mcp:AuthorizationServer"] = $"{SupabaseUrl}/auth/v1",
                }));
            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient("SupabaseAuth")
                    .ConfigurePrimaryHttpMessageHandler(() => handler);
                if (portfolioQueries is not null)
                {
                    services.RemoveAll<IPortfolioQueries>();
                    services.AddSingleton(portfolioQueries);
                }
            });
        });
    }

    private static string CreateAccessToken(
        SecurityKey signingKey,
        string audience,
        bool includeMcpClaims)
    {
        List<Claim> claims =
        [
            new("sub", TestAuthHandler.UserId),
            new("email", TestAuthHandler.Email),
        ];
        if (includeMcpClaims)
        {
            claims.Add(new("client_id", "44444444-4444-4444-4444-444444444444"));
            claims.Add(new("portfolio_access", "read"));
        }

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = $"{SupabaseUrl}/auth/v1",
            Audience = audience,
            Subject = new ClaimsIdentity(claims),
            NotBefore = DateTime.UtcNow.AddMinutes(-1),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new SigningCredentials(signingKey, SecurityAlgorithms.EcdsaSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    private static StringContent ToolsListRequest() => new(
        """{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}""",
        Encoding.UTF8,
        "application/json");

    private static StringContent ToolCallRequest(string tool) => new(
        JsonSerializer.Serialize(new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "tools/call",
            @params = new { name = tool, arguments = new { } },
        }),
        Encoding.UTF8,
        "application/json");

    private static async Task<HttpResponseMessage> SendMcpAsync(HttpClient client, HttpContent content)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp") { Content = content };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        request.Headers.TryAddWithoutValidation("MCP-Protocol-Version", "2025-11-25");
        return await client.SendAsync(request).ConfigureAwait(false);
    }

    private static async Task<JsonDocument> ReadMcpPayloadAsync(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        if (response.Content.Headers.ContentType?.MediaType == "text/event-stream")
        {
            var data = content.Split('\n')
                .Select(line => line.TrimEnd('\r'))
                .First(line => line.StartsWith("data: ", StringComparison.Ordinal))[6..];
            return JsonDocument.Parse(data);
        }
        return JsonDocument.Parse(content);
    }

    private sealed class RecordingPortfolioQueries : IPortfolioQueries
    {
        public Guid? UserId { get; private set; }

        public Task<IReadOnlyList<PortfolioListItem>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            UserId = userId;
            return Task.FromResult<IReadOnlyList<PortfolioListItem>>(
            [
                new(Guid.Parse("55555555-5555-5555-5555-555555555555"), "Growth", "Broker", null),
            ]);
        }
    }
}
