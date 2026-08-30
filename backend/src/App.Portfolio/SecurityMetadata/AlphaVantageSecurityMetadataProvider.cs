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
            var requestedSymbol = string.IsNullOrWhiteSpace(claim.ProviderSymbol)
                ? claim.Symbol
                : claim.ProviderSymbol.Trim();
            var searchedSymbol = requestedSymbol;
            requests++;
            using var search = await GetAsync(
                $"query?function=SYMBOL_SEARCH&keywords={Uri.EscapeDataString(searchedSymbol)}&apikey={Uri.EscapeDataString(apiKey)}",
                cancellationToken).ConfigureAwait(false);
            var searchFailure = FailureFromPayload(search.RootElement, searchedSymbol, requests);
            if (searchFailure is not null && searchFailure.Status != ProviderMetadataStatus.NotFound)
            {
                return searchFailure;
            }

            var match = searchFailure is null
                ? BestMatch(search.RootElement, searchedSymbol, claim)
                : null;
            if (match is null && TryRemoveExchangeSuffix(searchedSymbol, out var bareSymbol))
            {
                searchedSymbol = bareSymbol;
                requests++;
                using var fallbackSearch = await GetAsync(
                    $"query?function=SYMBOL_SEARCH&keywords={Uri.EscapeDataString(searchedSymbol)}&apikey={Uri.EscapeDataString(apiKey)}",
                    cancellationToken).ConfigureAwait(false);
                if (FailureFromPayload(fallbackSearch.RootElement, searchedSymbol, requests) is { } fallbackFailure)
                {
                    return fallbackFailure;
                }

                match = BestMatch(fallbackSearch.RootElement, searchedSymbol, claim);
            }

            if (match is null)
            {
                return new ProviderSecurityMetadata(
                    ProviderMetadataStatus.NotFound, requestedSymbol, null, null, null, null,
                    null, null, null, null, null,
                    JsonSerializer.SerializeToElement(new
                    {
                        requested_symbol = requestedSymbol,
                        searched_symbol = searchedSymbol,
                    }),
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
                        SearchAttributes(requestedSymbol, searchedSymbol, match.Value), requests,
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
                    ["requested_symbol"] = requestedSymbol,
                    ["searched_symbol"] = searchedSymbol,
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
                    ["requested_symbol"] = requestedSymbol,
                    ["searched_symbol"] = searchedSymbol,
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
                SearchAttributes(requestedSymbol, searchedSymbol, match.Value), requests,
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

    private static SearchMatch? BestMatch(
        JsonElement root,
        string requestedSymbol,
        SecurityMetadataRefreshClaim claim)
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
            .Where(item => IsCompatibleMatch(item, requestedSymbol, claim))
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

    private static bool IsCompatibleMatch(
        SearchMatch candidate,
        string requestedSymbol,
        SecurityMetadataRefreshClaim claim)
    {
        if (!string.Equals(SymbolStem(candidate.Symbol), SymbolStem(requestedSymbol),
                StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var expectedType = NormalizeType(claim.SecurityType, claim.SecurityType);
        if (!string.IsNullOrWhiteSpace(candidate.Type) &&
            !string.Equals(NormalizeType(candidate.Type, candidate.Type), expectedType,
                StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(claim.TradingCurrency)
            || string.IsNullOrWhiteSpace(candidate.Currency)
            || string.Equals(candidate.Currency, claim.TradingCurrency,
                StringComparison.OrdinalIgnoreCase);
    }

    private static string SymbolStem(string symbol)
    {
        var separator = symbol.IndexOf('.');
        return separator > 0 ? symbol[..separator] : symbol;
    }

    private static JsonElement SearchAttributes(
        string requestedSymbol,
        string searchedSymbol,
        SearchMatch match) =>
        JsonSerializer.SerializeToElement(new Dictionary<string, object?>
        {
            ["requested_symbol"] = requestedSymbol,
            ["searched_symbol"] = searchedSymbol,
            ["provider_symbol"] = match.Symbol,
            ["name"] = match.Name,
            ["asset_type"] = match.Type,
            ["region"] = match.Region,
            ["currency"] = match.Currency,
        });

    private static bool TryRemoveExchangeSuffix(string symbol, out string bareSymbol)
    {
        var separator = symbol.LastIndexOf('.');
        if (separator > 0 && separator < symbol.Length - 1)
        {
            bareSymbol = symbol[..separator];
            return true;
        }

        bareSymbol = symbol;
        return false;
    }

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
