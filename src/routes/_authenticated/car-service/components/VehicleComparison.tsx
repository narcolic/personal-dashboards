import { useTranslation } from "react-i18next";
import type { Vehicle } from "@/routes/_authenticated/car-service/types";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

type Comparison = {
  vehicleId: string;
  visitCount: number;
  totalSpend: number;
  averageVisitCost: number;
  costPer1000Km: number | null;
};

export function VehicleComparison({
  vehicles,
  comparisons,
}: {
  vehicles: Vehicle[];
  comparisons: Comparison[];
}) {
  const { t } = useTranslation();
  const byVehicle = new Map(comparisons.map((comparison) => [comparison.vehicleId, comparison]));
  const rows = vehicles.slice(0, 2).map((vehicle) => ({
    vehicle,
    comparison: byVehicle.get(vehicle.id) ?? {
      vehicleId: vehicle.id,
      visitCount: 0,
      totalSpend: 0,
      averageVisitCost: 0,
      costPer1000Km: null,
    },
  }));

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-[0_22px_60px_-45px_rgba(0,0,0,0.8)]">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("car.analyticsModern.vehicleComparison")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("car.analyticsModern.vehicleComparisonDescription")}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-border/50">
        {rows.map(({ vehicle }, index) => (
          <div
            key={vehicle.id}
            className={`px-4 py-4 ${index > 0 ? "border-l border-border/50" : ""}`}
          >
            <div className="truncate text-sm font-semibold text-foreground">
              {vehicle.make ?? "—"} {vehicle.model ?? ""}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {vehicle.plate ?? vehicle.year ?? "—"}
            </div>
          </div>
        ))}
        <ComparisonRow
          label={t("car.analyticsModern.totalSpend")}
          values={rows.map(({ comparison }) => formatCurrency(comparison.totalSpend))}
        />
        <ComparisonRow
          label={t("car.totalVisits")}
          values={rows.map(({ comparison }) => String(comparison.visitCount))}
        />
        <ComparisonRow
          label={t("car.avgCostPerVisit")}
          values={rows.map(({ comparison }) => formatCurrency(comparison.averageVisitCost))}
        />
        <ComparisonRow
          label={t("car.costPer1000km")}
          values={rows.map(({ comparison }) =>
            comparison.costPer1000Km === null ? "—" : formatCurrency(comparison.costPer1000Km),
          )}
        />
      </div>
    </section>
  );
}

function ComparisonRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)] border-t border-border/50 text-xs">
      <div className="px-3 py-3 text-muted-foreground">{label}</div>
      {values.map((value, index) => (
        <div
          key={`${label}-${index}`}
          className="border-l border-border/50 px-3 py-3 text-right font-semibold tabular-nums text-foreground"
        >
          {value}
        </div>
      ))}
    </div>
  );
}
