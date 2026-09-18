import assert from "node:assert/strict";
import test from "node:test";
import { calculateRealizedPnl } from "../src/lib/portfolio/realized.ts";
import type { TransactionRow } from "../src/lib/portfolio/types.ts";

function trade(
  id: string,
  action: "buy" | "sell",
  shares: number,
  price: number,
  date: string,
  created: string,
  fee = 0,
): TransactionRow {
  return {
    id,
    action,
    shares,
    price,
    transaction_date: date,
    created_at: created,
    security_listing_id: "listing",
    portfolio_id: "portfolio",
    currency: "USD",
    fee_amount: fee,
    cash_used: 0,
    settles_to_cash: action === "sell",
    ticker: "ABC",
    name: null,
    asset_type: "stock",
    market: null,
    notes: null,
    security: {} as NonNullable<TransactionRow["security"]>,
  };
}

const identity = (amount: number) => amount;

test("later same-day cash-funded buy leaves earlier realized gain unchanged", () => {
  const initial = trade("3", "buy", 10, 100, "2026-01-01", "2026-01-01T09:00:00Z");
  const sale = trade("2", "sell", 5, 120, "2026-02-01", "2026-02-01T10:00:00Z");
  const later = {
    ...trade("1", "buy", 5, 200, "2026-02-01", "2026-02-01T11:00:00Z"),
    cash_used: 600,
  };
  assert.equal(calculateRealizedPnl([sale, initial], "__all__", identity), 100);
  assert.equal(calculateRealizedPnl([later, sale, initial], "__all__", identity), 100);
  const close = trade("4", "sell", 10, 150, "2026-02-02", "2026-02-02T10:00:00Z");
  assert.equal(calculateRealizedPnl([close, later, sale, initial], "__all__", identity), 100);
});

test("same-day fees and loss reduce cumulative realized gain in recorded sequence", () => {
  const initial = trade("3", "buy", 10, 100, "2026-01-01", "2026-01-01T09:00:00Z", 10);
  const gain = trade("2", "sell", 5, 120, "2026-02-01", "2026-02-01T10:00:00Z", 5);
  const loss = trade("1", "sell", 5, 80, "2026-02-01", "2026-02-01T11:00:00Z", 5);
  assert.equal(calculateRealizedPnl([loss, initial, gain], "__all__", identity), -20);
});
