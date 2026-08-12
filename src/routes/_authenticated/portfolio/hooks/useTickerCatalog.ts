import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listTickerCatalog } from "@/lib/portfolio/catalog/api";
import { portfolioQueryKeys } from "@/lib/portfolio/queries";

export function useTickerCatalog() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const tickerCatalogQ = useQuery({
    queryKey: portfolioQueryKeys.tickerCatalogForUser(userId),
    enabled: Boolean(userId),
    queryFn: ({ signal }) => listTickerCatalog(signal),
  });

  const tickerCatalogByTicker = useMemo(
    () =>
      new Map(
        (tickerCatalogQ.data ?? []).map(
          (item) => [item.ticker.trim().toUpperCase(), item] as const,
        ),
      ),
    [tickerCatalogQ.data],
  );

  return {
    tickerCatalogQ,
    tickerCatalog: tickerCatalogQ.data ?? [],
    tickerCatalogByTicker,
  };
}
