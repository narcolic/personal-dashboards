import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  const { vehicles } = useVehicles();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialExpandedVisitId = searchParams.get("visitId")?.trim() || null;
  const initialVehicleId = searchParams.get("vehicleId")?.trim() || "all";
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId);

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
