import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
import type {
  ServiceReminder,
  ServiceReminderWithStatus,
} from "@/routes/_authenticated/car-service/types";
import { computeReminderStatus } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

export function useReminders(vehicleId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { visits } = useCarService("all");
  const [serviceReminders, setServiceReminders] = useState<ServiceReminder[]>([]);
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

    const { data: srData, error: srError } = await supabase
      .from("service_reminders")
      .select("*")
      .eq("user_id", userId)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: true });

    if (srError) {
      setServiceReminders([]);
      setError(srError.message ?? "Failed to fetch reminders.");
      setIsLoading(false);
      return;
    }

    setServiceReminders(srData ?? []);
    setIsLoading(false);
  }, [userId, vehicleId]);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (isCancelled) return;

      if (!userId) {
        setServiceReminders([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data: srData, error: srError } = await supabase
        .from("service_reminders")
        .select("*")
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: true });

      if (isCancelled) return;

      if (srError) {
        setServiceReminders([]);
        setError(srError.message ?? "Failed to fetch reminders.");
        setIsLoading(false);
        return;
      }

      setServiceReminders(srData ?? []);
      setIsLoading(false);
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [userId, vehicleId]);

  const vehicleVisits = useMemo(
    () => visits.filter((visit) => visit.vehicle_id === vehicleId),
    [vehicleId, visits],
  );

  const currentOdometerKm = useMemo(() => {
    const latest = vehicleVisits
      .slice()
      .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())[0];
    return latest ? Number(latest.odometer_km) : 0;
  }, [vehicleVisits]);

  const serviceRemindersWithStatus = useMemo<ServiceReminderWithStatus[]>(
    () =>
      serviceReminders.map((reminder) => ({
        ...reminder,
        ...computeReminderStatus(reminder, vehicleVisits, currentOdometerKm),
      })),
    [serviceReminders, vehicleVisits, currentOdometerKm],
  );

  return {
    serviceReminders: serviceRemindersWithStatus,
    isLoading,
    error,
    refetch,
  };
}

export function useAllReminders() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { visits } = useCarService("all");
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
      const { data: srData } = await supabase
        .from("service_reminders")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (isCancelled) return;

      const vehicleLatestKm = new Map<string, number>();
      for (const visit of visits) {
        const prev = vehicleLatestKm.get(visit.vehicle_id);
        if (prev == null || visit.odometer_km > prev)
          vehicleLatestKm.set(visit.vehicle_id, visit.odometer_km);
      }

      const withStatus = (srData ?? []).map((reminder) => {
        const vehicleVisits = visits.filter((visit) => visit.vehicle_id === reminder.vehicle_id);
        const currentKm = vehicleLatestKm.get(reminder.vehicle_id) ?? 0;
        return { ...reminder, ...computeReminderStatus(reminder, vehicleVisits, currentKm) };
      });

      setServiceReminders(withStatus);
      setIsLoading(false);
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [userId, visits]);

  return { serviceReminders, isLoading };
}
