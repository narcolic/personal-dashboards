import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { TickerCatalogRow } from "@/lib/portfolio/tickerCatalog";

export function useTickerCatalog() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const tickerCatalogQ = useQuery({
    queryKey: ["ticker-catalog", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticker_catalog")
        .select("*")
        .order("ticker", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as TickerCatalogRow[];
    },
  });

  const tickerCatalogByTicker = useMemo(
    () =>
      new Map(
        (tickerCatalogQ.data ?? []).map((item) => [item.ticker.trim().toUpperCase(), item] as const),
      ),
    [tickerCatalogQ.data],
  );

  return {
    tickerCatalogQ,
    tickerCatalog: tickerCatalogQ.data ?? [],
    tickerCatalogByTicker,
  };
}
