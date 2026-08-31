import { apiFetch } from "@/lib/api/client";
import type { HoldingRow } from "@/lib/portfolio/types";

export async function listPortfolioHoldings(signal?: AbortSignal) {
  const rows = await apiFetch<
    Array<
      Omit<HoldingRow, "ticker" | "name" | "asset_type" | "market" | "currency"> & {
        transaction_currency: string;
        security_listing_id: string;
        security: NonNullable<HoldingRow["security"]>;
      }
    >
  >("/api/portfolio/holdings", { signal });
  return rows.map((row) => {
    return {
      ...row,
      ticker: row.security.symbol,
      name: row.security.name,
      asset_type: row.security.securityType,
      market: row.security.exchangeName ?? row.security.exchangeMic,
      currency: row.transaction_currency,
      security_listing_id: row.security.listingId,
    };
  });
}
