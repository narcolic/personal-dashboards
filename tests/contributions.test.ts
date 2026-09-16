import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContributionModel,
  convertContribution,
  freshMoneyInvested,
  getContributionYears,
  localDateKey,
  resolveContributionYear,
  type ContributionActivity,
} from "../src/lib/portfolio/contributions/calculations.ts";

const now = new Date(2026, 8, 16, 12);
const buy: ContributionActivity = {
  kind: "transaction",
  action: "buy",
  transaction_date: "2026-01-10",
  portfolio_id: "portfolio-a",
  currency: "EUR",
  amount: 100,
  shares: 2,
  price: 50,
  fee_amount: 0,
  cash_used: 0,
};
const calculate = (
  activity: ContributionActivity[],
  overrides: Partial<Parameters<typeof buildContributionModel>[1]> = {},
) =>
  buildContributionModel(activity, {
    year: 2026,
    portfolioId: "__all__",
    currency: "EUR",
    rates: { EUR: 0.9, GBP: 0.75 },
    now,
    ...overrides,
  });

test("fresh money includes purchase fees and excludes reused cash", () => {
  assert.equal(freshMoneyInvested(buy), 100);
  assert.equal(freshMoneyInvested({ ...buy, fee_amount: 5 }), 105);
  assert.equal(freshMoneyInvested({ ...buy, fee_amount: 5, cash_used: 40 }), 65);
  assert.equal(freshMoneyInvested({ ...buy, fee_amount: 5, cash_used: 105 }), 0);
  assert.equal(freshMoneyInvested({ ...buy, cash_used: 110 }), 0);
});

test("sells, dividends, standalone fees, and withdrawals are excluded from contributions", () => {
  const model = calculate([
    buy,
    ...["sell", "dividend", "fee"].map((action) => ({ ...buy, action })),
    { ...buy, kind: "withdrawal", action: "withdrawal", amount: 35 },
  ]);
  assert.equal(model.total, 100);
  assert.equal(model.withdrawals, 35);
  assert.equal(model.months[0].withdrawals, 35);
  assert.equal(model.monthlyAverage, 100 / 9);
});

test("12 zero-filled months distinguish current and future months", () => {
  const model = calculate([]);
  assert.equal(model.months.length, 12);
  assert.equal(model.total, 0);
  assert.equal(model.monthlyAverage, 0);
  assert.equal(model.months[7].state, "elapsed");
  assert.equal(model.months[8].state, "current");
  assert.equal(model.months[9].state, "future");
  assert.ok(model.months.every((month) => month.total === 0));
});

test("year boundaries and future dates use recorded local calendar dates", () => {
  const model = calculate([
    { ...buy, transaction_date: "2025-12-31" },
    { ...buy, transaction_date: "2026-01-01" },
    { ...buy, transaction_date: "2026-09-16" },
    { ...buy, transaction_date: "2026-09-17" },
    { ...buy, transaction_date: "2026-12-31" },
    { ...buy, transaction_date: "2027-01-01" },
  ]);
  assert.equal(model.total, 200);
  assert.equal(model.months[0].total, 100);
  assert.equal(model.months[8].total, 100);
  assert.equal(model.months[11].total, 0);
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 1)), "2026-01-01");
});

test("all portfolios aggregate segments, including unassigned and sold-out history", () => {
  const activity = [buy, { ...buy, portfolio_id: "portfolio-b" }, { ...buy, portfolio_id: null }];
  const all = calculate(activity);
  assert.equal(all.total, 300);
  assert.deepEqual(all.months[0].byPortfolio, {
    "portfolio-a": 100,
    "portfolio-b": 100,
    __unassigned__: 100,
  });
  assert.equal(calculate(activity, { portfolioId: "portfolio-b" }).total, 100);
  assert.equal(calculate(activity, { portfolioId: "__unassigned__" }).total, 100);
  assert.equal(calculate(activity, { portfolioId: "empty" }).total, 0);
});

