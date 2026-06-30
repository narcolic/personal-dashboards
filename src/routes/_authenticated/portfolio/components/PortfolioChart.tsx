import { TerminalCard } from "@/components/terminal/TerminalCard";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
}: {
  title: string;
  data: { name: string; value: number }[];
  total: number;
  chart: "pie" | "bar";
  display: string;
  formatter?: (value: number, name: string) => string;
  onItemClick?: (name: string) => void;
  chartHeight?: number;
}) {
  const { t } = useTranslation();
  const formatValue = (value: number, name: string) =>
    formatter ? formatter(value, name) : fmtCurrency(value, display);
  const formatBreakdown = (value: number, name: string) => {
    const pct = total ? (value / total) * 100 : 0;
    return `${pct.toFixed(1)}% | ${formatValue(value, name)}`;
  };

  return (
    <TerminalCard title={title}>
      {data.length === 0 ? (
        <div className="text-muted-foreground text-xs">{t("common.noData")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] md:items-center">
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer>
              {chart === "pie" ? (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={80}
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
              ) : (
                <BarChart data={data}>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-16}
                    textAnchor="end"
                    height={52}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    width={72}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
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
                  <Bar
                    dataKey="value"
                    onClick={onItemClick ? (item) => onItemClick(String(item.name)) : undefined}
                    cursor={onItemClick ? "pointer" : undefined}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[12px]">
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
                    <span className="min-w-0 flex-1 text-[12px] uppercase leading-tight text-foreground/90">
                      {d.name}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-[11px] tabular-nums">
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
