using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.CarService.Analytics;

namespace PortfolioTerminal.Tests;

public sealed class CarServiceAnalyticsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AnalyticsRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/car-service/analytics");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AnalyticsForwardsVehicleFilterAndReturnsCamelCaseContract()
    {
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var vehicleId = Guid.NewGuid();
        var analytics = new RecordingAnalytics(new CarServiceAnalyticsResult(
            2,
            300m,
            200m,
            new DateOnly(2026, 6, 1),
            20_000,
            150m,
            5_000m,
            30m,
            new MostExpensiveVisitResult(Guid.NewGuid(), new DateOnly(2026, 6, 1), 200m),
            [new AnnualSpendResult("2026", 200m)],
            [new CategorySpendResult("SERVICE", 120m)],
            [new TopJobResult("Oil change", 2, 120m)]));

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ICarServiceAnalytics>();
                services.AddSingleton<ICarServiceAnalytics>(analytics);
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

        var response = await client.GetAsync($"/api/car-service/analytics?vehicleId={vehicleId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, analytics.RequestedUserId);
        Assert.Equal(vehicleId, analytics.RequestedVehicleId);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, payload.GetProperty("visitCount").GetInt32());
        Assert.Equal(300m, payload.GetProperty("totalLifetimeCost").GetDecimal());
        Assert.Equal("2026-06-01", payload.GetProperty("lastVisitDate").GetString());
        Assert.Equal("Oil change", payload.GetProperty("topJobs")[0]
            .GetProperty("jobName").GetString());
        Assert.False(payload.TryGetProperty("VisitCount", out _));
    }

    private sealed class RecordingAnalytics(
        CarServiceAnalyticsResult result) : ICarServiceAnalytics
    {
        public Guid? RequestedUserId { get; private set; }

        public Guid? RequestedVehicleId { get; private set; }

        public Task<CarServiceAnalyticsResult> GetAsync(
            Guid userId,
            Guid? vehicleId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedVehicleId = vehicleId;
            return Task.FromResult(result);
        }
    }
}
