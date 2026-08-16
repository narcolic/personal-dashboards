import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

type TrendPoint = {
  bucketStart: string;
  total: number;
  previousTotal: number | null;
};

type ChartMouseState = {
  activePayload?: Array<{ payload?: TrendPoint }>;
};

export function SpendTrendChart({ data }: { data: TrendPoint[] }) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<TrendPoint | null>(null);
  const display = hovered ?? data.at(-1) ?? null;
  const hasComparison = data.some((point) => point.previousTotal !== null);
  const formatter = new Intl.DateTimeFormat(i18n.language === "el" ? "el-GR" : "en-GB", {
    month: "short",
    year: "2-digit",
  });
  const formatBucket = (value: string) => formatter.format(new Date(`${value}T00:00:00`));

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_22px_60px_-45px_rgba(0,0,0,0.8)]">
      <header className="flex min-h-24 flex-col justify-between gap-4 px-5 pb-2 pt-5 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("car.analyticsModern.spendTrend")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("car.analyticsModern.spendTrendDescription")}
          </p>
        </div>
        <div className="text-left sm:text-right" aria-live="polite">
          <div className="text-xl font-semibold tabular-nums text-foreground">
            {formatCurrency(display?.total ?? 0)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {display ? formatBucket(display.bucketStart) : t("common.noData")}
          </div>
        </div>
      </header>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center px-5 text-sm text-muted-foreground">
          {t("car.analyticsModern.noTrendData")}
        </div>
      ) : (
        <div className="h-72 w-full px-2 pb-3 sm:h-80 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 22, right: 12, bottom: 4, left: 12 }}
              onMouseMove={(state: ChartMouseState) =>
                setHovered(state.activePayload?.[0]?.payload ?? null)
              }
              onMouseLeave={() => setHovered(null)}
            >
              <defs>
                <linearGradient id="service-spend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.015} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="2 7"
                strokeOpacity={0.42}
              />
              <XAxis
                dataKey="bucketStart"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickFormatter={formatBucket}
              />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip content={() => null} cursor={{ stroke: "var(--color-border)" }} />
              {hasComparison ? (
                <Line
                  type="monotone"
                  dataKey="previousTotal"
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="5 6"
                  dot={false}
                  connectNulls
                  animationDuration={500}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#service-spend-fill)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "var(--color-primary)",
                  stroke: "var(--color-card)",
                  strokeWidth: 3,
                }}
                animationDuration={650}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-t border-border/50 px-5 py-3 text-xs text-muted-foreground">
        <LegendDot className="bg-primary" label={t("car.analyticsModern.selectedPeriod")} />
        {hasComparison ? (
          <LegendDot
            className="bg-muted-foreground"
            label={t("car.analyticsModern.previousPeriod")}
          />
        ) : null}
      </div>
      <ul className="sr-only">
        {data.map((point) => (
          <li key={point.bucketStart}>
            {formatBucket(point.bucketStart)}: {formatCurrency(point.total)}.
            {point.previousTotal === null
              ? ""
              : ` ${t("car.analyticsModern.previousPeriod")}: ${formatCurrency(point.previousTotal)}.`}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}
