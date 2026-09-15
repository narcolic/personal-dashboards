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

        var transactionTask = store.ReadTransactionsAsync(cancellationToken);
        var withdrawalTask = store.ReadWithdrawalsAsync(cancellationToken);
        await Task.WhenAll(transactionTask, withdrawalTask).ConfigureAwait(false);
        var transactions = (await transactionTask.ConfigureAwait(false))
            .Where(row => row.TransactionDate <= snapshotDate)
            .ToArray();
        var withdrawals = (await withdrawalTask.ConfigureAwait(false))
            .Where(row => row.WithdrawalDate <= snapshotDate)
            .ToArray();
        var holdings = Aggregate(transactions);
        var accounting = BuildAccounting(transactions, withdrawals, snapshotDate);
        if (holdings.Length == 0 && accounting.Length == 0)
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
            accounting,
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
        IReadOnlyList<SnapshotTransaction> transactions)
    {
        var holdings = new List<SnapshotHolding>();
        foreach (var group in transactions
            .Where(row => row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase) ||
                          row.Action.Equals("sell", StringComparison.OrdinalIgnoreCase))
            .GroupBy(transaction => new HoldingKey(
                transaction.UserId,
                transaction.SecurityListingId,
                transaction.PortfolioId,
                NormalizeCurrency(transaction.Currency))))
        {
            decimal shares = 0m;
            decimal costBasis = 0m;
            SnapshotTransaction? last = null;
            foreach (var row in Ordered(group))
            {
                last = row;
                if (row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase))
                {
                    shares += row.Shares;
                    costBasis += row.Shares * row.Price + row.FeeAmount;
                    continue;
                }
                if (row.Shares > shares)
                    throw new InvalidOperationException($"Snapshot history oversells {row.Ticker}.");
                var average = shares == 0m ? 0m : costBasis / shares;
                costBasis -= average * row.Shares;
                shares -= row.Shares;
                if (shares == 0m) costBasis = 0m;
            }
            if (shares <= 0m || last is null) continue;
            holdings.Add(new(
                group.Key.UserId, last.Ticker, group.Key.Currency,
                shares, costBasis / shares, group.Key.PortfolioId, last.PortfolioName));
        }
        return [.. holdings.OrderBy(row => row.Ticker, StringComparer.Ordinal)];
    }

    private static AccountingRow[] BuildAccounting(
        IReadOnlyList<SnapshotTransaction> transactions,
        IReadOnlyList<SnapshotWithdrawal> withdrawals,
        DateOnly snapshotDate)
    {
        var realized = new Dictionary<AccountingKey, decimal>();
        foreach (var group in transactions
            .Where(row => row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase) ||
                          row.Action.Equals("sell", StringComparison.OrdinalIgnoreCase))
            .GroupBy(row => new HoldingKey(
                row.UserId, row.SecurityListingId, row.PortfolioId, NormalizeCurrency(row.Currency))))
        {
            decimal quantity = 0m;
            decimal basis = 0m;
            foreach (var row in Ordered(group))
            {
                if (row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase))
                {
                    quantity += row.Shares;
                    basis += row.Shares * row.Price + row.FeeAmount;
                    continue;
                }
                var average = quantity == 0m ? 0m : basis / quantity;
                var disposed = average * row.Shares;
                var key = new AccountingKey(
                    row.UserId, row.PortfolioId, row.PortfolioName, NormalizeCurrency(row.Currency));
                realized[key] = realized.GetValueOrDefault(key) +
                    (row.Shares * row.Price - row.FeeAmount - disposed);
                quantity -= row.Shares;
                basis -= disposed;
                if (quantity == 0m) basis = 0m;
            }
        }

        var rows = new Dictionary<AccountingKey, AccountingAmounts>();
        foreach (var transaction in transactions)
        {
            var key = new AccountingKey(
                transaction.UserId, transaction.PortfolioId,
                transaction.PortfolioName, NormalizeCurrency(transaction.Currency));
            var value = rows.GetValueOrDefault(key) ?? new AccountingAmounts();
            if (transaction.Action.Equals("sell", StringComparison.OrdinalIgnoreCase) &&
                transaction.SettlesToCash)
                value.Cash += transaction.Shares * transaction.Price - transaction.FeeAmount;
            if (transaction.Action.Equals("buy", StringComparison.OrdinalIgnoreCase))
            {
                value.Cash -= transaction.CashUsed;
                if (transaction.TransactionDate == snapshotDate)
                    value.ExternalFlow += transaction.Shares * transaction.Price +
                        transaction.FeeAmount - transaction.CashUsed;
            }
            rows[key] = value;
        }
        foreach (var withdrawal in withdrawals)
        {
            var key = new AccountingKey(
                withdrawal.UserId, withdrawal.PortfolioId,
                withdrawal.PortfolioName, NormalizeCurrency(withdrawal.Currency));
            var value = rows.GetValueOrDefault(key) ?? new AccountingAmounts();
            value.Cash -= withdrawal.Amount;
            if (withdrawal.WithdrawalDate == snapshotDate) value.ExternalFlow -= withdrawal.Amount;
            rows[key] = value;
        }
        foreach (var item in realized)
        {
            var value = rows.GetValueOrDefault(item.Key) ?? new AccountingAmounts();
            value.Realized = item.Value;
            rows[item.Key] = value;
        }
        return [.. rows.Select(item => new AccountingRow(
            item.Key.UserId, item.Key.PortfolioId, item.Key.PortfolioName,
            item.Key.Currency, item.Value.Cash, item.Value.Realized, item.Value.ExternalFlow))];
    }

    private static IOrderedEnumerable<SnapshotTransaction> Ordered(
        IEnumerable<SnapshotTransaction> rows) =>
        rows.OrderBy(row => row.TransactionDate)
            .ThenBy(row => row.Action.Equals("buy", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenBy(row => row.CreatedAt ?? DateTimeOffset.MinValue)
            .ThenBy(row => row.Id);

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
        IReadOnlyList<AccountingRow> accounting,
        DateOnly snapshotDate,
        DateTimeOffset snapshotAt,
        IReadOnlyDictionary<string, decimal> rates,
        JsonElement quoteMetadata,
        JsonElement fxMetadata)
    {
        var records = new List<PortfolioSnapshotRecord>();
        var userIds = holdings.Select(row => row.UserId)
            .Concat(accounting.Select(row => row.UserId)).Distinct();
        foreach (var userId in userIds)
        {
            var userHoldings = holdings.Where(row => row.UserId == userId).ToArray();
            var userAccounting = accounting.Where(row => row.UserId == userId).ToArray();
            records.Add(CreateRecord(
                userId,
                snapshotDate,
                snapshotAt,
                "total",
                "total",
                null,
                null,
                userHoldings,
                userAccounting,
                rates,
                quoteMetadata,
                fxMetadata));

            var portfolioIds = userHoldings.Select(row => row.PortfolioId)
                .Concat(userAccounting.Select(row => row.PortfolioId)).Distinct();
            foreach (var portfolioId in portfolioIds)
            {
                var portfolioHoldings = userHoldings.Where(row => row.PortfolioId == portfolioId).ToArray();
                var portfolioAccounting = userAccounting.Where(row => row.PortfolioId == portfolioId).ToArray();
                var key = portfolioId?.ToString() ?? "unassigned";
                records.Add(CreateRecord(
                    userId,
                    snapshotDate,
                    snapshotAt,
                    "portfolio",
                    $"portfolio:{key}",
                    portfolioId,
                    portfolioId is null
                        ? "Unassigned"
                        : portfolioHoldings.FirstOrDefault()?.PortfolioName ??
                          portfolioAccounting.FirstOrDefault()?.PortfolioName ?? "Unknown portfolio",
                    portfolioHoldings,
                    portfolioAccounting,
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
        IEnumerable<AccountingRow> accounting,
        IReadOnlyDictionary<string, decimal> rates,
        JsonElement quoteMetadata,
        JsonElement fxMetadata)
    {
        var rows = holdings.ToArray();
        var marketValueEur = rows.Sum(row => Convert(row.MarketValue, row.Currency, "EUR", rates));
        var marketValueUsd = rows.Sum(row => Convert(row.MarketValue, row.Currency, "USD", rates));
        var costBasisEur = rows.Sum(row => Convert(row.CostBasis, row.Currency, "EUR", rates));
        var costBasisUsd = rows.Sum(row => Convert(row.CostBasis, row.Currency, "USD", rates));
        var cashRows = accounting.ToArray();
        var cashEur = cashRows.Sum(row => Convert(row.Cash, row.Currency, "EUR", rates));
        var cashUsd = cashRows.Sum(row => Convert(row.Cash, row.Currency, "USD", rates));
        var realizedEur = cashRows.Sum(row => Convert(row.Realized, row.Currency, "EUR", rates));
        var realizedUsd = cashRows.Sum(row => Convert(row.Realized, row.Currency, "USD", rates));
        var externalFlowEur = cashRows.Sum(row => Convert(row.ExternalFlow, row.Currency, "EUR", rates));
        var externalFlowUsd = cashRows.Sum(row => Convert(row.ExternalFlow, row.Currency, "USD", rates));
        var unrealizedEur = marketValueEur - costBasisEur;
        var unrealizedUsd = marketValueUsd - costBasisUsd;
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
            unrealizedEur,
            unrealizedUsd,
            quoteMetadata,
            fxMetadata,
            cashEur,
            cashUsd,
            marketValueEur + cashEur,
            marketValueUsd + cashUsd,
            realizedEur,
            realizedUsd,
            realizedEur + unrealizedEur,
            realizedUsd + unrealizedUsd,
            externalFlowEur,
            externalFlowUsd,
            2);
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

    private sealed record AccountingKey(
        Guid UserId,
        Guid? PortfolioId,
        string? PortfolioName,
        string Currency);

    private sealed class AccountingAmounts
    {
        public decimal Cash { get; set; }
        public decimal Realized { get; set; }
        public decimal ExternalFlow { get; set; }
    }

    private sealed record AccountingRow(
        Guid UserId,
        Guid? PortfolioId,
        string? PortfolioName,
        string Currency,
        decimal Cash,
        decimal Realized,
        decimal ExternalFlow);

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
