import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { listPortfolioHoldings } from "@/lib/portfolio/holdings/api";
import { apiFetch } from "@/lib/api/client";

export function portfolioFxQueryOptions() {
  return queryOptions({
    queryKey: ["fx-rates", "USD"],
    queryFn: ({ signal }) =>
      apiFetch<{ rates?: Record<string, number> }>("/api/portfolio/fx-rates?from=USD", {
        signal,
      }),
    staleTime: 10 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });
}

export const portfolioQueryKeys = {
  positions: ["positions"] as const,
  holdings: ["positions", "holdings"] as const,
  portfolios: ["portfolios"] as const,
  tickerCatalog: ["ticker-catalog"] as const,
  tickerCatalogForUser: (userId: string | null) => ["ticker-catalog", userId] as const,
  cash: ["portfolio-cash"] as const,
  activity: ["portfolio-activity"] as const,
  snapshots: ["portfolio-value-snapshots"] as const,
};

export function portfolioHoldingsQueryOptions() {
  return queryOptions({
    queryKey: portfolioQueryKeys.holdings,
    queryFn: ({ signal }) => listPortfolioHoldings(signal),
  });
}

export function invalidatePortfolioData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.activity });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.positions });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.portfolios });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.tickerCatalog });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.cash });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.snapshots });
}
