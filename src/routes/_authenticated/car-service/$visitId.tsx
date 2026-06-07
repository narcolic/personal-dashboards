import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ServiceHistoryEditor } from "@/routes/_authenticated/car-service/components/ServiceHistoryEditor";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import { useTranslation } from "react-i18next";
import {
  deleteServiceVisit,
  updateServiceVisit,
} from "@/routes/_authenticated/car-service/hooks/useCarServiceMutations";
import type {
  ServiceJob,
  ServiceJobInput,
  ServiceVisitWithJobs,
} from "@/routes/_authenticated/car-service/types";

export const Route = createFileRoute("/_authenticated/car-service/$visitId")({
  component: CarServiceEditVisit,
});

function CarServiceEditVisit() {
  const { t } = useTranslation();
  const { visitId } = Route.useParams();
  const navigate = useNavigate();
  const { jobSuggestions, categorySuggestions } = useCarServiceData();
  const { vehicles } = useVehicles();
  const searchParams = new URLSearchParams(window.location.search);
  const persistedContext = (() => {
    try {
      const raw = sessionStorage.getItem("carServiceHistoryContext");
      if (!raw) return null as { vehicleId?: string; visitId?: string } | null;
      return JSON.parse(raw) as { vehicleId?: string; visitId?: string };
    } catch {
      return null;
    }
  })();
  const returnVehicleId =
    searchParams.get("vehicleId")?.trim() ?? persistedContext?.vehicleId?.trim() ?? "";
  const returnVisitId =
    searchParams.get("visitId")?.trim() ?? persistedContext?.visitId?.trim() ?? "";

  const [visit, setVisit] = useState<ServiceVisitWithJobs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadVisit() {
      setIsLoading(true);
      setError(null);

      const { data: visitData, error: visitError } = await supabase
        .from("service_visits")
        .select("*")
        .eq("id", visitId)
        .maybeSingle();

      if (!mounted) return;

      if (visitError) {
        setError(visitError.message);
        setIsLoading(false);
        return;
      }

      if (!visitData) {
        setError(t("car.editVisit.notFound"));
        setIsLoading(false);
        return;
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from("service_jobs")
        .select("*")
        .eq("service_visit_id", visitId)
        .order("created_at", { ascending: true });

      if (!mounted) return;

      if (jobsError) {
        setError(jobsError.message);
        setIsLoading(false);
        return;
      }

      setVisit({ ...visitData, jobs: (jobsData ?? []) as ServiceJob[] });
      setIsLoading(false);
    }

    void loadVisit();

    return () => {
      mounted = false;
    };
  }, [visitId, t]);

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
    setError(null);
    setIsSaving(true);

    try {
      await updateServiceVisit(
        supabase,
        visitId,
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

      await navigate({
        to: "/car-service/history",
        search: {
          vehicleId: returnVehicleId || undefined,
          visitId: returnVisitId || visitId,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update visit.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      await deleteServiceVisit(supabase, visitId);
      await navigate({
        to: "/car-service/history",
        search: {
          vehicleId: returnVehicleId || undefined,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete visit.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    void navigate({
      to: "/car-service/history",
      search: {
        vehicleId: returnVehicleId || undefined,
        visitId: returnVisitId || visitId,
      },
    });
  };

  return (
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("car.editVisit.title")}
        </div>
      </div>

      {isLoading ? (
        <div className="border border-border bg-card px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : visit ? (
        <ServiceHistoryEditor
          initialVisit={visit}
          vehicles={vehicles}
          jobSuggestions={jobSuggestions}
          categorySuggestions={categorySuggestions}
          submitLabel={t("common.save")}
          saveError={error}
          isSaving={isSaving}
          isDeleting={isDeleting}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      ) : (
        <div className="border border-border bg-card px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-destructive">
          {error ?? t("car.editVisit.notFound")}
        </div>
      )}
    </div>
  );
}
