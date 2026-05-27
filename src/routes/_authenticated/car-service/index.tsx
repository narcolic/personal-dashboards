import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CarServiceKpiCard } from "@/routes/_authenticated/car-service/components/CarServiceKpiCard";
import { VehicleFilterBar } from "@/routes/_authenticated/car-service/components/VehicleFilterBar";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import {
  formatCurrency,
  formatDate,
  formatKm,
  getCostThisYear,
  getLastVisit,
  getTotalLifetimeCost,
  getTotalVisits,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/")({
  component: CarServiceOverview,
});

function CarServiceOverview() {
  const { t } = useTranslation();
  const { vehicles } = useVehicles();
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const { visits, isLoading, error } = useCarServiceData(selectedVehicleId);

  const totalLifetimeCost = getTotalLifetimeCost(visits);
  const costThisYear = getCostThisYear(visits);
  const lastVisit = getLastVisit(visits);
  const totalVisits = getTotalVisits(visits);
  const recentVisits = visits.slice(0, 3);

  return (
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("car.overview")}
        </div>
      </div>

      <VehicleFilterBar
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelect={setSelectedVehicleId}
      />

      {error ? (
        <div className="border border-border bg-card px-4 py-2 text-[11px] text-bear uppercase tracking-[0.2em]">
          {t("car.error")}: {error}
        </div>
      ) : null}

      <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${isLoading ? "opacity-70" : ""}`}>
        <CarServiceKpiCard
          label={t("car.totalLifetimeCost")}
          value={isLoading ? "..." : formatCurrency(totalLifetimeCost)}
        />
        <CarServiceKpiCard
          label={t("car.costThisYear")}
          value={isLoading ? "..." : formatCurrency(costThisYear)}
        />
        <CarServiceKpiCard
          label={t("car.lastServiceDate")}
          value={isLoading ? "..." : lastVisit ? formatDate(lastVisit.service_date) : "--"}
        />
        <CarServiceKpiCard label={t("car.totalVisits")} value={isLoading ? "..." : String(totalVisits)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="border border-border bg-card">
          <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("car.recentVisits")}
          </div>
          <div className="p-4 text-[11px] text-muted-foreground space-y-2">
            {isLoading ? (
              <>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>...</span>
                  <span>...</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>...</span>
                  <span>...</span>
                </div>
                <div className="flex justify-between">
                  <span>...</span>
                  <span>...</span>
                </div>
              </>
            ) : recentVisits.length === 0 ? (
              <div className="text-center uppercase tracking-[0.2em] py-2">
                {t("car.noServiceRecords")}
              </div>
            ) : (
              recentVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between border-b border-border pb-2 last:border-b-0 last:pb-0"
                >
                  <span>
                    {formatDate(visit.service_date)} | {formatKm(visit.odometer_km)}
                  </span>
                  <span className="text-right">
                    {formatCurrency(Number(visit.total_amount))} | {visit.jobs.length} {t("car.jobs")}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="border border-border bg-card">
          <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("car.upcomingReminders")}
          </div>
          <div className="p-4 text-[11px] text-muted-foreground space-y-2">
            <div className="border-b border-border pb-2">--</div>
            <div className="border-b border-border pb-2">--</div>
            <div>--</div>
          </div>
        </section>
      </div>
    </div>
  );
}
