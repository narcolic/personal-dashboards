import { convertContribution } from "../contributions/calculations.ts";

type MarketValue = {
  marketValue: number;
  currency: string;
  quote?: { currency?: string | null };
};

export function totalMarketValue(
  rows: readonly MarketValue[],
  currency: string,
  rates: Readonly<Record<string, number>>,
) {
  let total = 0;
  for (const row of rows) {
    const amount = convertContribution(
      row.marketValue,
      row.quote?.currency ?? row.currency,
      currency,
      rates,
    );
    if (amount === null) return null;
    total += amount;
  }
  return total;
}
