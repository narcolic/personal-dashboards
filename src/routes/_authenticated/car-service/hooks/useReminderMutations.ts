import { apiFetch } from "@/lib/api/client";
import type {
  ServiceReminder,
  ServiceReminderInsert,
  ServiceReminderUpdate,
} from "@/routes/_authenticated/car-service/types";

export async function createServiceReminder(
  data: Omit<ServiceReminderInsert, "id" | "created_at" | "user_id">,
): Promise<Pick<ServiceReminder, "id">> {
  return apiFetch<Pick<ServiceReminder, "id">>("/api/car-service/reminders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateServiceReminder(
  id: string,
  data: ServiceReminderUpdate,
): Promise<Pick<ServiceReminder, "id">> {
  return apiFetch<Pick<ServiceReminder, "id">>(
    `/api/car-service/reminders/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function deleteServiceReminder(id: string): Promise<void> {
  await apiFetch<void>(`/api/car-service/reminders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
