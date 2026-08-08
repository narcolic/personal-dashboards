import { ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

export function AnnualSpendChart({ data }: { data: { year: string; total: number }[] }) {
  const { t } = useTranslation();

  return (
    <section className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/70 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] md:p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {t("car.analyticsLabels.annualSpend")}
      </div>
      <div className="h-48 md:h-56">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
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
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar dataKey="total" fill="var(--color-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
