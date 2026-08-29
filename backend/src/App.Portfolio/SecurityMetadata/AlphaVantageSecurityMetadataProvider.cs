using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;

namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed class AlphaVantageSecurityMetadataProvider(
    HttpClient httpClient,
    AlphaVantageOptions options) : ISecurityMetadataProvider, IDisposable
{
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private DateTimeOffset nextRequestAt = DateTimeOffset.MinValue;

    public async Task<ProviderSecurityMetadata> FetchAsync(
        SecurityMetadataRefreshClaim claim,
        CancellationToken cancellationToken = default)
    {
        var apiKey = options.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Failed(claim.Symbol, 0, "not_configured", "The Alpha Vantage API key is not configured.");
        }

        var requests = 0;
        try
        {
            requests++;
            using var search = await GetAsync(
                $"query?function=SYMBOL_SEARCH&keywords={Uri.EscapeDataString(claim.Symbol)}&apikey={Uri.EscapeDataString(apiKey)}",
                cancellationToken).ConfigureAwait(false);
            if (FailureFromPayload(search.RootElement, claim.Symbol, requests) is { } searchFailure)
            {
                return searchFailure;
            }

            var match = BestMatch(search.RootElement, claim.Symbol);
            if (match is null)
            {
                return new ProviderSecurityMetadata(
                    ProviderMetadataStatus.NotFound, claim.Symbol, null, null, null, null,
                    null, null, null, null, null,
                    JsonSerializer.SerializeToElement(new { searchedSymbol = claim.Symbol }),
                    requests, "not_found", "Alpha Vantage returned no matching symbol.");
            }

            var providerSymbol = match.Value.Symbol;
            var type = NormalizeType(match.Value.Type, claim.SecurityType);
            if (type == "stock")
            {
                requests++;
                using var overview = await GetAsync(
                    $"query?function=OVERVIEW&symbol={Uri.EscapeDataString(providerSymbol)}&apikey={Uri.EscapeDataString(apiKey)}",
                    cancellationToken).ConfigureAwait(false);
                if (FailureFromPayload(overview.RootElement, providerSymbol, requests) is { } overviewFailure)
                {
                    return overviewFailure;
                }

                var root = overview.RootElement;
                if (root.ValueKind != JsonValueKind.Object || !root.EnumerateObject().Any())
                {
                    return new ProviderSecurityMetadata(
                        ProviderMetadataStatus.NotFound, providerSymbol, match.Value.Name, type,
                        null, match.Value.Currency, null, null, null, null, null,
                        SearchAttributes(claim.Symbol, match.Value), requests,
                        "not_found", "Alpha Vantage returned an empty company overview.");
                }

                var name = String(root, "Name") ?? match.Value.Name;
                var companyId = String(root, "CIK");
                var exchange = String(root, "Exchange") ?? match.Value.Region;
                var currency = String(root, "Currency") ?? match.Value.Currency;
                var country = String(root, "Country");
                var sector = String(root, "Sector");
                var industry = String(root, "Industry");
                var assetType = NormalizeType(String(root, "AssetType"), type);
                var attributes = JsonSerializer.SerializeToElement(new Dictionary<string, object?>
                {
                    ["searched_symbol"] = claim.Symbol,
                    ["provider_symbol"] = providerSymbol,
                    ["name"] = name,
                    ["asset_type"] = assetType,
                    ["exchange"] = exchange,
                    ["currency"] = currency,
                    ["country"] = country,
                    ["sector"] = sector,
                    ["industry"] = industry,
                    ["company_id"] = companyId,
                });
                var incomplete = new[] { name, exchange, currency, country, sector }
                    .Any(string.IsNullOrWhiteSpace);
                return new ProviderSecurityMetadata(
                    incomplete ? ProviderMetadataStatus.Incomplete : ProviderMetadataStatus.Succeeded,
                    providerSymbol, name, assetType, exchange, currency, name, companyId,
                    country, sector, industry, attributes, requests);
            }

            if (type == "etf")
            {
                requests++;
                using var profile = await GetAsync(
                    $"query?function=ETF_PROFILE&symbol={Uri.EscapeDataString(providerSymbol)}&apikey={Uri.EscapeDataString(apiKey)}",
                    cancellationToken).ConfigureAwait(false);
                if (FailureFromPayload(profile.RootElement, providerSymbol, requests) is { } profileFailure)
                {
                    return profileFailure;
                }

                var profileAvailable = profile.RootElement.ValueKind == JsonValueKind.Object &&
                    profile.RootElement.EnumerateObject().Any();
                var attributes = JsonSerializer.SerializeToElement(new Dictionary<string, object?>
                {
                    ["searched_symbol"] = claim.Symbol,
                    ["provider_symbol"] = providerSymbol,
                    ["name"] = match.Value.Name,
                    ["asset_type"] = "etf",
                    ["region"] = match.Value.Region,
                    ["currency"] = match.Value.Currency,
                    ["etf_profile_available"] = profileAvailable,
                });
                return new ProviderSecurityMetadata(
                    ProviderMetadataStatus.Incomplete,
                    providerSymbol, match.Value.Name, "etf", null,
                    match.Value.Currency, null, null, null, null, null,
                    attributes, requests, profileAvailable ? null : "not_found",
                    profileAvailable
                        ? "ETF geography requires a canonical override or a provider that supplies geographic exposure."
                        : "Alpha Vantage returned an empty ETF profile.");
            }

            return new ProviderSecurityMetadata(
                ProviderMetadataStatus.Incomplete,
                providerSymbol, match.Value.Name, type, null,
                match.Value.Currency, null, null, null, null, null,
                SearchAttributes(claim.Symbol, match.Value), requests,
                "unsupported_type", $"No metadata profile is configured for security type '{type}'.");
        }
        catch (HttpRequestException exception) when (
            exception.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            return new ProviderSecurityMetadata(
                ProviderMetadataStatus.RateLimited, claim.Symbol, null, null, null, null,
                null, null, null, null, null,
                JsonSerializer.SerializeToElement(new { symbol = claim.Symbol }), requests,
                "rate_limited", Bound(exception.Message));
        }
        catch (Exception exception) when (
            exception is HttpRequestException or JsonException or InvalidOperationException)
        {
            return Failed(claim.Symbol, requests, "provider_error", exception.Message);
        }
    }

    private async Task<JsonDocument> GetAsync(string path, CancellationToken cancellationToken)
    {
        await WaitForRequestSlotAsync(cancellationToken).ConfigureAwait(false);
        using var response = await httpClient.GetAsync(path, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"Alpha Vantage returned HTTP {(int)response.StatusCode}.", null, response.StatusCode);
        }

        return await response.Content.ReadFromJsonAsync<JsonDocument>(
                cancellationToken: cancellationToken).ConfigureAwait(false)
            ?? throw new JsonException("Alpha Vantage returned an empty response body.");
    }

    private async Task WaitForRequestSlotAsync(CancellationToken cancellationToken)
    {
        await requestGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var delay = nextRequestAt - DateTimeOffset.UtcNow;
            if (delay > TimeSpan.Zero)
            {
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }

            nextRequestAt = DateTimeOffset.UtcNow.AddMilliseconds(
                Math.Max(0, options.RequestIntervalMilliseconds));
        }
        finally
        {
            requestGate.Release();
        }
    }

    private static ProviderSecurityMetadata? FailureFromPayload(
        JsonElement root,
        string symbol,
        int requests)
    {
        if (String(root, "Note") is { } note)
        {
            return new ProviderSecurityMetadata(
                ProviderMetadataStatus.RateLimited, symbol, null, null, null, null,
                null, null, null, null, null,
                JsonSerializer.SerializeToElement(new { symbol }), requests,
                "rate_limited", Bound(note));
        }

        if (String(root, "Information") is { } information)
        {
            var status = information.Contains("rate", StringComparison.OrdinalIgnoreCase)
                || information.Contains("frequency", StringComparison.OrdinalIgnoreCase)
                ? ProviderMetadataStatus.RateLimited
                : ProviderMetadataStatus.Failed;
            return new ProviderSecurityMetadata(
                status, symbol, null, null, null, null, null, null, null, null, null,
                JsonSerializer.SerializeToElement(new { symbol }), requests,
                status == ProviderMetadataStatus.RateLimited ? "rate_limited" : "provider_information",
                Bound(information));
        }

        if (String(root, "Error Message") is { } error)
        {
            return new ProviderSecurityMetadata(
                ProviderMetadataStatus.NotFound, symbol, null, null, null, null,
                null, null, null, null, null,
                JsonSerializer.SerializeToElement(new { symbol }), requests,
                "not_found", Bound(error));
        }

        return null;
    }

    private static SearchMatch? BestMatch(JsonElement root, string requestedSymbol)
    {
        if (!root.TryGetProperty("bestMatches", out var matches) ||
            matches.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var candidates = matches.EnumerateArray()
            .Select(item => new SearchMatch(
                String(item, "1. symbol") ?? string.Empty,
                String(item, "2. name"),
                String(item, "3. type"),
                String(item, "4. region"),
                String(item, "8. currency"),
                Decimal(item, "9. matchScore")))
            .Where(item => item.Symbol.Length > 0)
            .ToArray();
        foreach (var candidate in candidates)
        {
            if (string.Equals(candidate.Symbol, requestedSymbol, StringComparison.OrdinalIgnoreCase))
            {
                return candidate;
            }
        }

        return candidates.Length == 0
            ? null
            : candidates.OrderByDescending(item => item.Score).First();
    }

    private static JsonElement SearchAttributes(string searchedSymbol, SearchMatch match) =>
        JsonSerializer.SerializeToElement(new Dictionary<string, object?>
        {
            ["searched_symbol"] = searchedSymbol,
            ["provider_symbol"] = match.Symbol,
            ["name"] = match.Name,
            ["asset_type"] = match.Type,
            ["region"] = match.Region,
            ["currency"] = match.Currency,
        });

    private static ProviderSecurityMetadata Failed(
        string symbol,
        int requests,
        string code,
        string message) =>
        new(ProviderMetadataStatus.Failed, symbol, null, null, null, null,
            null, null, null, null, null,
            JsonSerializer.SerializeToElement(new { symbol }), requests, code, Bound(message));

    private static string NormalizeType(string? providerType, string fallback) =>
        (providerType ?? fallback).Trim().ToLowerInvariant() switch
        {
            "equity" or "common stock" or "stock" => "stock",
            "exchange traded fund" or "etf" => "etf",
            "mutual fund" or "fund" => "fund",
            "bond" => "bond",
            "crypto" or "cryptocurrency" => "crypto",
            _ => fallback.Trim().ToLowerInvariant(),
        };

    private static string? String(JsonElement root, string property) =>
        root.ValueKind == JsonValueKind.Object &&
        root.TryGetProperty(property, out var value) &&
        value.ValueKind == JsonValueKind.String &&
        !string.IsNullOrWhiteSpace(value.GetString()) &&
        !string.Equals(value.GetString(), "None", StringComparison.OrdinalIgnoreCase)
            ? value.GetString()!.Trim()
            : null;

    private static decimal Decimal(JsonElement root, string property) =>
        decimal.TryParse(String(root, property), NumberStyles.Float,
            CultureInfo.InvariantCulture, out var value)
            ? value
            : 0m;

    private static string Bound(string value) =>
        value.Length <= 500 ? value : value[..500];

    public void Dispose() => requestGate.Dispose();

    private readonly record struct SearchMatch(
        string Symbol,
        string? Name,
        string? Type,
        string? Region,
        string? Currency,
        decimal Score);
}
