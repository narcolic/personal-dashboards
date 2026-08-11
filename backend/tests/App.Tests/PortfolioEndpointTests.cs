using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.Snapshots;
using PortfolioTerminal.Portfolio.TickerCatalog;

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

    [Fact]
    public async Task TickerCatalogListUsesAuthenticatedSubjectAndPreservesClientContract()
    {
        var now = new DateTimeOffset(2026, 8, 11, 12, 0, 0, TimeSpan.Zero);
        var queries = new RecordingTickerCatalogQueries(
        [
            new TickerCatalogListItem(
                Guid.Parse("36fd25a9-923c-45b4-a327-1375bc3979a9"),
                Guid.Parse(TestAuthHandler.UserId),
                "VWCE.DE",
                "Vanguard FTSE All-World",
                "etf",
                "XETRA",
                "EUR",
                true,
                now,
                now),
        ]);

        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ITickerCatalogQueries>();
            services.AddSingleton<ITickerCatalogQueries>(queries);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync("/api/portfolio/ticker-catalog");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), queries.RequestedUserId);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var item = Assert.Single(payload.EnumerateArray());
        Assert.Equal("VWCE.DE", item.GetProperty("ticker").GetString());
        Assert.Equal("etf", item.GetProperty("asset_type").GetString());
        Assert.True(item.GetProperty("is_active").GetBoolean());
    }

    [Fact]
    public async Task SnapshotListUsesAuthenticatedSubjectAndRequestedLimit()
    {
        var snapshotId = Guid.Parse("7d29ff54-37cf-448f-b4fa-1e439b20f69a");
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var now = new DateTimeOffset(2026, 8, 11, 12, 0, 0, TimeSpan.Zero);
        var queries = new RecordingPortfolioSnapshotQueries(
        [
            new PortfolioSnapshotListItem(
                snapshotId,
                userId,
                new DateOnly(2026, 8, 11),
                now,
                "total",
                "total",
                null,
                null,
                1000m,
                1150m,
                800m,
                920m,
                200m,
                230m,
                JsonSerializer.Deserialize<JsonElement>("{\"failed\":[]}"),
                JsonSerializer.Deserialize<JsonElement>("{\"base\":\"USD\"}"),
                now,
                now),
        ]);

        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IPortfolioSnapshotQueries>();
            services.AddSingleton<IPortfolioSnapshotQueries>(queries);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync("/api/portfolio/snapshots?limit=25");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, queries.RequestedUserId);
        Assert.Equal(25, queries.RequestedLimit);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var item = Assert.Single(payload.EnumerateArray());
        Assert.Equal(snapshotId.ToString(), item.GetProperty("id").GetString());
        Assert.Equal("2026-08-11", item.GetProperty("snapshot_date").GetString());
        Assert.Equal(1000m, item.GetProperty("market_value_eur").GetDecimal());
        Assert.Equal(JsonValueKind.Array,
            item.GetProperty("quote_metadata").GetProperty("failed").ValueKind);
    }

    [Fact]
    public async Task SnapshotListRejectsLimitsAboveMaximum()
    {
        using var authenticatedFactory = CreateAuthenticatedFactory(_ => { });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync("/api/portfolio/snapshots?limit=1001");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private WebApplicationFactory<Program> CreateAuthenticatedFactory(
        Action<IServiceCollection> configureServices) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                configureServices(services);
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

    private sealed class RecordingTickerCatalogQueries(
        IReadOnlyList<TickerCatalogListItem> items) : ITickerCatalogQueries
    {
        public Guid? RequestedUserId { get; private set; }

        public Task<IReadOnlyList<TickerCatalogListItem>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            return Task.FromResult(items);
        }
    }

    private sealed class RecordingPortfolioSnapshotQueries(
        IReadOnlyList<PortfolioSnapshotListItem> items) : IPortfolioSnapshotQueries
    {
        public Guid? RequestedUserId { get; private set; }
        public int? RequestedLimit { get; private set; }

        public Task<IReadOnlyList<PortfolioSnapshotListItem>> ListAsync(
            Guid userId,
            int limit,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedLimit = limit;
            return Task.FromResult(items);
        }
    }
}