test("current year averages include elapsed zero months; past years use 12", () => {
  assert.equal(calculate([buy]).averageMonths, 9);
  assert.equal(calculate([buy]).monthlyAverage, 100 / 9);
  const past = calculate([{ ...buy, transaction_date: "2025-12-31" }], { year: 2025 });
  assert.equal(past.averageMonths, 12);
  assert.equal(past.monthlyAverage, 100 / 12);
  assert.ok(past.months.every((month) => month.state === "elapsed"));
  assert.equal(calculate([buy], { now: new Date(2026, 0, 31) }).monthlyAverage, 100);
  assert.equal(calculate([buy], { now: new Date(2026, 11, 31) }).monthlyAverage, 100 / 12);
});

test("year options include calendar gaps and ignore future-only records", () => {
  const years = getContributionYears(
    [
      { ...buy, transaction_date: "2023-01-01", action: "sell" },
      { ...buy, transaction_date: "2028-01-01" },
    ],
    now,
  );
  assert.deepEqual(years, [2026, 2025, 2024, 2023]);
  assert.deepEqual(getContributionYears([], now), [2026]);
  assert.equal(resolveContributionYear(2024, years), 2024);
  assert.equal(resolveContributionYear(2022, years), 2026);
  assert.equal(resolveContributionYear(2027, years), 2026);
  assert.equal(resolveContributionYear(undefined, years), 2026);
});

test("currency conversion uses USD-based rates and does not fabricate missing rates", () => {
  assert.equal(convertContribution(100, "USD", "EUR", { EUR: 0.9 }), 90);
  assert.equal(convertContribution(75, "GBP", "EUR", { GBP: 0.75, EUR: 0.9 }), 90);
  assert.equal(convertContribution(90, "EUR", "USD", { EUR: 0.9 }), 100);
  assert.equal(convertContribution(100, "eur", "EUR", {}), 100);
  assert.equal(convertContribution(0, "GBP", "EUR", {}), 0);
  for (const rate of [0, -1, NaN, Infinity]) {
    assert.equal(convertContribution(100, "USD", "EUR", { EUR: rate }), null);
  }
  assert.equal(convertContribution(100, "GBP", "EUR", { EUR: 0.9 }), null);
});

test("converted monthly segments sum to the annual total without premature rounding", () => {
  const model = calculate([
    { ...buy, currency: "USD", shares: 1, price: 10.123 },
    { ...buy, currency: "GBP", shares: 1, price: 5.456, transaction_date: "2026-02-10" },
    { ...buy, kind: "withdrawal", action: "withdrawal", currency: "USD", amount: 10 },
  ]);
  assert.equal(
    model.total,
    model.months.reduce((sum, month) => sum + month.total, 0),
  );
  assert.equal(model.total, 10.123 * 0.9 + (5.456 / 0.75) * 0.9);
  assert.equal(model.withdrawals, 9);
  assert.ok(
    model.months.every(
      (month) =>
        month.total === Object.values(month.byPortfolio).reduce((sum, value) => sum + value, 0),
    ),
  );
});

test("missing rates affect only nonzero contributions and withdrawals in the selected scope/year", () => {
  const activity = [
    buy,
    { ...buy, currency: "GBP" },
    { ...buy, currency: "JPY", transaction_date: "2025-01-01" },
    { ...buy, currency: "CAD", portfolio_id: "portfolio-b" },
    { ...buy, currency: "CHF", cash_used: 100 },
    { ...buy, currency: "AUD", transaction_date: "2026-09-17" },
  ];
  assert.deepEqual(
    calculate(activity, { portfolioId: "portfolio-a", rates: {} }).missingCurrencies,
    ["EUR", "GBP"],
  );
  assert.deepEqual(calculate([buy], { rates: {} }).missingCurrencies, []);
  assert.deepEqual(
    calculate([{ ...buy, kind: "withdrawal", currency: "GBP", amount: 10 }], {
      rates: { EUR: 0.9 },
    }).missingCurrencies,
    ["GBP"],
  );
});
