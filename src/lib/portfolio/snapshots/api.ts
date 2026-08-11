import { apiFetch } from "@/lib/api/client";
import type { Database } from "@/integrations/supabase/types";

export type PortfolioSnapshotRow = Database["public"]["Tables"]["portfolio_value_snapshots"]["Row"];

export function listPortfolioSnapshots(signal?: AbortSignal) {
  return apiFetch<PortfolioSnapshotRow[]>("/api/portfolio/snapshots?limit=1000", { signal });
}
