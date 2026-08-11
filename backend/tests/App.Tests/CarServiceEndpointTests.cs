using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.CarService.Vehicles;

namespace PortfolioTerminal.Tests;

public sealed class CarServiceEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task VehicleListRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/car-service/vehicles");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task VehicleListUsesAuthenticatedSubjectAndPreservesJsonShape()
    {
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var vehicleId = Guid.Parse("05a41de7-d5ea-43a9-bfc3-cab59b619143");
        var createdAt = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var queries = new RecordingVehicleQueries(
        [
            new VehicleListItem(
                vehicleId,
                userId,
                "Example||{}",
                "Example",
                "Model",
                "ABC-123",
                2024,
                createdAt,
                createdAt.AddDays(1)),
        ]);

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IVehicleQueries>();
                services.AddSingleton<IVehicleQueries>(queries);
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

        var response = await client.GetAsync("/api/car-service/vehicles");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, queries.RequestedUserId);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var vehicle = Assert.Single(payload.EnumerateArray());
        Assert.Equal(vehicleId.ToString(), vehicle.GetProperty("id").GetString());
        Assert.Equal(userId.ToString(), vehicle.GetProperty("user_id").GetString());
        Assert.Equal("Example", vehicle.GetProperty("make").GetString());
        Assert.Equal(2024, vehicle.GetProperty("year").GetInt32());
        Assert.True(vehicle.TryGetProperty("created_at", out _));
        Assert.True(vehicle.TryGetProperty("updated_at", out _));
        Assert.False(vehicle.TryGetProperty("userId", out _));
    }

    private sealed class RecordingVehicleQueries(
        IReadOnlyList<VehicleListItem> vehicles) : IVehicleQueries
    {
        public Guid? RequestedUserId { get; private set; }

        public Task<VehicleListItem?> GetAsync(
            Guid userId,
            Guid vehicleId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            return Task.FromResult(vehicles.SingleOrDefault(vehicle => vehicle.Id == vehicleId));
        }

        public Task<IReadOnlyList<VehicleListItem>> ListAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            return Task.FromResult(vehicles);
        }
    }
}
