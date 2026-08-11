using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.CarService;
using PortfolioTerminal.CarService.Reminders;
using PortfolioTerminal.CarService.Vehicles;
using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.Tests;

public sealed class CarServiceWriteEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly Guid UserId = Guid.Parse(TestAuthHandler.UserId);

    [Fact]
    public async Task VehicleCreateRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/car-service/vehicles", VehicleBody());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task VehicleCreateUsesCurrentUserAndReturnsCreatedVehicle()
    {
        var vehicleId = Guid.NewGuid();
        var createdAt = DateTimeOffset.UtcNow;
        var commands = new RecordingVehicleCommands(MutationResult.Succeeded(vehicleId));
        var queries = new StubVehicleQueries(new VehicleListItem(
            vehicleId,
            UserId,
            "Ford Focus||{}",
            "Ford",
            "Focus",
            "ABC-123",
            2020,
            createdAt,
            createdAt));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IVehicleCommands>();
            services.RemoveAll<IVehicleQueries>();
            services.AddSingleton<IVehicleCommands>(commands);
            services.AddSingleton<IVehicleQueries>(queries);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/car-service/vehicles", VehicleBody());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal("Blue", commands.Mutation!.Colour);
        Assert.Equal(15_000, commands.Mutation.AnnualServiceIntervalKm);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(vehicleId.ToString(), payload.GetProperty("id").GetString());
        Assert.Equal("ABC-123", payload.GetProperty("plate").GetString());
    }

    [Fact]
    public async Task VehicleDeleteConflictReturnsLinkedVisitMessage()
    {
        var vehicleId = Guid.NewGuid();
        var commands = new RecordingVehicleCommands(
            MutationResult.Conflicted("CANNOT DELETE - 2 SERVICE VISITS LINKED"));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IVehicleCommands>();
            services.AddSingleton<IVehicleCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.DeleteAsync($"/api/car-service/vehicles/{vehicleId}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(vehicleId, commands.RequestedId);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            "CANNOT DELETE - 2 SERVICE VISITS LINKED",
            payload.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task ServiceVisitCreateForwardsJobsAndReturnsNestedVisit()
    {
        var vehicleId = Guid.NewGuid();
        var visitId = Guid.NewGuid();
        var createdAt = DateTimeOffset.UtcNow;
        var commands = new RecordingVisitCommands(MutationResult.Succeeded(visitId));
        var queries = new StubVisitQueries(new ServiceVisitListItem(
            visitId,
            vehicleId,
            UserId,
            new DateOnly(2026, 8, 11),
            10_000,
            "Garage",
            null,
            0.24m,
            50m,
            12m,
            62m,
            createdAt,
            createdAt,
            true,
            [new ServiceJobListItem(
                Guid.NewGuid(), visitId, null, "Oil change", "Service",
                1m, 50m, 50m, null, true, createdAt, createdAt)]));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IServiceVisitCommands>();
            services.RemoveAll<IServiceVisitQueries>();
            services.AddSingleton<IServiceVisitCommands>(commands);
            services.AddSingleton<IServiceVisitQueries>(queries);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/car-service/visits", new
        {
            vehicle_id = vehicleId,
            service_date = "2026-08-11",
            odometer_km = 10_000,
            workshop = "Garage",
            notes = (string?)null,
            vat_rate = 0.24m,
            is_annual_service = true,
            jobs = new[]
            {
                new
                {
                    jobName = "Oil change",
                    category = "Service",
                    quantity = 1m,
                    unitPriceExVat = 50m,
                    notes = (string?)null,
                },
            },
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        var job = Assert.Single(commands.Mutation!.Jobs);
        Assert.Equal("Oil change", job.JobName);
        Assert.Equal(50m, job.UnitPriceExVat);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(62m, payload.GetProperty("total_amount").GetDecimal());
        Assert.Single(payload.GetProperty("jobs").EnumerateArray());
    }

    [Fact]
    public async Task MissingServiceVisitUpdateReturnsNotFound()
    {
        var visitId = Guid.NewGuid();
        var commands = new RecordingVisitCommands(
            MutationResult.Missing("Service visit not found."));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IServiceVisitCommands>();
            services.AddSingleton<IServiceVisitCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PutAsJsonAsync($"/api/car-service/visits/{visitId}", new
        {
            vehicle_id = Guid.NewGuid(),
            service_date = "2026-08-11",
            odometer_km = 10_000,
            vat_rate = 0.24m,
            is_annual_service = false,
            jobs = Array.Empty<object>(),
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(visitId, commands.RequestedId);
    }

    [Fact]
    public async Task InvalidReminderIsRejectedBeforeCommandRuns()
    {
        var commands = new RecordingReminderCommands(MutationResult.Succeeded(Guid.NewGuid()));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IServiceReminderCommands>();
            services.AddSingleton<IServiceReminderCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/car-service/reminders", new
        {
            vehicle_id = Guid.NewGuid(),
            job_name = "Oil change",
            interval_km = (int?)null,
            interval_months = (int?)null,
            warning_km = 500,
            warning_days = 30,
            is_active = true,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(commands.RequestedUserId);
    }

    [Fact]
    public async Task ReminderCreateAndDeleteUseCurrentUser()
    {
        var reminderId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var commands = new RecordingReminderCommands(MutationResult.Succeeded(reminderId));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IServiceReminderCommands>();
            services.AddSingleton<IServiceReminderCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/car-service/reminders", new
        {
            vehicle_id = vehicleId,
            job_name = "Oil change",
            interval_km = 15_000,
            interval_months = 12,
            warning_km = 500,
            warning_days = 30,
            notes = "Use synthetic oil",
            is_active = true,
        });
        var deleteResponse = await client.DeleteAsync(
            $"/api/car-service/reminders/{reminderId}");

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(reminderId, commands.RequestedId);
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

    private static object VehicleBody() => new
    {
        make = "Ford",
        model = "Focus",
        year = 2020,
        plate = "ABC-123",
        colour = "Blue",
        notes = "Example",
        annualServiceIntervalKm = 15_000,
        annualServiceIntervalMonths = 12,
    };

    private sealed class RecordingVehicleCommands(MutationResult result) : IVehicleCommands
    {
        public Guid? RequestedUserId { get; private set; }
        public Guid? RequestedId { get; private set; }
        public VehicleMutation? Mutation { get; private set; }

        public Task<MutationResult> CreateAsync(Guid userId, VehicleMutation mutation, CancellationToken cancellationToken = default) => Record(userId, null, mutation);
        public Task<MutationResult> UpdateAsync(Guid userId, Guid vehicleId, VehicleMutation mutation, CancellationToken cancellationToken = default) => Record(userId, vehicleId, mutation);
        public Task<MutationResult> DeleteAsync(Guid userId, Guid vehicleId, CancellationToken cancellationToken = default) => Record(userId, vehicleId, null);

        private Task<MutationResult> Record(Guid userId, Guid? id, VehicleMutation? mutation)
        {
            RequestedUserId = userId;
            RequestedId = id;
            Mutation = mutation;
            return Task.FromResult(result);
        }
    }

    private sealed class StubVehicleQueries(VehicleListItem vehicle) : IVehicleQueries
    {
        public Task<VehicleListItem?> GetAsync(Guid userId, Guid vehicleId, CancellationToken cancellationToken = default) => Task.FromResult<VehicleListItem?>(vehicle);
        public Task<IReadOnlyList<VehicleListItem>> ListAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<VehicleListItem>>([vehicle]);
    }

    private sealed class RecordingVisitCommands(MutationResult result) : IServiceVisitCommands
    {
        public Guid? RequestedUserId { get; private set; }
        public Guid? RequestedId { get; private set; }
        public ServiceVisitMutation? Mutation { get; private set; }

        public Task<MutationResult> CreateAsync(Guid userId, ServiceVisitMutation mutation, CancellationToken cancellationToken = default) => Record(userId, null, mutation);
        public Task<MutationResult> UpdateAsync(Guid userId, Guid visitId, ServiceVisitMutation mutation, CancellationToken cancellationToken = default) => Record(userId, visitId, mutation);
        public Task<MutationResult> DeleteAsync(Guid userId, Guid visitId, CancellationToken cancellationToken = default) => Record(userId, visitId, null);

        private Task<MutationResult> Record(Guid userId, Guid? id, ServiceVisitMutation? mutation)
        {
            RequestedUserId = userId;
            RequestedId = id;
            Mutation = mutation;
            return Task.FromResult(result);
        }
    }

    private sealed class StubVisitQueries(ServiceVisitListItem visit) : IServiceVisitQueries
    {
        public Task<ServiceVisitListItem?> GetAsync(Guid userId, Guid visitId, CancellationToken cancellationToken = default) => Task.FromResult<ServiceVisitListItem?>(visit);
        public Task<IReadOnlyList<ServiceVisitListItem>> ListAsync(Guid userId, Guid? vehicleId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ServiceVisitListItem>>([visit]);
    }

    private sealed class RecordingReminderCommands(MutationResult result) : IServiceReminderCommands
    {
        public Guid? RequestedUserId { get; private set; }
        public Guid? RequestedId { get; private set; }

        public Task<MutationResult> CreateAsync(Guid userId, ServiceReminderMutation mutation, CancellationToken cancellationToken = default) => Record(userId, null);
        public Task<MutationResult> UpdateAsync(Guid userId, Guid reminderId, ServiceReminderMutation mutation, CancellationToken cancellationToken = default) => Record(userId, reminderId);
        public Task<MutationResult> DeleteAsync(Guid userId, Guid reminderId, CancellationToken cancellationToken = default) => Record(userId, reminderId);

        private Task<MutationResult> Record(Guid userId, Guid? id)
        {
            RequestedUserId = userId;
            RequestedId = id;
            return Task.FromResult(result);
        }
    }
}
