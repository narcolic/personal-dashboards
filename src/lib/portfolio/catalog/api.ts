import { apiFetch } from "@/lib/api/client";
import type { TickerCatalogRow } from "@/lib/portfolio/tickerCatalog";

export function listTickerCatalog(signal?: AbortSignal) {
  return apiFetch<TickerCatalogRow[]>("/api/portfolio/ticker-catalog", { signal });
}
