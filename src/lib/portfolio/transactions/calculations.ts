import type { Quote } from "@/lib/portfolio/types";

export function enrich(
  positions: import("@/lib/portfolio/types").HoldingRow[],
  quotes: Quote[],
): import("@/lib/portfolio/types").Enriched[] {
  const map = new Map<string, Quote>();
  for (const q of quotes) {
    map.set(q.symbol.toUpperCase(), q);
    if (q.inputSymbol) map.set(q.inputSymbol.toUpperCase(), q);
  }
  return positions.map((p) => {
    const q = map.get(p.ticker.toUpperCase());
    const price = q?.regularMarketPrice ?? Number(p.avg_cost);
    const prev = q?.regularMarketPreviousClose ?? price;
    const marketValue = price * Number(p.shares);
    const costBasis = Number(p.avg_cost) * Number(p.shares);
    const unrealized = marketValue - costBasis;
    const dayChange = (price - prev) * Number(p.shares);
    return {
      ...p,
      shares: Number(p.shares),
      avg_cost: Number(p.avg_cost),
      price,
      prevClose: prev,
      dayChange,
      dayChangePct: prev ? ((price - prev) / prev) * 100 : 0,
      marketValue,
      costBasis,
      unrealized,
      unrealizedPct: costBasis ? (unrealized / costBasis) * 100 : 0,
      quote: q,
    };
  });
}
