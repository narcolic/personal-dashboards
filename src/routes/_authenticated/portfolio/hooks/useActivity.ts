import { useQuery } from "@tanstack/react-query";
import { listActivity, type ActivityListOptions } from "@/lib/portfolio/activity/api";
import { portfolioQueryKeys } from "@/lib/portfolio/queries";

export function useActivity(options: ActivityListOptions) {
  return useQuery({
    queryKey: [...portfolioQueryKeys.activity, options],
    queryFn: ({ signal }) => listActivity(options, signal),
    placeholderData: (previous) => previous,
  });
}
