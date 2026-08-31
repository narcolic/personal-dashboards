using System.Collections.Concurrent;
using System.Text.Json;
using PortfolioTerminal.Portfolio.Holdings;
using PortfolioTerminal.Portfolio.MarketData;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.Snapshots;

namespace PortfolioTerminal.Portfolio.Analytics;

public sealed class PortfolioAnalysisService(
    IPortfolioQueries portfolioQueries,
    IPortfolioHoldingQueries holdingQueries,
    IPortfolioSnapshotQueries snapshotQueries,
    IQuoteService quoteService,
    IFxRateService fxRateService,
    TimeProvider timeProvider,
    int maxHoldings = PortfolioAnalysisService.DefaultMaxHoldings) : IPortfolioAnalysisService
{
    public const int DefaultMaxHoldings = 100;
    private readonly ConcurrentDictionary<string, Task<JsonElement>> _fxPayloads =
        new(StringComparer.OrdinalIgnoreCase);

    public async Task<PortfolioSummaryResult> GetSummaryAsync(
        Guid userId,
        string? portfolio,
        string displayCurrency,
        int top,
        CancellationToken cancellationToken = default)
    {
        top = RequireRange(top, 1, 10, nameof(top));
        var state = await LoadLiveStateAsync(userId, portfolio, displayCurrency, null, cancellationToken)
            .ConfigureAwait(false);
        var positions = Consolidate(state.Rows);
        var totals = CalculateTotals(positions);
        var ranked = positions.Select(ToRanked).ToArray();

        return new(
            state.AsOf,
            state.Scope.Selector,
            state.Currency,
            totals,
            [.. ranked.OrderByDescending(item => item.Value).Take(top)],
            [.. ranked.OrderByDescending(item => item.UnrealizedPnl).Take(top)],
            [.. ranked.OrderBy(item => item.UnrealizedPnl).Take(top)],
            CurrentSemanticsWarnings());
    }

    public async Task<PortfolioHoldingsResult> GetHoldingsAsync(
        Guid userId,
        string? portfolio,
        IReadOnlyList<string>? tickers,
        string displayCurrency,
        string sort,
        int limit,
        CancellationToken cancellationToken = default)
    {
        limit = RequireRange(limit, 1, 50, nameof(limit));
        var tickerSet = NormalizeTickers(tickers, 20);
        var state = await LoadLiveStateAsync(userId, portfolio, displayCurrency, null, cancellationToken)
            .ConfigureAwait(false);
        var positions = Consolidate(state.Rows)
            .Where(position => tickerSet.Count == 0 || tickerSet.Contains(position.Ticker))
            .ToArray();
        var ordered = SortPositions(positions, sort).ToArray();

        return new(
            state.AsOf,
            state.Scope.Selector,
            state.Currency,
            Math.Min(ordered.Length, limit),
            ordered.Length,
            [.. ordered.Take(limit)],
            CurrentSemanticsWarnings());
    }

    public async Task<PortfolioAllocationResult> GetAllocationAsync(
        Guid userId,
        string? portfolio,
        string dimension,
        string displayCurrency,
        int limit,
        CancellationToken cancellationToken = default)
    {
        limit = RequireRange(limit, 1, 20, nameof(limit));
        var normalizedDimension = dimension.Trim().ToLowerInvariant();
        if (normalizedDimension is not ("assettype" or "securitytype" or "currency"
            or "portfolio" or "country" or "region" or "sector" or "industry"))
        {
            throw new PortfolioAnalysisException(
                "unsupported_dimension",
                "Supported allocation dimensions are assetType, securityType, currency, portfolio, country, region, sector, and industry.");
        }

        var state = await LoadLiveStateAsync(userId, portfolio, displayCurrency, null, cancellationToken)
            .ConfigureAwait(false);
        var items = BuildAllocation(state.Rows, normalizedDimension);
        var visible = items.Take(limit).ToArray();
        PortfolioAllocationItem? other = null;
        if (items.Count > limit)
        {
            var otherValue = items.Skip(limit).Sum(item => item.Value);
            var total = items.Sum(item => item.Value);
            other = new("Other", Round(otherValue), Percent(otherValue, total));
        }

        return new(
            state.AsOf,
            state.Scope.Selector,
            state.Currency,
            dimension,
            Round(state.Rows.Sum(row => row.CurrentValue)),
            visible,
            other,
            CurrentSemanticsWarnings());
    }

    public async Task<PortfolioHistoryResult> GetHistoryAsync(
        Guid userId,
        string? portfolio,
        DateOnly? dateFrom,
        DateOnly? dateTo,
        string displayCurrency,
        string interval,
        int maxPoints,
        CancellationToken cancellationToken = default)
    {
        var currency = NormalizeCurrency(displayCurrency);
        maxPoints = RequireRange(maxPoints, 2, 120, nameof(maxPoints));
        var normalizedInterval = interval.Trim().ToLowerInvariant();
        if (normalizedInterval is not ("daily" or "weekly" or "monthly"))
        {
            throw new PortfolioAnalysisException("invalid_range", "interval must be daily, weekly, or monthly.");
        }

        var portfolios = await portfolioQueries.ListAsync(userId, cancellationToken).ConfigureAwait(false);
        var scope = PortfolioSelectorResolver.Resolve(portfolio, portfolios);
        var end = dateTo ?? DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var start = dateFrom ?? end.AddYears(-1);
        if (start > end || end.DayNumber - start.DayNumber > 366 * 5)
        {
            throw new PortfolioAnalysisException("invalid_range", "History range must be ordered and no longer than five years.");
        }

        var scopeKey = scope.IsAll
            ? "total"
            : scope.IsUnassigned ? "portfolio:unassigned" : scope.Selector;
        var snapshots = await snapshotQueries.SearchAsync(
                userId,
                scopeKey,
                start,
                end,
                cancellationToken)
            .ConfigureAwait(false);
        var points = snapshots.Select(snapshot => new PortfolioHistoryPoint(
                snapshot.SnapshotDate,
                currency == "EUR" ? snapshot.MarketValueEur : snapshot.MarketValueUsd,
                currency == "EUR" ? snapshot.CostBasisEur : snapshot.CostBasisUsd,
                currency == "EUR" ? snapshot.UnrealizedEur : snapshot.UnrealizedUsd))
            .OrderBy(point => point.Date)
            .ToArray();
        points = Bucket(points, normalizedInterval);
        points = Sample(points, maxPoints);

        PortfolioHistorySummary? summary = null;
        if (points.Length > 0)
        {
            var first = points[0];
            var last = points[^1];
            summary = new(
                Round(first.MarketValue),
                Round(last.MarketValue),
                Round(last.MarketValue - first.MarketValue),
                Percent(last.MarketValue - first.MarketValue, first.MarketValue),
                Round(first.UnrealizedPnl),
                Round(last.UnrealizedPnl),
                Round(last.UnrealizedPnl - first.UnrealizedPnl),
                Round(points.Max(point => point.MarketValue)),
                Round(points.Min(point => point.MarketValue)));
        }

        return new(
            timeProvider.GetUtcNow(),
            scope.Selector,
            currency,
            points.FirstOrDefault()?.Date,
            points.LastOrDefault()?.Date,
            "portfolio_value_change",
            summary,
            points,
            [new("not_investment_return", "Value change is not a cash-flow-adjusted investment return.")]);
    }

    public async Task<PortfolioSimulationResult> SimulatePurchaseAsync(
        Guid userId,
        string? portfolio,
        string ticker,
        decimal amount,
        string amountCurrency,
        string displayCurrency,
        CancellationToken cancellationToken = default)
    {
        if (amount <= 0m || amount > 100_000_000m)
        {
            throw new PortfolioAnalysisException("invalid_range", "amount must be greater than zero and no more than 100,000,000.");
        }

        var symbol = NormalizeTicker(ticker);
        var amountCode = NormalizeCurrency(amountCurrency);
        var state = await LoadLiveStateAsync(userId, portfolio, displayCurrency, symbol, cancellationToken)
            .ConfigureAwait(false);
        var quote = state.Quotes[symbol];
        var amountInDisplay = await ConvertAsync(amount, amountCode, state.Currency, cancellationToken)
            .ConfigureAwait(false);
        var amountInQuote = await ConvertAsync(amount, amountCode, NormalizeCurrency(quote.Currency), cancellationToken)
            .ConfigureAwait(false);
        var estimatedShares = amountInQuote / quote.RegularMarketPrice;

        var before = Consolidate(state.Rows);
        var beforeValue = before.Sum(position => position.CurrentValue);
        var afterRows = state.Rows.Append(new EnrichedHolding(
            symbol,
            quote.LongName ?? quote.ShortName,
            quote.QuoteType ?? "Unknown",
            estimatedShares,
            NormalizeCurrency(quote.Currency),
            quote.RegularMarketPrice,
            amountInDisplay,
            amountInDisplay,
            0m,
            state.Scope.Selector,
            state.Scope.DisplayName,
            null));
        var after = Consolidate(afterRows);
        var afterValue = after.Sum(position => position.CurrentValue);
        var beforePositionValue = before.Where(position => position.Ticker == symbol).Sum(position => position.CurrentValue);
        var afterPositionValue = after.Where(position => position.Ticker == symbol).Sum(position => position.CurrentValue);

        return new(
            state.AsOf,
            state.Scope.Selector,
            state.Currency,
            true,
            new(symbol, quote.LongName ?? quote.ShortName, quote.RegularMarketPrice, NormalizeCurrency(quote.Currency)),
            new(amount, amountCode, Round(estimatedShares, 8)),
            new(
                Round(beforeValue),
                Round(afterValue),
                Percent(beforePositionValue, beforeValue),
                Percent(afterPositionValue, afterValue),
                LargestWeight(before),
                LargestWeight(after),
                TopWeight(before, 5),
                TopWeight(after, 5)),
            new(
                BuildAllocation(state.Rows, "assettype"),
                BuildAllocation(afterRows, "assettype"),
                BuildAllocation(state.Rows, "currency"),
                BuildAllocation(afterRows, "currency")),
            CurrentSemanticsWarnings());
    }

    private async Task<LiveState> LoadLiveStateAsync(
        Guid userId,
        string? selector,
        string displayCurrency,
        string? additionalTicker,
        CancellationToken cancellationToken)
    {
        var currency = NormalizeCurrency(displayCurrency);
        var portfolioTask = portfolioQueries.ListAsync(userId, cancellationToken);
        var holdingTask = holdingQueries.ListAsync(userId, cancellationToken);
        await Task.WhenAll(portfolioTask, holdingTask).ConfigureAwait(false);
        var portfolios = await portfolioTask.ConfigureAwait(false);
        var scope = PortfolioSelectorResolver.Resolve(selector, portfolios);
        var portfolioNames = portfolios.ToDictionary(item => item.Id, item => item.Name);
        var holdings = (await holdingTask.ConfigureAwait(false))
            .Where(holding => scope.IsAll ||
                (scope.IsUnassigned ? holding.PortfolioId is null : holding.PortfolioId == scope.PortfolioId))
            .ToArray();
        var symbols = holdings.Select(holding => holding.Ticker)
            .Append(additionalTicker)
            .Where(symbol => !string.IsNullOrWhiteSpace(symbol))
            .Select(symbol => NormalizeTicker(symbol!))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.Ordinal)
            .ToArray();
        if (symbols.Length > maxHoldings)
        {
            throw new PortfolioAnalysisException("portfolio_too_large", $"Live analysis supports at most {maxHoldings} distinct holdings.");
        }

        var quoteResult = symbols.Length == 0
            ? new QuoteLookupResult([], [])
            : await quoteService.GetAsync(symbols, cancellationToken).ConfigureAwait(false);
        if (quoteResult.Failed.Count > 0 || quoteResult.Quotes.Count != symbols.Length)
        {
            var failed = quoteResult.Failed.Select(item => item.Symbol)
                .Concat(symbols.Except(quoteResult.Quotes.Select(item => item.Symbol), StringComparer.OrdinalIgnoreCase));
            throw new PortfolioAnalysisException(
                "market_data_incomplete",
                $"Live market data is incomplete for: {string.Join(", ", failed.Distinct(StringComparer.OrdinalIgnoreCase))}.");
        }

        var quotes = quoteResult.Quotes.ToDictionary(quote => NormalizeTicker(quote.Symbol), StringComparer.OrdinalIgnoreCase);
        var rows = new List<EnrichedHolding>();
        foreach (var holding in holdings)
        {
            var security = holding.Security ?? throw new InvalidOperationException(
                $"Holding {holding.Id} has no canonical security metadata.");
            var quote = quotes[NormalizeTicker(holding.Ticker)];
            var quoteCurrency = NormalizeCurrency(quote.Currency);
            var marketValue = await ConvertAsync(
                    quote.RegularMarketPrice * holding.Shares,
                    quoteCurrency,
                    currency,
                    cancellationToken)
                .ConfigureAwait(false);
            var costBasis = await ConvertAsync(
                    holding.AvgCost * holding.Shares,
                    NormalizeCurrency(holding.Currency),
                    currency,
                    cancellationToken)
                .ConfigureAwait(false);
            var dayChange = await ConvertAsync(
                    (quote.RegularMarketPrice - quote.RegularMarketPreviousClose) * holding.Shares,
                    quoteCurrency,
                    currency,
                    cancellationToken)
                .ConfigureAwait(false);
            var portfolioRef = holding.PortfolioId is null
                ? "unassigned"
                : $"portfolio:{holding.PortfolioId}";
            rows.Add(new(
                NormalizeTicker(holding.Ticker),
                quote.LongName ?? quote.ShortName ?? security.Name,
                security.SecurityType,
                holding.Shares,
                quoteCurrency,
                quote.RegularMarketPrice,
                marketValue,
                costBasis,
                dayChange,
                portfolioRef,
                holding.PortfolioId is null
                    ? "Unassigned"
                    : portfolioNames.GetValueOrDefault(holding.PortfolioId.Value, "Unknown portfolio"),
                security));
        }

        return new(timeProvider.GetUtcNow(), scope, currency, rows, quotes);
    }

    private async Task<decimal> ConvertAsync(
        decimal amount,
        string source,
        string target,
        CancellationToken cancellationToken)
    {
        if (source.Equals(target, StringComparison.OrdinalIgnoreCase))
        {
            return amount;
        }

        var payload = await _fxPayloads.GetOrAdd(
                source,
                currency => fxRateService.GetAsync(currency, cancellationToken))
            .ConfigureAwait(false);
        if (!payload.TryGetProperty("rates", out var rates) ||
            rates.ValueKind != JsonValueKind.Object ||
            !rates.TryGetProperty(target, out var rateNode) ||
            !rateNode.TryGetDecimal(out var rate) ||
            rate <= 0m)
        {
            throw new PortfolioAnalysisException("fx_unavailable", $"No usable {source}/{target} exchange rate is available.");
        }

        return amount * rate;
    }

    private static PortfolioAnalysisPosition[] Consolidate(IEnumerable<EnrichedHolding> source)
    {
        var rows = source.ToArray();
        var total = rows.Sum(row => row.CurrentValue);
        return [.. rows.GroupBy(row => row.Ticker, StringComparer.OrdinalIgnoreCase).Select(group =>
        {
            var items = group.ToArray();
            var value = items.Sum(item => item.CurrentValue);
            var cost = items.Sum(item => item.CostBasis);
            var quantity = items.Sum(item => item.Quantity);
            var dayChange = items.Sum(item => item.DayChange);
            var last = items[^1];
            return new PortfolioAnalysisPosition(
                group.Key,
                last.Name,
                last.AssetType,
                Round(quantity, 8),
                last.QuoteCurrency,
                Round(last.CurrentPrice, 6),
                Round(value),
                Round(cost),
                quantity == 0m ? 0m : Round(cost / quantity, 6),
                Round(value - cost),
                Percent(value - cost, cost),
                Round(dayChange),
                Percent(value, total),
                [.. items.Select(item => item.PortfolioRef).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.Ordinal)],
                last.Security);
        }).OrderByDescending(position => position.CurrentValue)];
    }

    private static PortfolioAnalysisTotals CalculateTotals(PortfolioAnalysisPosition[] positions)
    {
        var value = positions.Sum(position => position.CurrentValue);
        var cost = positions.Sum(position => position.CostBasis);
        var dayChange = positions.Sum(position => position.DayChange);
        return new(
            Round(value),
            Round(cost),
            Round(value - cost),
            Percent(value - cost, cost),
            Round(dayChange),
            Percent(dayChange, value - dayChange),
            positions.Length);
    }

    private static IReadOnlyList<PortfolioAllocationItem> BuildAllocation(
        IEnumerable<EnrichedHolding> source,
        string dimension)
    {
        var rows = source.ToArray();
        var total = rows.Sum(row => row.CurrentValue);
        return [.. rows.GroupBy(row => dimension switch
            {
                "assettype" or "securitytype" =>
                    string.IsNullOrWhiteSpace(row.Security?.SecurityType)
                        ? "Unknown" : row.Security.SecurityType,
                "currency" => row.QuoteCurrency,
                "portfolio" => row.PortfolioName,
                "country" => row.Security?.CountryName ?? "Unknown",
                "region" => row.Security?.SecurityType == "stock"
                    ? row.Security.RegionName ?? "Unknown"
                    : row.Security?.GeographicExposureName ?? "Unknown",
                "sector" => row.Security?.SectorName ?? "Unknown",
                "industry" => row.Security?.IndustryName ?? "Unknown",
                _ => "Unknown",
            }, StringComparer.OrdinalIgnoreCase)
            .Select(group => new PortfolioAllocationItem(
                group.Key,
                Round(group.Sum(row => row.CurrentValue)),
                Percent(group.Sum(row => row.CurrentValue), total)))
            .OrderByDescending(item => item.Value)];
    }

    private static IEnumerable<PortfolioAnalysisPosition> SortPositions(
        IEnumerable<PortfolioAnalysisPosition> positions,
        string sort) => sort.Trim().ToLowerInvariant() switch
        {
            "weight" => positions.OrderByDescending(position => position.WeightPct),
            "value" => positions.OrderByDescending(position => position.CurrentValue),
            "unrealizedpnl" => positions.OrderByDescending(position => position.UnrealizedPnl),
            "returnpct" => positions.OrderByDescending(position => position.UnrealizedReturnPct),
            "ticker" => positions.OrderBy(position => position.Ticker, StringComparer.Ordinal),
            _ => throw new PortfolioAnalysisException("invalid_range", "sort must be weight, value, unrealizedPnl, returnPct, or ticker."),
        };

    private static PortfolioHistoryPoint[] Bucket(PortfolioHistoryPoint[] points, string interval) =>
        interval switch
        {
            "daily" => points,
            "weekly" => [.. points.GroupBy(point => StartOfWeek(point.Date)).Select(group => group.Last()).OrderBy(point => point.Date)],
            "monthly" => [.. points.GroupBy(point => (point.Date.Year, point.Date.Month)).Select(group => group.Last()).OrderBy(point => point.Date)],
            _ => points,
        };

    private static PortfolioHistoryPoint[] Sample(PortfolioHistoryPoint[] points, int maxPoints)
    {
        if (points.Length <= maxPoints)
        {
            return points;
        }

        return [.. Enumerable.Range(0, maxPoints)
            .Select(index => points[(int)Math.Round(index * (points.Length - 1d) / (maxPoints - 1d))])
            .DistinctBy(point => point.Date)];
    }

    private static DateOnly StartOfWeek(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }

    private static HashSet<string> NormalizeTickers(IReadOnlyList<string>? tickers, int maximum)
    {
        if (tickers is null || tickers.Count == 0)
        {
            return new(StringComparer.OrdinalIgnoreCase);
        }
        if (tickers.Count > maximum)
        {
            throw new PortfolioAnalysisException("invalid_range", $"At most {maximum} tickers may be requested.");
        }
        return [.. tickers.Select(NormalizeTicker)];
    }

    private static string NormalizeTicker(string ticker)
    {
        var value = ticker.Trim().ToUpperInvariant();
        if (value.Length is < 1 or > 32 || value.Any(character => !(char.IsLetterOrDigit(character) || ".-^=".Contains(character))))
        {
            throw new PortfolioAnalysisException("invalid_range", "ticker must be 1-32 letters, digits, dots, dashes, carets, or equals signs.");
        }
        return value;
    }

    private static string NormalizeCurrency(string value)
    {
        var currency = value.Trim().ToUpperInvariant();
        return currency is "EUR" or "USD"
            ? currency
            : throw new PortfolioAnalysisException("invalid_range", "Supported display and investment currencies are EUR and USD.");
    }

    private static int RequireRange(int value, int minimum, int maximum, string name) =>
        value < minimum || value > maximum
            ? throw new PortfolioAnalysisException("invalid_range", $"{name} must be between {minimum} and {maximum}.")
            : value;

    private static PortfolioRankedPosition ToRanked(PortfolioAnalysisPosition position) =>
        new(position.Ticker, position.CurrentValue, position.WeightPct, position.UnrealizedPnl, position.UnrealizedReturnPct);

    private static decimal LargestWeight(PortfolioAnalysisPosition[] positions) =>
        positions.Length == 0 ? 0m : positions.Max(position => position.WeightPct);

    private static decimal TopWeight(PortfolioAnalysisPosition[] positions, int count) =>
        Round(positions.OrderByDescending(position => position.WeightPct).Take(count).Sum(position => position.WeightPct));

    private static decimal Percent(decimal numerator, decimal denominator) =>
        denominator == 0m ? 0m : Round(numerator / denominator * 100m);

    private static decimal Round(decimal value, int digits = 2) =>
        decimal.Round(value, digits, MidpointRounding.AwayFromZero);

    private static PortfolioAnalysisWarning[] CurrentSemanticsWarnings() =>
    [
        new("buy_only_cost_basis", "Current holdings and unrealized P&L preserve the application's buy-only accounting semantics; sells, dividends, and fees are not realized-P&L calculations."),
    ];

    private sealed record LiveState(
        DateTimeOffset AsOf,
        PortfolioAnalysisScope Scope,
        string Currency,
        IReadOnlyList<EnrichedHolding> Rows,
        IReadOnlyDictionary<string, MarketQuote> Quotes);

    private sealed record EnrichedHolding(
        string Ticker,
        string? Name,
        string AssetType,
        decimal Quantity,
        string QuoteCurrency,
        decimal CurrentPrice,
        decimal CurrentValue,
        decimal CostBasis,
        decimal DayChange,
        string PortfolioRef,
        string PortfolioName = "Unassigned",
        SecurityMetadata.SecurityMetadataView? Security = null);
}
