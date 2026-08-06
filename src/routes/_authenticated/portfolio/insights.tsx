import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  PortfolioInsights,
  type InsightsMetric,
  type InsightsRange,
} from "@/routes/_authenticated/portfolio/analytics";

const RANGES = new Set<InsightsRange>(["1W", "1M", "3M", "1Y", "ALL"]);
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
    });
  };

  return (
    <PortfolioInsights
      range={search.range}
      metric={search.metric}
      onRangeChange={(range) => updateSearch({ range })}
      onMetricChange={(metric) => updateSearch({ metric })}
    />
  );
}
