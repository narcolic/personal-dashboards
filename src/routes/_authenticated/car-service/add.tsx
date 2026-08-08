import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ServiceHistoryEditor } from "@/routes/_authenticated/car-service/components/ServiceHistoryEditor";
import { useCarServiceWorkspace } from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
import { createServiceVisit } from "@/routes/_authenticated/car-service/hooks/useCarServiceMutations";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import type { ServiceJobInput } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/add")({
  component: CarServiceAddVisit,
});

function CarServiceAddVisit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobSuggestions, categorySuggestions } = useCarService();
  const { vehicles } = useVehicles();
  const { selectedVehicleId } = useCarServiceWorkspace();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (payload: {
    visit: {
      vehicle_id: string;
      service_date: string;
      odometer_km: number;
      workshop: string | null;
      notes: string | null;
      vat_rate: number;
      is_annual_service: boolean;
    };
    jobs: ServiceJobInput[];
  }) => {
    if (!user?.id) {
      setError(t("car.authRequired"));
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await createServiceVisit(
        supabase,
        user.id,
        {
          vehicle_id: payload.visit.vehicle_id,
          service_date: payload.visit.service_date,
          odometer_km: payload.visit.odometer_km,
          workshop: payload.visit.workshop,
          notes: payload.visit.notes,
          vat_rate: payload.visit.vat_rate,
          is_annual_service: payload.visit.is_annual_service,
        },
        payload.jobs,
      );

      await navigate({ to: "/car-service/history" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("car.failedSaveVisit"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3 font-mono">
      <h1 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-primary">&gt;</span>
        <span>{t("car.addVisitTitle")}</span>
      </h1>
      <ServiceHistoryEditor
        vehicles={vehicles}
        defaultVehicleId={
          selectedVehicleId !== "all"
            ? selectedVehicleId
            : vehicles.length === 1
              ? vehicles[0].id
              : undefined
        }
        jobSuggestions={jobSuggestions}
        categorySuggestions={categorySuggestions}
        submitLabel={t("common.save")}
        saveError={error}
        isSaving={isSaving}
        onSave={handleSave}
      />
    </div>
  );
}
