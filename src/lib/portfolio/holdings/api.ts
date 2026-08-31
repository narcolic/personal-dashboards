import { apiFetch } from "@/lib/api/client";
import type { HoldingRow } from "@/lib/portfolio/types";

export async function listPortfolioHoldings(signal?: AbortSignal) {
  const rows = await apiFetch<HoldingRow[]>("/api/portfolio/holdings", { signal });
  return rows.map((row) => {
    if (!row.security) {
      throw new Error(`Canonical security metadata is missing for holding ${row.id}.`);
    }
    return {
      ...row,
      ticker: row.security.symbol,
      name: row.security.name,
      asset_type: row.security.securityType,
      market: row.security.exchangeName ?? row.security.exchangeMic,
      security_listing_id: row.security.listingId,
    };
  });
}
