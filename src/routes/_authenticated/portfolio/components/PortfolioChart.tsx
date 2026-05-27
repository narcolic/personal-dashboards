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
  "#a78bfa",
  "#f59e0b",
];

export function PortfolioChart({
  title,
  data,
  total,
  chart,
  display,
  formatter,
}: {
  title: string;
  data: { name: string; value: number }[];
  total: number;
  chart: "pie" | "bar";
  display: string;
  formatter?: (value: number, name: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <TerminalCard title={title}>
      {data.length === 0 ? (
        <div className="text-muted-foreground text-xs">{t("common.noData")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-48">
            <ResponsiveContainer>
              {chart === "pie" ? (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={80}
                    stroke="var(--color-background)"
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
                    formatter={(v: number) => fmtCurrency(v, display)}
                  />
                </PieChart>
              ) : (
                <BarChart data={data}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      fontSize: 11,
                    }}
                    wrapperStyle={{ color: "var(--color-foreground)" }}
                    labelStyle={{ color: "var(--color-foreground)" }}
                    itemStyle={{ color: "var(--color-foreground)" }}
                    formatter={(v: number) => fmtCurrency(v, display)}
                  />
                  <Bar dataKey="value">
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
              const pct = total ? (d.value / total) * 100 : 0;
              return (
                <div
                  key={d.name}
                  className="flex items-center justify-between border-b border-border/40 py-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="uppercase text-[11px]">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <div>
                      {formatter ? formatter(d.value, d.name) : fmtCurrency(d.value, display)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </TerminalCard>
  );
}
