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
  period: {
    key: AnalyticsPeriodKey;
    startDate: string | null;
    endDate: string;
    visitCount: number;
    totalSpend: number;
    averageVisitCost: number;
    costPer1000Km: number | null;
    previousTotalSpend: number | null;
    spendChangePercent: number | null;
  };
  spendTrend: { bucketStart: string; total: number; previousTotal: number | null }[];
  expensiveVisits: {
    id: string;
    vehicleId: string;
    serviceDate: string;
    workshop: string | null;
    totalAmount: number;
  }[];
  vehicleComparison: {
    vehicleId: string;
    visitCount: number;
    totalSpend: number;
    averageVisitCost: number;
    costPer1000Km: number | null;
  }[];
};

export type AnalyticsPeriodKey = "last12m" | "ytd" | "last3y" | "all";

export function useCarServiceAnalytics(vehicleId: string = "all", period?: AnalyticsPeriodKey) {
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
      const query = new URLSearchParams();
      if (vehicleId !== "all") query.set("vehicleId", vehicleId);
      if (period) query.set("period", period);
      const queryString = query.size > 0 ? `?${query.toString()}` : "";
      const response = await apiFetch<unknown>(`/api/car-service/analytics${queryString}`);
      if (!isCarServiceAnalyticsResponse(response)) {
        throw new Error(
          "The analytics API is out of date. Restart the backend server and try again.",
        );
      }
      setAnalytics(response);
    } catch (fetchError) {
      setAnalytics(null);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [period, userId, vehicleId]);

  useEffect(() => {
    const id = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(id);
  }, [refetch]);

  return { analytics, isLoading, error, refetch };
}

function isCarServiceAnalyticsResponse(value: unknown): value is CarServiceAnalytics {
  if (!isRecord(value) || !isRecord(value.period)) return false;

  return (
    typeof value.visitCount === "number" &&
    typeof value.period.key === "string" &&
    typeof value.period.endDate === "string" &&
    typeof value.period.totalSpend === "number" &&
    Array.isArray(value.spendTrend) &&
    Array.isArray(value.categorySpend) &&
    Array.isArray(value.topJobs) &&
    Array.isArray(value.expensiveVisits) &&
    Array.isArray(value.vehicleComparison)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
