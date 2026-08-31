using System.Text.Json;
using PortfolioTerminal.Portfolio.MarketData;

namespace PortfolioTerminal.Portfolio.Snapshots;

public sealed class PortfolioSnapshotJob(
    IPortfolioSnapshotStore store,
    IQuoteService quoteService,
    IFxRateService fxRateService,
    TimeProvider timeProvider) : IPortfolioSnapshotJob
{
    private static readonly TimeZoneInfo AthensTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens");

    public async Task<PortfolioSnapshotRunResult> RunAsync(
        PortfolioSnapshotRunRequest request,
        CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();
        var athensNow = TimeZoneInfo.ConvertTime(now, AthensTimeZone);
        var snapshotDate = request.Date ?? DateOnly.FromDateTime(athensNow.DateTime);
        if (!request.Force && athensNow.Hour != 0)
        {
            return Skipped("outside_athens_midnight_window", snapshotDate);
        }

        var transactions = await store.ReadTransactionsAsync(cancellationToken)
            .ConfigureAwait(false);
        var holdings = Aggregate(transactions);
        if (holdings.Length == 0)
        {
            return Completed(snapshotDate, rows: 0, users: 0, symbols: 0);
        }

        var symbols = holdings
            .Select(holding => holding.Ticker)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.Ordinal)
            .ToArray();
        var quoteTask = quoteService.GetAsync(symbols, cancellationToken);
        var fxTask = fxRateService.GetAsync("USD", cancellationToken);
        await Task.WhenAll(quoteTask, fxTask).ConfigureAwait(false);
        var quoteResult = await quoteTask.ConfigureAwait(false);
        if (quoteResult.Failed.Count > 0)
        {
            return new PortfolioSnapshotRunResult(
                true,
                true,
                "incomplete_quote_data",
                snapshotDate,
                0,
                0,
                symbols.Length,
                [.. quoteResult.Failed.Select(failure => failure.Symbol)]);
        }

        var fxPayload = await fxTask.ConfigureAwait(false);
        var rates = ReadRates(fxPayload);
        if (rates.Count == 0)
        {
            throw new InvalidOperationException("The FX provider returned no usable rates.");
        }

        var enriched = Enrich(holdings, quoteResult.Quotes);
        var quoteMetadata = JsonSerializer.SerializeToElement(new
        {
            provider = "yahoo-chart",
            requestedSymbols = symbols,
            quotedSymbols = quoteResult.Quotes
                .Select(quote => quote.Symbol)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.Ordinal)
                .ToArray(),
            failed = Array.Empty<object>(),
        });
        var fxMetadata = JsonSerializer.SerializeToElement(new
        {
            provider = FxProvider(fxPayload),
            @base = "USD",
            rates,
        });

        var records = BuildRecords(
            enriched,
            snapshotDate,
            now,
            rates,
            quoteMetadata,
            fxMetadata);
        await store.UpsertAsync(records, cancellationToken).ConfigureAwait(false);
        return Completed(
            snapshotDate,
            records.Count,
            enriched.Select(row => row.UserId).Distinct().Count(),
            symbols.Length);
    }

    private static SnapshotHolding[] Aggregate(
        IReadOnlyList<SnapshotTransaction> transactions) =>
        [.. transactions
            .GroupBy(transaction => new HoldingKey(
                transaction.UserId,
                transaction.SecurityListingId,
                transaction.PortfolioId,
                NormalizeCurrency(transaction.Currency)))
            .Select(group =>
            {
                var rows = group.ToArray();
                var shares = rows.Sum(row => row.Shares);
                if (shares <= 0m)
                {
                    return null;
                }

                var last = rows.MaxBy(row => row.TransactionDate)!;
                return new SnapshotHolding(
                    group.Key.UserId,
                    last.Ticker,
                    group.Key.Currency,
                    shares,
                    rows.Sum(row => row.Shares * row.Price) / shares,
                    group.Key.PortfolioId,
                    last.PortfolioName);
            })
            .Where(holding => holding is not null)
            .Select(holding => holding!)
            .OrderBy(holding => holding.Ticker, StringComparer.Ordinal)];

    private static EnrichedSnapshotHolding[] Enrich(
        IReadOnlyList<SnapshotHolding> holdings,
        IReadOnlyList<MarketQuote> quotes)
    {
        var bySymbol = quotes.ToDictionary(
            quote => quote.Symbol,
            StringComparer.OrdinalIgnoreCase);
        return [.. holdings.Select(holding =>
        {
            if (!bySymbol.TryGetValue(holding.Ticker, out var quote))
            {
                throw new InvalidOperationException($"Missing quote for {holding.Ticker}.");
            }

            var marketValue = quote.RegularMarketPrice * holding.Shares;
            var costBasis = holding.AvgCost * holding.Shares;
            return new EnrichedSnapshotHolding(
                holding.UserId,
                holding.Ticker,
                holding.PortfolioId,
                holding.PortfolioName,
                NormalizeCurrency(quote.Currency),
                marketValue,
                costBasis);
        })];
    }

    private static List<PortfolioSnapshotRecord> BuildRecords(
        IReadOnlyList<EnrichedSnapshotHolding> holdings,
        DateOnly snapshotDate,
        DateTimeOffset snapshotAt,
        IReadOnlyDictionary<string, decimal> rates,
        JsonElement quoteMetadata,
        JsonElement fxMetadata)
    {
        var records = new List<PortfolioSnapshotRecord>();
        foreach (var userGroup in holdings.GroupBy(holding => holding.UserId))
        {
            records.Add(CreateRecord(
                userGroup.Key,
                snapshotDate,
                snapshotAt,
                "total",
                "total",
                null,
                null,
                userGroup,
                rates,
                quoteMetadata,
                fxMetadata));

            foreach (var portfolioGroup in userGroup.GroupBy(holding => holding.PortfolioId))
            {
                var first = portfolioGroup.First();
                var key = portfolioGroup.Key?.ToString() ?? "unassigned";
                records.Add(CreateRecord(
                    userGroup.Key,
                    snapshotDate,
                    snapshotAt,
                    "portfolio",
                    $"portfolio:{key}",
                    portfolioGroup.Key,
                    portfolioGroup.Key is null
                        ? "Unassigned"
                        : first.PortfolioName ?? "Unknown portfolio",
                    portfolioGroup,
                    rates,
                    quoteMetadata,
                    fxMetadata));
            }
        }
        return records;
    }

    private static PortfolioSnapshotRecord CreateRecord(
        Guid userId,
        DateOnly snapshotDate,
        DateTimeOffset snapshotAt,
        string scope,
        string scopeKey,
        Guid? portfolioId,
        string? portfolioName,
        IEnumerable<EnrichedSnapshotHolding> holdings,
        IReadOnlyDictionary<string, decimal> rates,
        JsonElement quoteMetadata,
        JsonElement fxMetadata)
    {
        var rows = holdings.ToArray();
        var marketValueEur = rows.Sum(row => Convert(row.MarketValue, row.Currency, "EUR", rates));
        var marketValueUsd = rows.Sum(row => Convert(row.MarketValue, row.Currency, "USD", rates));
        var costBasisEur = rows.Sum(row => Convert(row.CostBasis, row.Currency, "EUR", rates));
        var costBasisUsd = rows.Sum(row => Convert(row.CostBasis, row.Currency, "USD", rates));
        return new PortfolioSnapshotRecord(
            userId,
            snapshotDate,
            snapshotAt,
            scope,
            scopeKey,
            portfolioId,
            portfolioName,
            marketValueEur,
            marketValueUsd,
            costBasisEur,
            costBasisUsd,
            marketValueEur - costBasisEur,
            marketValueUsd - costBasisUsd,
            quoteMetadata,
            fxMetadata);
    }

    private static Dictionary<string, decimal> ReadRates(JsonElement payload)
    {
        var rates = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["USD"] = 1m,
        };
        if (!payload.TryGetProperty("rates", out var ratesNode) ||
            ratesNode.ValueKind != JsonValueKind.Object)
        {
            return rates;
        }

        foreach (var property in ratesNode.EnumerateObject())
        {
            if (property.Value.TryGetDecimal(out var rate) && rate > 0m)
            {
                rates[property.Name.ToUpperInvariant()] = rate;
            }
        }
        return rates;
    }

    private static decimal Convert(
        decimal amount,
        string sourceCurrency,
        string targetCurrency,
        IReadOnlyDictionary<string, decimal> rates)
    {
        var sourceRate = rates.GetValueOrDefault(sourceCurrency, 1m);
        var targetRate = rates.GetValueOrDefault(targetCurrency, 1m);
        var amountInUsd = sourceCurrency == "USD" ? amount : amount / sourceRate;
        return targetCurrency == "USD" ? amountInUsd : amountInUsd * targetRate;
    }

    private static string FxProvider(JsonElement payload) =>
        payload.TryGetProperty("base", out _) ? "frankfurter" : "open.er-api";

    private static string NormalizeCurrency(string? currency) =>
        string.IsNullOrWhiteSpace(currency) ? "USD" : currency.Trim().ToUpperInvariant();

    private static PortfolioSnapshotRunResult Skipped(string reason, DateOnly date) =>
        new(true, true, reason, date, 0, 0, 0, []);

    private static PortfolioSnapshotRunResult Completed(
        DateOnly date,
        int rows,
        int users,
        int symbols) =>
        new(true, false, null, date, rows, users, symbols, []);

    private sealed record HoldingKey(
        Guid UserId,
        Guid SecurityListingId,
        Guid? PortfolioId,
        string Currency);

    private sealed record SnapshotHolding(
        Guid UserId,
        string Ticker,
        string Currency,
        decimal Shares,
        decimal AvgCost,
        Guid? PortfolioId,
        string? PortfolioName);

    private sealed record EnrichedSnapshotHolding(
        Guid UserId,
        string Ticker,
        Guid? PortfolioId,
        string? PortfolioName,
        string Currency,
        decimal MarketValue,
        decimal CostBasis);
}
