import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type {
  ServiceJob,
  ServiceVisit,
  ServiceVisitWithJobs,
} from "@/routes/_authenticated/car-service/types";

export function useCarServiceData(vehicleId: string = "all") {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [visits, setVisits] = useState<ServiceVisitWithJobs[]>([]);
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setVisits([]);
      setJobSuggestions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let visitsQuery = supabase
      .from("service_visits")
      .select("*")
      .eq("user_id", userId)
      .order("service_date", { ascending: false });

    if (vehicleId !== "all") {
      visitsQuery = visitsQuery.eq("vehicle_id", vehicleId);
    }

    const { data: visitsData, error: visitsError } = await visitsQuery;

    if (visitsError) {
      setVisits([]);
      setJobSuggestions([]);
      setError(visitsError.message);
      setIsLoading(false);
      return;
    }

    const baseVisits = (visitsData ?? []) as ServiceVisit[];

    if (baseVisits.length === 0) {
      setVisits([]);
      setJobSuggestions([]);
      setIsLoading(false);
      return;
    }

    const visitIds = baseVisits.map((visit) => visit.id);

    const { data: jobsData, error: jobsError } = await supabase
      .from("service_jobs")
      .select("*")
      .in("service_visit_id", visitIds)
      .order("created_at", { ascending: true });

    if (jobsError) {
      setVisits([]);
      setJobSuggestions([]);
      setError(jobsError.message);
      setIsLoading(false);
      return;
    }

    const jobs = (jobsData ?? []) as ServiceJob[];
    const jobsByVisit = new Map<string, ServiceJob[]>();

    for (const job of jobs) {
      const group = jobsByVisit.get(job.service_visit_id) ?? [];
      group.push(job);
      jobsByVisit.set(job.service_visit_id, group);
    }

    const names = Array.from(
      new Set(jobs.map((job) => job.job_name_snapshot.trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    setVisits(baseVisits.map((visit) => ({ ...visit, jobs: jobsByVisit.get(visit.id) ?? [] })));
    setJobSuggestions(names);
    setIsLoading(false);
  }, [userId, vehicleId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refetch();
    }, 0);

    return () => clearTimeout(id);
  }, [refetch]);

  return { visits, jobSuggestions, isLoading, error, refetch };
}
