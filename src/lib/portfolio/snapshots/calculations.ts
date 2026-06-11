export type SnapshotTransaction = {
  id: string;
  user_id: string;
  ticker: string | null;
  name: string | null;
  asset_type: string | null;
  market: string | null;
  currency: string | null;
  shares: number | string | null;
  price: number | string | null;
  transaction_date: string | null;
  notes: string | null;
  portfolio_id: string | null;
  portfolio_name?: string | null;
};

export type SnapshotQuote = {
  symbol: string;
  inputSymbol?: string;
  regularMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;
  currency?: string | null;
};

export type SnapshotHolding = {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  asset_type: string;
  market: string | null;
  currency: string;
  shares: number;
  avg_cost: number;
  portfolio_id: string | null;
  portfolio_name: string | null;
  tx_count: number;
  first_date: string | null;
  last_date: string | null;
};

export type SnapshotEnrichedHolding = SnapshotHolding & {
  price: number;
  nativeCurrency: string;
  marketValue: number;
  costBasis: number;
  unrealized: number;
  quote?: SnapshotQuote;
};

export type SnapshotTotals = {
  marketValue: number;
  costBasis: number;
  unrealized: number;
};

export type SnapshotConvertedTotals = {
  eur: SnapshotTotals;
  usd: SnapshotTotals;
};

export type CurrencyConverter = (amount: number, from: string, to: "EUR" | "USD") => number;

function finiteNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = (value ?? "USD").trim().toUpperCase();
  return currency || "USD";
}

export function aggregateSnapshotTransactions(txs: SnapshotTransaction[]) {
  const groups = new Map<string, SnapshotTransaction[]>();

  for (const tx of txs) {
    const ticker = (tx.ticker ?? "").trim().toUpperCase();
    if (!ticker) continue;

    const key = `${tx.user_id}|${ticker}|${tx.portfolio_id ?? ""}|${normalizeCurrency(tx.currency)}`;
    const rows = groups.get(key) ?? [];
    rows.push(tx);
    groups.set(key, rows);
  }

  const holdings: SnapshotHolding[] = [];
  for (const [key, rows] of groups) {
    const totalShares = rows.reduce((sum, tx) => sum + finiteNumber(tx.shares), 0);
    const totalCost = rows.reduce(
      (sum, tx) => sum + finiteNumber(tx.shares) * finiteNumber(tx.price),
      0,
    );

    if (totalShares <= 0) continue;

    const first = rows.reduce((a, b) =>
      (a.transaction_date ?? "") < (b.transaction_date ?? "") ? a : b,
    );
    const last = rows.reduce((a, b) =>
      (a.transaction_date ?? "") > (b.transaction_date ?? "") ? a : b,
    );

    holdings.push({
      id: key,
      user_id: last.user_id,
      ticker: (last.ticker ?? "").trim().toUpperCase(),
      name: last.name,
      asset_type: last.asset_type ?? "Unknown",
      market: last.market,
      currency: normalizeCurrency(last.currency),
      shares: totalShares,
      avg_cost: totalCost / totalShares,
      portfolio_id: last.portfolio_id,
      portfolio_name: last.portfolio_name ?? null,
      tx_count: rows.length,
      first_date: first.transaction_date,
      last_date: last.transaction_date,
    });
  }

  return holdings.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function enrichSnapshotHoldings(
  holdings: SnapshotHolding[],
  quotes: SnapshotQuote[],
): SnapshotEnrichedHolding[] {
  const quoteBySymbol = new Map<string, SnapshotQuote>();

  for (const quote of quotes) {
    const symbol = quote.symbol.trim().toUpperCase();
    if (symbol) quoteBySymbol.set(symbol, quote);
    const inputSymbol = quote.inputSymbol?.trim().toUpperCase();
    if (inputSymbol) quoteBySymbol.set(inputSymbol, quote);
  }

  return holdings.map((holding) => {
    const quote = quoteBySymbol.get(holding.ticker);
    const quotedPrice = finiteNumber(quote?.regularMarketPrice);
    const price = quotedPrice > 0 ? quotedPrice : holding.avg_cost;
    const nativeCurrency = normalizeCurrency(quote?.currency ?? holding.currency);
    const marketValue = price * holding.shares;
    const costBasis = holding.avg_cost * holding.shares;

    return {
      ...holding,
      price,
      nativeCurrency,
      marketValue,
      costBasis,
      unrealized: marketValue - costBasis,
      quote,
    };
  });
}

export function convertSnapshotTotals(
  rows: SnapshotEnrichedHolding[],
  convert: CurrencyConverter,
): SnapshotConvertedTotals {
  const totals: SnapshotConvertedTotals = {
    eur: { marketValue: 0, costBasis: 0, unrealized: 0 },
    usd: { marketValue: 0, costBasis: 0, unrealized: 0 },
  };

  for (const row of rows) {
    totals.eur.marketValue += convert(row.marketValue, row.nativeCurrency, "EUR");
    totals.eur.costBasis += convert(row.costBasis, row.nativeCurrency, "EUR");
    totals.usd.marketValue += convert(row.marketValue, row.nativeCurrency, "USD");
    totals.usd.costBasis += convert(row.costBasis, row.nativeCurrency, "USD");
  }

  totals.eur.unrealized = totals.eur.marketValue - totals.eur.costBasis;
  totals.usd.unrealized = totals.usd.marketValue - totals.usd.costBasis;

  return totals;
}

export function createUsdBaseConverter(rates: Record<string, number>): CurrencyConverter {
  const normalizedRates = new Map<string, number>();
  normalizedRates.set("USD", 1);

  for (const [currency, rate] of Object.entries(rates)) {
    const parsed = finiteNumber(rate);
    if (parsed > 0) normalizedRates.set(currency.toUpperCase(), parsed);
  }

  return (amount, from, to) => {
    const source = normalizeCurrency(from);
    const target = to.toUpperCase();
    const sourceRate = normalizedRates.get(source) ?? 1;
    const targetRate = normalizedRates.get(target) ?? 1;
    const amountInUsd = source === "USD" ? amount : amount / sourceRate;
    return target === "USD" ? amountInUsd : amountInUsd * targetRate;
  };
}
