import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import YahooFinance from "yahoo-finance2";
import {
  aggregateSnapshotTransactions,
  convertSnapshotTotals,
  createUsdBaseConverter,
  enrichSnapshotHoldings,
  type SnapshotEnrichedHolding,
  type SnapshotQuote,
  type SnapshotTransaction,
} from "../src/lib/portfolio/snapshots/calculations";

type ApiRequest = {
  method?: string;
  headers?: {
    authorization?: string | string[];
  };
  query?: {
    date?: string | string[];
    force?: string | string[];
  };
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type TransactionRecord = SnapshotTransaction;

type PortfolioRecord = {
  id: string;
  user_id: string | null;
  name: string;
};

type SnapshotRecord = {
  user_id: string;
  snapshot_date: string;
  snapshot_at: string;
  scope: "total" | "portfolio";
  scope_key: string;
  portfolio_id: string | null;
  portfolio_name: string | null;
  market_value_eur: number;
  market_value_usd: number;
  cost_basis_eur: number;
  cost_basis_usd: number;
  unrealized_eur: number;
  unrealized_usd: number;
  quote_metadata: Record<string, unknown>;
  fx_metadata: Record<string, unknown>;
};

type FxRatesResult = {
  provider: string;
  rates: Record<string, number>;
};

type SnapshotDbClient = {
  from: <T>(table: "transactions" | "portfolios") => {
    select: (columns: string) => {
      range: (
        from: number,
        to: number,
      ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
    };
  };
};

const ATHENS_TIME_ZONE = "Europe/Athens";
const PAGE_SIZE = 1000;

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  },
});

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Portfolio snapshot failed";
}

function getAthensParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

function getAthensDate(date: Date) {
  const parts = getAthensParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isAthensMidnightWindow(date: Date) {
  return getAthensParts(date).hour === "00";
}

function isIsoDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getEnv() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const missing = [
    ...(!supabaseUrl ? ["SUPABASE_URL or VITE_SUPABASE_URL"] : []),
    ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ...(!cronSecret ? ["CRON_SECRET"] : []),
  ];

  if (missing.length > 0) {
    throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
  }

  return {
    supabaseUrl: supabaseUrl as string,
    serviceRoleKey: serviceRoleKey as string,
    cronSecret: cronSecret as string,
  };
}

