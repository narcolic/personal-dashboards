import { useQuery } from "@tanstack/react-query";
import { listPortfolios } from "@/lib/portfolio/portfolios/api";
import { listTransactions } from "@/lib/portfolio/transactions/api";

export type { PortfolioRecord } from "@/lib/portfolio/portfolios/api";

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
    queryFn: ({ signal }) =>
      listTransactions(
        {
          page: transactionPagination?.page,
          pageSize: transactionPagination?.pageSize,
          ticker: transactionFilters?.ticker,
          portfolioId: transactionFilters?.portfolioId,
          assetType: transactionFilters?.assetType,
          currency: transactionFilters?.currency,
          dateFrom: transactionFilters?.dateFrom,
          dateTo: transactionFilters?.dateTo,
        },
        signal,
      ),
    placeholderData: (previousData) => previousData,
  });

  const portfoliosQ = useQuery({
    queryKey: ["portfolios"],
    queryFn: ({ signal }) => listPortfolios(signal),
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
