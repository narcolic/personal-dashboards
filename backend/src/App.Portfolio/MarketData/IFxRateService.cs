using System.Text.Json;

namespace PortfolioTerminal.Portfolio.MarketData;

public interface IFxRateService
{
    Task<JsonElement> GetAsync(
        string baseCurrency,
        CancellationToken cancellationToken = default);
}
