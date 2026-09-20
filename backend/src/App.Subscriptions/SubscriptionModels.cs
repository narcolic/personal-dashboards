namespace PortfolioTerminal.Subscriptions;

public sealed record SubscriptionPerson(Guid Id, string Name, bool IsActive);
public sealed record SubscriptionMember(Guid PersonId, string PaymentBehavior, decimal? FixedAmount);
public sealed record SubscriptionItem(
    Guid Id, string Name, string? Description, string? Category, string? Notes,
    decimal Amount, string Currency, int IntervalMonths, DateOnly NextBillingDate,
    int BillingAnchorDay, string SplitMode, bool IsActive,
    IReadOnlyList<SubscriptionMember> Members);
public sealed record MemberContribution(
    Guid Id, Guid PersonId, decimal Amount, string PaymentBehavior,
    string Status, DateTimeOffset? PaidAt);
public sealed record SubscriptionPeriod(
    Guid Id, Guid SubscriptionId, DateOnly BillingDate, decimal FullAmount,
    decimal MyAmount, string Currency, IReadOnlyList<MemberContribution> Contributions);
public sealed record SubscriptionState(
    string HomeCurrency, IReadOnlyList<SubscriptionPerson> People,
    IReadOnlyList<SubscriptionItem> Subscriptions,
    IReadOnlyList<SubscriptionPeriod> Periods);
public sealed record SubscriptionInput(
    string Name, string? Description, string? Category, string? Notes,
    decimal Amount, string Currency, int IntervalMonths, DateOnly NextBillingDate,
    string SplitMode, bool IsActive, bool TrackCurrentPeriod,
    IReadOnlyList<SubscriptionMember> Members);

public static class SubscriptionMath
{
    public static DateOnly Advance(DateOnly date, int months, int anchorDay)
    {
        var nextMonth = new DateOnly(date.Year, date.Month, 1).AddMonths(months);
        return new DateOnly(nextMonth.Year, nextMonth.Month,
            Math.Min(anchorDay, DateTime.DaysInMonth(nextMonth.Year, nextMonth.Month)));
    }

    public static (decimal Mine, IReadOnlyList<decimal> Members) Split(
        decimal fullAmount, string mode, IReadOnlyList<SubscriptionMember> members)
    {
        if (mode == "fixed")
        {
            var amounts = members.Select(member => member.FixedAmount ?? 0m).ToArray();
            var mine = fullAmount - amounts.Sum();
            if (mine < 0) throw new ArgumentException("Member contributions exceed the full cost.");
            return (mine, amounts);
        }

        var each = decimal.Floor(fullAmount * 100m / (members.Count + 1)) / 100m;
        return (fullAmount - each * members.Count,
            Enumerable.Repeat(each, members.Count).ToArray());
    }
}
