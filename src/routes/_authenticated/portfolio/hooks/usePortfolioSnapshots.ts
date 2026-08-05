import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PortfolioSnapshotRow = Database["public"]["Tables"]["portfolio_value_snapshots"]["Row"];

export function isCompletePortfolioSnapshot(row: PortfolioSnapshotRow) {
  const metadata = row.quote_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true;

  const failed = (metadata as Record<string, unknown>).failed;
  return !Array.isArray(failed) || failed.length === 0;
}

export function usePortfolioSnapshots() {
  return useQuery({
    queryKey: ["portfolio-value-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_value_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .order("scope", { ascending: true })
        .limit(1000);

      if (error) throw new Error(error.message);
      return (data ?? []) as PortfolioSnapshotRow[];
    },
    staleTime: 10 * 60_000,
  });
}
