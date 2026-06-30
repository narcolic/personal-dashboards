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

type TransactionFilters = {
  ticker?: string;
  portfolioId?: string;
  assetType?: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function usePortfolioData({
  includePortfolios = true,
  transactionPagination,
  transactionFilters,
}: {
  includePortfolios?: boolean;
  transactionPagination?: TransactionPagination;
  transactionFilters?: TransactionFilters;
} = {}) {
  const txQ = useQuery({
    queryKey: [
      "positions",
      transactionPagination ? transactionPagination.page : "all",
      transactionPagination ? transactionPagination.pageSize : "all",
      transactionFilters?.ticker ?? "",
      transactionFilters?.portfolioId ?? "",
      transactionFilters?.assetType ?? "",
      transactionFilters?.currency ?? "",
      transactionFilters?.dateFrom ?? "",
      transactionFilters?.dateTo ?? "",
    ],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*", {
        count: transactionPagination ? "exact" : undefined,
      });

      if (transactionFilters?.ticker?.trim()) {
        query = query.ilike("ticker", `%${transactionFilters.ticker.trim()}%`);
      }
      if (transactionFilters?.portfolioId === "__unassigned__") {
        query = query.is("portfolio_id", null);
      } else if (transactionFilters?.portfolioId) {
        query = query.eq("portfolio_id", transactionFilters.portfolioId);
      }
      if (transactionFilters?.assetType) {
        query = query.eq("asset_type", transactionFilters.assetType);
      }
      if (transactionFilters?.currency) {
        query = query.eq("currency", transactionFilters.currency);
      }
      if (transactionFilters?.dateFrom) {
        query = query.gte("transaction_date", transactionFilters.dateFrom);
      }
      if (transactionFilters?.dateTo) {
        query = query.lte("transaction_date", transactionFilters.dateTo);
      }

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
