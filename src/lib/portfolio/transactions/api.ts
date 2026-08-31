import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import type { TransactionRow } from "@/lib/portfolio/types";

const TransactionInput = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9.\-^=:_]+$/),
  action: z.enum(["buy", "sell", "dividend", "fee"]).default("buy"),
  name: z.string().trim().max(120).optional().nullable(),
  asset_type: z.enum(["stock", "etf", "crypto", "bond", "fund", "other"]),
  market: z.string().trim().max(40).optional().nullable(),
  currency: z.string().trim().min(3).max(5).default("USD"),
  shares: z.number().positive().max(1e9),
  price: z.number().nonnegative().max(1e9),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional().nullable(),
  portfolio_id: z.string().uuid().optional().nullable(),
  security_listing_id: z.string().uuid().nullable(),
});

export type TransactionInputType = z.infer<typeof TransactionInput>;

export type TransactionListOptions = {
  page?: number;
  pageSize?: number;
  ticker?: string;
  portfolioId?: string;
  assetType?: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type TransactionListResult = {
  rows: TransactionRow[];
  count: number;
};

type TransactionApiRow = {
  id: string;
  action: TransactionRow["action"];
  transaction_currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
  security_listing_id: string;
  security: NonNullable<TransactionRow["security"]>;
};

type TransactionApiListResult = {
  rows: TransactionApiRow[];
  count: number;
};

export type ImportedTransactionInput = {
  ticker: string;
  name: string | null;
  asset_type: TransactionInputType["asset_type"];
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_name: string;
  security_listing_id?: string | null;
};

export async function listTransactions(options: TransactionListOptions, signal?: AbortSignal) {
  const query = new URLSearchParams();

  if (options.page != null) query.set("page", String(options.page));
  if (options.pageSize != null) query.set("pageSize", String(options.pageSize));
  if (options.ticker?.trim()) query.set("ticker", options.ticker.trim());
  if (options.portfolioId === "__unassigned__") {
    query.set("unassignedPortfolio", "true");
  } else if (options.portfolioId) {
    query.set("portfolioId", options.portfolioId);
  }
  if (options.assetType) query.set("assetType", options.assetType);
  if (options.currency) query.set("currency", options.currency);
  if (options.dateFrom) query.set("dateFrom", options.dateFrom);
  if (options.dateTo) query.set("dateTo", options.dateTo);

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const result = await apiFetch<TransactionApiListResult>(`/api/portfolio/transactions${suffix}`, {
    signal,
  });
  return {
    ...result,
    rows: result.rows.map((row) => {
      return {
        ...row,
        ticker: row.security.symbol,
        name: row.security.name,
        asset_type: row.security.securityType,
        market: row.security.exchangeName ?? row.security.exchangeMic,
        currency: row.transaction_currency,
        security_listing_id: row.security.listingId,
      };
    }),
  };
}

export async function createTransaction(value: TransactionInputType) {
  const listingId = await resolveListingId(value);
  return apiFetch<{ id: string }>("/api/portfolio/transactions", {
    method: "POST",
    body: JSON.stringify(toTransactionMutation(value, listingId)),
  });
}

export async function updateTransaction(id: string, value: TransactionInputType) {
  const listingId = await resolveListingId(value);
  return apiFetch<{ id: string }>(`/api/portfolio/transactions/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(toTransactionMutation(value, listingId)),
  });
}

async function resolveListingId(value: TransactionInputType) {
  if (value.security_listing_id) return value.security_listing_id;
  const resolution = await apiFetch<{ listing_id: string }>(
    "/api/portfolio/security-listings/resolve",
    {
      method: "POST",
      body: JSON.stringify({
        symbol: value.ticker,
        name: value.name,
        security_type: value.asset_type,
        market: value.market,
        trading_currency: value.currency,
      }),
    },
  );
  return resolution.listing_id;
}

function toTransactionMutation(value: TransactionInputType, listingId: string) {
  return {
    action: value.action,
    transaction_currency: value.currency,
    shares: value.shares,
    price: value.price,
    transaction_date: value.transaction_date,
    notes: value.notes,
    portfolio_id: value.portfolio_id,
    security_listing_id: listingId,
  };
}

export async function deleteTransaction(id: string) {
  await apiFetch<void>(`/api/portfolio/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function deleteTransactions(ids: string[]) {
  return apiFetch<{ deleted: number }>("/api/portfolio/transactions/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function importTransactions(
  rows: ImportedTransactionInput[],
  importedPortfolioNotes: string,
) {
  return apiFetch<{ inserted: number }>("/api/portfolio/transactions/import", {
    method: "POST",
    body: JSON.stringify({ rows, importedPortfolioNotes }),
  });
}
