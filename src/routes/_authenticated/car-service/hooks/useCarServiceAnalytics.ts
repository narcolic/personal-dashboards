import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api/client";

export type CarServiceAnalytics = {
  visitCount: number;
  totalLifetimeCost: number;
  costThisYear: number;
  lastVisitDate: string | null;
  latestOdometerKm: number | null;
  averageVisitCost: number;
  averageKmInterval: number | null;
  costPer1000Km: number | null;
  mostExpensiveVisit: {
    id: string;
    serviceDate: string;
    totalAmount: number;
  } | null;
  annualSpend: { year: string; total: number }[];
  categorySpend: { category: string; total: number }[];
  topJobs: { jobName: string; count: number; totalSpent: number }[];
};

export function useCarServiceAnalytics(vehicleId: string = "all") {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [analytics, setAnalytics] = useState<CarServiceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setAnalytics(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const query = vehicleId === "all" ? "" : `?vehicleId=${encodeURIComponent(vehicleId)}`;
      setAnalytics(await apiFetch<CarServiceAnalytics>(`/api/car-service/analytics${query}`));
    } catch (fetchError) {
      setAnalytics(null);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, vehicleId]);

  useEffect(() => {
    const id = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(id);
  }, [refetch]);

  return { analytics, isLoading, error, refetch };
}
