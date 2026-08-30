using System.Net;
using System.Text;
using System.Text.Json;
using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Tests;

public sealed class SecurityMetadataProviderTests
{
    [Fact]
    public async Task StockOverviewMapsOnlyCanonicalSourceFields()
    {
        using var client = Client(request => Query(request, "function") switch
        {
            "SYMBOL_SEARCH" => JsonResponse("""
                {"bestMatches":[{"1. symbol":"MSFT","2. name":"Microsoft Corporation","3. type":"Equity","4. region":"United States","8. currency":"USD","9. matchScore":"1.0000"}]}
                """),
            _ => JsonResponse("""
                {"Symbol":"MSFT","AssetType":"Common Stock","Name":"Microsoft Corporation","CIK":"789019","Exchange":"NASDAQ","Currency":"USD","Country":"USA","Sector":"TECHNOLOGY","Industry":"SOFTWARE—INFRASTRUCTURE","Description":"must not be persisted"}
                """),
        });
        var provider = Provider(client);

        var result = await provider.FetchAsync(Claim("MSFT", "stock"));

        Assert.Equal(ProviderMetadataStatus.Succeeded, result.Status);
        Assert.Equal(2, result.RequestsConsumed);
        Assert.Equal("789019", result.ProviderCompanyId);
        Assert.Equal("TECHNOLOGY", result.Sector);
        var json = result.SanitizedAttributes.GetRawText();
        Assert.DoesNotContain("Description", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("holdings", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EtfProfileNeverPersistsConstituentsOrPercentageSectors()
    {
        using var client = Client(request => Query(request, "function") switch
        {
            "SYMBOL_SEARCH" => JsonResponse("""
                {"bestMatches":[{"1. symbol":"VUAA.LON","2. name":"Vanguard S&P 500 UCITS ETF","3. type":"ETF","4. region":"United Kingdom","8. currency":"USD","9. matchScore":"0.999"}]}
                """),
            _ => JsonResponse("""
                {"net_assets":"100","sectors":[{"technology":"32.5"}],"holdings":[{"symbol":"AAPL","weight":"7.1"}]}
                """),
        });
        var provider = Provider(client);

        var result = await provider.FetchAsync(Claim("VUAA.LON", "etf"));

        Assert.Equal(ProviderMetadataStatus.Incomplete, result.Status);
        var json = result.SanitizedAttributes.GetRawText();
        Assert.DoesNotContain("holdings", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("sectors", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("weight", json, StringComparison.OrdinalIgnoreCase);
        Assert.True(result.SanitizedAttributes.GetProperty("etf_profile_available").GetBoolean());
    }

    [Fact]
    public async Task DailyLimitMessageIsRateLimited()
    {
        using var client = Client(_ => JsonResponse("""
            {"Note":"Thank you for using Alpha Vantage. Our standard API rate limit has been reached."}
            """));
        var provider = Provider(client);

        var result = await provider.FetchAsync(Claim("MSFT", "stock"));

        Assert.Equal(ProviderMetadataStatus.RateLimited, result.Status);
        Assert.Equal("rate_limited", result.ErrorCode);
        Assert.Equal(1, result.RequestsConsumed);
    }

    [Fact]
    public async Task MissingSuffixedSymbolRetriesWithBareSymbol()
    {
        var searchedSymbols = new List<string?>();
        using var client = Client(request =>
        {
            var function = Query(request, "function");
            if (function == "SYMBOL_SEARCH")
            {
                var symbol = Uri.UnescapeDataString(Query(request, "keywords") ?? string.Empty);
                searchedSymbols.Add(symbol);
                return symbol == "TPEIR.AT"
                    ? JsonResponse("""{"bestMatches":[]}""")
                    : JsonResponse("""
                        {"bestMatches":[{"1. symbol":"TPEIR","2. name":"Piraeus Financial Holdings S.A.","3. type":"Equity","4. region":"Greece","8. currency":"EUR","9. matchScore":"1.0000"}]}
                        """);
            }

            return JsonResponse("""
                {"Symbol":"TPEIR","AssetType":"Common Stock","Name":"Piraeus Financial Holdings S.A.","Exchange":"ATHENS","Currency":"EUR","Country":"Greece","Sector":"FINANCIAL SERVICES"}
                """);
        });
        var provider = Provider(client);

        var claim = Claim("TPEIR.AT", "stock") with { TradingCurrency = "EUR" };
        var result = await provider.FetchAsync(claim);

        Assert.Equal(ProviderMetadataStatus.Succeeded, result.Status);
        Assert.Equal("TPEIR", result.ProviderSymbol);
        Assert.Equal(3, result.RequestsConsumed);
        Assert.Equal(["TPEIR.AT", "TPEIR"], searchedSymbols);
        Assert.Equal("TPEIR.AT", result.SanitizedAttributes.GetProperty("requested_symbol").GetString());
        Assert.Equal("TPEIR", result.SanitizedAttributes.GetProperty("searched_symbol").GetString());
    }

    [Fact]
    public async Task MissingBareSymbolDoesNotRepeatSearch()
    {
        var requests = 0;
        using var client = Client(_ =>
        {
            requests++;
            return JsonResponse("""{"bestMatches":[]}""");
        });
        var provider = Provider(client);

        var result = await provider.FetchAsync(Claim("AETF", "etf"));

        Assert.Equal(ProviderMetadataStatus.NotFound, result.Status);
        Assert.Equal(1, result.RequestsConsumed);
        Assert.Equal(1, requests);
    }

    [Fact]
    public async Task FallbackRejectsUnrelatedOrWrongCurrencyMatch()
    {
        using var client = Client(request =>
        {
            var symbol = Uri.UnescapeDataString(Query(request, "keywords") ?? string.Empty);
            return symbol == "AETF.AT"
                ? JsonResponse("""{"bestMatches":[]}""")
                : JsonResponse("""
                    {"bestMatches":[
                      {"1. symbol":"AETF","2. name":"Unrelated ETF","3. type":"ETF","4. region":"United States","8. currency":"USD","9. matchScore":"1.0000"},
                      {"1. symbol":"AETFX","2. name":"Unrelated Fund","3. type":"Mutual Fund","4. region":"United States","8. currency":"USD","9. matchScore":"0.9000"}
                    ]}
                    """);
        });
        var provider = Provider(client);
        var claim = Claim("AETF.AT", "etf") with { TradingCurrency = "EUR" };

        var result = await provider.FetchAsync(claim);

        Assert.Equal(ProviderMetadataStatus.NotFound, result.Status);
        Assert.Equal(2, result.RequestsConsumed);
    }

    [Fact]
    public async Task NotFoundPayloadAlsoRetriesWithBareSymbol()
    {
        using var client = Client(request =>
        {
            if (Query(request, "function") == "SYMBOL_SEARCH")
            {
                var symbol = Uri.UnescapeDataString(Query(request, "keywords") ?? string.Empty);
                return symbol == "TPEIR.AT"
                    ? JsonResponse("""{"Error Message":"Invalid API call."}""")
                    : JsonResponse("""
                        {"bestMatches":[{"1. symbol":"TPEIR","2. name":"Piraeus Financial Holdings S.A.","3. type":"Equity","4. region":"Greece","8. currency":"EUR","9. matchScore":"1.0000"}]}
                        """);
            }

            return JsonResponse("""
                {"Symbol":"TPEIR","AssetType":"Common Stock","Name":"Piraeus Financial Holdings S.A.","Exchange":"ATHENS","Currency":"EUR","Country":"Greece","Sector":"FINANCIAL SERVICES"}
                """);
        });
        var provider = Provider(client);
        var claim = Claim("TPEIR.AT", "stock") with { TradingCurrency = "EUR" };

        var result = await provider.FetchAsync(claim);

        Assert.Equal(ProviderMetadataStatus.Succeeded, result.Status);
        Assert.Equal("TPEIR", result.ProviderSymbol);
        Assert.Equal(3, result.RequestsConsumed);
    }

    [Fact]
    public async Task ExistingProviderSymbolIsUsedBeforeListingSymbol()
    {
        var searchedSymbols = new List<string?>();
        using var client = Client(request =>
        {
            if (Query(request, "function") == "SYMBOL_SEARCH")
            {
                searchedSymbols.Add(Uri.UnescapeDataString(Query(request, "keywords") ?? string.Empty));
                return JsonResponse("""
                    {"bestMatches":[{"1. symbol":"TPEIR","2. name":"Piraeus Financial Holdings S.A.","3. type":"Equity","4. region":"Greece","8. currency":"EUR","9. matchScore":"1.0000"}]}
                    """);
            }

            return JsonResponse("""
                {"Symbol":"TPEIR","AssetType":"Common Stock","Name":"Piraeus Financial Holdings S.A.","Exchange":"ATHENS","Currency":"EUR","Country":"Greece","Sector":"FINANCIAL SERVICES"}
                """);
        });
        var provider = Provider(client);
        var claim = Claim("TPEIR.AT", "stock") with
        {
            TradingCurrency = "EUR",
            ProviderSymbol = "TPEIR",
        };

        var result = await provider.FetchAsync(claim);

        Assert.Equal(ProviderMetadataStatus.Succeeded, result.Status);
        Assert.Equal(["TPEIR"], searchedSymbols);
        Assert.Equal(2, result.RequestsConsumed);
    }

    [Fact]
    public async Task MissingApiKeyDoesNotMakeARequest()
    {
        var requests = 0;
        using var client = Client(_ =>
        {
            requests++;
            return JsonResponse("{}");
        });
        var provider = new AlphaVantageSecurityMetadataProvider(client, new AlphaVantageOptions());

        var result = await provider.FetchAsync(Claim("MSFT", "stock"));

        Assert.Equal(ProviderMetadataStatus.Failed, result.Status);
        Assert.Equal("not_configured", result.ErrorCode);
        Assert.Equal(0, requests);
    }

    [Fact]
    public async Task RequestsAreSpacedByConfiguredInterval()
    {
        var requestTimes = new List<DateTimeOffset>();
        using var client = Client(request =>
        {
            requestTimes.Add(DateTimeOffset.UtcNow);
            return Query(request, "function") == "SYMBOL_SEARCH"
                ? JsonResponse("""
                    {"bestMatches":[{"1. symbol":"MSFT","2. name":"Microsoft Corporation","3. type":"Equity","4. region":"United States","8. currency":"USD","9. matchScore":"1.0000"}]}
                    """)
                : JsonResponse("""
                    {"Symbol":"MSFT","AssetType":"Common Stock","Name":"Microsoft Corporation","Exchange":"NASDAQ","Currency":"USD","Country":"USA","Sector":"TECHNOLOGY"}
                    """);
        });
        var provider = new AlphaVantageSecurityMetadataProvider(
            client,
            new AlphaVantageOptions { ApiKey = "test", RequestIntervalMilliseconds = 100 });

        var result = await provider.FetchAsync(Claim("MSFT", "stock"));

        Assert.Equal(ProviderMetadataStatus.Succeeded, result.Status);
        Assert.Equal(2, requestTimes.Count);
        Assert.True(requestTimes[1] - requestTimes[0] >= TimeSpan.FromMilliseconds(80));
    }

    [Fact]
    public async Task RefreshJobStopsAfterRateLimitAndCompletesClaimedItem()
    {
        var claims = new[] { Claim("AAA", "stock"), Claim("BBB", "stock") };
        var store = new RecordingStore(claims);
        var provider = new StubProvider(new ProviderSecurityMetadata(
            ProviderMetadataStatus.RateLimited, "AAA", null, null, null, null,
            null, null, null, null, null, JsonSerializer.SerializeToElement(new { symbol = "AAA" }),
            1, "rate_limited", "daily limit"));
        var job = new SecurityMetadataRefreshJob(
            provider,
            new StubCanonicalizer(),
            store,
            new SecurityMetadataOptions { MaxRequestsPerRun = 20, MaxItemsPerRun = 20 },
            new AlphaVantageOptions { ApiKey = "test" });

        var result = await job.RunAsync(new SecurityMetadataRefreshRequest());

        Assert.Equal(2, result.Claimed);
        Assert.Equal(1, result.Processed);
        Assert.Equal(1, result.RateLimited);
        Assert.Single(store.Completed);
    }

    private static AlphaVantageSecurityMetadataProvider Provider(HttpClient client) =>
        new(client, new AlphaVantageOptions
        {
            ApiKey = "test",
            RequestIntervalMilliseconds = 0,
        });

    private static SecurityMetadataRefreshClaim Claim(string symbol, string type) =>
        new(Guid.NewGuid(), Guid.NewGuid(), type == "stock" ? Guid.NewGuid() : null,
            symbol, symbol, type, "USD");

    private static HttpClient Client(Func<HttpRequestMessage, HttpResponseMessage> responder) =>
        new(new StubHandler(responder)) { BaseAddress = new Uri("https://www.alphavantage.co/") };

    private static string? Query(HttpRequestMessage request, string name)
    {
        var query = request.RequestUri?.Query.TrimStart('?').Split('&') ?? [];
        return query.Select(part => part.Split('=', 2))
            .FirstOrDefault(parts => parts.Length == 2 && parts[0] == name)?[1];
    }

    private static HttpResponseMessage JsonResponse(string json) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };

    private sealed class StubHandler(
        Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(responder(request));
    }

    private sealed class StubProvider(ProviderSecurityMetadata response) : ISecurityMetadataProvider
    {
        public Task<ProviderSecurityMetadata> FetchAsync(
            SecurityMetadataRefreshClaim claim,
            CancellationToken cancellationToken = default) => Task.FromResult(response);
    }

    private sealed class StubCanonicalizer : ISecurityMetadataCanonicalizer
    {
        public Task<CanonicalSecurityMetadata> CanonicalizeAsync(
            ProviderSecurityMetadata metadata,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new CanonicalSecurityMetadata(null, null, null, null, null, true));
    }

    private sealed class RecordingStore(IReadOnlyList<SecurityMetadataRefreshClaim> claims)
        : ISecurityMetadataStore
    {
        public List<Guid> Completed { get; } = [];

        public Task<IReadOnlyList<SecurityMetadataRefreshClaim>> ClaimAsync(
            int limit,
            bool force,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<SecurityMetadataRefreshClaim>>([.. claims.Take(limit)]);

        public Task CompleteAsync(
            SecurityMetadataRefreshClaim claim,
            ProviderSecurityMetadata providerMetadata,
            CanonicalSecurityMetadata? canonicalMetadata,
            CancellationToken cancellationToken = default)
        {
            Completed.Add(claim.ListingId);
            return Task.CompletedTask;
        }

        public Task ReleaseAsync(
            IReadOnlyCollection<Guid> listingIds,
            TimeSpan delay,
            CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
