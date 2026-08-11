using System.Net.Http.Json;
using System.Text.Json;

namespace PortfolioTerminal.Portfolio.MarketData;

public sealed class YahooQuoteService(HttpClient httpClient) : IQuoteService
{
    public async Task<QuoteLookupResult> GetAsync(
        IReadOnlyList<string> symbols,
        CancellationToken cancellationToken = default)
    {
        var tasks = symbols.Select(symbol => GetOneAsync(symbol, cancellationToken));
        var results = await Task.WhenAll(tasks).ConfigureAwait(false);
        return new QuoteLookupResult(
            [.. results.Where(result => result.Quote is not null).Select(result => result.Quote!)],
            [.. results.Where(result => result.Failure is not null).Select(result => result.Failure!)]);
    }

    private async Task<QuoteAttempt> GetOneAsync(
        string symbol,
        CancellationToken cancellationToken)
    {
        try
        {
            var url = $"v8/finance/chart/{Uri.EscapeDataString(symbol)}?interval=1d&range=5d";
            using var response = await httpClient.GetAsync(url, cancellationToken)
                .ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return QuoteAttempt.Failed(symbol, $"Yahoo returned HTTP {(int)response.StatusCode}.");
            }

            using var document = await response.Content.ReadFromJsonAsync<JsonDocument>(
                    cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            var result = document?.RootElement
                .GetProperty("chart")
                .GetProperty("result");
            if (result is not { ValueKind: JsonValueKind.Array } ||
                result.Value.GetArrayLength() == 0)
            {
                return QuoteAttempt.Failed(symbol, "Yahoo returned no chart result.");
            }

            var meta = result.Value[0].GetProperty("meta");
            if (!TryDecimal(meta, "regularMarketPrice", out var price) || price <= 0m)
            {
                return QuoteAttempt.Failed(symbol, "Yahoo returned no regular market price.");
            }

            var previousClose = TryDecimal(meta, "chartPreviousClose", out var previous)
                ? previous
                : price;
            return QuoteAttempt.Succeeded(new MarketQuote(
                symbol,
                String(meta, "shortName"),
                String(meta, "longName"),
                price,
                previousClose,
                String(meta, "currency") ?? "USD",
                String(meta, "fullExchangeName"),
                String(meta, "exchangeName"),
                String(meta, "marketState"),
                String(meta, "instrumentType")));
        }
        catch (Exception exception) when (
            exception is HttpRequestException or JsonException or InvalidOperationException)
        {
            return QuoteAttempt.Failed(symbol, exception.Message);
        }
    }

    private static bool TryDecimal(JsonElement element, string property, out decimal value)
    {
        value = 0m;
        return element.TryGetProperty(property, out var node) && node.TryGetDecimal(out value);
    }

    private static string? String(JsonElement element, string property) =>
        element.TryGetProperty(property, out var node) && node.ValueKind == JsonValueKind.String
            ? node.GetString()
            : null;

    private sealed record QuoteAttempt(MarketQuote? Quote, QuoteFailure? Failure)
    {
        public static QuoteAttempt Succeeded(MarketQuote quote) => new(quote, null);

        public static QuoteAttempt Failed(string symbol, string error) =>
            new(null, new QuoteFailure(symbol, error));
    }
}
