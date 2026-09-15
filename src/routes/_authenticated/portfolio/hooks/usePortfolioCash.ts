import { useQuery } from "@tanstack/react-query";
import { listPortfolioCash } from "@/lib/portfolio/cash/api";
import { portfolioQueryKeys } from "@/lib/portfolio/queries";

export function usePortfolioCash() {
  return useQuery({
    queryKey: portfolioQueryKeys.cash,
    queryFn: ({ signal }) => listPortfolioCash(signal),
  });
}
