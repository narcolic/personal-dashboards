import { useMemo } from "react";
import { buildPortfolioColorMap } from "@/lib/portfolio/colors";
import { useActivity } from "@/routes/_authenticated/portfolio/hooks/useActivity";

export function usePortfolioColors() {
  const activityQ = useActivity({});
  const portfolioColors = useMemo(
    () => buildPortfolioColorMap((activityQ.data?.rows ?? []).map((row) => row.portfolio_id)),
    [activityQ.data],
  );
  return { activityQ, portfolioColors };
}
