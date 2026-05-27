import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CarServiceKpiCard } from "@/routes/_authenticated/car-service/components/CarServiceKpiCard";
import { ServiceAnalyticsPanel } from "@/routes/_authenticated/car-service/components/ServiceAnalyticsPanel";
import { VehicleFilterBar } from "@/routes/_authenticated/car-service/components/VehicleFilterBar";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import {
  formatCurrency,
  formatDate,
  formatKm,
  getAnnualSpend,
  getAverageKmInterval,
  getAverageVisitCost,
  getCostPer1000km,
  getJobFrequency,
  getMostExpensiveVisit,
  getSpendByCategory,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/analytics")({ component: CarServiceAnalytics });

function CarServiceAnalytics() {
  const { t } = useTranslation();
  const { vehicles } = useVehicles();
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const { visits, isLoading, error } = useCarServiceData(selectedVehicleId);

  const annualSpend = getAnnualSpend(visits);
  const categorySpend = getSpendByCategory(visits);
  const jobFrequency = getJobFrequency(visits);
  const avgVisitCost = getAverageVisitCost(visits);
  const avgKmInterval = getAverageKmInterval(visits);
  const mostExpensiveVisit = getMostExpensiveVisit(visits);
  const costPer1000km = getCostPer1000km(visits);

  const topJobs = jobFrequency.map((item) => {
    let totalSpent = 0;
    for (const visit of visits) {
      for (const job of visit.jobs) {
        if (job.job_name_snapshot.trim() === item.jobName) {
          totalSpent += Number(job.line_total_ex_vat ?? 0) * (1 + Number(visit.vat_rate ?? 0));
        }
      }
    }
    return { ...item, totalSpent };
  });

  return (
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2"><div className="text-[11px] uppercase tracking-[0.2em] text-primary">{t("car.analytics")}</div></div>
      <VehicleFilterBar vehicles={vehicles} selectedVehicleId={selectedVehicleId} onSelect={setSelectedVehicleId} />

      {error ? <div className="border border-border bg-card px-4 py-2 text-[11px] text-destructive uppercase tracking-[0.2em]">{t("car.error")}: {error}</div> : null}

      {isLoading ? <AnalyticsLoadingSkeleton /> : visits.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("car.noDataYet")}</div>
          <Link to="/car-service/add" className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] text-primary hover:underline">{t("car.goToAddService")}</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CarServiceKpiCard label={t("car.avgCostPerVisit")} value={formatCurrency(avgVisitCost)} />
            <CarServiceKpiCard label={t("car.avgKmBetween")} value={avgKmInterval === null ? "--" : formatKm(Math.round(avgKmInterval))} />
            <CarServiceKpiCard label={t("car.costPer1000km")} value={costPer1000km === null ? "--" : formatCurrency(costPer1000km)} />
            <CarServiceKpiCard label={t("car.mostExpensiveVisit")} value={mostExpensiveVisit ? `${formatDate(mostExpensiveVisit.service_date)} ${formatCurrency(Number(mostExpensiveVisit.total_amount))}` : "--"} />
          </div>
          <ServiceAnalyticsPanel annualSpend={annualSpend} categorySpend={categorySpend} topJobs={topJobs} />
        </>
      )}
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-20 border border-border bg-card animate-pulse" />))}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div className="h-72 border border-border bg-card animate-pulse" /><div className="h-72 border border-border bg-card animate-pulse" /></div>
      <div className="h-72 border border-border bg-card animate-pulse" />
    </div>
  );
}
