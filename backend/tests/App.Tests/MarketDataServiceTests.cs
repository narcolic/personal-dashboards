using System.Net;
using System.Text;
using PortfolioTerminal.Portfolio.MarketData;

namespace PortfolioTerminal.Tests;

public sealed class MarketDataServiceTests
{
    [Fact]
    public async Task YahooQuoteServiceMapsChartMetadataToClientContract()
    {
        using var client = Client(_ => JsonResponse("""
            {
              "chart": {
                "result": [{
                  "meta": {
                    "currency": "USD",
                    "symbol": "MSFT",
                    "exchangeName": "NMS",
                    "fullExchangeName": "NasdaqGS",
                    "instrumentType": "EQUITY",
                    "regularMarketPrice": 503.24,
                    "chartPreviousClose": 492.81,
                    "longName": "Microsoft Corporation",
                    "shortName": "Microsoft Corporation"
                  }
                }],
                "error": null
              }
            }
            """), new Uri("https://query1.finance.yahoo.com/"));
        var service = new YahooQuoteService(client);

        var result = await service.GetAsync(["MSFT"]);

        var quote = Assert.Single(result.Quotes);
        Assert.Empty(result.Failed);
        Assert.Equal("MSFT", quote.Symbol);
        Assert.Equal(503.24m, quote.RegularMarketPrice);
        Assert.Equal(492.81m, quote.RegularMarketPreviousClose);
        Assert.Equal("NasdaqGS", quote.FullExchangeName);
        Assert.Equal("EQUITY", quote.QuoteType);
    }

    [Fact]
    public async Task FxRateServiceUsesFallbackProviderWhenPrimaryFails()
    {
        using var client = Client(request =>
            request.RequestUri?.Host == "api.frankfurter.app"
                ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
                : JsonResponse("""{"rates":{"USD":1,"EUR":0.86}}"""));
        var service = new FxRateService(client);

        var result = await service.GetAsync("USD");

        Assert.Equal(0.86m, result.GetProperty("rates").GetProperty("EUR").GetDecimal());
    }

    [Fact]
    public async Task MarketStatusServiceMergesHoursAndStatusPayloads()
    {
        using var client = Client(request =>
            request.RequestUri?.AbsolutePath.EndsWith("/hours", StringComparison.Ordinal) == true
                ? JsonResponse("""
                    {"data":{"markets":[{
                      "id":"nasdaq",
                      "exchange":"NASDAQ",
                      "timezone":"America/New_York",
                      "tradingHours":{"regular":{"start":"09:30","end":"16:00"}}
                    }]}}
                    """)
                : JsonResponse("""
                    {"markets":[{
                      "id":"nasdaq",
                      "status":{"isOpen":true,"status":"open"}
                    }]}
                    """));
        var now = new DateTimeOffset(2026, 8, 11, 12, 0, 0, TimeSpan.Zero);
        var service = new MarketStatusService(client, new FixedTimeProvider(now));

        var result = await service.GetAsync(["nasdaq"]);

        var market = Assert.Single(result.Markets);
        Assert.Equal(now, result.FetchedAt);
        Assert.Equal("nasdaq", market.Id);
        Assert.Equal("NASDAQ", market.Exchange);
        Assert.True(market.TradingHours?.GetProperty("regular").GetProperty("start").GetString() == "09:30");
        Assert.True(market.Status?.GetProperty("isOpen").GetBoolean());
    }

    private static HttpClient Client(
        Func<HttpRequestMessage, HttpResponseMessage> responder,
        Uri? baseAddress = null) =>
        new(new StubHandler(responder)) { BaseAddress = baseAddress };

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
            CancellationToken cancellationToken) =>
            Task.FromResult(responder(request));
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
