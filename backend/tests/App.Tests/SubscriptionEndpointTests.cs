using System.Net;
using System.Net.Http.Json;

namespace PortfolioTerminal.Tests;

public sealed class SubscriptionEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task SubscriptionRoutesRequireAuthentication()
    {
        using var client = factory.CreateClient();
        var overview = await client.GetAsync("/api/subscriptions/overview");
        var create = await client.PostAsJsonAsync("/api/subscriptions", new
        {
            name = "Netflix",
            amount = 20,
            currency = "EUR",
            intervalMonths = 1,
            nextBillingDate = "2026-10-01",
            splitMode = "equal",
            isActive = true,
            trackCurrentPeriod = false,
            members = Array.Empty<object>(),
        });

        Assert.Equal(HttpStatusCode.Unauthorized, overview.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, create.StatusCode);
    }
}
