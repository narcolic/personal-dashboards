import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export function useContributionFx() {
  return useQuery({
    queryKey: ["fx-rates", "contributions", "USD"],
    queryFn: ({ signal }) =>
      apiFetch<{ rates?: Record<string, number> }>("/api/portfolio/fx-rates?from=USD", {
        signal,
      }),
    staleTime: 10 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });
}
