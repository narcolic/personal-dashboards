import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  formatCurrency,
  formatDate,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";

type Visit = {
  id: string;
  vehicleId: string;
  serviceDate: string;
  workshop: string | null;
  totalAmount: number;
};

export function HighestCostVisits({
  visits,
  vehicleNames,
}: {
  visits: Visit[];
  vehicleNames: Map<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-[0_22px_60px_-45px_rgba(0,0,0,0.8)]">
      <h2 className="text-sm font-semibold text-foreground">
        {t("car.analyticsModern.highestCostVisits")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("car.analyticsModern.highestCostVisitsDescription")}
      </p>

      {visits.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center text-center text-sm text-muted-foreground">
          {t("car.analyticsModern.noVisitData")}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border/50">
          {visits.map((visit, index) => (
            <Link
              key={visit.id}
              to="/car-service/history"
              search={{ vehicleId: visit.vehicleId, visitId: visit.id }}
              className="group -mx-2 flex items-center justify-between gap-4 rounded-xl px-2 py-4 outline-none hover:bg-secondary/30 focus-visible:bg-secondary/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {visit.workshop || t("car.analyticsModern.unknownWorkshop")}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {formatDate(visit.serviceDate)} · {vehicleNames.get(visit.vehicleId) ?? "—"}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(visit.totalAmount)}
                </div>
                <div className="mt-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {t("car.analyticsModern.viewVisit")} →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
