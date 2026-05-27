import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const { visits, isLoading, error } = useCarServiceData(selectedVehicleId);

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
      <VehicleFilterBar vehicles={vehicles} selectedVehicleId={selectedVehicleId} onSelect={setSelectedVehicleId} />

      {error ? (<div className="border border-border bg-card px-4 py-2 text-[11px] text-bear uppercase tracking-[0.2em]">{t("car.error")}: {error}</div>) : null}

      <ServiceHistoryTable visits={visits} isLoading={isLoading} />
    </div>
  );
}
