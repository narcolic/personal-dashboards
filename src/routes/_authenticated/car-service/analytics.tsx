import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ServiceAnalyticsPanel } from "@/routes/_authenticated/car-service/components/ServiceAnalyticsPanel";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import {
  type AnalyticsPeriodKey,
  useCarServiceAnalytics,
} from "@/routes/_authenticated/car-service/hooks/useCarServiceAnalytics";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import {
  formatCurrency,
  formatDate,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";

const PERIODS: AnalyticsPeriodKey[] = ["last12m", "ytd", "last3y", "all"];

export const Route = createFileRoute("/_authenticated/car-service/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    period: PERIODS.includes(search.period as AnalyticsPeriodKey)
      ? (search.period as AnalyticsPeriodKey)
      : ("last12m" as const),
  }),
  component: CarServiceAnalytics,
});

function CarServiceAnalytics() {
  const { t } = useTranslation();
  const navigate = Route.useNavigate();
  const { period } = Route.useSearch();
  const { selectedVehicleId } = useCarServiceWorkspace();
  const { vehicles } = useVehicles();
  const { analytics, isLoading, error, refetch } = useCarServiceAnalytics(
    selectedVehicleId,
    period,
  );
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const scopeLabel = selectedVehicle
    ? `${selectedVehicle.make ?? "—"} ${selectedVehicle.model ?? ""}`.trim()
    : t("car.allVehicles");
  const hasPeriodAnalytics = Boolean(analytics?.period);

  return (
    <div className="space-y-6 font-[family-name:var(--font-analytics)] sm:space-y-7">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {scopeLabel}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
            {t("car.analyticsModern.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("car.analyticsModern.subtitle")}
          </p>
        </div>

        <PeriodPicker
          value={period}
          onChange={(nextPeriod) =>
            void navigate({ search: { period: nextPeriod }, replace: true })
          }
        />
      </header>

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.06] px-5 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("car.error")}: {error}
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="self-start rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 sm:self-auto"
          >
            {t("car.analyticsModern.retry")}
          </button>
        </div>
      ) : isLoading ? (
        <AnalyticsLoadingSkeleton />
      ) : !analytics || !hasPeriodAnalytics || analytics.visitCount === 0 ? (
        <EmptyAnalytics />
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {analytics.period.startDate
              ? t("car.analyticsModern.dateRange", {
                  from: formatDate(analytics.period.startDate),
                  to: formatDate(analytics.period.endDate),
                })
              : t("car.analyticsModern.allTimeRange", {
                  to: formatDate(analytics.period.endDate),
                })}
          </div>

          <AnalyticsSummary analytics={analytics} />

          <ServiceAnalyticsPanel
            spendTrend={analytics.spendTrend}
            categorySpend={analytics.categorySpend}
            topJobs={analytics.topJobs}
            expensiveVisits={analytics.expensiveVisits}
            vehicleComparison={analytics.vehicleComparison}
            vehicles={vehicles}
            showComparison={selectedVehicleId === "all" && vehicles.length === 2}
          />
        </>
      )}
    </div>
  );
}

function PeriodPicker({
  value,
  onChange,
}: {
  value: AnalyticsPeriodKey;
  onChange: (value: AnalyticsPeriodKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-card/70 p-1 sm:inline-grid sm:grid-cols-4"
      role="group"
      aria-label={t("car.analyticsModern.periodLabel")}
    >
      {PERIODS.map((period) => {
        const active = value === period;
        return (
          <button
            key={period}
            type="button"
            onClick={() => onChange(period)}
            aria-pressed={active}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground"
            }`}
          >
            {t(`car.analyticsModern.periods.${period}`)}
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsSummary({
  analytics,
}: {
  analytics: NonNullable<ReturnType<typeof useCarServiceAnalytics>["analytics"]>;
}) {
  const { t } = useTranslation();
  const change = analytics.period.spendChangePercent;
  const changeTone = change === null || change === 0 ? "neutral" : change > 0 ? "up" : "down";

  return (
    <section
      aria-label={t("car.analyticsModern.summary")}
      className="grid gap-4 lg:grid-cols-[1.25fr_1fr]"
    >
      <article className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary)_14%,var(--color-card)),var(--color-card)_62%)] p-6 shadow-[0_28px_70px_-48px_var(--color-primary)] sm:p-7">
        <div
          className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="text-sm font-medium text-muted-foreground">
            {t("car.analyticsModern.periodSpend")}
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums text-foreground sm:text-5xl">
            {formatCurrency(analytics.period.totalSpend)}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ChangeBadge value={change} tone={changeTone} />
            <span className="text-xs text-muted-foreground">
              {analytics.period.previousTotalSpend === null
                ? t("car.analyticsModern.noPreviousPeriod")
                : t("car.analyticsModern.previousSpend", {
                    amount: formatCurrency(analytics.period.previousTotalSpend),
                  })}
            </span>
          </div>
        </div>
      </article>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <MetricCard
          label={t("car.avgCostPerVisit")}
          value={formatCurrency(analytics.period.averageVisitCost)}
          help={t("car.analyticsModern.avgVisitHelp")}
        />
        <MetricCard
          label={t("car.costPer1000km")}
          value={
            analytics.period.costPer1000Km === null
              ? "—"
              : formatCurrency(analytics.period.costPer1000Km)
          }
          help={
            analytics.period.costPer1000Km === null
              ? t("car.analyticsModern.mileageUnavailable")
              : t("car.analyticsModern.costPerKmHelp")
          }
        />
        <MetricCard
          label={t("car.totalVisits")}
          value={String(analytics.period.visitCount)}
          help={t("car.analyticsModern.visitsHelp")}
        />
      </div>
    </section>
  );
}

function ChangeBadge({ value, tone }: { value: number | null; tone: "neutral" | "up" | "down" }) {
  const { t } = useTranslation();
  const className =
    tone === "up"
      ? "border-bear/25 bg-bear/10 text-bear"
      : tone === "down"
        ? "border-bull/25 bg-bull/10 text-bull"
        : "border-border/60 bg-secondary/55 text-muted-foreground";
  const label =
    value === null
      ? t("car.analyticsModern.noComparison")
      : t("car.analyticsModern.changePercent", {
          value: `${value > 0 ? "+" : ""}${value.toFixed(0)}`,
        });

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function MetricCard({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card/90 px-5 py-4 shadow-[0_18px_50px_-42px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span
          tabIndex={0}
          aria-label={help}
          className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border/80 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          ?
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border/70 bg-popover px-3 py-2 text-left text-xs font-normal leading-5 text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus:opacity-100"
          >
            {help}
          </span>
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.025em] tabular-nums text-foreground">
        {value}
      </div>
    </article>
  );
}

function EmptyAnalytics() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border/60 bg-card/85 px-6 py-16 text-center shadow-[0_22px_60px_-45px_rgba(0,0,0,0.8)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">
        +
      </div>
      <h2 className="mt-5 text-lg font-semibold text-foreground">
        {t("car.analyticsModern.emptyTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {t("car.analyticsModern.emptyDescription")}
      </p>
      <Link
        to="/car-service/add"
        className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {t("car.goToAddService")}
      </Link>
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="h-48 animate-pulse rounded-2xl border border-border/50 bg-card/70" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border border-border/50 bg-card/70"
            />
          ))}
        </div>
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border/50 bg-card/70" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-border/50 bg-card/70" />
        <div className="h-72 animate-pulse rounded-2xl border border-border/50 bg-card/70" />
      </div>
    </div>
  );
}
