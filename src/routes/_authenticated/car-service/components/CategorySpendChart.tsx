import { ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

export function CategorySpendChart({ data }: { data: { category: string; total: number }[] }) {
  return (
    <section className="border border-border bg-card p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        SPEND BY CATEGORY
      </div>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
            <YAxis
              type="category"
              dataKey="category"
              width={90}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
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
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar dataKey="total" fill="var(--color-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
