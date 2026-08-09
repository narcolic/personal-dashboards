using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.CarService.Reminders;

namespace PortfolioTerminal.Tests;

public sealed class ServiceReminderEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ReminderListRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/car-service/reminders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ReminderListForwardsFiltersAndPreservesJsonShape()
    {
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var vehicleId = Guid.NewGuid();
        var reminderId = Guid.NewGuid();
        var service = new RecordingReminderService(
        [
            new ServiceReminderWithStatus(
                reminderId,
                userId,
                vehicleId,
                "Oil change",
                15_000,
                12,
                500,
                30,
                null,
                true,
                new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
                "DUE SOON",
                new DateOnly(2026, 1, 1),
                10_000,
                500,
                20),
        ]);

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IServiceReminderService>();
                services.AddSingleton<IServiceReminderService>(service);
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

        var response = await client.GetAsync(
            $"/api/car-service/reminders?vehicleId={vehicleId}&activeOnly=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, service.RequestedUserId);
        Assert.Equal(vehicleId, service.RequestedVehicleId);
        Assert.True(service.RequestedActiveOnly);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var reminder = Assert.Single(payload.EnumerateArray());
        Assert.Equal(reminderId.ToString(), reminder.GetProperty("id").GetString());
        Assert.Equal(vehicleId.ToString(), reminder.GetProperty("vehicle_id").GetString());
        Assert.Equal("Oil change", reminder.GetProperty("job_name").GetString());
        Assert.Equal(15_000, reminder.GetProperty("interval_km").GetInt32());
        Assert.Equal("DUE SOON", reminder.GetProperty("status").GetString());
        Assert.Equal("2026-01-01", reminder.GetProperty("lastDoneDate").GetString());
        Assert.Equal(500, reminder.GetProperty("kmRemaining").GetInt32());
        Assert.False(reminder.TryGetProperty("last_done_date", out _));
    }

    [Fact]
    public async Task ReminderListDefaultsActiveOnlyToFalseWhenOmitted()
    {
        var vehicleId = Guid.NewGuid();
        var service = new RecordingReminderService([]);

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IServiceReminderService>();
                services.AddSingleton<IServiceReminderService>(service);
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

        var response = await client.GetAsync(
            $"/api/car-service/reminders?vehicleId={vehicleId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(vehicleId, service.RequestedVehicleId);
        Assert.False(service.RequestedActiveOnly);
    }

    private sealed class RecordingReminderService(
        IReadOnlyList<ServiceReminderWithStatus> reminders) : IServiceReminderService
    {
        public Guid? RequestedUserId { get; private set; }

        public Guid? RequestedVehicleId { get; private set; }

        public bool RequestedActiveOnly { get; private set; }

        public Task<IReadOnlyList<ServiceReminderWithStatus>> ListAsync(
            Guid userId,
            Guid? vehicleId,
            bool activeOnly,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedVehicleId = vehicleId;
            RequestedActiveOnly = activeOnly;
            return Task.FromResult(reminders);
        }
    }
}
