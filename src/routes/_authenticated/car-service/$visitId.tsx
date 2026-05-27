import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ServiceHistoryEditor } from "@/routes/_authenticated/car-service/components/ServiceHistoryEditor";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import {
  deleteServiceVisit,
  updateServiceVisit,
} from "@/routes/_authenticated/car-service/hooks/useCarServiceMutations";
import type { ServiceJob, ServiceJobInput, ServiceVisitWithJobs } from "@/routes/_authenticated/car-service/types";

export const Route = createFileRoute("/_authenticated/car-service/$visitId")({
  component: CarServiceEditVisit,
});

function CarServiceEditVisit() {
  const { visitId } = Route.useParams();
  const navigate = useNavigate();
  const { jobSuggestions } = useCarServiceData();
  const { vehicles } = useVehicles();

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
        setError("Visit not found.");
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
  }, [visitId]);

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
        },
        payload.jobs,
      );

      await navigate({ to: "/car-service/history" });
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
      await navigate({ to: "/car-service/history" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete visit.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">&gt; CAR-SERVICE // EDIT VISIT</div>
      </div>

      {isLoading ? (
        <div className="border border-border bg-card px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          LOADING...
        </div>
      ) : visit ? (
        <ServiceHistoryEditor
          initialVisit={visit}
          vehicles={vehicles}
          jobSuggestions={jobSuggestions}
          submitLabel="UPDATE VISIT"
          saveError={error}
          isSaving={isSaving}
          isDeleting={isDeleting}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : (
        <div className="border border-border bg-card px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-destructive">
          {error ?? "VISIT NOT FOUND."}
        </div>
      )}
    </div>
  );
}
