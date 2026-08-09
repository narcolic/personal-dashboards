using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.Portfolio.Portfolios;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task PortfolioListRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/portfolio/portfolios");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PortfolioListUsesAuthenticatedSubjectAndReturnsItems()
    {
        var expectedPortfolioId = Guid.Parse("b9e94829-e191-4f77-8d12-152f1db718c1");
        var queries = new RecordingPortfolioQueries(
        [
            new PortfolioListItem(
                expectedPortfolioId,
                "Main",
                "Example Broker",
                null),
        ]);

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IPortfolioQueries>();
                services.AddSingleton<IPortfolioQueries>(queries);
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

        var response = await client.GetAsync("/api/portfolio/portfolios");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), queries.RequestedUserId);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var portfolio = Assert.Single(payload.EnumerateArray());
        Assert.Equal(expectedPortfolioId.ToString(), portfolio.GetProperty("id").GetString());
        Assert.Equal("Main", portfolio.GetProperty("name").GetString());
        Assert.Equal("Example Broker", portfolio.GetProperty("broker").GetString());
        Assert.Equal(JsonValueKind.Null, portfolio.GetProperty("notes").ValueKind);
    }

    private sealed class RecordingPortfolioQueries(
        IReadOnlyList<PortfolioListItem> portfolios) : IPortfolioQueries
    {
        public Guid? RequestedUserId { get; private set; }

        public Task<IReadOnlyList<PortfolioListItem>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            return Task.FromResult(portfolios);
        }
    }
}
