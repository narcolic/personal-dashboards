import assert from "node:assert/strict";
import test from "node:test";
import { calculatePortfolioFees } from "../src/lib/portfolio/fees.ts";
import type { ContributionActivity } from "../src/lib/portfolio/contributions/calculations.ts";
const buy: ContributionActivity = {
  kind: "transaction",
  action: "buy",
  portfolio_id: "a",
  currency: "EUR",
  transaction_date: "2026-01-01",
  shares: 10,
  price: 100,
  amount: 1000,
  fee_amount: 5,
};
const calculate = (rows: ContributionActivity[], portfolio = "__all__") =>
  calculatePortfolioFees(rows, portfolio, "EUR", { EUR: 0.8 }, "2026-10-15");
test("fee reporting counts buy/sell fees and standalone fees once, including sold-out history", () => {
  const result = calculate([
    buy,
    { ...buy, action: "sell", fee_amount: 3 },
    { ...buy, action: "fee", amount: 2, fee_amount: 99 },
    { ...buy, action: "dividend", amount: 20 },
    { ...buy, kind: "withdrawal", action: "withdrawal", amount: 10 },
  ]);
  assert.equal(result.total, 10);
  assert.equal(result.missingRates, false);
});
test("fee totals respect scope, dates, currencies and missing FX", () => {
  const rows = [
    buy,
    { ...buy, portfolio_id: null, fee_amount: 4 },
    { ...buy, portfolio_id: "b", currency: "USD", fee_amount: 10 },
    { ...buy, transaction_date: "2027-01-01", fee_amount: 100 },
  ];
  assert.equal(calculate(rows).total, 17);
  assert.equal(calculate(rows, "a").total, 5);
  assert.equal(calculate(rows, "__unassigned__").total, 4);
  assert.equal(calculate([{ ...buy, currency: "GBP" }]).missingRates, true);
});
