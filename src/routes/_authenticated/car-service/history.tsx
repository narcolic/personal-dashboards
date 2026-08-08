import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ServiceHistoryTable } from "@/routes/_authenticated/car-service/components/ServiceHistoryTable";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/history")({
  component: CarServiceHistory,
});

function CarServiceHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialExpandedVisitId =
    searchParams.get("visitId")?.trim() || persistedContext?.visitId?.trim() || null;
  const initialVehicleId =
    searchParams.get("vehicleId")?.trim() || persistedContext?.vehicleId?.trim() || "all";
  const [userExpandedVisitIds, setUserExpandedVisitIds] = useState<Set<string>>(new Set());
  const [restoredExpandedVisitId, setRestoredExpandedVisitId] = useState(initialExpandedVisitId);
  const [jobFilter, setJobFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");

  useEffect(() => {
    if (initialVehicleId !== "all") setSelectedVehicleId(initialVehicleId);
    try {
      sessionStorage.removeItem("carServiceHistoryContext");
    } catch {
      // ignore storage failures
    }

    if (!searchParams.get("visitId") && !searchParams.get("vehicleId")) return;

    void navigate({
      to: "/car-service/history",
      replace: true,
    });
  }, [initialVehicleId, navigate, searchParams, setSelectedVehicleId]);

  const { visits: allVisits, isLoading, error } = useCarService("all");
  const effectiveSelectedVehicleId = useMemo(() => {
    if (selectedVehicleId !== "all") return selectedVehicleId;
    if (!initialExpandedVisitId) return "all";
    const target = allVisits.find((visit) => visit.id === initialExpandedVisitId);
    return target?.vehicle_id ?? "all";
  }, [allVisits, initialExpandedVisitId, selectedVehicleId]);

  const scopedVisits = useMemo(() => {
    if (effectiveSelectedVehicleId === "all") return allVisits;
    return allVisits.filter((visit) => visit.vehicle_id === effectiveSelectedVehicleId);
  }, [allVisits, effectiveSelectedVehicleId]);
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
  const visits = useMemo(() => {
    const query = jobFilter.trim().toLocaleLowerCase();
    if (!query && categoryFilter === "__all__") return scopedVisits;

    return scopedVisits.filter((visit) =>
      visit.jobs.some((job) => {
        const jobName = job.job_name_snapshot.trim().toLocaleLowerCase();
        const category = (job.category_snapshot ?? "").trim();
        const matchesQuery =
          !query || jobName.includes(query) || category.toLocaleLowerCase().includes(query);
        const matchesCategory = categoryFilter === "__all__" || category === categoryFilter;
        return matchesQuery && matchesCategory;
      }),
    );
  }, [categoryFilter, jobFilter, scopedVisits]);
  const filtersActive = jobFilter.trim().length > 0 || categoryFilter !== "__all__";
  const expandedVisitIds = useMemo(() => {
    const next = new Set(userExpandedVisitIds);
    if (restoredExpandedVisitId && visits.some((visit) => visit.id === restoredExpandedVisitId)) {
      next.add(restoredExpandedVisitId);
    }
    return next;
  }, [restoredExpandedVisitId, userExpandedVisitIds, visits]);
  const allExpanded = visits.length > 0 && visits.every((visit) => expandedVisitIds.has(visit.id));

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
    <div className="space-y-4 font-mono">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {visits.length > 0 ? (
          <button
            type="button"
            onClick={toggleAllExpanded}
            className="hidden h-10 rounded-lg border border-border/70 bg-card/70 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground md:inline-flex md:items-center"
          >
            {allExpanded ? t("car.collapseAll") : t("car.expandAll")}
          </button>
        ) : null}
        <Link
          to="/car-service/add"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90"
        >
          + {t("car.new")}
        </Link>
      </div>

      <section
        className="analytics-panel rounded-[10px] border border-border/70 bg-card/70 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
        aria-label={t("car.historyFilters")}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_auto]">
          <label className="min-w-0">
            <span className="sr-only">{t("car.jobOrCategoryFilter")}</span>
            <input
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
              placeholder={t("car.historyFilterPlaceholder")}
              list="car-service-history-job-options"
              className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
            />
            <datalist id="car-service-history-job-options">
              {jobOptions.map((job) => (
                <option key={job} value={job} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="sr-only">{t("car.category")}</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
            >
              <option value="__all__">{t("car.allCategories")}</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setJobFilter("");
              setCategoryFilter("__all__");
            }}
            disabled={!filtersActive}
            className="h-10 rounded-lg border border-border/70 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:cursor-default disabled:opacity-35"
          >
            {t("car.clearFilters")}
          </button>
        </div>
        <div className="mt-2 text-right text-[10px] text-muted-foreground">
          {t("car.showingVisits", { shown: visits.length, total: scopedVisits.length })}
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
        expandedVisitIds={expandedVisitIds}
        onToggleExpanded={toggleExpanded}
        emptyMessage={filtersActive ? t("car.noMatchingVisits") : undefined}
      />
    </div>
  );
}
