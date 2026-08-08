import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [jobFilter, setJobFilter] = useState("__all__");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [openFilter, setOpenFilter] = useState<"job" | "category" | null>(null);
  const filtersRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!openFilter) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setOpenFilter(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openFilter]);

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
    if (jobFilter === "__all__" && categoryFilter === "__all__") return scopedVisits;

    return scopedVisits.filter((visit) =>
      visit.jobs.some((job) => {
        const jobName = job.job_name_snapshot.trim();
        const category = (job.category_snapshot ?? "").trim();
        const matchesJob = jobFilter === "__all__" || jobName === jobFilter;
        const matchesCategory = categoryFilter === "__all__" || category === categoryFilter;
        return matchesJob && matchesCategory;
      }),
    );
  }, [categoryFilter, jobFilter, scopedVisits]);
  const filtersActive = jobFilter !== "__all__" || categoryFilter !== "__all__";
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
        ref={filtersRef}
        className="analytics-panel rounded-[10px] border border-border/70 bg-card/70 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
        aria-label={t("car.historyFilters")}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <HistoryFilterDropdown
            label={t("car.job")}
            value={jobFilter}
            allLabel={t("car.allJobs")}
            options={jobOptions}
            open={openFilter === "job"}
            onToggle={() => setOpenFilter((current) => (current === "job" ? null : "job"))}
            onChange={setJobFilter}
            onClose={() => setOpenFilter(null)}
          />
          <HistoryFilterDropdown
            label={t("car.category")}
            value={categoryFilter}
            allLabel={t("car.allCategories")}
            options={categoryOptions}
            open={openFilter === "category"}
            onToggle={() =>
              setOpenFilter((current) => (current === "category" ? null : "category"))
            }
            onChange={setCategoryFilter}
            onClose={() => setOpenFilter(null)}
          />
          <button
            type="button"
            onClick={() => {
              setJobFilter("__all__");
              setCategoryFilter("__all__");
            }}
            disabled={!filtersActive}
            className="h-11 rounded-lg border border-border/70 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:cursor-default disabled:opacity-35"
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

function HistoryFilterDropdown({
  label,
  value,
  allLabel,
  options,
  open,
  onToggle,
  onChange,
  onClose,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const selectedLabel = value === "__all__" ? allLabel : value;
  const choices = ["__all__", ...options];

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          open
            ? "border-primary/60 ring-1 ring-primary/20"
            : "border-border/70 hover:border-primary/50"
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.08em] text-foreground">
            {selectedLabel}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-[10px] text-primary transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="terminal-scrollbar absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border/70 bg-popover/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
        >
          {choices.map((choice) => {
            const choiceLabel = choice === "__all__" ? allLabel : choice;
            const selected = choice === value;
            return (
              <button
                key={choice}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(choice);
                  onClose();
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  selected ? "bg-primary/12 text-primary" : "text-foreground hover:bg-secondary/55"
                }`}
              >
                <span className="truncate">{choiceLabel}</span>
                {selected ? <span aria-hidden="true">●</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
