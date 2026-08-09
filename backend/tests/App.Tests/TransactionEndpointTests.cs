using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Tests;

public sealed class TransactionEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task TransactionListRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/portfolio/transactions");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TransactionListForwardsFiltersAndPreservesJsonShape()
    {
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var portfolioId = Guid.NewGuid();
        var transactionId = Guid.NewGuid();
        var queries = new RecordingTransactionQueries(new TransactionListResult(
        [
            new TransactionListItem(
                transactionId,
                "AAPL",
                "buy",
                "Apple",
                "stock",
                "NASDAQ",
                "USD",
                2.5m,
                181.25m,
                new DateOnly(2026, 7, 8),
                null,
                portfolioId),
        ],
        31));
        using var authenticatedFactory = CreateAuthenticatedFactory(queries);
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync(
            $"/api/portfolio/transactions?page=2&pageSize=25&ticker=app&portfolioId={portfolioId}" +
            "&assetType=stock&currency=USD&dateFrom=2026-01-01&dateTo=2026-12-31");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, queries.RequestedUserId);
        Assert.NotNull(queries.RequestedFilter);
        Assert.Equal("app", queries.RequestedFilter.Ticker);
        Assert.Equal(portfolioId, queries.RequestedFilter.PortfolioId);
        Assert.Equal("stock", queries.RequestedFilter.AssetType);
        Assert.Equal("USD", queries.RequestedFilter.Currency);
        Assert.Equal(new DateOnly(2026, 1, 1), queries.RequestedFilter.DateFrom);
        Assert.Equal(new DateOnly(2026, 12, 31), queries.RequestedFilter.DateTo);
        Assert.Equal(25, queries.RequestedFilter.Offset);
        Assert.Equal(25, queries.RequestedFilter.Limit);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(31, payload.GetProperty("count").GetInt64());
        var transaction = Assert.Single(payload.GetProperty("rows").EnumerateArray());
        Assert.Equal(transactionId.ToString(), transaction.GetProperty("id").GetString());
        Assert.Equal("stock", transaction.GetProperty("asset_type").GetString());
        Assert.Equal("2026-07-08", transaction.GetProperty("transaction_date").GetString());
        Assert.Equal(portfolioId.ToString(), transaction.GetProperty("portfolio_id").GetString());
        Assert.Equal(2.5m, transaction.GetProperty("shares").GetDecimal());
        Assert.Equal(181.25m, transaction.GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task TransactionListSupportsUnassignedPortfolioFilter()
    {
        var queries = new RecordingTransactionQueries(new TransactionListResult([], 0));
        using var authenticatedFactory = CreateAuthenticatedFactory(queries);
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync(
            "/api/portfolio/transactions?unassignedPortfolio=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(queries.RequestedFilter?.UnassignedPortfolio);
        Assert.Null(queries.RequestedFilter?.PortfolioId);
        Assert.Null(queries.RequestedFilter?.Limit);
    }

    [Fact]
    public async Task TransactionListRejectsIncompletePagination()
    {
        var queries = new RecordingTransactionQueries(new TransactionListResult([], 0));
        using var authenticatedFactory = CreateAuthenticatedFactory(queries);
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync("/api/portfolio/transactions?page=1");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(queries.RequestedUserId);
    }

    private WebApplicationFactory<Program> CreateAuthenticatedFactory(
        ITransactionQueries queries) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ITransactionQueries>();
                services.AddSingleton(queries);
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

    private sealed class RecordingTransactionQueries(
        TransactionListResult result) : ITransactionQueries
    {
        public Guid? RequestedUserId { get; private set; }

        public TransactionListFilter? RequestedFilter { get; private set; }

        public Task<TransactionListResult> ListAsync(
            Guid userId,
            TransactionListFilter filter,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedFilter = filter;
            return Task.FromResult(result);
        }
    }
}
