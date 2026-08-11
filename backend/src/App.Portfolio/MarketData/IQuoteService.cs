namespace PortfolioTerminal.Portfolio.MarketData;

public interface IQuoteService
{
    Task<QuoteLookupResult> GetAsync(
        IReadOnlyList<string> symbols,
        CancellationToken cancellationToken = default);
}

public sealed record QuoteLookupResult(
    IReadOnlyList<MarketQuote> Quotes,
    IReadOnlyList<QuoteFailure> Failed);

public sealed record MarketQuote(
    string Symbol,
    string? ShortName,
    string? LongName,
    decimal RegularMarketPrice,
    decimal RegularMarketPreviousClose,
    string Currency,
    string? FullExchangeName,
    string? Exchange,
    string? MarketState,
    string? QuoteType);

public sealed record QuoteFailure(string Symbol, string Error);
