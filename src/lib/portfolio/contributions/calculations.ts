export type ContributionActivity = {
  kind: "transaction" | "withdrawal";
  action: string;
  transaction_date: string;
  portfolio_id: string | null;
  currency: string;
  amount: number;
  shares?: number | null;
  price?: number | null;
  fee_amount?: number;
  cash_used?: number;
};

export type ContributionMonth = {
  month: number;
  total: number;
  withdrawals: number;
  byPortfolio: Record<string, number>;
  state: "elapsed" | "current" | "future";
};

export function localDateKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getContributionYears(activity: readonly ContributionActivity[], now: Date) {
  const currentYear = now.getFullYear();
  const today = localDateKey(now);
  let earliestYear = currentYear;
  for (const row of activity) {
    if (row.transaction_date > today) continue;
    const year = Number(row.transaction_date.slice(0, 4));
    if (Number.isInteger(year) && year > 0) earliestYear = Math.min(earliestYear, year);
  }
  return Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index);
}

export function resolveContributionYear(requested: number | undefined, years: readonly number[]) {
  return requested !== undefined && years.includes(requested) ? requested : years[0];
}

export function freshMoneyInvested(row: ContributionActivity) {
  if (row.kind !== "transaction" || row.action !== "buy") return 0;
  return Math.max(
    0,
    Number(row.shares ?? 0) * Number(row.price ?? 0) +
      Number(row.fee_amount ?? 0) -
      Number(row.cash_used ?? 0),
  );
}

// Rates from the FX endpoint are units of each currency per USD.
export function convertContribution(
  amount: number,
  from: string,
  to: string,
  rates: Readonly<Record<string, number>>,
) {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (amount === 0 || source === target) return amount;
  const sourceRate = source === "USD" ? 1 : rates[source];
  const targetRate = target === "USD" ? 1 : rates[target];
  if (
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0 ||
    !Number.isFinite(targetRate) ||
    targetRate <= 0
  ) {
    return null;
  }
  return (amount / sourceRate) * targetRate;
}

export function buildContributionModel(
  activity: readonly ContributionActivity[],
  {
    year,
    portfolioId,
    currency,
    rates,
    now,
  }: {
    year: number;
    portfolioId: string;
    currency: string;
    rates: Readonly<Record<string, number>>;
    now: Date;
  },
) {
  const currentYear = now.getFullYear();
  const today = localDateKey(now);
  const months: ContributionMonth[] = Array.from({ length: 12 }, (_, month) => ({
    month,
    total: 0,
    withdrawals: 0,
    byPortfolio: {},
    state:
      year > currentYear || (year === currentYear && month > now.getMonth())
        ? "future"
        : year === currentYear && month === now.getMonth()
          ? "current"
          : "elapsed",
  }));
  const missingCurrencies = new Set<string>();

  for (const row of activity) {
    const rowPortfolio = row.portfolio_id ?? "__unassigned__";
    if (
      (portfolioId !== "__all__" && rowPortfolio !== portfolioId) ||
      Number(row.transaction_date.slice(0, 4)) !== year ||
      row.transaction_date > today
    ) {
      continue;
    }
    const month = months[Number(row.transaction_date.slice(5, 7)) - 1];
    if (!month) continue;
    const amount = row.kind === "withdrawal" ? Number(row.amount) : freshMoneyInvested(row);
    if (amount === 0) continue;
    const converted = convertContribution(amount, row.currency, currency, rates);
    if (converted === null) {
      for (const code of [row.currency.toUpperCase(), currency.toUpperCase()]) {
        if (code !== "USD" && (!Number.isFinite(rates[code]) || rates[code] <= 0)) {
          missingCurrencies.add(code);
        }
      }
      continue;
    }
    if (row.kind === "withdrawal") {
      month.withdrawals += converted;
    } else {
      month.total += converted;
      month.byPortfolio[rowPortfolio] = (month.byPortfolio[rowPortfolio] ?? 0) + converted;
    }
  }

  const total = months.reduce((sum, month) => sum + month.total, 0);
  const averageMonths = year === currentYear ? now.getMonth() + 1 : 12;
  return {
    months,
    total,
    monthlyAverage: total / averageMonths,
    averageMonths,
    withdrawals: months.reduce((sum, month) => sum + month.withdrawals, 0),
    missingCurrencies: [...missingCurrencies].sort(),
  };
}
