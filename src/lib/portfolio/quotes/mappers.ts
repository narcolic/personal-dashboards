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
  assetProfile?: unknown;
  fundProfile?: unknown;
  price?: unknown;
  quoteSummary?: unknown;
  topHoldings?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isNormalizedHolding(
  item: { symbol: string | undefined; weight: number | undefined } | undefined,
): item is { symbol: string | undefined; weight: number | undefined } {
  return item !== undefined;
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
    assetProfile:
      typeof raw.assetProfile === "object" && raw.assetProfile !== null
        ? {
            country: optionalString((raw.assetProfile as { country?: unknown }).country),
            sector: optionalString((raw.assetProfile as { sector?: unknown }).sector),
            industry: optionalString((raw.assetProfile as { industry?: unknown }).industry),
          }
        : undefined,
    fundProfile:
      typeof raw.fundProfile === "object" && raw.fundProfile !== null
        ? {
            category: optionalString((raw.fundProfile as { category?: unknown }).category),
            family: optionalString((raw.fundProfile as { family?: unknown }).family),
          }
        : undefined,
    price:
      typeof raw.price === "object" && raw.price !== null
        ? { longName: optionalString((raw.price as { longName?: unknown }).longName) }
        : undefined,
    quoteSummary:
      typeof raw.quoteSummary === "object" && raw.quoteSummary !== null
        ? {
            quoteType: {
              quoteType: optionalString(
                (raw.quoteSummary as { quoteType?: { quoteType?: unknown } }).quoteType?.quoteType,
              ),
            },
          }
        : undefined,
    topHoldings: Array.isArray(raw.topHoldings)
      ? raw.topHoldings
          .map((item) => {
            if (typeof item !== "object" || item === null) return undefined;
            return {
              symbol: optionalString((item as { symbol?: unknown }).symbol),
              weight: Number((item as { weight?: unknown }).weight) || undefined,
            };
          })
          .filter(isNormalizedHolding)
      : undefined,
    regularMarketPrice: p,
    regularMarketPreviousClose: pp,
    regularMarketChange: change,
    regularMarketChangePercent: pp ? (change / pp) * 100 : 0,
    currency: isPence ? "GBP" : rawCur,
    exchange: optionalString(raw.fullExchangeName) ?? optionalString(raw.exchange),
    marketState: optionalString(raw.marketState),
  };
}
