import { useQuery } from "@tanstack/react-query";
import { portfolioFxQueryOptions } from "@/lib/portfolio/queries";

export function useContributionFx() {
  return useQuery(portfolioFxQueryOptions());
}
