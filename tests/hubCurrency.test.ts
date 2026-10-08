import assert from "node:assert/strict";
import test from "node:test";
import { totalMarketValue } from "../src/lib/portfolio/holdings/value.ts";
import { convertContribution } from "../src/lib/portfolio/contributions/calculations.ts";

const rates = { EUR: 0.9, GBP: 0.75, TRY: 30 };
const holdings = [
  { marketValue: 100, currency: "USD" },
  { marketValue: 90, currency: "EUR" },
  { marketValue: 75, currency: "USD", quote: { currency: "GBP" } },
];

test("hub converts mixed holdings from their price currency into each default currency", () => {
  assert.equal(totalMarketValue(holdings, "EUR", rates), 270);
  assert.equal(totalMarketValue(holdings, "USD", rates), 300);
  assert.equal(totalMarketValue(holdings, "GBP", rates), 225);
  assert.equal(totalMarketValue(holdings, "TRY", rates), 9000);
});

test("hub uses holding currency when a quote is unavailable", () => {
  assert.equal(totalMarketValue([{ marketValue: 90, currency: "EUR" }], "USD", rates), 100);
});

test("hub does not show a partial total or assume parity when rates are missing", () => {
  assert.equal(totalMarketValue(holdings, "EUR", { EUR: 0.9 }), null);
  assert.equal(totalMarketValue(holdings, "TRY", { EUR: 0.9, GBP: 0.75 }), null);
  assert.equal(totalMarketValue([{ marketValue: 90, currency: "EUR" }], "EUR", {}), 90);
});

test("car service converts its EUR total into the chosen default currency", () => {
  assert.equal(convertContribution(90, "EUR", "GBP", rates), 75);
  assert.equal(convertContribution(90, "EUR", "EUR", {}), 90);
  assert.equal(convertContribution(90, "EUR", "USD", {}), null);
});
