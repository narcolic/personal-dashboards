import { useQuery } from "@tanstack/react-query";
import { listPortfolioSnapshots, type PortfolioSnapshotRow } from "@/lib/portfolio/snapshots/api";

export type { PortfolioSnapshotRow } from "@/lib/portfolio/snapshots/api";

export function isCompletePortfolioSnapshot(row: PortfolioSnapshotRow) {
  const metadata = row.quote_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true;

  const failed = (metadata as Record<string, unknown>).failed;
  return !Array.isArray(failed) || failed.length === 0;
}

export function usePortfolioSnapshots() {
  return useQuery({
    queryKey: ["portfolio-value-snapshots"],
    queryFn: ({ signal }) => listPortfolioSnapshots(signal),
    staleTime: 10 * 60_000,
  });
}
