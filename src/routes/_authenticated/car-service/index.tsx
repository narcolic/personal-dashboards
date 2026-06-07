import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CarServiceKpiCard } from "@/routes/_authenticated/car-service/components/CarServiceKpiCard";
import { VehicleFilterBar } from "@/routes/_authenticated/car-service/components/VehicleFilterBar";
import { ReminderStatusBadge } from "@/routes/_authenticated/car-service/components/ReminderStatusBadge";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import { parseVehicleMeta } from "@/routes/_authenticated/car-service/hooks/useVehicleMutations";
import { useAllReminders } from "@/routes/_authenticated/car-service/hooks/useReminders";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import {
  computeAnnualServiceStatus,
  formatCurrency,
  formatDate,
  formatKm,
  getCostThisYear,
  getLastVisit,
  getTotalLifetimeCost,
  getTotalVisits,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/car-service/")({
  component: CarServiceOverview,
});

function CarServiceOverview() {
  const { t } = useTranslation();
  const { vehicles } = useVehicles();
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const { visits, isLoading, error } = useCarServiceData(selectedVehicleId);
  const { serviceReminders, manualReminders } = useAllReminders();

  const totalLifetimeCost = getTotalLifetimeCost(visits);
  const costThisYear = getCostThisYear(visits);
  const lastVisit = getLastVisit(visits);
  const totalVisits = getTotalVisits(visits);
  const recentVisits = visits.slice(0, 3);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const nowMs = useMemo(() => new Date().getTime(), []);
  const visibleVehicles =
    selectedVehicleId === "all"
      ? vehicles
      : vehicles.filter((vehicle) => vehicle.id === selectedVehicleId);
  const annualServiceItems = visibleVehicles.map((vehicle) => {
    const meta = parseVehicleMeta(vehicle.name);
    const vehicleVisits = visits.filter((visit) => visit.vehicle_id === vehicle.id);
    const currentKm = vehicleVisits.reduce(
      (max, visit) => Math.max(max, Number(visit.odometer_km)),
      0,
    );
    const status = computeAnnualServiceStatus(
      vehicleVisits,
      currentKm,
      meta.annualServiceIntervalKm,
      meta.annualServiceIntervalMonths,
    );

    return {
      type: "annual-service" as const,
      status: status.status,
      vehicleId: vehicle.id,
      title: t("car.annualServiceReminderTitle"),
      dueInfo:
        status.daysRemaining != null
          ? t("car.daysRemaining", { count: status.daysRemaining })
          : status.kmRemaining != null
            ? t("car.kmRemaining", { count: status.kmRemaining })
            : "--",
      urgency:
        status.status === "OVERDUE"
          ? 0
          : status.status === "DUE SOON"
            ? 1
            : status.status === "OK"
              ? 3
              : 4,
      dateSort:
        status.daysRemaining != null
          ? nowMs + status.daysRemaining * 24 * 60 * 60 * 1000
          : Number.MAX_SAFE_INTEGER,
    };
  });
  const upcomingItems = [
    ...annualServiceItems,
    ...serviceReminders.map((item) => ({
      type: "service" as const,
      status: item.status,
      vehicleId: item.vehicle_id,
      title: item.job_name,
      dueInfo:
        item.daysRemaining != null
          ? t("car.daysRemaining", { count: item.daysRemaining })
          : item.kmRemaining != null
            ? t("car.kmRemaining", { count: item.kmRemaining })
            : "--",
      urgency:
        item.status === "OVERDUE"
          ? 0
          : item.status === "DUE SOON"
            ? 1
            : item.status === "OK"
              ? 3
              : 4,
      dateSort:
        item.daysRemaining != null
          ? nowMs + item.daysRemaining * 24 * 60 * 60 * 1000
          : Number.MAX_SAFE_INTEGER,
    })),
    ...manualReminders.map((item) => ({
      type: "manual" as const,
      status: "DUE SOON" as const,
      vehicleId: item.vehicle_id,
      title: item.title,
      dueInfo: item.due_date ? t("car.dueDateLabel", { date: item.due_date }) : t("car.noDueDate"),
      urgency: 2,
      dateSort: item.due_date ? new Date(item.due_date).getTime() : Number.MAX_SAFE_INTEGER,
    })),
  ]
    .sort((a, b) => a.dateSort - b.dateSort || a.urgency - b.urgency)
    .slice(0, 5);

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
        <CarServiceKpiCard
          label={t("car.totalVisits")}
          value={isLoading ? "..." : String(totalVisits)}
        />
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
                <Link
                  key={visit.id}
                  to={`/car-service/history?visitId=${visit.id}`}
                  className="flex items-center justify-between border-b border-border pb-2 last:border-b-0 last:pb-0"
                >
                  <span>
                    {formatDate(visit.service_date)} | {formatKm(visit.odometer_km)}
                  </span>
                  <span className="text-right">
                    {formatCurrency(Number(visit.total_amount))} | {visit.jobs.length}{" "}
                    {t("car.jobs")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="border border-border bg-card">
          <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("car.upcomingReminders")}
          </div>
          <div className="p-4 text-[11px] text-muted-foreground space-y-2">
            {upcomingItems.length === 0 ? (
              <div className="uppercase tracking-[0.2em]">{t("common.noData")}</div>
            ) : (
              upcomingItems.map((item, idx) => {
                const vehicle = vehicleById.get(item.vehicleId);
                const vehicleName = `${vehicle?.make ?? "-"} ${vehicle?.model ?? "-"}`
                  .trim()
                  .toUpperCase();
                return (
                  <Link
                    key={`${item.type}-${idx}-${item.title}`}
                    to={`/car-service/vehicles?vehicleId=${item.vehicleId}`}
                    className="flex items-center justify-between border-b border-border pb-2 last:border-b-0 last:pb-0 hover:text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <ReminderStatusBadge status={item.status} />
                      <span className="text-foreground">{vehicleName}</span>
                      <span>{item.title}</span>
                    </div>
                    <span>{item.dueInfo}</span>
                  </Link>
                );
              })
            )}
            <Link
              to="/car-service/vehicles"
              className="inline-block pt-2 text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
            >
              {t("car.manageReminders")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
