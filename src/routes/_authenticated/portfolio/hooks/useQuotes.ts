import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { aggregateTransactions, enrich } from "@/lib/portfolio/transactions/calculations";
import { getQuotesClient } from "@/lib/portfolio/quotes/api";
import type { TransactionRow } from "@/lib/portfolio/types";

export function useQuotes(
  transactions: TransactionRow[],
  options: {
    staleTime?: number;
    gcTime?: number;
    retry?: number;
    enabled?: boolean;
  } = {},
) {
  const positions = useMemo(() => aggregateTransactions(transactions), [transactions]);

  const tickers = useMemo(
    () => Array.from(new Set(positions.map((p) => p.ticker.toUpperCase()))),
    [positions],
  );

  const quotesQ = useQuery({
    queryKey: ["quotes", tickers.join(",")],
    queryFn: () => getQuotesClient(tickers),
    enabled: options.enabled ?? tickers.length > 0,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    retry: options.retry,
  });

  const enrichedRows = useMemo(
    () => enrich(positions, quotesQ.data?.quotes ?? []),
    [positions, quotesQ.data],
  );

  return {
    positions,
    tickers,
    quotesQ,
    enrichedRows,
  };
}
