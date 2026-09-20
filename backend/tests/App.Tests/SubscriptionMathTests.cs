using PortfolioTerminal.Subscriptions;

namespace PortfolioTerminal.Tests;

public sealed class SubscriptionMathTests
{
    [Fact]
    public void MonthEndAnchorDoesNotDrift()
    {
        var february = SubscriptionMath.Advance(new DateOnly(2027, 1, 31), 1, 31);
        var march = SubscriptionMath.Advance(february, 1, 31);

        Assert.Equal(new DateOnly(2027, 2, 28), february);
        Assert.Equal(new DateOnly(2027, 3, 31), march);
        Assert.Equal(new DateOnly(2028, 2, 29),
            SubscriptionMath.Advance(new DateOnly(2027, 2, 28), 12, 29));
    }

    [Fact]
    public void EqualSplitKeepsRoundingRemainderWithOwner()
    {
        var members = new[]
        {
            new SubscriptionMember(Guid.NewGuid(), "manual", null),
            new SubscriptionMember(Guid.NewGuid(), "auto", null),
        };

        var (mine, shares) = SubscriptionMath.Split(10m, "equal", members);

        Assert.Equal(3.34m, mine);
        Assert.Equal([3.33m, 3.33m], shares);
        Assert.Equal(10m, mine + shares.Sum());
    }

    [Fact]
    public void FixedContributionsLeaveTheOwnerResidual()
    {
        var members = new[]
        {
            new SubscriptionMember(Guid.NewGuid(), "manual", 5m),
            new SubscriptionMember(Guid.NewGuid(), "auto", 8.50m),
        };

        var (mine, shares) = SubscriptionMath.Split(20m, "fixed", members);

        Assert.Equal(6.50m, mine);
        Assert.Equal([5m, 8.50m], shares);
        Assert.Throws<ArgumentException>(() => SubscriptionMath.Split(10m, "fixed", members));
    }
}
