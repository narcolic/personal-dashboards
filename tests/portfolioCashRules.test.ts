import assert from "node:assert/strict";
import test from "node:test";
import { shouldOfferAvailableCash } from "../src/lib/portfolio/cash/rules.ts";

test("available cash option is hidden when no cash exists", () => {
  assert.equal(shouldOfferAvailableCash("buy", 0), false);
});

test("available cash option is shown only for buys with cash", () => {
  assert.equal(shouldOfferAvailableCash("buy", 1000), true);
  assert.equal(shouldOfferAvailableCash("sell", 1000), false);
});
