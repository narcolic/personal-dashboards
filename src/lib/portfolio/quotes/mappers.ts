import type { Quote } from "@/lib/portfolio/types";

export type RawQuote = {
  symbol?: unknown;
  shortName?: unknown;
  longName?: unknown;
  regularMarketPrice?: unknown;
  regularMarketPreviousClose?: unknown;
  currency?: unknown;
  fullExchangeName?: unknown;
  exchange?: unknown;
  marketState?: unknown;
  quoteType?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizeQuote(input: string, raw: RawQuote | undefined): Quote | null {
  if (!raw) return null;
  const price = Number(raw.regularMarketPrice);
  if (!Number.isFinite(price)) return null;
  const prev = Number(raw.regularMarketPreviousClose ?? price);
  const rawCur = String(raw.currency ?? "USD").toUpperCase();
  const isPence = rawCur === "GBP" && price > 1000;
  const p = isPence ? price / 100 : price;
  const pp = isPence ? prev / 100 : prev;
  const change = p - pp;

  return {
    symbol: String(raw.symbol ?? input).toUpperCase(),
    inputSymbol: input.toUpperCase(),
    shortName: optionalString(raw.shortName) ?? optionalString(raw.longName),
    longName: optionalString(raw.longName) ?? optionalString(raw.shortName),
    quoteType: optionalString(raw.quoteType),
    regularMarketPrice: p,
    regularMarketPreviousClose: pp,
    regularMarketChange: change,
    regularMarketChangePercent: pp ? (change / pp) * 100 : 0,
    currency: isPence ? "GBP" : rawCur,
    exchange: optionalString(raw.fullExchangeName) ?? optionalString(raw.exchange),
    marketState: optionalString(raw.marketState),
  };
}
