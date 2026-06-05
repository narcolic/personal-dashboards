import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ServiceHistoryTable } from "@/routes/_authenticated/car-service/components/ServiceHistoryTable";
import { VehicleFilterBar } from "@/routes/_authenticated/car-service/components/VehicleFilterBar";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
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

  const { visits: allVisits, isLoading, error } = useCarServiceData("all");
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

  return (
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2 flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("car.history")}
        </div>
        <Link
          to="/car-service/add"
          className="bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
        >
          {t("car.new")}
        </Link>
      </div>
      <VehicleFilterBar
        vehicles={vehicles}
        selectedVehicleId={effectiveSelectedVehicleId}
        onSelect={setSelectedVehicleId}
      />

      {error ? (
        <div className="border border-border bg-card px-4 py-2 text-[11px] text-bear uppercase tracking-[0.2em]">
          {t("car.error")}: {error}
        </div>
      ) : null}

      <ServiceHistoryTable
        visits={visits}
        isLoading={isLoading}
        initialExpandedVisitId={initialExpandedVisitId}
        selectedVehicleId={effectiveSelectedVehicleId}
      />
    </div>
  );
}
