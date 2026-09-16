import { apiFetch } from "@/lib/api/client";
import type { TransactionListOptions } from "@/lib/portfolio/transactions/api";
import type { SecurityMetadata, TransactionRow } from "@/lib/portfolio/types";

export type ActivitySortKey =
  | "transaction_date"
  | "ticker"
  | "portfolio"
  | "action"
  | "asset_type"
  | "shares"
  | "price"
  | "total";
export type ActivityTransaction = TransactionRow & { kind: "transaction"; amount: number };
export type ActivityWithdrawal = {
  kind: "withdrawal";
  id: string;
  action: "withdrawal";
  transaction_date: string;
  portfolio_id: string | null;
  currency: string;
  amount: number;
  notes: string | null;
  ticker: null;
  name: null;
  asset_type: null;
  shares: null;
  price: null;
};
export type ActivityRow = ActivityTransaction | ActivityWithdrawal;
export type ActivityListOptions = TransactionListOptions & {
  sort?: ActivitySortKey;
  direction?: "asc" | "desc";
};
type ApiRow = {
  kind: "transaction" | "withdrawal";
  id: string;
  action: TransactionRow["action"] | "withdrawal";
  transaction_currency: string;
  transaction_date: string;
  portfolio_id: string | null;
  amount: number;
  notes: string | null;
  shares: number | null;
  price: number | null;
  security: SecurityMetadata | null;
  cash_used: number;
  fee_amount: number;
  settles_to_cash: boolean;
};

export async function listActivity(
  options: ActivityListOptions,
  signal?: AbortSignal,
): Promise<{ rows: ActivityRow[]; count: number }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value == null || value === "") continue;
    if (key === "portfolioId" && value === "__unassigned__")
      query.set("unassignedPortfolio", "true");
    else query.set(key, String(value));
  }
  const result = await apiFetch<{ rows: ApiRow[]; count: number }>(
    `/api/portfolio/activity?${query}`,
    { signal },
  );
  return {
    count: result.count,
    rows: result.rows.map((row) => {
      const common = {
        id: row.id,
        transaction_date: row.transaction_date,
        portfolio_id: row.portfolio_id,
        currency: row.transaction_currency,
        amount: Number(row.amount),
        notes: row.notes,
      };
      if (row.kind === "withdrawal")
        return {
          ...common,
          kind: "withdrawal",
          action: "withdrawal",
          ticker: null,
          name: null,
          asset_type: null,
          shares: null,
          price: null,
        };
      if (!row.security || row.action === "withdrawal" || row.shares == null || row.price == null)
        throw new Error(`Canonical transaction data is missing for activity ${row.id}.`);
      return {
        ...common,
        kind: "transaction",
        action: row.action,
        shares: Number(row.shares),
        price: Number(row.price),
        ticker: row.security.symbol,
        name: row.security.name,
        asset_type: row.security.securityType,
        market: row.security.exchangeName ?? row.security.exchangeMic,
        security: row.security,
        security_listing_id: row.security.listingId,
        cash_used: Number(row.cash_used),
        fee_amount: Number(row.fee_amount),
        settles_to_cash: row.settles_to_cash,
      };
    }),
  };
}
