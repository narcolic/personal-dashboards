import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import {
  PortfolioAnalyticsChart,
  type AnalyticsPoint,
} from "@/routes/_authenticated/portfolio/components/PortfolioAnalyticsChart";
import {
  isCompletePortfolioSnapshot,
  usePortfolioSnapshots,
  type PortfolioSnapshotRow,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioSnapshots";
import {
  type RowWithNative,
  usePortfolioHoldingsView,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";

export const Route = createFileRoute("/_authenticated/portfolio/analytics")({
  component: PortfolioAnalytics,
});

type RangeKey = "1W" | "1M" | "3M" | "1Y" | "ALL";
type SnapshotCurrency = "EUR" | "USD";

const RANGES: Array<{ key: RangeKey; days: number | null }> = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: null },
];

function PortfolioAnalytics() {
  const { t } = useTranslation();
  const snapshotsQ = usePortfolioSnapshots();
  const { allRows, convertTo, quotesQ } = usePortfolioHoldingsView();
  const [range, setRange] = useState<RangeKey>("1M");
  const [currency, setCurrency] = useState<SnapshotCurrency>("EUR");
  const [scopeKey, setScopeKey] = useState("total");

  const model = useMemo(
    () => buildAnalyticsModel(snapshotsQ.data ?? [], scopeKey, range, currency),
    [currency, range, scopeKey, snapshotsQ.data],
  );
  const scopeOptions = useMemo(
    () => buildScopeOptions(snapshotsQ.data ?? [], t("portfolio.all")),
    [snapshotsQ.data, t],
  );
  const topAllocations = useMemo(
    () => buildTopAllocations(allRows, convertTo, currency, scopeKey),
    [allRows, convertTo, currency, scopeKey],
  );

  if (snapshotsQ.isLoading) return <AnalyticsSkeleton />;

  if (snapshotsQ.isError) {
    return (
      <AnalyticsMessage
        title={t("portfolio.analytics.loadError")}
        body={snapshotsQ.error.message}
      />
    );
  }

  if (!model.latest || model.points.length === 0) {
    return (
      <AnalyticsMessage
        title={t("portfolio.analytics.noData")}
        body={t("portfolio.noSnapshotsYet")}
      />
    );
  }

  const tone = model.change < 0 ? "negative" : "positive";
  const formatMoney = (value: number) => fmtCurrency(value, currency);
  const signedChange = `${model.change < 0 ? "−" : "+"}${formatMoney(Math.abs(model.change))}`;
  const selectedScope = scopeOptions.find((option) => option.key === scopeKey);
  const rangeLabel = t("portfolio.analytics.rangePerformance");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary">
            &gt; {t("portfolio.analytics.eyebrow")}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            {t("portfolio.analytics.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
            {t("portfolio.analytics.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="analytics-scope">
            {t("portfolio.portfolio")}
          </label>
          <select
            id="analytics-scope"
            value={scopeKey}
            onChange={(event) => setScopeKey(event.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-[10px] uppercase tracking-[0.14em] outline-none transition-colors hover:border-primary focus:border-primary"
          >
            {scopeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex h-9 rounded-md border border-border bg-card p-0.5">
            {(["EUR", "USD"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCurrency(item)}
                aria-pressed={currency === item}
                className={`rounded px-3 text-[10px] font-semibold tracking-[0.14em] transition-all ${
                  currency === item
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-border/70 bg-card/70 p-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 px-1">
          <span
            className={`text-sm font-bold tabular-nums ${tone === "negative" ? "text-bear" : "text-bull"}`}
          >
            {signedChange}
          </span>
          <span
            className={`text-[10px] tabular-nums ${tone === "negative" ? "text-bear" : "text-bull"}`}
          >
            {model.changePct < 0 ? "▼" : "▲"} {Math.abs(model.changePct).toFixed(2)}%
          </span>
          <span className="hidden truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:inline">
            {selectedScope?.label} · {t("portfolio.analytics.selectedPeriod")}
          </span>
        </div>
        <div className="grid grid-cols-5 rounded-md bg-secondary/45 p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              aria-pressed={range === item.key}
              className={`min-w-12 rounded px-3 py-2 text-[10px] font-bold tracking-[0.08em] transition-all duration-200 ${
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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PortfolioAnalyticsChart
          title={t("portfolio.analytics.totalValue")}
          data={model.points}
          metric="totalValue"
          tone={tone}
          badgeLabel={rangeLabel}
          formatMetric={formatMoney}
          baseline={model.points[0]?.totalValue}
        />
        <PortfolioAnalyticsChart
          title={t("portfolio.analytics.performance")}
          data={model.points}
          metric="performance"
          tone={tone}
          badgeLabel={rangeLabel}
          formatMetric={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`}
          baseline={0}
        />
        <PortfolioAnalyticsChart
          title={t("portfolio.analytics.profitLoss")}
          data={model.points}
          metric="profitLoss"
          tone={tone}
          badgeLabel={rangeLabel}
          formatMetric={formatMoney}
          baseline={0}
        />
        <AllocationPanel
          rows={topAllocations.rows}
          totalValue={topAllocations.totalValue}
          currency={currency}
          subtitle={t("portfolio.analytics.liveTopAllocations", {
            count: topAllocations.rows.length,
            scope: selectedScope?.label ?? t("portfolio.all"),
          })}
          title={t("portfolio.analytics.topAllocations")}
          emptyLabel={t("portfolio.analytics.noAllocation")}
          loading={quotesQ.isLoading}
          loadingLabel={t("common.loading")}
        />
      </div>
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
  ];

  return (
    <section className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
      <header className="px-4 pb-1 pt-4 md:px-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="text-primary">&gt;</span>
          <span>{title}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums md:text-[28px]">
          {fmtCurrency(totalValue, currency)}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{subtitle}</div>
      </header>

      {loading ? (
        <div className="grid h-[260px] place-items-center px-5 text-xs text-muted-foreground md:h-[300px]">
          {loadingLabel}
        </div>
      ) : rows.length === 0 ? (
        <div className="grid h-[260px] place-items-center px-5 text-xs text-muted-foreground md:h-[300px]">
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
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
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
                  fontSize: 10,
                }}
                labelStyle={{ color: "var(--color-popover-foreground)" }}
                itemStyle={{ color: "var(--color-popover-foreground)" }}
                wrapperStyle={{ color: "var(--color-popover-foreground)" }}
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
  range: RangeKey,
  currency: SnapshotCurrency,
) {
  const validRows = rows.filter(isCompletePortfolioSnapshot);
  const scopedRows = validRows
    .filter((row) => row.scope_key === scopeKey)
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
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
  scopeKey: string,
) {
  const portfolioId = scopeKey.startsWith("portfolio:")
    ? scopeKey.slice("portfolio:".length)
    : null;
  const valuesByTicker = new Map<string, number>();

  for (const row of rows) {
    if (portfolioId === "unassigned" && row.portfolio_id) continue;
    if (portfolioId && portfolioId !== "unassigned" && row.portfolio_id !== portfolioId) continue;

    const value = convertTo(row.marketValue, row._nativeCurrency, currency);
    valuesByTicker.set(row.ticker, (valuesByTicker.get(row.ticker) ?? 0) + value);
  }

  const positions = Array.from(valuesByTicker, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
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

function buildScopeOptions(rows: PortfolioSnapshotRow[], allLabel: string) {
  const portfolios = new Map<string, string>();
  for (const row of rows) {
    if (row.scope !== "portfolio" || !isCompletePortfolioSnapshot(row)) continue;
    portfolios.set(row.scope_key, row.portfolio_name ?? "Unassigned");
  }
  return [
    { key: "total", label: allLabel },
    ...Array.from(portfolios, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  ];
}

function abbreviate(value: string) {
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 w-72 animate-pulse rounded-md bg-secondary/50" />
      <div className="h-14 animate-pulse rounded-[10px] bg-secondary/50" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[390px] animate-pulse rounded-[10px] bg-card" />
        ))}
      </div>
    </div>
  );
}

function AnalyticsMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-border bg-card p-12 text-center">
      <div className="text-xs uppercase tracking-[0.22em] text-primary">&gt; {title}</div>
      <p className="mt-3 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
