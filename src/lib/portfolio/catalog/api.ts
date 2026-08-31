import { apiFetch } from "@/lib/api/client";
import type { TickerCatalogRow } from "@/lib/portfolio/tickerCatalog";

export async function listTickerCatalog(signal?: AbortSignal) {
  const rows = await apiFetch<
    Array<
      Omit<TickerCatalogRow, "ticker" | "name" | "asset_type" | "market" | "currency"> & {
        security_listing_id: string;
        security: NonNullable<TickerCatalogRow["security"]>;
      }
    >
  >("/api/portfolio/ticker-catalog", { signal });
  return rows.map((row) => {
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
