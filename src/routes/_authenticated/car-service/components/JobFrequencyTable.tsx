import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

type Row = {
  jobName: string;
  count: number;
  totalSpent: number;
};

export function JobFrequencyTable({ rows }: { rows: Row[] }) {
  const { t } = useTranslation();

  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("car.analyticsLabels.topJobsByFrequency")}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t("car.analyticsLabels.rank")}</th>
              <th className="px-3 py-2 text-left">{t("car.analyticsLabels.jobTask")}</th>
              <th className="px-3 py-2 text-right">{t("car.analyticsLabels.timesPerformed")}</th>
              <th className="px-3 py-2 text-right">{t("car.analyticsLabels.totalSpentOnJob")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-border/60">
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                  {t("car.analyticsLabels.noJobsData")}
                </td>
              </tr>
            ) : null}
            {rows.map((row, idx) => (
              <tr
                key={`${row.jobName}-${idx}`}
                className="border-t border-border/60 hover:bg-secondary/30"
              >
                <td className="px-3 py-2 font-bold text-primary">{idx + 1}</td>
                <td className="px-3 py-2">{row.jobName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(row.totalSpent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
