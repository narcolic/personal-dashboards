using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using PortfolioTerminal.Energy;

namespace PortfolioTerminal.Tests;

public sealed class EnergyEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    internal static EnergyInput Valid => new("ΖeniΘ", "TEST-SUPPLY", "INV-1", "actual",
        new(2026, 9, 19), new(2026, 10, 18), 29, new(2026, 11, 6), new DateOnly(2026, 11, 26),
        223, 32.99m, 22.12m, 4.09m, 19.89m, 0, 79.09m, 0, 79.09m, 9.57m, -26.76m,
        new string('a', 64), "bill.pdf", "zenith-monthly-v1");

    [Fact]
    public async Task AllRoutesRequireAuthentication()
    {
        using var client = factory.CreateClient();
        var path = $"/api/energy/bills/{Guid.NewGuid()}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/energy/bills")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/energy/bills", Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync(path, Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync(path)).StatusCode);
    }
    [Fact]
    public async Task CrudUsesJwtOwnerAndReturnsSavedShape()
    {
        var store = new RecordingStore(); using var app = Authenticated(store); using var client = app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/energy/bills", Valid);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var bill = await response.Content.ReadFromJsonAsync<EnergyBill>();
        Assert.NotNull(bill); Assert.Equal(Valid, bill.Summary);
        Assert.Equal(Guid.Parse(TestAuthHandler.UserId), store.Owner);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/energy/bills")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/energy/bills/{bill.Id}", Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/energy/bills/{bill.Id}")).StatusCode);
    }
    [Fact]
    public async Task InvalidSummariesNeverReachStore()
    {
        var store = new RecordingStore(); using var app = Authenticated(store); using var client = app.CreateClient();
        EnergyInput[] invalid = [Valid with { Provider = " " }, Valid with { Kwh = -1 },
            Valid with { SupplyNumber = "" }, Valid with { BillType = "unknown" },
            Valid with { PeriodEnd = new DateOnly(2026, 1, 1) }, Valid with { IssueDate = new DateOnly(2025, 1, 1) },
            Valid with { BillingDays = 0 }, Valid with { SupplyCharges = 0 }, Valid with { PreviousBalance = 10 },
            Valid with { Taxes = 4.099m }, Valid with { SupplyCharges = decimal.MaxValue, Taxes = decimal.MaxValue },
            Valid with { DocumentHash = "not-a-hash" }, Valid with { Discount = 26.76m }];
        foreach (var input in invalid)
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/energy/bills", input)).StatusCode);
        Assert.Equal(Guid.Empty, store.Owner);
    }
    [Fact]
    public async Task DuplicateReturnsConflictAndMissingRowsReturnNotFound()
    {
        using var app = Authenticated(new RecordingStore { Duplicate = true }); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/energy/bills", Valid)).StatusCode);
        using var missing = Authenticated(new RecordingStore { Missing = true }); using var other = missing.CreateClient();
        var path = $"/api/energy/bills/{Guid.NewGuid()}";
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync(path, Valid)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync(path)).StatusCode);
    }
    private WebApplicationFactory<Program> Authenticated(RecordingStore store) => factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
    {
        services.RemoveAll<IEnergyStore>(); services.AddSingleton<IEnergyStore>(store);
        services.AddAuthentication(options => { options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName; options.DefaultChallengeScheme = TestAuthHandler.SchemeName; })
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
    }));
    private sealed class RecordingStore : IEnergyStore
    {
        public Guid Owner { get; private set; }
        public bool Duplicate { get; init; }
        public bool Missing { get; init; }
        public Task<IReadOnlyList<EnergyBill>> ListAsync(Guid userId, CancellationToken ct) { Owner = userId; return Task.FromResult<IReadOnlyList<EnergyBill>>([]); }
        public Task<EnergyBill?> SaveAsync(Guid userId, Guid? id, EnergyInput input, CancellationToken ct)
        {
            Owner = userId;
            if (Duplicate) throw new PostgresException("duplicate", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation);
            return Task.FromResult<EnergyBill?>(Missing ? null : new(id ?? Guid.NewGuid(), input));
        }
        public Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct) { Owner = userId; return Task.FromResult(!Missing); }
    }
}
