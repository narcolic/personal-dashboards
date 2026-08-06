import { TerminalCard } from "@/components/terminal/TerminalCard";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "var(--color-primary)",
  "var(--color-bull)",
  "var(--color-amber)",
  "var(--color-chart-5)",
  "var(--color-bear)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];

export function PortfolioChart({
  title,
  data,
  total,
  chart,
  display,
  formatter,
  onItemClick,
  chartHeight = 192,
  pieInnerRadius = 48,
  pieOuterRadius = 84,
}: {
  title: string;
  data: { name: string; value: number }[];
  total: number;
  chart: "pie" | "bar";
  display: string;
  formatter?: (value: number, name: string) => string;
  onItemClick?: (name: string) => void;
  chartHeight?: number;
  pieInnerRadius?: number;
  pieOuterRadius?: number;
}) {
  const { t } = useTranslation();
  const isBarChart = chart === "bar";
  const formatValue = (value: number, name: string) =>
    formatter ? formatter(value, name) : fmtCurrency(value, display);
  const formatBreakdown = (value: number, name: string) => {
    const pct = total ? (value / total) * 100 : 0;
    return `${pct.toFixed(1)}% | ${formatValue(value, name)}`;
  };

  return (
    <TerminalCard title={title} bodyClassName="p-3">
      {data.length === 0 ? (
        <div className="text-muted-foreground text-xs">{t("common.noData")}</div>
      ) : isBarChart ? (
        <div className="space-y-1">
          {data.map((d, i) => {
            const pct = total ? (d.value / total) * 100 : 0;
            return (
              <button
                type="button"
                key={d.name}
                onClick={onItemClick ? () => onItemClick(d.name) : undefined}
                className={`grid w-full grid-cols-1 gap-2 border-b border-border/40 py-2 text-left last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(190px,0.95fr)_minmax(140px,1.15fr)] md:items-center md:gap-3 ${
                  onItemClick ? "cursor-pointer hover:text-primary" : ""
                }`}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1 h-2 w-2 shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="min-w-0 break-words text-[12px] uppercase leading-tight text-foreground/90">
                    {d.name}
                  </span>
                </div>
                <div className="text-xs tabular-nums text-muted-foreground md:text-right">
                  {pct.toFixed(1)}% | {formatValue(d.value, d.name)}
                </div>
                <div className="h-2.5 overflow-hidden border border-border/50 bg-secondary/30">
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      background: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(190px,1.1fr)] md:items-center">
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={pieInnerRadius}
                  outerRadius={pieOuterRadius}
                  stroke="var(--color-background)"
                  onClick={onItemClick ? (item) => onItemClick(item.name) : undefined}
                  cursor={onItemClick ? "pointer" : undefined}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    fontSize: 11,
                  }}
                  wrapperStyle={{ color: "var(--color-foreground)" }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                  itemStyle={{ color: "var(--color-foreground)" }}
                  formatter={(v: number, _label, item) =>
                    formatBreakdown(v, String(item.payload?.name ?? ""))
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-0.5 text-[12px]">
            {data.map((d, i) => {
              return (
                <button
                  type="button"
                  key={d.name}
                  onClick={onItemClick ? () => onItemClick(d.name) : undefined}
                  className={`flex w-full items-center justify-between border-b border-border/40 py-1 text-left ${
                    onItemClick ? "cursor-pointer hover:text-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="min-w-0 flex-1 text-xs uppercase leading-tight text-foreground/90">
                      {d.name}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums">
                    <div>{formatBreakdown(d.value, d.name)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}
