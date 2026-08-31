import { apiFetch } from "@/lib/api/client";
import type { TickerCatalogRow } from "@/lib/portfolio/tickerCatalog";

export async function listTickerCatalog(signal?: AbortSignal) {
  const rows = await apiFetch<TickerCatalogRow[]>("/api/portfolio/ticker-catalog", { signal });
  return rows.map((row) => {
    if (!row.security) {
      throw new Error(`Canonical security metadata is missing for catalog row ${row.id}.`);
    }
    return {
      ...row,
      ticker: row.security.symbol,
      name: row.security.name,
      asset_type: row.security.securityType,
      market: row.security.exchangeName ?? row.security.exchangeMic,
      currency: row.security.tradingCurrency,
      security_listing_id: row.security.listingId,
    };
  });
}
