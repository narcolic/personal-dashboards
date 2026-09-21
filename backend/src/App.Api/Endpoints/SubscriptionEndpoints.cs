using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Portfolio.MarketData;
using PortfolioTerminal.Subscriptions;

namespace PortfolioTerminal.Api.Endpoints;

public static class SubscriptionEndpoints
{
    private static readonly HashSet<string> SupportedCurrencies =
        ["EUR", "GBP", "USD", "TRY"];

    public static IEndpointRouteBuilder MapSubscriptionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/subscriptions")
            .WithTags("Subscriptions").RequireAuthorization();

        group.MapGet("/overview", async Task<IResult> (
            SubscriptionStore store, IFxRateService fx, IMemoryCache cache,
            ICurrentUser user, CancellationToken ct) =>
        {
            var state = await store.GetStateAsync(user.UserId, ct);
            var rates = await GetRatesAsync(state.HomeCurrency, fx, cache, ct);
            return TypedResults.Ok(new
            {
                state,
                fx = rates,
                summary = CalculateSummary(state, rates),
            });
        }).WithName("GetSubscriptionOverview");

        group.MapGet("", async (SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
            (await store.GetStateAsync(user.UserId, ct)).Subscriptions)
            .WithName("ListSubscriptions");
        group.MapGet("/{id:guid}", async Task<IResult> (
            Guid id, SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
        {
            var state = await store.GetStateAsync(user.UserId, ct);
            var item = state.Subscriptions.FirstOrDefault(item => item.Id == id);
            return item is null ? TypedResults.NotFound() : TypedResults.Ok(new
            {
                subscription = item,
                periods = state.Periods.Where(period => period.SubscriptionId == id),
            });
        }).WithName("GetSubscription");

        group.MapPost("", (SubscriptionInput input, SubscriptionStore store,
            ICurrentUser user, CancellationToken ct) => SaveSubscription(null, input, store, user, ct))
            .WithName("CreateSubscription");
        group.MapPut("/{id:guid}", (Guid id, SubscriptionInput input, SubscriptionStore store,
            ICurrentUser user, CancellationToken ct) => SaveSubscription(id, input, store, user, ct))
            .WithName("UpdateSubscription");
        group.MapDelete("/{id:guid}", async Task<IResult> (
            Guid id, SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
        {
            if (await store.DeleteSubscriptionAsync(user.UserId, id, ct))
                return TypedResults.NoContent();
            var state = await store.GetStateAsync(user.UserId, ct);
            return state.Subscriptions.Any(item => item.Id == id)
                ? TypedResults.Conflict(new { detail = "Archive subscriptions with payment history instead of deleting them." })
                : TypedResults.NotFound();
        }).WithName("DeleteSubscription");

        group.MapGet("/people", async (SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
            (await store.GetStateAsync(user.UserId, ct)).People).WithName("ListSubscriptionPeople");
        group.MapPost("/people", (PersonInput input, SubscriptionStore store,
            ICurrentUser user, CancellationToken ct) => SavePerson(null, input, store, user, ct))
            .WithName("CreateSubscriptionPerson");
        group.MapPut("/people/{id:guid}", (Guid id, PersonInput input, SubscriptionStore store,
            ICurrentUser user, CancellationToken ct) => SavePerson(id, input, store, user, ct))
            .WithName("UpdateSubscriptionPerson");

        group.MapGet("/settings", async (SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
            new { homeCurrency = (await store.GetStateAsync(user.UserId, ct)).HomeCurrency })
            .WithName("GetSubscriptionSettings");
        group.MapPut("/settings", async Task<IResult> (
            SettingsInput input, SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
        {
            var currency = input.HomeCurrency?.Trim().ToUpperInvariant() ?? "";
            if (!SupportedCurrencies.Contains(currency))
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                { ["homeCurrency"] = ["Choose EUR, GBP, USD, or TRY."] });
            return TypedResults.Ok(new
            { homeCurrency = await store.SaveHomeCurrencyAsync(user.UserId, currency, ct) });
        }).WithName("UpdateSubscriptionSettings");

        group.MapGet("/outstanding", async (SubscriptionStore store, ICurrentUser user,
            CancellationToken ct) =>
        {
            var state = await store.GetStateAsync(user.UserId, ct);
            return state.Periods.SelectMany(period => period.Contributions
                .Where(c => c.Status == "unpaid")
                .Select(c => new { period.SubscriptionId, period.BillingDate,
                    period.Currency, c.Id, c.PersonId, c.Amount }));
        }).WithName("GetSubscriptionOutstanding");
        group.MapGet("/{id:guid}/periods", async (Guid id, SubscriptionStore store,
            ICurrentUser user, CancellationToken ct) =>
            (await store.GetStateAsync(user.UserId, ct)).Periods
                .Where(period => period.SubscriptionId == id))
            .WithName("ListSubscriptionPeriods");
        group.MapPost("/{id:guid}/periods/{periodId:guid}/recalculate", async Task<IResult> (
            Guid id, Guid periodId, SubscriptionStore store, ICurrentUser user, CancellationToken ct) =>
            (await store.RecalculatePeriodAsync(user.UserId, id, periodId, ct)) switch
            {
                PeriodRecalculationResult.Updated => TypedResults.NoContent(),
                PeriodRecalculationResult.PaidConflict => TypedResults.Conflict(new
                {
                    detail = "Undo affected recorded payments before updating this bill."
                }),
                _ => TypedResults.NotFound(),
            })
            .WithName("RecalculateSubscriptionPeriod");
        group.MapPatch("/contributions/{id:guid}", async Task<IResult> (
            Guid id, PaymentInput input, SubscriptionStore store,
            ICurrentUser user, CancellationToken ct) =>
            await store.SetPaidAsync(user.UserId, id, input.Paid, ct)
                ? TypedResults.NoContent() : TypedResults.NotFound())
            .WithName("SetSubscriptionContributionPaid");
        return endpoints;
    }

    private static async Task<IResult> SaveSubscription(Guid? id, SubscriptionInput input,
        SubscriptionStore store, ICurrentUser user, CancellationToken ct)
    {
        var currency = input.Currency?.Trim().ToUpperInvariant() ?? "";
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160 ||
            input.Amount <= 0 || decimal.Round(input.Amount, 2) != input.Amount ||
            input.LogoKey?.Length > 64 ||
            !SupportedCurrencies.Contains(currency) || input.IntervalMonths is < 1 or > 120 ||
            input.SplitMode is not ("equal" or "fixed") ||
            (input.IsActive && input.NextBillingDate < DateOnly.FromDateTime(DateTime.UtcNow)) ||
            input.Members is null || input.Members.Any(member =>
                member.PaymentBehavior is not ("manual" or "auto") ||
                (input.SplitMode == "fixed" &&
                 (member.FixedAmount is null or < 0 ||
                  decimal.Round(member.FixedAmount.Value, 2) != member.FixedAmount.Value))) ||
            (input.SplitMode == "fixed" &&
             input.Members.Sum(member => member.FixedAmount ?? 0) > input.Amount))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            { ["subscription"] = ["Check name, positive two-decimal cost, currency, future renewal, interval, and member amounts."] });

        try
        {
            var saved = await store.SaveSubscriptionAsync(user.UserId, id,
                input with { Currency = currency, LogoKey = string.IsNullOrWhiteSpace(input.LogoKey)
                    ? null : input.LogoKey.Trim() }, ct);
            return saved == Guid.Empty ? TypedResults.NotFound()
                : id is null
                    ? TypedResults.Created($"/api/subscriptions/{saved}", new { id = saved })
                    : TypedResults.Ok(new { id = saved });
        }
        catch (ArgumentException error)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            { ["members"] = [error.Message] });
        }
    }

