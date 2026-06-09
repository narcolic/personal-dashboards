import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ServiceHistoryTable } from "@/routes/_authenticated/car-service/components/ServiceHistoryTable";
import { VehicleFilterBar } from "@/routes/_authenticated/car-service/components/VehicleFilterBar";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/history")({
  component: CarServiceHistory,
});

function CarServiceHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId);
  const [userExpandedVisitIds, setUserExpandedVisitIds] = useState<Set<string>>(new Set());
  const [restoredExpandedVisitId, setRestoredExpandedVisitId] = useState(initialExpandedVisitId);

  useEffect(() => {
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
  }, [navigate, searchParams]);

  const { visits: allVisits, isLoading, error } = useCarService("all");
  const effectiveSelectedVehicleId = useMemo(() => {
    if (selectedVehicleId !== "all") return selectedVehicleId;
    if (!initialExpandedVisitId) return "all";
    const target = allVisits.find((visit) => visit.id === initialExpandedVisitId);
    return target?.vehicle_id ?? "all";
  }, [allVisits, initialExpandedVisitId, selectedVehicleId]);

  const visits = useMemo(() => {
    if (effectiveSelectedVehicleId === "all") return allVisits;
    return allVisits.filter((visit) => visit.vehicle_id === effectiveSelectedVehicleId);
  }, [allVisits, effectiveSelectedVehicleId]);
  const selectedVehicleLabel = useMemo(() => {
    if (effectiveSelectedVehicleId === "all") return null;
    const vehicle = vehicles.find((item) => item.id === effectiveSelectedVehicleId);
    if (!vehicle) return null;
    const make = vehicle.make?.trim() || "-";
    const model = vehicle.model?.trim() || "-";
    const year = vehicle.year ? String(vehicle.year) : "-";
    return `${make} ${model} · ${year}`.toUpperCase();
  }, [effectiveSelectedVehicleId, vehicles]);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl uppercase tracking-[0.2em]">&gt; {t("header.history")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {visits.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllExpanded}
              className="border border-border px-3 py-2 text-[11px] uppercase tracking-[0.2em] hover:border-primary"
            >
              [{allExpanded ? t("car.collapseAll") : t("car.expandAll")}]
            </button>
          ) : null}
          <Link
            to="/car-service/add"
            className="bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
          >
            {t("car.new")}
          </Link>
        </div>
      </div>

      {selectedVehicleLabel ? (
        <div className="border border-border bg-card/50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          &gt; {selectedVehicleLabel}
        </div>
      ) : null}

      {vehicles.length > 1 ? (
        <VehicleFilterBar
          vehicles={vehicles}
          selectedVehicleId={effectiveSelectedVehicleId}
          onSelect={setSelectedVehicleId}
        />
      ) : null}

      {error ? (
        <div className="border border-border bg-card px-4 py-2 text-[11px] text-bear uppercase tracking-[0.2em]">
          {t("car.error")}: {error}
        </div>
      ) : null}

      <ServiceHistoryTable
        visits={visits}
        isLoading={isLoading}
        selectedVehicleId={effectiveSelectedVehicleId}
        expandedVisitIds={expandedVisitIds}
        onToggleExpanded={toggleExpanded}
      />
    </div>
  );
}
