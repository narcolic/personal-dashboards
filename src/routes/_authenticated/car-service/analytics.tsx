import { createFileRoute, Link } from "@tanstack/react-router";
import { CarServiceKpiCard } from "@/routes/_authenticated/car-service/components/CarServiceKpiCard";
import { ServiceAnalyticsPanel } from "@/routes/_authenticated/car-service/components/ServiceAnalyticsPanel";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
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

export const Route = createFileRoute("/_authenticated/car-service/analytics")({
  component: CarServiceAnalytics,
});

function CarServiceAnalytics() {
  const { t } = useTranslation();
  const { selectedVehicleId } = useCarServiceWorkspace();
  const { visits, isLoading, error } = useCarService(selectedVehicleId);

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
    <div className="space-y-6 font-mono">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-destructive">
          {t("car.error")}: {error}
        </div>
      ) : null}

      {isLoading ? (
        <AnalyticsLoadingSkeleton />
      ) : visits.length === 0 ? (
        <div className="analytics-panel rounded-[10px] border border-border/70 bg-card/70 p-10 text-center shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {t("car.noDataYet")}
          </div>
          <Link
            to="/car-service/add"
            className="mt-4 inline-flex rounded-md border border-primary/35 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-primary hover:bg-primary/10"
          >
            {t("car.goToAddService")}
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="analytics-summary-heading">
            <h1
              id="analytics-summary-heading"
              className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              <span className="text-primary">&gt;</span>
              <span>{t("car.serviceInsights")}</span>
            </h1>
            <div className="analytics-panel grid grid-cols-2 overflow-hidden rounded-[10px] border border-border/70 bg-card/70 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] md:grid-cols-4">
              <CarServiceKpiCard
                label={t("car.avgCostPerVisit")}
                value={formatCurrency(avgVisitCost)}
              />
              <CarServiceKpiCard
                label={t("car.avgKmBetween")}
                value={avgKmInterval === null ? "--" : formatKm(Math.round(avgKmInterval))}
              />
              <CarServiceKpiCard
                label={t("car.costPer1000km")}
                value={costPer1000km === null ? "--" : formatCurrency(costPer1000km)}
              />
              <CarServiceKpiCard
                label={t("car.mostExpensiveVisit")}
                value={
                  mostExpensiveVisit
                    ? `${formatDate(mostExpensiveVisit.service_date)} ${formatCurrency(Number(mostExpensiveVisit.total_amount))}`
                    : "--"
                }
              />
            </div>
          </section>
          <ServiceAnalyticsPanel
            annualSpend={annualSpend}
            categorySpend={categorySpend}
            topJobs={topJobs}
          />
        </>
      )}
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-border/70 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 border-l border-border/50 bg-card/70 animate-pulse first:border-l-0"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-[10px] border border-border/70 bg-card/70 animate-pulse" />
        <div className="h-64 rounded-[10px] border border-border/70 bg-card/70 animate-pulse" />
      </div>
      <div className="h-64 rounded-[10px] border border-border/70 bg-card/70 animate-pulse" />
    </div>
  );
}
