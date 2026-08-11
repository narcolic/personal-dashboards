using System.Text.Json;

namespace PortfolioTerminal.Portfolio.MarketData;

public interface IMarketStatusService
{
    Task<MarketStatusResult> GetAsync(
        IReadOnlyList<string> exchanges,
        CancellationToken cancellationToken = default);
}

public sealed record MarketStatusResult(
    IReadOnlyList<MarketStatusItem> Markets,
    DateTimeOffset FetchedAt);

public sealed record MarketStatusItem(
    string Id,
    string? Exchange,
    string? Market,
    string? Timezone,
    JsonElement? TradingHours,
    JsonElement? Status);
