using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.Travel;

namespace PortfolioTerminal.Tests;

public sealed class TravelEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static TravelInput Valid => new("Athens", "Greece", 37.98, 23.72, new DateOnly(2024, 6, 1), "A visit");

    [Fact]
    public async Task EveryRouteRequiresAuthentication()
    {
        using var client = factory.CreateClient();
        var id = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/travel/places")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/travel/places", Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync($"/api/travel/places/{id}", Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync($"/api/travel/places/{id}")).StatusCode);
    }

    [Fact]
    public async Task CrudAlwaysUsesAuthenticatedUserAndReturnsSavedRecord()
    {
        var store = new RecordingStore();
        using var app = Authenticated(store);
        using var client = app.CreateClient();
        var created = await client.PostAsJsonAsync("/api/travel/places", Valid);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var place = await created.Content.ReadFromJsonAsync<TravelPlace>();
        Assert.NotNull(place);
        Assert.Equal(Valid.Name, place.Name);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), store.UserId);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/travel/places")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/travel/places/{place.Id}", Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/travel/places/{place.Id}")).StatusCode);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), store.UserId);
    }

    [Fact]
    public async Task InvalidInputNeverReachesStore()
    {
        var store = new RecordingStore();
        using var app = Authenticated(store);
        using var client = app.CreateClient();
        TravelInput[] invalid = [Valid with { Name = " " }, Valid with { Country = "" },
            Valid with { Latitude = null }, Valid with { Longitude = null },
            Valid with { Latitude = 91 }, Valid with { Longitude = -181 },
            Valid with { Note = new string('a', 4001) }];
        foreach (var input in invalid)
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/travel/places", input)).StatusCode);
        Assert.Equal(Guid.Empty, store.UserId);
    }

    [Fact]
    public async Task MissingOrOtherUsersPlaceReturnsNotFound()
    {
        using var app = Authenticated(new RecordingStore { Missing = true });
        using var client = app.CreateClient();
        var path = $"/api/travel/places/{Guid.NewGuid()}";
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync(path, Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync(path)).StatusCode);
    }

    private WebApplicationFactory<Program> Authenticated(RecordingStore store) => factory.WithWebHostBuilder(builder =>
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ITravelStore>();
            services.AddSingleton<ITravelStore>(store);
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        }));

    private sealed class RecordingStore : ITravelStore
    {
        public Guid UserId { get; private set; }
        public bool Missing { get; init; }
        public Task<IReadOnlyList<TravelPlace>> ListAsync(Guid userId, CancellationToken ct)
        { UserId = userId; return Task.FromResult<IReadOnlyList<TravelPlace>>([]); }
        public Task<TravelPlace?> SaveAsync(Guid userId, Guid? id, TravelInput input, CancellationToken ct)
        {
            UserId = userId;
            return Task.FromResult<TravelPlace?>(Missing ? null : new(id ?? Guid.NewGuid(), input.Name, input.Country,
                input.Latitude!.Value, input.Longitude!.Value, input.VisitDate, input.Note));
        }
        public Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct)
        { UserId = userId; return Task.FromResult(!Missing); }
    }
}
