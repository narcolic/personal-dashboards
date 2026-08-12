import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { listPortfolioHoldings } from "@/lib/portfolio/holdings/api";

export const portfolioQueryKeys = {
  positions: ["positions"] as const,
  holdings: ["positions", "holdings"] as const,
  portfolios: ["portfolios"] as const,
  tickerCatalog: ["ticker-catalog"] as const,
  tickerCatalogForUser: (userId: string | null) => ["ticker-catalog", userId] as const,
};

export function portfolioHoldingsQueryOptions() {
  return queryOptions({
    queryKey: portfolioQueryKeys.holdings,
    queryFn: ({ signal }) => listPortfolioHoldings(signal),
  });
}

export function invalidatePortfolioData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.positions });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.portfolios });
  void queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.tickerCatalog });
}