async function fetchAllRows<T>(
  supabase: SnapshotDbClient,
  table: "transactions" | "portfolios",
  select: string,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function rawQuoteValue(raw: unknown, key: string) {
  if (!raw || typeof raw !== "object") return undefined;
  return (raw as Record<string, unknown>)[key];
}

function rawQuoteString(raw: unknown, key: string) {
  const value = rawQuoteValue(raw, key);
  return typeof value === "string" ? value : undefined;
}

function rawQuoteNumber(raw: unknown, key: string) {
  const value = rawQuoteValue(raw, key);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function fetchQuotes(symbols: string[]) {
  const quotes: SnapshotQuote[] = [];
  const failed: Array<{ symbol: string; error: string }> = [];

  for (let index = 0; index < symbols.length; index += 50) {
    const batch = symbols.slice(index, index + 50);
    const settled = await Promise.allSettled(batch.map((symbol) => yahooFinance.quote(symbol)));

    settled.forEach((result, resultIndex) => {
      const inputSymbol = batch[resultIndex];
      if (result.status === "rejected") {
        failed.push({ symbol: inputSymbol, error: errorMessage(result.reason) });
        return;
      }

      const symbol = rawQuoteString(result.value, "symbol") ?? inputSymbol;
      const regularMarketPrice = rawQuoteNumber(result.value, "regularMarketPrice");
      if (!regularMarketPrice || regularMarketPrice <= 0) {
        failed.push({ symbol: inputSymbol, error: "Missing regular market price" });
        return;
      }

      quotes.push({
        symbol,
        inputSymbol,
        regularMarketPrice,
        regularMarketPreviousClose: rawQuoteNumber(result.value, "regularMarketPreviousClose"),
        currency: rawQuoteString(result.value, "currency"),
      });
    });
  }

  return { quotes, failed };
}

async function fetchUsdRates(): Promise<FxRatesResult> {
  try {
    const frankfurter = await fetch("https://api.frankfurter.app/latest?from=USD");
    if (frankfurter.ok) {
      const data = (await frankfurter.json()) as { rates?: Record<string, number> };
      if (data.rates) {
        const rates: Record<string, number> = { USD: 1, ...data.rates };
        return { provider: "frankfurter", rates };
      }
    }
  } catch {
    // fallback below
  }

  const erApi = await fetch("https://open.er-api.com/v6/latest/USD");
  if (erApi.ok) {
    const data = (await erApi.json()) as { rates?: Record<string, number> };
    if (data.rates) {
      const rates: Record<string, number> = { USD: 1, ...data.rates };
      return { provider: "open.er-api", rates };
    }
  }

  return { provider: "fallback", rates: { USD: 1, EUR: 1 } };
}

function groupByUser(rows: SnapshotEnrichedHolding[]) {
  const groups = new Map<string, SnapshotEnrichedHolding[]>();

  for (const row of rows) {
    const userRows = groups.get(row.user_id) ?? [];
    userRows.push(row);
    groups.set(row.user_id, userRows);
  }

  return groups;
}

function groupByPortfolio(rows: SnapshotEnrichedHolding[]) {
  const groups = new Map<string, SnapshotEnrichedHolding[]>();

  for (const row of rows) {
    const key = row.portfolio_id ?? "unassigned";
    const portfolioRows = groups.get(key) ?? [];
    portfolioRows.push(row);
    groups.set(key, portfolioRows);
  }

  return groups;
}

function createSnapshotRecord({
  userId,
  snapshotDate,
  snapshotAt,
  scope,
  scopeKey,
  portfolioId,
  portfolioName,
  rows,
  quoteMetadata,
  fxMetadata,
  convert,
}: {
  userId: string;
  snapshotDate: string;
  snapshotAt: string;
  scope: "total" | "portfolio";
  scopeKey: string;
  portfolioId: string | null;
  portfolioName: string | null;
  rows: SnapshotEnrichedHolding[];
  quoteMetadata: Record<string, unknown>;
  fxMetadata: Record<string, unknown>;
  convert: ReturnType<typeof createUsdBaseConverter>;
}): SnapshotRecord {
  const totals = convertSnapshotTotals(rows, convert);

  return {
    user_id: userId,
    snapshot_date: snapshotDate,
    snapshot_at: snapshotAt,
    scope,
    scope_key: scopeKey,
    portfolio_id: portfolioId,
    portfolio_name: portfolioName,
    market_value_eur: totals.eur.marketValue,
    market_value_usd: totals.usd.marketValue,
    cost_basis_eur: totals.eur.costBasis,
    cost_basis_usd: totals.usd.costBasis,
    unrealized_eur: totals.eur.unrealized,
    unrealized_usd: totals.usd.unrealized,
    quote_metadata: quoteMetadata,
    fx_metadata: fxMetadata,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { supabaseUrl, serviceRoleKey, cronSecret } = getEnv();
    const authHeader = getHeaderValue(req.headers?.authorization);
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const force = getQueryValue(req.query?.force) === "1";
    const requestedDate = getQueryValue(req.query?.date);
    const now = new Date();

    if (!force && !isAthensMidnightWindow(now)) {
      res.status(200).json({
        ok: true,
        skipped: true,
        reason: "outside_athens_midnight_window",
        athensDate: getAthensDate(now),
      });
      return;
    }

    if (requestedDate && !isIsoDate(requestedDate)) {
      res.status(400).json({ error: "date must use YYYY-MM-DD format" });
      return;
    }

    const snapshotDate = requestedDate ?? getAthensDate(now);
    const snapshotAt = now.toISOString();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [transactions, portfolios] = await Promise.all([
      fetchAllRows<TransactionRecord>(
        supabase as unknown as SnapshotDbClient,
        "transactions",
        "id,user_id,ticker,name,asset_type,market,currency,shares,price,transaction_date,notes,portfolio_id",
      ),
      fetchAllRows<PortfolioRecord>(
        supabase as unknown as SnapshotDbClient,
        "portfolios",
        "id,user_id,name",
      ),
    ]);

    const portfolioNameById = new Map(
      portfolios.map((portfolio) => [portfolio.id, portfolio.name]),
    );
    const snapshotTransactions = transactions
      .filter((tx) => tx.user_id && tx.ticker)
      .map((tx) => ({
        ...tx,
        portfolio_name: tx.portfolio_id ? (portfolioNameById.get(tx.portfolio_id) ?? null) : null,
      }));

    const holdings = aggregateSnapshotTransactions(snapshotTransactions);
    if (holdings.length === 0) {
      res.status(200).json({ ok: true, snapshotDate, rows: 0, users: 0 });
      return;
    }

    const tickers = Array.from(new Set(holdings.map((holding) => holding.ticker))).sort();
    const [{ quotes, failed }, fx] = await Promise.all([fetchQuotes(tickers), fetchUsdRates()]);
    const enriched = enrichSnapshotHoldings(holdings, quotes);
    const convert = createUsdBaseConverter(fx.rates);
    const quotedSymbols = new Set(
      quotes.flatMap((quote) => [quote.symbol.toUpperCase(), quote.inputSymbol?.toUpperCase()]),
    );
    const quoteMetadata = {
      provider: "yahoo-finance2",
      requestedSymbols: tickers,
      quotedSymbols: Array.from(quotedSymbols).filter(Boolean).sort(),
      failed,
    };
    const fxMetadata = {
      provider: fx.provider,
      base: "USD",
      rates: fx.rates,
    };

    const records: SnapshotRecord[] = [];
    const rowsByUser = groupByUser(enriched);

    for (const [userId, userRows] of rowsByUser) {
      records.push(
        createSnapshotRecord({
          userId,
          snapshotDate,
          snapshotAt,
          scope: "total",
          scopeKey: "total",
          portfolioId: null,
          portfolioName: null,
          rows: userRows,
          quoteMetadata,
          fxMetadata,
          convert,
        }),
      );

      for (const [portfolioKey, portfolioRows] of groupByPortfolio(userRows)) {
        const first = portfolioRows[0];
        const portfolioId = portfolioKey === "unassigned" ? null : portfolioKey;
        records.push(
          createSnapshotRecord({
            userId,
            snapshotDate,
            snapshotAt,
            scope: "portfolio",
            scopeKey: `portfolio:${portfolioKey}`,
            portfolioId,
            portfolioName: portfolioId
              ? (first.portfolio_name ?? "Unknown portfolio")
              : "Unassigned",
            rows: portfolioRows,
            quoteMetadata,
            fxMetadata,
            convert,
          }),
        );
      }
    }

    const { error } = await supabase
      .from("portfolio_value_snapshots")
      .upsert(records, { onConflict: "user_id,snapshot_date,scope_key" });

    if (error) throw new Error(error.message);

    res.status(200).json({
      ok: true,
      snapshotDate,
      rows: records.length,
      users: rowsByUser.size,
      symbols: tickers.length,
      quoteFailures: failed.length,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: errorMessage(error) });
  }
}
