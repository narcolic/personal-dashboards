import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDailyChange,
  calendarDate,
  isPreviousQuoteSession,
  isTodayClosingSnapshot,
} from "../src/lib/portfolio/holdings/dailyChange.ts";
import { normalizeQuote } from "../src/lib/portfolio/quotes/mappers.ts";
import { enrich } from "../src/lib/portfolio/transactions/calculations.ts";
import type { HoldingRow, Quote } from "../src/lib/portfolio/types.ts";
const friday = {
  regularMarketTime: Date.parse("2026-10-16T20:00:00Z") / 1000,
};
const saturday = new Date("2026-10-17T10:00:00Z");
const base = {
  totalValue: 1100,
  quoteDayChange: 100,
  closingSnapshotValue: null,
  externalFlow: 0,
  quotes: [friday],
  now: saturday,
};
test("the daily baseline uses yesterday's close captured after midnight today", () => {
  const close = { snapshot_date: "2026-10-16", snapshot_at: "2026-10-16T21:00:05Z" };
  assert.equal(isTodayClosingSnapshot(close, saturday), true);
  assert.equal(isTodayClosingSnapshot({ ...close, snapshot_date: "2026-10-15" }, saturday), false);
  assert.equal(isTodayClosingSnapshot({ ...close, snapshot_date: "2026-10-17" }, saturday), false);
  assert.equal(isTodayClosingSnapshot(close, new Date("2026-10-18T10:00:00Z")), false);
  assert.equal(
    isTodayClosingSnapshot(
      { snapshot_date: "2026-12-31", snapshot_at: "2026-12-31T22:00:05Z" },
      new Date("2027-01-01T10:00:00Z"),
    ),
    true,
  );
});
test("a previous session does not show Friday's movement on Saturday, with or without snapshots", () => {
  assert.deepEqual(calculateDailyChange(base), { change: 0, baseline: 1100 });
  assert.equal(calculateDailyChange({ ...base, closingSnapshotValue: 1098 }).change, 0);
  assert.equal(isPreviousQuoteSession(friday, new Date("2026-10-19T11:00:00Z")), true);
});
test("a session closed today retains its daily result until the Athens reporting day ends", () => {
  assert.equal(isPreviousQuoteSession(friday, new Date("2026-10-16T20:30:00Z")), false);
  assert.equal(
    calculateDailyChange({ ...base, now: new Date("2026-10-16T20:30:00Z") }).change,
    100,
  );
  assert.equal(calendarDate(new Date("2026-10-16T22:30:00Z")), "2026-10-17");
});
test("a current session or unknown quote keeps flow-adjusted snapshot and fallback behavior", () => {
  const current = { ...friday, regularMarketTime: Date.parse("2026-10-17T09:00:00Z") / 1000 };
  assert.equal(
    calculateDailyChange({
      ...base,
      quotes: [friday, current],
      closingSnapshotValue: 950,
      externalFlow: 50,
    }).change,
    100,
  );
  assert.equal(calculateDailyChange({ ...base, quotes: [undefined] }).change, 100);
  assert.equal(isPreviousQuoteSession(friday, new Date("2026-10-16T22:30:00Z")), true);
});
test("quote dates survive normalization and holding enrichment zeros stale daily figures only", () => {
  const quote = normalizeQuote("ABC", {
    symbol: "ABC",
    regularMarketPrice: 110,
    regularMarketPreviousClose: 100,
    currency: "USD",
    ...friday,
  }) as Quote;
  assert.equal(quote.regularMarketTime, friday.regularMarketTime);
  const holding = { id: "a", security: { symbol: "ABC" }, shares: 10, avg_cost: 90 } as HoldingRow;
  const row = enrich([holding], [quote], saturday)[0];
  assert.equal(row.marketValue, 1100);
  assert.equal(row.unrealized, 200);
  assert.equal(row.dayChange, 0);
  assert.equal(row.dayChangePct, 0);
  assert.equal(enrich([holding], [quote], new Date("2026-10-16T20:30:00Z"))[0].dayChange, 100);
});
