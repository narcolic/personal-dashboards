import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TransactionRow } from "@/lib/portfolio/types";

export type PortfolioRecord = {
  id: string;
  name: string;
  broker: string | null;
  notes: string | null;
};

type TransactionPagination = {
  page: number;
  pageSize: number;
};

export function usePortfolioData({
  includePortfolios = true,
  transactionPagination,
}: {
  includePortfolios?: boolean;
  transactionPagination?: TransactionPagination;
} = {}) {
  const txQ = useQuery({
    queryKey: [
      "positions",
      transactionPagination ? transactionPagination.page : "all",
      transactionPagination ? transactionPagination.pageSize : "all",
    ],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*", {
        count: transactionPagination ? "exact" : undefined,
      });

      if (transactionPagination) {
        const from = (transactionPagination.page - 1) * transactionPagination.pageSize;
        const to = from + transactionPagination.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query.order("transaction_date", { ascending: false });
      if (error) throw new Error(error.message);
      return {
        rows: (data ?? []) as TransactionRow[],
        count: count ?? data?.length ?? 0,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const portfoliosQ = useQuery({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PortfolioRecord[];
    },
    enabled: includePortfolios,
  });

  return {
    txQ,
    portfoliosQ,
    transactions: txQ.data?.rows ?? [],
    transactionCount: txQ.data?.count ?? 0,
    portfolios: portfoliosQ.data ?? [],
  };
}
