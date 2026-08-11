using System.Text.Json;

namespace PortfolioTerminal.Portfolio.MarketData;

public sealed class MarketStatusService(HttpClient httpClient, TimeProvider timeProvider)
    : IMarketStatusService
{
    private const string HoursUrl = "https://markethours.io/api/markets/hours";
    private const string StatusUrl = "https://markethours.io/api/markets/status";

    public async Task<MarketStatusResult> GetAsync(
        IReadOnlyList<string> exchanges,
        CancellationToken cancellationToken = default)
    {
        var marketList = string.Join(',', exchanges);
        var hoursTask = TryGetAsync(
            $"{HoursUrl}?markets={Uri.EscapeDataString(marketList)}",
            cancellationToken);
        var statusTask = TryGetAsync(
            $"{StatusUrl}?markets={Uri.EscapeDataString(marketList)}",
            cancellationToken);
        await Task.WhenAll(hoursTask, statusTask).ConfigureAwait(false);

        var hours = await hoursTask.ConfigureAwait(false);
        var statuses = await statusTask.ConfigureAwait(false);
        if (hours is null && statuses is null)
        {
            throw new HttpRequestException("Both market-hours provider requests failed.");
        }

        var byId = new Dictionary<string, MutableMarket>(StringComparer.OrdinalIgnoreCase);
        foreach (var market in ReadMarkets(hours))
        {
            var id = MarketId(market);
            if (id.Length == 0)
            {
                continue;
            }

            byId[id] = new MutableMarket(
                id,
                String(market, "exchange"),
                String(market, "market"),
                String(market, "timezone"),
                Object(market, "tradingHours") ?? Object(market, "hours"),
                null);
        }

        foreach (var market in ReadMarkets(statuses))
        {
            var id = MarketId(market);
            if (id.Length == 0)
            {
                continue;
            }

            byId.TryGetValue(id, out var existing);
            byId[id] = new MutableMarket(
                id,
                existing?.Exchange ?? String(market, "exchange"),
                existing?.Market ?? String(market, "market"),
                existing?.Timezone ?? String(market, "timezone"),
                existing?.TradingHours,
                Object(market, "status"));
        }

        var requested = exchanges.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var results = byId.Values
            .Where(market => requested.Count == 0 || requested.Contains(market.Id))
            .Select(market => new MarketStatusItem(
                market.Id,
                market.Exchange,
                market.Market,
                market.Timezone,
                market.TradingHours,
                market.Status))
            .ToArray();
        return new MarketStatusResult(results, timeProvider.GetUtcNow());
    }

    private async Task<JsonElement?> TryGetAsync(
        string url,
        CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync(url, cancellationToken)
                .ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            using var document = await JsonDocument.ParseAsync(
                    await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false),
                    cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            return document.RootElement.Clone();
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException)
        {
            return null;
        }
    }

    private static JsonElement[] ReadMarkets(JsonElement? payload)
    {
        if (payload is not { } root || root.ValueKind != JsonValueKind.Object)
        {
            return [];
        }

        if (root.TryGetProperty("data", out var data))
        {
            if (data.ValueKind == JsonValueKind.Array)
            {
                return [.. data.EnumerateArray().Select(item => item.Clone())];
            }
            if (data.ValueKind == JsonValueKind.Object &&
                data.TryGetProperty("markets", out var dataMarkets) &&
                dataMarkets.ValueKind == JsonValueKind.Array)
            {
                return [.. dataMarkets.EnumerateArray().Select(item => item.Clone())];
            }
        }

        return root.TryGetProperty("markets", out var markets) &&
               markets.ValueKind == JsonValueKind.Array
            ? [.. markets.EnumerateArray().Select(item => item.Clone())]
            : [];
    }

    private static string MarketId(JsonElement market) =>
        (String(market, "id") ?? String(market, "exchange") ?? String(market, "market") ?? "")
        .ToLowerInvariant();

    private static string? String(JsonElement element, string property) =>
        element.TryGetProperty(property, out var node) && node.ValueKind == JsonValueKind.String
            ? node.GetString()
            : null;

    private static JsonElement? Object(JsonElement element, string property) =>
        element.TryGetProperty(property, out var node) && node.ValueKind == JsonValueKind.Object
            ? node.Clone()
            : null;

    private sealed record MutableMarket(
        string Id,
        string? Exchange,
        string? Market,
        string? Timezone,
        JsonElement? TradingHours,
        JsonElement? Status);
}
