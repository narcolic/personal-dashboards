import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api/client";
import type { ServiceVisitWithJobs } from "@/routes/_authenticated/car-service/types";

export function useCarService(vehicleId: string = "all") {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [visits, setVisits] = useState<ServiceVisitWithJobs[]>([]);
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setVisits([]);
      setJobSuggestions([]);
      setCategorySuggestions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const query = vehicleId === "all" ? "" : `?vehicleId=${encodeURIComponent(vehicleId)}`;
      const visits = await apiFetch<ServiceVisitWithJobs[]>(`/api/car-service/visits${query}`);
      const jobs = visits.flatMap((visit) => visit.jobs);
      const names = Array.from(
        new Set(jobs.map((job) => job.job_name_snapshot.trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
      const categories = Array.from(
        new Set(
          jobs.map((job) => (job.category_snapshot ?? "").trim().toUpperCase()).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));

      setVisits(visits);
      setJobSuggestions(names);
      setCategorySuggestions(categories);
    } catch (fetchError) {
      setVisits([]);
      setJobSuggestions([]);
      setCategorySuggestions([]);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load service visits.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, vehicleId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refetch();
    }, 0);

    return () => clearTimeout(id);
  }, [refetch]);

  return { visits, jobSuggestions, categorySuggestions, isLoading, error, refetch };
}
