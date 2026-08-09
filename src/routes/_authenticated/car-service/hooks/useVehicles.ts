import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api/client";
import type { Vehicle } from "@/routes/_authenticated/car-service/types";

export function useVehicles() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setVehicles([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<Vehicle[]>("/api/car-service/vehicles");
      setVehicles(data);
    } catch (fetchError) {
      setVehicles([]);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load vehicles.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refetch();
    }, 0);

    return () => clearTimeout(id);
  }, [refetch]);

  return { vehicles, isLoading, error, refetch };
}
