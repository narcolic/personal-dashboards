import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api/client";
import type { ServiceReminderWithStatus } from "@/routes/_authenticated/car-service/types";

export function useReminders(vehicleId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [serviceReminders, setServiceReminders] = useState<ServiceReminderWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setServiceReminders([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setServiceReminders(
        await apiFetch<ServiceReminderWithStatus[]>(
          `/api/car-service/reminders?vehicleId=${encodeURIComponent(vehicleId)}`,
        ),
      );
    } catch (fetchError) {
      setServiceReminders([]);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch reminders.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, vehicleId]);

  useEffect(() => {
    const id = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(id);
  }, [refetch]);

  return { serviceReminders, isLoading, error, refetch };
}

export function useAllReminders() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [serviceReminders, setServiceReminders] = useState<ServiceReminderWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (isCancelled) return;

      if (!userId) {
        setServiceReminders([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await apiFetch<ServiceReminderWithStatus[]>(
          "/api/car-service/reminders?activeOnly=true",
        );
        if (!isCancelled) setServiceReminders(data);
      } catch {
        if (!isCancelled) setServiceReminders([]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      isCancelled = true;
    };
  }, [userId]);

  return { serviceReminders, isLoading };
}
