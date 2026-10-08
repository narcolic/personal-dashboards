using PortfolioTerminal.Api.Endpoints;
using PortfolioTerminal.Subscriptions;

namespace PortfolioTerminal.Tests;

public sealed class SubscriptionValidationTests
{
    private static readonly DateOnly PastDate = new(2020, 1, 1);

    [Fact]
    public void ExistingSubscriptionCanKeepCurrentBillingDateWhileChangingCurrency()
    {
        var input = Input(20m, "EUR", PastDate, "equal", []);

        var errors = SubscriptionEndpoints.ValidateSubscription(Guid.NewGuid(), input, "EUR");

        Assert.Empty(errors);
    }

    [Fact]
    public void NewActiveSubscriptionStillRequiresNonPastBillingDate()
    {
        var input = Input(20m, "EUR", PastDate, "equal", []);

        var errors = SubscriptionEndpoints.ValidateSubscription(null, input, "EUR");

        Assert.Contains("nextBillingDate", errors.Keys);
    }

    [Fact]
    public void CurrencyChangeReportsCustomContributionsThatExceedNewCost()
    {
        var members = new[]
        {
            new SubscriptionMember(Guid.NewGuid(), "manual", 250m)
        };
        var input = Input(20m, "EUR", PastDate, "fixed", members);

        var errors = SubscriptionEndpoints.ValidateSubscription(Guid.NewGuid(), input, "EUR");

        Assert.Equal(
            "Member contributions cannot exceed the full cost in the selected currency.",
            Assert.Single(errors["members"]));
    }

    private static SubscriptionInput Input(decimal amount, string currency, DateOnly nextBillingDate,
        string splitMode, IReadOnlyList<SubscriptionMember> members) =>
        new("ChatGPT Plus", null, null, null, amount, currency, 1, nextBillingDate,
            splitMode, true, false, members, "chatgpt");
}
