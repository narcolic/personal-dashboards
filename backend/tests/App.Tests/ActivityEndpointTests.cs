using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.Portfolio.Activity;

namespace PortfolioTerminal.Tests;

public sealed class ActivityEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task RequiresBearerToken()
    {
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/portfolio/activity")).StatusCode);
    }

    [Fact]
    public async Task ForwardsUserFiltersSortAndPaginationAndPreservesWithdrawalShape()
    {
        var portfolioId = Guid.NewGuid();
        var queries = new RecordingQueries();
        using var host = Authenticated(queries);
        using var client = host.CreateClient();
        var response = await client.GetAsync($"/api/portfolio/activity?page=2&pageSize=25&portfolioId={portfolioId}&currency=EUR&dateFrom=2026-01-01&dateTo=2026-12-31&sort=action&direction=asc");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), queries.UserId);
        var filter = Assert.IsType<ActivityListFilter>(queries.Filter);
        Assert.Equal(portfolioId, filter.Transactions.PortfolioId);
        Assert.Equal("EUR", filter.Transactions.Currency);
        Assert.Equal(new DateOnly(2026, 1, 1), filter.Transactions.DateFrom);
        Assert.Equal(new DateOnly(2026, 12, 31), filter.Transactions.DateTo);
        Assert.Equal(25, filter.Transactions.Offset);
        Assert.Equal(25, filter.Transactions.Limit);
        Assert.Equal("action", filter.Sort);
        Assert.Equal("asc", filter.Direction);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(31, json.GetProperty("count").GetInt64());
        var row = Assert.Single(json.GetProperty("rows").EnumerateArray());
        Assert.Equal("withdrawal", row.GetProperty("kind").GetString());
        Assert.Equal("withdrawal", row.GetProperty("action").GetString());
        Assert.Equal("EUR", row.GetProperty("transaction_currency").GetString());
        Assert.Equal("2026-09-16", row.GetProperty("transaction_date").GetString());
        Assert.Equal(125m, row.GetProperty("amount").GetDecimal());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("shares").ValueKind);
        Assert.Equal(JsonValueKind.Null, row.GetProperty("security").ValueKind);
    }

    [Fact]
    public async Task DefaultsToDateDescendingAndSupportsSecurityAndUnassignedFilters()
    {
        var queries = new RecordingQueries();
        using var host = Authenticated(queries);
        using var client = host.CreateClient();
        var response = await client.GetAsync("/api/portfolio/activity?ticker=app&assetType=stock&unassignedPortfolio=true");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("transaction_date", queries.Filter!.Sort);
        Assert.Equal("desc", queries.Filter.Direction);
        Assert.Equal("app", queries.Filter.Transactions.Ticker);
        Assert.Equal("stock", queries.Filter.Transactions.AssetType);
        Assert.True(queries.Filter.Transactions.UnassignedPortfolio);
        Assert.Null(queries.Filter.Transactions.Limit);
    }

    [Theory]
    [InlineData("page=1")]
    [InlineData("page=0&pageSize=25")]
    [InlineData("page=1&pageSize=201")]
    [InlineData("page=2147483647&pageSize=200")]
    [InlineData("sort=anything")]
    [InlineData("direction=sideways")]
    [InlineData("dateFrom=2026-12-31&dateTo=2026-01-01")]
    [InlineData("portfolioId=00000000-0000-0000-0000-000000000001&unassignedPortfolio=true")]
    public async Task RejectsInvalidQueriesBeforeReadingData(string query)
    {
        var queries = new RecordingQueries();
        using var host = Authenticated(queries);
        using var client = host.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/portfolio/activity?{query}")).StatusCode);
        Assert.Null(queries.UserId);
    }

    private WebApplicationFactory<Program> Authenticated(IActivityQueries queries) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IActivityQueries>();
            services.AddSingleton(queries);
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        }));

    private sealed class RecordingQueries : IActivityQueries
    {
        public Guid? UserId { get; private set; }
        public ActivityListFilter? Filter { get; private set; }
        public Task<ActivityListResult> ListAsync(Guid userId, ActivityListFilter filter, CancellationToken cancellationToken = default)
        {
            UserId = userId; Filter = filter;
            return Task.FromResult(new ActivityListResult([
                new ActivityListItem("withdrawal", Guid.NewGuid(), "withdrawal", "EUR", null, null,
                    new DateOnly(2026, 9, 16), null, null, null, 125m)], 31));
        }
    }
}
