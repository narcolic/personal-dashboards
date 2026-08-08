import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ReminderStatusBadge } from "@/routes/_authenticated/car-service/components/ReminderStatusBadge";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
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
  const { selectedVehicleId } = useCarServiceWorkspace();
  const { visits, isLoading, error } = useCarService(selectedVehicleId);
  const { serviceReminders } = useAllReminders();

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
    ...serviceReminders
      .filter((item) => selectedVehicleId === "all" || item.vehicle_id === selectedVehicleId)
      .map((item) => ({
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
  ]
    .sort((a, b) => a.urgency - b.urgency || a.dateSort - b.dateSort)
    .slice(0, 5);
  const nextMaintenance = upcomingItems[0] ?? null;

  return (
    <div className="space-y-8 font-mono">
      {error ? (
        <div className="rounded-lg border border-bear/30 bg-bear/5 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-bear">
          {t("car.error")}: {error}
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="maintenance-heading">
        <SectionHeading id="maintenance-heading">{t("car.nextMaintenance")}</SectionHeading>
        <div className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <div className="relative bg-primary/[0.035] px-5 py-6 text-center md:px-6 md:text-left">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 h-0.5 w-12 -translate-x-1/2 rounded-b bg-primary md:inset-y-5 md:left-0 md:h-auto md:w-0.5 md:translate-x-0 md:rounded-r"
            />
            {isLoading ? (
              <div className="text-xl font-bold text-muted-foreground">...</div>
            ) : nextMaintenance ? (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <ReminderStatusBadge status={nextMaintenance.status} />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {vehicleById.get(nextMaintenance.vehicleId)?.make ?? "-"}{" "}
                    {vehicleById.get(nextMaintenance.vehicleId)?.model ?? "-"}
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground md:text-3xl">
                  {nextMaintenance.title}
                </div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {nextMaintenance.dueInfo}
                </div>
                <Link
                  to="/car-service/vehicles"
                  search={{ vehicleId: nextMaintenance.vehicleId }}
                  className="mt-4 inline-flex rounded-md border border-primary/35 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10"
                >
                  {t("car.manageReminders")}
                </Link>
              </>
            ) : (
              <div className="py-2 text-sm uppercase tracking-[0.14em] text-muted-foreground">
                {t("car.noMaintenanceDue")}
              </div>
            )}
          </div>
          <div className={`grid grid-cols-2 md:grid-cols-4 ${isLoading ? "opacity-70" : ""}`}>
            <OverviewMetric
              label={t("car.costThisYear")}
              value={isLoading ? "..." : formatCurrency(costThisYear)}
            />
            <OverviewMetric
              label={t("car.totalLifetimeCost")}
              value={isLoading ? "..." : formatCurrency(totalLifetimeCost)}
            />
            <OverviewMetric
              label={t("car.lastServiceDate")}
              value={isLoading ? "..." : lastVisit ? formatDate(lastVisit.service_date) : "--"}
            />
            <OverviewMetric
              label={t("car.totalVisits")}
              value={isLoading ? "..." : String(totalVisits)}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/70 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <PanelHeading>{t("car.recentVisits")}</PanelHeading>
          <div className="space-y-1 p-3 text-[11px] text-muted-foreground">
            {isLoading ? (
              <div className="p-3">...</div>
            ) : recentVisits.length === 0 ? (
              <div className="py-4 text-center uppercase tracking-[0.16em]">
                {t("car.noServiceRecords")}
              </div>
            ) : (
              recentVisits.map((visit) => (
                <Link
                  key={visit.id}
                  to={`/car-service/history?visitId=${visit.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/30 hover:text-foreground"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">
                      {formatDate(visit.service_date)}
                    </span>
                    <span className="mt-0.5 block text-[10px]">
                      {formatKm(visit.odometer_km)} · {visit.jobs.length} {t("car.jobs")}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(Number(visit.total_amount))}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/70 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <PanelHeading>{t("car.upcomingReminders")}</PanelHeading>
          <div className="space-y-1 p-3 text-[11px] text-muted-foreground">
            {upcomingItems.length === 0 ? (
              <div className="p-3 uppercase tracking-[0.16em]">{t("common.noData")}</div>
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
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/30 hover:text-foreground"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ReminderStatusBadge status={item.status} />
                      <span className="min-w-0 truncate">
                        <span className="text-foreground">{vehicleName}</span> · {item.title}
                      </span>
                    </div>
                    <span className="text-right text-[10px]">{item.dueInfo}</span>
                  </Link>
                );
              })
            )}
            <Link
              to="/car-service/vehicles"
              className="inline-flex px-3 pt-2 text-[10px] uppercase tracking-[0.16em] text-primary hover:underline"
            >
              {t("car.manageReminders")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h1
      id={id}
      className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
    >
      <span className="text-primary">&gt;</span>
      <span>{children}</span>
    </h1>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-secondary/20 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border/50 px-3 py-4 text-center even:border-l md:border-l md:px-5 md:text-left">
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground md:text-[10px]">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-bold tabular-nums text-foreground md:text-xl">
        {value}
      </div>
    </div>
  );
}
