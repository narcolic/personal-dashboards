import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { ServiceHistoryTable } from "@/routes/_authenticated/car-service/components/ServiceHistoryTable";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

const ALL_FILTER_VALUE = "__all__";

export const Route = createFileRoute("/_authenticated/car-service/history")({
  validateSearch: (search: Record<string, unknown>) => ({
    visitId: typeof search.visitId === "string" ? search.visitId : undefined,
    vehicleId: typeof search.vehicleId === "string" ? search.vehicleId : undefined,
    job: typeof search.job === "string" ? search.job : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: CarServiceHistory,
});

function CarServiceHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const { selectedVehicleId, setSelectedVehicleId } = useCarServiceWorkspace();
  const { vehicles } = useVehicles();
  const [persistedContext] = useState(() => {
    try {
      const raw = sessionStorage.getItem("carServiceHistoryContext");
      if (!raw) return null as { vehicleId?: string; visitId?: string } | null;
      return JSON.parse(raw) as { vehicleId?: string; visitId?: string };
    } catch {
      return null;
    }
  });
  const initialExpandedVisitId =
    routeSearch.visitId?.trim() || persistedContext?.visitId?.trim() || null;
  const initialVehicleId =
    routeSearch.vehicleId?.trim() || persistedContext?.vehicleId?.trim() || "all";
  const initialJobFilter = routeSearch.job?.trim() || ALL_FILTER_VALUE;
  const initialCategoryFilter = routeSearch.category?.trim() || ALL_FILTER_VALUE;
  const [userExpandedVisitIds, setUserExpandedVisitIds] = useState<Set<string>>(new Set());
  const [restoredExpandedVisitId, setRestoredExpandedVisitId] = useState(initialExpandedVisitId);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(
    initialJobFilter !== ALL_FILTER_VALUE || initialCategoryFilter !== ALL_FILTER_VALUE,
  );
  const [jobFilter, setJobFilter] = useState(initialJobFilter);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());

  useEffect(() => {
    if (initialVehicleId !== "all") setSelectedVehicleId(initialVehicleId);
    try {
      sessionStorage.removeItem("carServiceHistoryContext");
    } catch {
      // ignore storage failures
    }

    if (!routeSearch.visitId && !routeSearch.vehicleId && !routeSearch.job && !routeSearch.category)
      return;

    void navigate({
      to: "/car-service/history",
      replace: true,
    });
  }, [initialVehicleId, navigate, routeSearch, setSelectedVehicleId]);

  const { visits: allVisits, isLoading, error } = useCarService("all");
  const effectiveSelectedVehicleId = useMemo(() => {
    if (selectedVehicleId !== "all") return selectedVehicleId;
    if (!initialExpandedVisitId) return "all";
    const target = allVisits.find((visit) => visit.id === initialExpandedVisitId);
    return target?.vehicle_id ?? "all";
  }, [allVisits, initialExpandedVisitId, selectedVehicleId]);

  const vehicleNames = useMemo(
    () =>
      new Map(
        vehicles.map((vehicle) => [
          vehicle.id,
          `${vehicle.make ?? "-"} ${vehicle.model ?? "-"}`.trim(),
        ]),
      ),
    [vehicles],
  );
  const scopedVisits = useMemo(() => {
    if (effectiveSelectedVehicleId === "all") return allVisits;
    return allVisits.filter((visit) => visit.vehicle_id === effectiveSelectedVehicleId);
  }, [allVisits, effectiveSelectedVehicleId]);
  const scopedSpend = useMemo(
    () => scopedVisits.reduce((total, visit) => total + Number(visit.total_amount), 0),
    [scopedVisits],
  );
  const jobOptions = useMemo(
    () =>
      Array.from(
        new Set(
          scopedVisits.flatMap((visit) =>
            visit.jobs.map((job) => job.job_name_snapshot.trim()).filter(Boolean),
          ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [scopedVisits],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          scopedVisits.flatMap((visit) =>
            visit.jobs.map((job) => (job.category_snapshot ?? "").trim()).filter(Boolean),
          ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [scopedVisits],
  );
  const searchableVisits = useMemo(
    () =>
      new Map(
        scopedVisits.map((visit) => [
          visit.id,
          [
            vehicleNames.get(visit.vehicle_id),
            visit.workshop,
            visit.notes,
            ...visit.jobs.flatMap((job) => [
              job.job_name_snapshot,
              job.category_snapshot,
              job.notes,
            ]),
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(),
        ]),
      ),
    [scopedVisits, vehicleNames],
  );
  const visits = useMemo(
    () =>
      scopedVisits.filter((visit) => {
        const matchesStructuredFilters = visit.jobs.some((job) => {
          const jobName = job.job_name_snapshot.trim();
          const category = (job.category_snapshot ?? "").trim();
          return (
            (jobFilter === ALL_FILTER_VALUE || jobName === jobFilter) &&
            (categoryFilter === ALL_FILTER_VALUE ||
              category.toLocaleLowerCase() === categoryFilter.toLocaleLowerCase())
          );
        });
        const hasNoStructuredFilters =
          jobFilter === ALL_FILTER_VALUE && categoryFilter === ALL_FILTER_VALUE;
        const matchesSearch =
          !deferredSearch || searchableVisits.get(visit.id)?.includes(deferredSearch);

        return (hasNoStructuredFilters || matchesStructuredFilters) && Boolean(matchesSearch);
      }),
    [categoryFilter, deferredSearch, jobFilter, scopedVisits, searchableVisits],
  );
  const structuredFilterCount =
    Number(jobFilter !== ALL_FILTER_VALUE) + Number(categoryFilter !== ALL_FILTER_VALUE);
  const filtersActive = Boolean(search.trim()) || structuredFilterCount > 0;
  const expandedVisitIds = useMemo(() => {
    const next = new Set(userExpandedVisitIds);
    if (restoredExpandedVisitId && visits.some((visit) => visit.id === restoredExpandedVisitId)) {
      next.add(restoredExpandedVisitId);
    }
    return next;
  }, [restoredExpandedVisitId, userExpandedVisitIds, visits]);
  const allExpanded = visits.length > 0 && visits.every((visit) => expandedVisitIds.has(visit.id));

  const clearFilters = () => {
    setSearch("");
    setJobFilter(ALL_FILTER_VALUE);
    setCategoryFilter(ALL_FILTER_VALUE);
  };

  const toggleExpanded = (visitId: string) => {
    setUserExpandedVisitIds((prev) => {
      const next = new Set(prev);
      const isExpanded = next.has(visitId) || restoredExpandedVisitId === visitId;
      if (isExpanded) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
    if (restoredExpandedVisitId === visitId) {
      setRestoredExpandedVisitId(null);
    }
  };

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setUserExpandedVisitIds(new Set());
      setRestoredExpandedVisitId(null);
      return;
    }

    setUserExpandedVisitIds(new Set(visits.map((visit) => visit.id)));
    setRestoredExpandedVisitId(null);
  };

  return (
    <div className="space-y-6 font-mono">
      <section
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        aria-labelledby="service-history-heading"
      >
        <div>
          <h1
            id="service-history-heading"
            className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span className="text-primary">&gt;</span>
            <span>{t("car.historyTitle")}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>
              {t("car.totalVisits")}:{" "}
              <strong className="font-semibold tabular-nums text-foreground">
                {isLoading ? "..." : scopedVisits.length}
              </strong>
            </span>
            <span className="hidden h-3 w-px bg-border/70 sm:block" aria-hidden="true" />
            <span>
              {t("car.historySpend")}:{" "}
              <strong className="font-semibold tabular-nums text-foreground">
                {isLoading ? "..." : formatCurrency(scopedSpend)}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visits.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllExpanded}
              className="hidden h-10 items-center rounded-lg border border-border/70 bg-card/70 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:inline-flex"
            >
              {allExpanded ? t("car.collapseAll") : t("car.expandAll")}
            </button>
          ) : null}
          <Link
            to="/car-service/add"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            + {t("car.new")}
          </Link>
        </div>
      </section>

      <section className="space-y-3" aria-label={t("car.historyFilters")}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("car.historySearch")}</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-primary"
            >
              &gt;
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("car.historySearchPlaceholder")}
              className="h-10 w-full rounded-lg border border-border/70 bg-card/70 pl-8 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("car.clearSearch")}
                className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                ×
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((visible) => !visible)}
            aria-expanded={showFilters}
            className={`h-10 rounded-lg border px-4 text-xs uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              showFilters || structuredFilterCount
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/70 bg-card/70 text-muted-foreground hover:border-primary/60 hover:text-foreground"
            }`}
          >
            {t("car.filters")} {structuredFilterCount ? `(${structuredFilterCount})` : ""}
          </button>
        </div>

        {showFilters ? (
          <div className="analytics-panel grid grid-cols-1 gap-3 rounded-[10px] border border-border/70 bg-card/70 p-4 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] sm:grid-cols-2">
            <HistoryFilterSelect
              label={t("car.job")}
              value={jobFilter}
              allLabel={t("car.allJobs")}
              options={jobOptions}
              onChange={setJobFilter}
            />
            <HistoryFilterSelect
              label={t("car.category")}
              value={categoryFilter}
              allLabel={t("car.allCategories")}
              options={categoryOptions}
              onChange={setCategoryFilter}
            />
            <div className="flex justify-end sm:col-span-2">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!filtersActive}
                className="rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default disabled:opacity-35"
              >
                {t("car.clearAll")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>
            {t("car.showingVisits", { shown: visits.length, total: scopedVisits.length })}
          </span>
          {filtersActive ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {search.trim() ? (
                <FilterChip label={`“${search.trim()}”`} onClear={() => setSearch("")} />
              ) : null}
              {jobFilter !== ALL_FILTER_VALUE ? (
                <FilterChip label={jobFilter} onClear={() => setJobFilter(ALL_FILTER_VALUE)} />
              ) : null}
              {categoryFilter !== ALL_FILTER_VALUE ? (
                <FilterChip
                  label={categoryFilter}
                  onClear={() => setCategoryFilter(ALL_FILTER_VALUE)}
                />
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="px-1.5 py-1 uppercase tracking-[0.12em] text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {t("car.clearAll")}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-bear/30 bg-bear/5 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-bear">
          {t("car.error")}: {error}
        </div>
      ) : null}

      <ServiceHistoryTable
        visits={visits}
        vehicles={vehicles}
        isLoading={isLoading}
        selectedVehicleId={effectiveSelectedVehicleId}
        showVehicle={effectiveSelectedVehicleId === "all"}
        expandedVisitIds={expandedVisitIds}
        onToggleExpanded={toggleExpanded}
        emptyMessage={filtersActive ? t("car.noMatchingVisits") : undefined}
        onClearEmpty={filtersActive ? clearFilters : undefined}
      />
    </div>
  );
}

function HistoryFilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <TerminalSelect
        value={value}
        onChange={onChange}
        ariaLabel={label}
        options={[
          { value: ALL_FILTER_VALUE, label: allLabel },
          ...options.map((option) => ({ value: option, label: option })),
        ]}
      />
    </label>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`${t("car.clearFilters")}: ${label}`}
      className="inline-flex max-w-44 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.07] px-2 py-1 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="truncate">{label}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}
