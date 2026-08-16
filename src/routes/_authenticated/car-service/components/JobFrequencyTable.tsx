import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

type Row = { jobName: string; count: number; totalSpent: number };
type SortMode = "frequency" | "spend";

export function JobFrequencyTable({ rows }: { rows: Row[] }) {
  const { t } = useTranslation();
  const [sortMode, setSortMode] = useState<SortMode>("frequency");
  const sortedRows = useMemo(
    () =>
      [...rows].sort((left, right) =>
        sortMode === "frequency"
          ? right.count - left.count || right.totalSpent - left.totalSpent
          : right.totalSpent - left.totalSpent || right.count - left.count,
      ),
    [rows, sortMode],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_22px_60px_-45px_rgba(0,0,0,0.8)]">
      <header className="flex flex-col gap-4 border-b border-border/50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("car.analyticsModern.topJobs")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("car.analyticsModern.topJobsDescription")}
          </p>
        </div>
        <div
          className="inline-flex self-start rounded-lg bg-secondary/60 p-1"
          role="group"
          aria-label={t("car.analyticsModern.sortJobs")}
        >
          <SortButton active={sortMode === "frequency"} onClick={() => setSortMode("frequency")}>
            {t("car.analyticsModern.frequency")}
          </SortButton>
          <SortButton active={sortMode === "spend"} onClick={() => setSortMode("spend")}>
            {t("car.analyticsModern.spend")}
          </SortButton>
        </div>
      </header>

      {sortedRows.length === 0 ? (
        <div className="flex min-h-44 items-center justify-center px-5 text-sm text-muted-foreground">
          {t("car.analyticsLabels.noJobsData")}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/25 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">#</th>
                  <th className="px-3 py-3 text-left font-medium">
                    {t("car.analyticsLabels.jobTask")}
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    {t("car.analyticsModern.visitsShort")}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {t("car.analyticsModern.totalSpend")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={row.jobName} className="border-t border-border/45">
                    <td className="px-5 py-3 text-xs font-medium tabular-nums text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      <Link
                        to="/car-service/history"
                        search={{ job: row.jobName }}
                        className="rounded-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        {row.jobName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {row.count}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
                      {formatCurrency(row.totalSpent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border/50 sm:hidden">
            {sortedRows.map((row, index) => (
              <Link
                key={row.jobName}
                to="/car-service/history"
                search={{ job: row.jobName }}
                className="flex items-center justify-between gap-4 px-5 py-4 outline-none hover:bg-secondary/25 focus-visible:bg-secondary/35"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    <span className="mr-2 text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {row.jobName}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("car.analyticsModern.performedCount", { count: row.count })}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(row.totalSpent)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
