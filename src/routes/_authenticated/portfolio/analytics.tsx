import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { PnLBucket } from "@/routes/_authenticated/portfolio/components/PnLBucket";
import {
  PortfolioAnalyticsChart,
  type AnalyticsPoint,
} from "@/routes/_authenticated/portfolio/components/PortfolioAnalyticsChart";
import { PortfolioSnapshotStats } from "@/routes/_authenticated/portfolio/components/PortfolioSnapshotStats";
import {
  isCompletePortfolioSnapshot,
  usePortfolioSnapshots,
  type PortfolioSnapshotRow,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioSnapshots";
import {
  type RowWithNative,
  usePortfolioHoldingsView,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";

export type InsightsRange = "1W" | "1M" | "3M" | "1Y" | "ALL";
export type InsightsMetric = "totalValue" | "performance" | "profitLoss";
type SnapshotCurrency = "EUR" | "USD";

const RANGES: Array<{ key: InsightsRange; days: number | null }> = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: null },
];

export const Route = createFileRoute("/_authenticated/portfolio/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/portfolio/insights", replace: true });
  },
});

export function PortfolioInsights({
  range,
  metric,
  onRangeChange,
  onMetricChange,
}: {
  range: InsightsRange;
  metric: InsightsMetric;
  onRangeChange: (range: InsightsRange) => void;
  onMetricChange: (metric: InsightsMetric) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const snapshotsQ = usePortfolioSnapshots();
  const { rows, convertTo, holdingsQ, quotesQ, display, selected, portfolioMap } =
    usePortfolioHoldingsView();
  const currency: SnapshotCurrency = display === "USD" ? "USD" : "EUR";
  const scopeKey = selected === "__all__" ? "total" : `portfolio:${selected}`;
  const selectedScopeLabel =
    selected === "__all__" ? t("portfolio.all") : (portfolioMap.get(selected) ?? "—");

  const model = useMemo(
    () => buildAnalyticsModel(snapshotsQ.data ?? [], scopeKey, range, currency),
    [currency, range, scopeKey, snapshotsQ.data],
  );
  const topAllocations = useMemo(
    () => buildTopAllocations(rows, convertTo, currency),
    [convertTo, currency, rows],
  );
  const movers = useMemo(() => {
    const sorted = rows.slice().sort((left, right) => right.unrealized - left.unrealized);
    const gainers = sorted.filter((row) => row.unrealized >= 0);
    const losers = sorted.filter((row) => row.unrealized < 0).reverse();
    const total = (items: RowWithNative[]) =>
      items.reduce((sum, row) => sum + convertTo(row.unrealized, row._nativeCurrency, currency), 0);
    return {
      gainers,
      losers,
      gainTotals: { [currency]: total(gainers) },
      lossTotals: { [currency]: total(losers) },
    };
  }, [convertTo, currency, rows]);

  if (snapshotsQ.isLoading) return <InsightsSkeleton />;
  if (snapshotsQ.isError) {
    return (
      <InsightsMessage title={t("portfolio.analytics.loadError")} body={snapshotsQ.error.message} />
    );
  }
  if (!model.latest || model.points.length === 0) {
    return (
      <InsightsMessage
        title={t("portfolio.analytics.noData")}
        body={t("portfolio.noSnapshotsYet")}
      />
    );
  }

  const latestMetric = model.latest[metric];
  const tone = latestMetric < 0 ? "negative" : "positive";
  const formatMoney = (value: number) => fmtCurrency(value, currency);
  const chartTitle =
    metric === "totalValue"
      ? t("portfolio.analytics.totalValue")
      : metric === "performance"
        ? t("portfolio.analytics.performance")
        : t("portfolio.analytics.profitLoss");
  const formatMetric =
    metric === "performance"
      ? (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`
      : formatMoney;
  const baseline = metric === "totalValue" ? model.points[0]?.totalValue : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-[10px] border border-border/70 bg-card/70 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div
            className={`text-lg font-bold tabular-nums ${model.change >= 0 ? "text-bull" : "text-bear"}`}
          >
            {model.change >= 0 ? "▲ +" : "▼ −"}
            {formatMoney(Math.abs(model.change))}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {selectedScopeLabel} · {t("portfolio.analytics.selectedPeriod")} ·{" "}
            {model.changePct >= 0 ? "+" : ""}
            {model.changePct.toFixed(2)}%
          </div>
        </div>
        <div className="grid grid-cols-5 bg-secondary/45 p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onRangeChange(item.key)}
              aria-pressed={range === item.key}
              className={`min-w-12 px-3 py-2 text-xs font-bold tracking-[0.08em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                range === item.key
                  ? "bg-card text-primary shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.key}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3" aria-labelledby="trend-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="trend-heading"
            className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span className="text-primary">&gt;</span>
            {t("portfolio.performanceTrend")}
          </h2>
          <div className="inline-flex self-start border border-border bg-card p-0.5" role="group">
            {(["totalValue", "performance", "profitLoss"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onMetricChange(item)}
                aria-pressed={metric === item}
                className={`px-3 py-2 text-xs uppercase tracking-[0.08em] ${
                  metric === item
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item === "totalValue"
                  ? t("portfolio.analytics.value")
                  : item === "performance"
                    ? t("portfolio.analytics.performance")
                    : t("portfolio.analytics.pnlShort")}
              </button>
            ))}
          </div>
        </div>
        <PortfolioAnalyticsChart
          title={chartTitle}
          data={model.points}
          metric={metric}
          tone={tone}
          badgeLabel={t("portfolio.analytics.rangePerformance")}
          formatMetric={formatMetric}
          baseline={baseline}
        />
      </section>

      <div className="space-y-3">
        <AllocationPanel
          rows={topAllocations.rows}
          totalValue={topAllocations.totalValue}
          currency={currency}
          subtitle={t("portfolio.analytics.liveTopAllocations", {
            count: topAllocations.rows.length,
            scope: selectedScopeLabel,
          })}
          title={t("portfolio.analytics.topAllocations")}
          emptyLabel={t("portfolio.analytics.noAllocation")}
          loading={holdingsQ.isLoading || quotesQ.isLoading}
          loadingLabel={t("common.loading")}
        />
        <div id="movers" className="grid scroll-mt-28 grid-cols-1 items-start gap-3 lg:grid-cols-2">
          <PnLBucket
            title={t("portfolio.gainers")}
            tone="bull"
            totalsByCurrency={movers.gainTotals}
            rows={movers.gainers}
            onRowClick={(row) =>
              void navigate({
                to: "/portfolio/holdings/$ticker",
                params: { ticker: row.ticker },
              })
            }
          />
          <PnLBucket
            title={t("portfolio.losers")}
            tone="bear"
            totalsByCurrency={movers.lossTotals}
            rows={movers.losers}
            onRowClick={(row) =>
              void navigate({
                to: "/portfolio/holdings/$ticker",
                params: { ticker: row.ticker },
              })
            }
          />
        </div>
      </div>

      <details className="analytics-panel group overflow-hidden rounded-[10px] border border-border/70 bg-card/70 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 bg-secondary/20 px-4 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring">
          <span
            aria-hidden="true"
            className="text-primary transition-transform duration-200 group-open:rotate-90"
          >
            &gt;
          </span>
          <span>{t("portfolio.historicalMilestones")}</span>
        </summary>
        <div className="border-t border-border/50 p-4 md:p-5">
          <PortfolioSnapshotStats currency={currency} scopeKey={scopeKey} embedded />
        </div>
      </details>
    </div>
  );
}

function AllocationPanel({
  rows,
  totalValue,
  currency,
  subtitle,
  title,
  emptyLabel,
  loading,
  loadingLabel,
}: {
  rows: Array<{ name: string; value: number }>;
  totalValue: number;
  currency: SnapshotCurrency;
  subtitle: string;
  title: string;
  emptyLabel: string;
  loading: boolean;
  loadingLabel: string;
}) {
  const colors = [
    "var(--color-primary)",
    "var(--color-chart-5)",
    "var(--color-bull)",
    "var(--color-amber)",
    "var(--color-chart-6)",
    "var(--color-chart-7)",
    "var(--color-bear)",
    "var(--color-chart-8)",
  ];

  return (
    <section className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
      <header className="px-4 pb-1 pt-4 md:px-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <span className="text-primary">&gt;</span>
          <span>{title}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums md:text-[28px]">
          {fmtCurrency(totalValue, currency)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </header>

      {loading ? (
        <div className="grid h-[260px] place-items-center px-5 text-sm text-muted-foreground">
          {loadingLabel}
        </div>
      ) : rows.length === 0 ? (
        <div className="grid h-[260px] place-items-center px-5 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="h-[260px] px-2 pb-3 md:h-[300px] md:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 4, left: 8 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                tickFormatter={(value: string) => abbreviate(value)}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)", fillOpacity: 0.3 }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  color: "var(--color-popover-foreground)",
                  fontSize: 11,
                }}
                labelStyle={{ color: "var(--color-popover-foreground)" }}
                itemStyle={{ color: "var(--color-popover-foreground)" }}
                formatter={(value: number) => fmtCurrency(value, currency)}
              />
              <Bar dataKey="value" radius={[4, 4, 1, 1]} animationDuration={800}>
                {rows.map((row, index) => (
                  <Cell key={row.name} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function buildAnalyticsModel(
  rows: PortfolioSnapshotRow[],
  scopeKey: string,
  range: InsightsRange,
  currency: SnapshotCurrency,
) {
  const scopedRows = rows
    .filter(isCompletePortfolioSnapshot)
    .filter((row) => row.scope_key === scopeKey)
    .slice()
    .sort((left, right) => left.snapshot_date.localeCompare(right.snapshot_date));
  const points = scopedRows.map<AnalyticsPoint>((row, index) => {
    const totalValue = snapshotMetric(row, currency, "market");
    const previousValue =
      index > 0 ? snapshotMetric(scopedRows[index - 1], currency, "market") : totalValue;
    return {
      date: row.snapshot_date,
      totalValue,
      costBasis: snapshotMetric(row, currency, "cost"),
      unrealized: snapshotMetric(row, currency, "unrealized"),
      dailyEarnings: totalValue - previousValue,
      performance: 0,
      profitLoss: 0,
    };
  });
  const rangeConfig = RANGES.find((item) => item.key === range) ?? RANGES[1];
  const rangedPoints = filterRange(points, rangeConfig.days);
  const firstValue = rangedPoints[0]?.totalValue ?? 0;
  const firstUnrealized = rangedPoints[0]?.unrealized ?? 0;
  const derivedPoints = rangedPoints.map((point) => ({
    ...point,
    performance: firstValue ? ((point.totalValue - firstValue) / firstValue) * 100 : 0,
    profitLoss: point.unrealized - firstUnrealized,
  }));
  const latest = derivedPoints.at(-1) ?? null;
  const change = latest ? latest.totalValue - firstValue : 0;
  return {
    points: derivedPoints,
    latest,
    change,
    changePct: firstValue ? (change / firstValue) * 100 : 0,
  };
}

function buildTopAllocations(
  rows: RowWithNative[],
  convertTo: (amount: number, from: string, to: string) => number,
  currency: SnapshotCurrency,
) {
  const valuesByTicker = new Map<string, number>();
  for (const row of rows) {
    const value = convertTo(row.marketValue, row._nativeCurrency, currency);
    valuesByTicker.set(row.ticker, (valuesByTicker.get(row.ticker) ?? 0) + value);
  }
  const positions = Array.from(valuesByTicker, ([name, value]) => ({ name, value })).sort(
    (left, right) => right.value - left.value,
  );
  return {
    totalValue: positions.reduce((sum, position) => sum + position.value, 0),
    rows: positions.slice(0, 8),
  };
}

function filterRange(points: AnalyticsPoint[], days: number | null) {
  if (!days || points.length === 0) return points;
  const latestDate = new Date(`${points.at(-1)?.date}T00:00:00`);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoffKey);
}

function snapshotMetric(
  row: PortfolioSnapshotRow,
  currency: SnapshotCurrency,
  metric: "market" | "cost" | "unrealized",
) {
  if (metric === "market") {
    return currency === "EUR" ? row.market_value_eur : row.market_value_usd;
  }
  if (metric === "cost") {
    return currency === "EUR" ? row.cost_basis_eur : row.cost_basis_usd;
  }
  return currency === "EUR" ? row.unrealized_eur : row.unrealized_usd;
}

function abbreviate(value: string) {
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 w-72 max-w-full animate-pulse rounded-md bg-secondary/50" />
      <div className="h-14 animate-pulse rounded-[10px] bg-secondary/50" />
      <div className="h-[390px] animate-pulse rounded-[10px] bg-card" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-[340px] animate-pulse rounded-[10px] bg-card" />
        ))}
      </div>
    </div>
  );
}

function InsightsMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-border bg-card p-12 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-primary">&gt; {title}</div>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
