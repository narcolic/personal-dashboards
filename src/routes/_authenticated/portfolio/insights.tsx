import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  PortfolioInsights,
  type InsightsMetric,
  type InsightsRange,
} from "@/routes/_authenticated/portfolio/analytics";

const RANGES = new Set<InsightsRange>(["1W", "1M", "3M", "YTD", "1Y", "ALL"]);
const METRICS = new Set<InsightsMetric>(["totalValue", "performance", "profitLoss"]);

export const Route = createFileRoute("/_authenticated/portfolio/insights")({
  validateSearch: (search: Record<string, unknown>) => ({
    range:
      typeof search.range === "string" && RANGES.has(search.range as InsightsRange)
        ? (search.range as InsightsRange)
        : "1M",
    metric:
      typeof search.metric === "string" && METRICS.has(search.metric as InsightsMetric)
        ? (search.metric as InsightsMetric)
        : "totalValue",
    contributionYear:
      (typeof search.contributionYear === "number" ||
        (typeof search.contributionYear === "string" && /^\d{4}$/.test(search.contributionYear))) &&
      Number.isInteger(Number(search.contributionYear)) &&
      Number(search.contributionYear) >= 1000 &&
      Number(search.contributionYear) <= new Date().getFullYear()
        ? Number(search.contributionYear)
        : undefined,
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const updateSearch = (next: Partial<typeof search>) => {
    void navigate({
      to: "/portfolio/insights",
      search: { ...search, ...next },
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <PortfolioInsights
      range={search.range}
      metric={search.metric}
      onRangeChange={(range) => updateSearch({ range })}
      onMetricChange={(metric) => updateSearch({ metric })}
      contributionYear={search.contributionYear}
      onContributionYearChange={(contributionYear) => updateSearch({ contributionYear })}
    />
  );
}
