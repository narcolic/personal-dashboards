import { apiFetch } from "@/lib/api/client";
import type { HoldingRow } from "@/lib/portfolio/types";

export function listPortfolioHoldings(signal?: AbortSignal) {
  return apiFetch<HoldingRow[]>("/api/portfolio/holdings", { signal });
}
