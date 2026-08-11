import { apiFetch } from "@/lib/api/client";
import type {
  ServiceJobInput,
  ServiceVisit,
  ServiceVisitFormInput,
} from "@/routes/_authenticated/car-service/types";

export async function createServiceVisit(
  visitData: Omit<ServiceVisitFormInput, "user_id">,
  jobs: ServiceJobInput[],
): Promise<ServiceVisit> {
  return apiFetch<ServiceVisit>("/api/car-service/visits", {
    method: "POST",
    body: JSON.stringify({ ...visitData, jobs }),
  });
}

export async function updateServiceVisit(
  visitId: string,
  visitData: Omit<ServiceVisitFormInput, "user_id" | "vehicle_id"> & { vehicle_id?: string },
  jobs: ServiceJobInput[],
): Promise<ServiceVisit> {
  return apiFetch<ServiceVisit>(`/api/car-service/visits/${encodeURIComponent(visitId)}`, {
    method: "PUT",
    body: JSON.stringify({ ...visitData, jobs }),
  });
}

export async function deleteServiceVisit(visitId: string): Promise<void> {
  await apiFetch<void>(`/api/car-service/visits/${encodeURIComponent(visitId)}`, {
    method: "DELETE",
  });
}
