using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.Tests;

public sealed class ServiceVisitEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ServiceVisitListRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/car-service/visits");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ServiceVisitDetailRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync($"/api/car-service/visits/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ServiceVisitListForwardsFilterAndPreservesNestedJsonShape()
    {
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var vehicleId = Guid.Parse("05a41de7-d5ea-43a9-bfc3-cab59b619143");
        var visitId = Guid.Parse("be1515c4-dae1-4dda-b5a9-6c40eed5e186");
        var jobId = Guid.Parse("172eeab5-8fd8-4a59-9453-07ca6542b349");
        var createdAt = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var queries = new RecordingServiceVisitQueries(
        [
            new ServiceVisitListItem(
                visitId,
                vehicleId,
                userId,
                new DateOnly(2026, 1, 2),
                12345,
                "Example Garage",
                null,
                0.19m,
                100m,
                19m,
                119m,
                createdAt,
                createdAt.AddDays(1),
                true,
                [
                    new ServiceJobListItem(
                        jobId,
                        visitId,
                        null,
                        "Oil change",
                        "SERVICE",
                        1m,
                        100m,
                        100m,
                        null,
                        true,
                        createdAt,
                        createdAt),
                ]),
        ]);

        using var authenticatedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IServiceVisitQueries>();
                services.AddSingleton<IServiceVisitQueries>(queries);
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

        var response = await client.GetAsync($"/api/car-service/visits?vehicleId={vehicleId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, queries.RequestedUserId);
        Assert.Equal(vehicleId, queries.RequestedVehicleId);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var visit = Assert.Single(payload.EnumerateArray());
        Assert.Equal(visitId.ToString(), visit.GetProperty("id").GetString());
        Assert.Equal(vehicleId.ToString(), visit.GetProperty("vehicle_id").GetString());
        Assert.Equal(userId.ToString(), visit.GetProperty("user_id").GetString());
        Assert.Equal("2026-01-02", visit.GetProperty("service_date").GetString());
        Assert.Equal(12345, visit.GetProperty("odometer_km").GetInt32());
        Assert.Equal(119m, visit.GetProperty("total_amount").GetDecimal());
        Assert.True(visit.GetProperty("is_annual_service").GetBoolean());

        var job = Assert.Single(visit.GetProperty("jobs").EnumerateArray());
        Assert.Equal(jobId.ToString(), job.GetProperty("id").GetString());
        Assert.Equal(visitId.ToString(), job.GetProperty("service_visit_id").GetString());
        Assert.Equal("Oil change", job.GetProperty("job_name_snapshot").GetString());
        Assert.Equal(100m, job.GetProperty("line_total_ex_vat").GetDecimal());
        Assert.True(job.GetProperty("is_custom").GetBoolean());
    }

    [Fact]
    public async Task ServiceVisitDetailForwardsCurrentUserAndReturnsNestedVisit()
    {
        var userId = Guid.Parse(TestAuthHandler.UserId);
        var vehicleId = Guid.NewGuid();
        var visitId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var createdAt = new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero);
        var queries = new RecordingServiceVisitQueries(
        [
            new ServiceVisitListItem(
                visitId,
                vehicleId,
                userId,
                new DateOnly(2026, 2, 3),
                45678,
                "Detail Garage",
                "Detail notes",
                0.19m,
                50m,
                9.5m,
                59.5m,
                createdAt,
                createdAt,
                false,
                [
                    new ServiceJobListItem(
                        jobId,
                        visitId,
                        null,
                        "Brake check",
                        "BRAKES",
                        1m,
                        50m,
                        50m,
                        null,
                        true,
                        createdAt,
                        createdAt),
                ]),
        ]);

        using var authenticatedFactory = CreateAuthenticatedFactory(queries);
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync($"/api/car-service/visits/{visitId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(userId, queries.RequestedUserId);
        Assert.Equal(visitId, queries.RequestedVisitId);

        var visit = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(visitId.ToString(), visit.GetProperty("id").GetString());
        Assert.Equal("Detail Garage", visit.GetProperty("workshop").GetString());
        var job = Assert.Single(visit.GetProperty("jobs").EnumerateArray());
        Assert.Equal(jobId.ToString(), job.GetProperty("id").GetString());
    }

    [Fact]
    public async Task MissingServiceVisitDetailReturnsNotFound()
    {
        var queries = new RecordingServiceVisitQueries([]);
        var visitId = Guid.NewGuid();
        using var authenticatedFactory = CreateAuthenticatedFactory(queries);
        using var client = authenticatedFactory.CreateClient();

        var response = await client.GetAsync($"/api/car-service/visits/{visitId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), queries.RequestedUserId);
        Assert.Equal(visitId, queries.RequestedVisitId);
    }

    private WebApplicationFactory<Program> CreateAuthenticatedFactory(
        IServiceVisitQueries queries) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IServiceVisitQueries>();
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

    private sealed class RecordingServiceVisitQueries(
        IReadOnlyList<ServiceVisitListItem> visits) : IServiceVisitQueries
    {
        public Guid? RequestedUserId { get; private set; }

        public Guid? RequestedVehicleId { get; private set; }

        public Guid? RequestedVisitId { get; private set; }

        public Task<ServiceVisitListItem?> GetAsync(
            Guid userId,
            Guid visitId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedVisitId = visitId;
            return Task.FromResult(visits.SingleOrDefault(visit => visit.Id == visitId));
        }

        public Task<IReadOnlyList<ServiceVisitListItem>> ListAsync(
            Guid userId,
            Guid? vehicleId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedVehicleId = vehicleId;
            return Task.FromResult(visits);
        }
    }
}
