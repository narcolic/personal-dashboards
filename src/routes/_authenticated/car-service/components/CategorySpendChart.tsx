import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

type CategorySpend = { category: string; total: number };

export function CategorySpendChart({ data }: { data: CategorySpend[] }) {
  const { t } = useTranslation();
  const rows = data.slice(0, 6);
  const total = data.reduce((sum, item) => sum + item.total, 0);
  const highest = rows[0]?.total ?? 0;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-[0_22px_60px_-45px_rgba(0,0,0,0.8)]">
      <h2 className="text-sm font-semibold text-foreground">
        {t("car.analyticsModern.costDrivers")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("car.analyticsModern.costDriversDescription")}
      </p>

      {rows.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center text-center text-sm text-muted-foreground">
          {t("car.analyticsModern.noCategoryData")}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((row, index) => {
            const share = total > 0 ? (row.total / total) * 100 : 0;
            const width = highest > 0 ? (row.total / highest) * 100 : 0;
            return (
              <Link
                key={row.category}
                to="/car-service/history"
                search={{ category: row.category }}
                className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={t("car.analyticsModern.viewCategoryHistory", {
                  category: row.category,
                })}
              >
                <div className="mb-2 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <span className="mr-2 text-xs font-medium text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {row.category}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(row.total)}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {share.toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 group-hover:bg-primary/80"
                    style={{ width: `${Math.max(width, 3)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
