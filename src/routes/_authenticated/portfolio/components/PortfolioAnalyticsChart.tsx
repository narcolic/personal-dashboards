import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AnalyticsPoint = {
  date: string;
  totalValue: number;
  costBasis: number;
  unrealized: number;
  dailyEarnings: number;
  performance: number;
  profitLoss: number;
};

type MetricKey = "totalValue" | "performance" | "unrealized" | "profitLoss";

type ChartMouseState = {
  activePayload?: Array<{ payload?: AnalyticsPoint }>;
};

export function PortfolioAnalyticsChart({
  title,
  data,
  metric,
  tone,
  badgeLabel,
  formatMetric,
  baseline,
}: {
  title: string;
  data: AnalyticsPoint[];
  metric: MetricKey;
  tone: "positive" | "negative";
  badgeLabel: string;
  formatMetric: (value: number) => string;
  baseline?: number;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<AnalyticsPoint | null>(null);
  const latestPoint = data.at(-1) ?? null;
  const displayPoint = hoveredPoint ?? latestPoint;
  const color = tone === "negative" ? "var(--color-bear)" : "var(--color-bull)";
  const gradientId = `analytics-${metric}-${tone}`;
  const extremes = getMetricExtremes(data, metric);
  const handleMove = (state: ChartMouseState) => {
    setHoveredPoint(state.activePayload?.[0]?.payload ?? null);
  };

  return (
    <section className="analytics-panel group overflow-hidden rounded-[10px] border border-border/70 bg-card shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] transition-colors duration-300 hover:border-border">
      <header className="flex min-h-[90px] items-start justify-between gap-3 px-4 pb-1 pt-4 md:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
            <span className="text-primary">&gt;</span>
            <span>{title}</span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums md:text-[28px]">
            {displayPoint ? formatMetric(displayPoint[metric]) : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {displayPoint ? formatAnalyticsDate(displayPoint.date, true) : "—"}
          </div>
        </div>
        <div
          className={`mt-1 rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em] ${
            tone === "negative"
              ? "border-bear/30 bg-bear/10 text-bear"
              : "border-bull/30 bg-bull/10 text-bull"
          }`}
        >
          {tone === "negative" ? "▼" : "▲"} {badgeLabel}
        </div>
      </header>

      <div className="relative h-[260px] w-full px-1 pb-2 md:h-[300px] md:px-2">
        {extremes ? (
          <div className="pointer-events-none absolute inset-y-0 right-3 z-10 flex flex-col justify-between pb-11 pt-5 md:right-4">
            <span className="rounded bg-secondary/55 px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground/85 shadow-sm backdrop-blur-sm">
              {formatMetric(extremes.high)}
            </span>
            {extremes.low !== extremes.high ? (
              <span className="rounded bg-secondary/55 px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground/85 shadow-sm backdrop-blur-sm">
                {formatMetric(extremes.low)}
              </span>
            ) : null}
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 18, right: 12, bottom: 2, left: 12 }}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="72%" stopColor={color} stopOpacity={0.035} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="2 8"
              strokeOpacity={0.34}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={34}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
              tickFormatter={(date: string) => formatAnalyticsDate(date, false)}
              padding={{ left: 4, right: 4 }}
            />
            <YAxis hide domain={["auto", "auto"]} />
            {baseline !== undefined ? (
              <ReferenceLine
                y={baseline}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="2 6"
                strokeOpacity={0.55}
              />
            ) : null}
            <Tooltip<number, string>
              content={() => null}
              cursor={{ stroke: "var(--color-foreground)", strokeWidth: 1, strokeOpacity: 0.65 }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: color,
                stroke: "var(--color-card)",
                strokeWidth: 3,
                className: "analytics-active-dot",
              }}
              animationDuration={800}
              animationEasing="ease-out"
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function getMetricExtremes(data: AnalyticsPoint[], metric: MetricKey) {
  if (data.length === 0) return null;

  let high = data[0][metric];
  let low = high;
  for (let index = 1; index < data.length; index += 1) {
    const value = data[index][metric];
    if (value > high) high = value;
    if (value < low) low = value;
  }

  return { high, low };
}

function formatAnalyticsDate(value: string, full: boolean) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(
    "en-GB",
    full
      ? { weekday: "short", day: "2-digit", month: "short", year: "numeric" }
      : { day: "2-digit", month: "short" },
  ).format(date);
}
