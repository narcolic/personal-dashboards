import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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

    const { data, error: fetchError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      setVehicles([]);
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setVehicles(data ?? []);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refetch();
    }, 0);

    return () => clearTimeout(id);
  }, [refetch]);

  return { vehicles, isLoading, error, refetch };
}
