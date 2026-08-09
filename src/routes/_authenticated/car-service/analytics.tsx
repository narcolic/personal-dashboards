import { createFileRoute, Link } from "@tanstack/react-router";
import { CarServiceKpiCard } from "@/routes/_authenticated/car-service/components/CarServiceKpiCard";
import { ServiceAnalyticsPanel } from "@/routes/_authenticated/car-service/components/ServiceAnalyticsPanel";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import { useCarServiceAnalytics } from "@/routes/_authenticated/car-service/hooks/useCarServiceAnalytics";
import {
  formatCurrency,
  formatDate,
  formatKm,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/analytics")({
  component: CarServiceAnalytics,
});

function CarServiceAnalytics() {
  const { t } = useTranslation();
  const { selectedVehicleId } = useCarServiceWorkspace();
  const { analytics, isLoading, error } = useCarServiceAnalytics(selectedVehicleId);

  return (
    <div className="space-y-6 font-mono">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-destructive">
          {t("car.error")}: {error}
        </div>
      ) : null}

      {isLoading ? (
        <AnalyticsLoadingSkeleton />
      ) : !analytics || analytics.visitCount === 0 ? (
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
                value={formatCurrency(analytics.averageVisitCost)}
              />
              <CarServiceKpiCard
                label={t("car.avgKmBetween")}
                value={
                  analytics.averageKmInterval === null
                    ? "--"
                    : formatKm(Math.round(analytics.averageKmInterval))
                }
              />
              <CarServiceKpiCard
                label={t("car.costPer1000km")}
                value={
                  analytics.costPer1000Km === null ? "--" : formatCurrency(analytics.costPer1000Km)
                }
              />
              <CarServiceKpiCard
                label={t("car.mostExpensiveVisit")}
                value={
                  analytics.mostExpensiveVisit
                    ? `${formatDate(analytics.mostExpensiveVisit.serviceDate)} ${formatCurrency(analytics.mostExpensiveVisit.totalAmount)}`
                    : "--"
                }
              />
            </div>
          </section>
          <ServiceAnalyticsPanel
            annualSpend={analytics.annualSpend}
            categorySpend={analytics.categorySpend}
            topJobs={analytics.topJobs}
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
