import { convertContribution, type ContributionActivity } from "./contributions/calculations.ts";

export function calculatePortfolioFees(
  activity: readonly ContributionActivity[],
  portfolioId: string,
  currency: string,
  rates: Readonly<Record<string, number>>,
  today: string,
) {
  let total = 0;
  let missingRates = false;
  for (const row of activity) {
    if (
      row.kind !== "transaction" ||
      row.transaction_date > today ||
      (portfolioId !== "__all__" && (row.portfolio_id ?? "__unassigned__") !== portfolioId)
    )
      continue;
    const amount =
      row.action === "fee"
        ? Number(row.amount)
        : row.action === "buy" || row.action === "sell"
          ? Number(row.fee_amount ?? 0)
          : 0;
    if (!amount) continue;
    const converted = convertContribution(amount, row.currency, currency, rates);
    if (converted === null) missingRates = true;
    else total += converted;
  }
  return { total, missingRates };
}
