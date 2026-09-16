import assert from "node:assert/strict";
import test from "node:test";
import { validateTransactionDraft } from "../src/lib/portfolio/transactions/editorRules.ts";

const valid = {
  ticker: "VUAA.DE",
  portfolio_id: "portfolio",
  transaction_date: "2026-09-16",
  shares: "2.5",
  price: "126.61",
  fee_amount: "",
  action: "buy",
  notes: "",
};

test("valid draft accepts fractional amounts, no fee and zero price", () => {
  assert.deepEqual(validateTransactionDraft(valid), {});
  assert.deepEqual(validateTransactionDraft({ ...valid, price: "0" }), {});
});
test("portfolio is mandatory and empty inputs are not silently converted to zero", () => {
  const errors = validateTransactionDraft({ ...valid, portfolio_id: null, shares: "", price: "" });
  assert.equal(errors.portfolio_id, "portfolioRequired");
  assert.equal(errors.shares, "numberInvalid");
  assert.equal(errors.price, "numberInvalid");
});
test("invalid symbols, calendar dates and oversized notes are rejected", () => {
  const errors = validateTransactionDraft({
    ...valid,
    ticker: "BAD TICKER",
    transaction_date: "2026-02-30",
    notes: "x".repeat(501),
  });
  assert.equal(errors.ticker, "tickerInvalid");
  assert.equal(errors.transaction_date, "dateRequired");
  assert.equal(errors.notes, "notesTooLong");
});
test("nonfinite, negative and oversized amounts are rejected", () => {
  for (const amount of ["NaN", "Infinity", "-1", "1000000001"]) {
    assert.equal(validateTransactionDraft({ ...valid, shares: amount }).shares, "numberInvalid");
    assert.equal(validateTransactionDraft({ ...valid, price: amount }).price, "numberInvalid");
    assert.equal(
      validateTransactionDraft({ ...valid, fee_amount: amount }).fee_amount,
      "numberInvalid",
    );
  }
});
test("sell fee cannot exceed gross proceeds; buy fee may exceed subtotal", () => {
  assert.equal(
    validateTransactionDraft({ ...valid, action: "sell", shares: "1", price: "5", fee_amount: "6" })
      .fee_amount,
    "feeExceedsSale",
  );
  assert.deepEqual(
    validateTransactionDraft({ ...valid, shares: "1", price: "5", fee_amount: "6" }),
    {},
  );
});
