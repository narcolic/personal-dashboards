import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ServiceHistoryEditor } from "@/routes/_authenticated/car-service/components/ServiceHistoryEditor";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
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
  const { jobSuggestions } = useCarServiceData();
  const { vehicles } = useVehicles();
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
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">{t("car.addVisit")}</div>
      </div>
      <ServiceHistoryEditor
        vehicles={vehicles}
        defaultVehicleId={vehicles.length === 1 ? vehicles[0].id : undefined}
        jobSuggestions={jobSuggestions}
        submitLabel={t("car.saveVisit")}
        saveError={error}
        isSaving={isSaving}
        onSave={handleSave}
      />
    </div>
  );
}