    private static async Task<IResult> SavePerson(Guid? id, PersonInput input,
        SubscriptionStore store, ICurrentUser user, CancellationToken ct)
    {
        var name = input.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 120)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            { ["name"] = ["Enter a name of at most 120 characters."] });
        var saved = await store.SavePersonAsync(user.UserId, id, name, input.IsActive, ct);
        return saved == Guid.Empty ? TypedResults.NotFound()
            : id is null
                ? TypedResults.Created($"/api/subscriptions/people/{saved}", new { id = saved })
                : TypedResults.Ok(new { id = saved });
    }

    private static async Task<RateSnapshot> GetRatesAsync(string homeCurrency,
        IFxRateService service, IMemoryCache cache, CancellationToken ct)
    {
        if (cache.TryGetValue<RateSnapshot>($"subscriptions-fx-{homeCurrency}", out var cached) && cached is not null)
            return cached;
        var payload = await service.GetAsync(homeCurrency, ct);
        var rates = new Dictionary<string, decimal> { [homeCurrency] = 1m };
        if (payload.TryGetProperty("rates", out var rawRates))
            foreach (var rate in rawRates.EnumerateObject())
                if (rate.Value.TryGetDecimal(out var value) && value > 0)
                    rates[rate.Name.ToUpperInvariant()] = value;
        string? asOf = null;
        if (payload.TryGetProperty("date", out var date) && date.ValueKind == JsonValueKind.String)
            asOf = date.GetString();
        else if (payload.TryGetProperty("time_last_update_unix", out var unix) &&
                 unix.TryGetInt64(out var seconds))
            asOf = DateTimeOffset.FromUnixTimeSeconds(seconds).ToString(
                "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        if (DateOnly.TryParse(asOf, out var parsed) &&
            parsed < DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-7))
            rates = new Dictionary<string, decimal> { [homeCurrency] = 1m };
        var result = new RateSnapshot(homeCurrency, asOf, rates);
        cache.Set($"subscriptions-fx-{homeCurrency}", result,
            rates.Count > 1 ? TimeSpan.FromHours(12) : TimeSpan.FromMinutes(5));
        return result;
    }

    private static object CalculateSummary(SubscriptionState state, RateSnapshot fx)
    {
        decimal? Convert(decimal amount, string currency) =>
            fx.Rates.TryGetValue(currency, out var rate) && rate > 0
                ? amount / rate : null;
        decimal? Sum(IEnumerable<(decimal amount, string currency)> values)
        {
            decimal total = 0;
            foreach (var (amount, currency) in values)
            {
                var converted = Convert(amount, currency);
                if (converted is null) return null;
                total += converted.Value;
            }
            return decimal.Round(total, 2);
        }
        var active = state.Subscriptions.Where(item => item.IsActive).ToArray();
        var shares = active.Select(item =>
            (item, mine: SubscriptionMath.Split(item.Amount, item.SplitMode, item.Members).Mine)).ToArray();
        var unpaid = state.Periods.SelectMany(period => period.Contributions
            .Where(c => c.Status == "unpaid")
            .Select(c => (amount: c.Amount, currency: period.Currency)));
        return new
        {
            activeCount = active.Length,
            myMonthly = Sum(shares.Select(x => (x.mine / x.item.IntervalMonths, x.item.Currency))),
            myAnnual = Sum(shares.Select(x => (x.mine * 12m / x.item.IntervalMonths, x.item.Currency))),
            fullMonthly = Sum(active.Select(x => (x.Amount / x.IntervalMonths, x.Currency))),
            fullAnnual = Sum(active.Select(x => (x.Amount * 12m / x.IntervalMonths, x.Currency))),
            outstanding = Sum(unpaid),
        };
    }

    public sealed record PersonInput(string Name, bool IsActive);
    public sealed record SettingsInput(string HomeCurrency);
    public sealed record PaymentInput(bool Paid);
    public sealed record RateSnapshot(string Base, string? AsOf, IReadOnlyDictionary<string, decimal> Rates);
}
