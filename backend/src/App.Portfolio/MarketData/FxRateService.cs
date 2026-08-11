using System.Text.Json;

namespace PortfolioTerminal.Portfolio.MarketData;

public sealed class FxRateService(HttpClient httpClient) : IFxRateService
{
    public async Task<JsonElement> GetAsync(
        string baseCurrency,
        CancellationToken cancellationToken = default)
    {
        var frankfurter = await TryGetAsync(
                $"https://api.frankfurter.app/latest?from={Uri.EscapeDataString(baseCurrency)}",
                cancellationToken)
            .ConfigureAwait(false);
        if (frankfurter is { } frankfurterPayload)
        {
            return frankfurterPayload;
        }

        var fallback = await TryGetAsync(
                $"https://open.er-api.com/v6/latest/{Uri.EscapeDataString(baseCurrency)}",
                cancellationToken)
            .ConfigureAwait(false);
        if (fallback is { } fallbackPayload &&
            fallbackPayload.TryGetProperty("rates", out _))
        {
            return fallbackPayload;
        }

        return JsonSerializer.SerializeToElement(new
        {
            rates = new Dictionary<string, decimal> { [baseCurrency] = 1m },
        });
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
}
