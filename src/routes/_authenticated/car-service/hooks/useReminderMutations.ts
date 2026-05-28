import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  ManualReminder,
  ManualReminderInsert,
  ManualReminderUpdate,
  ServiceReminder,
  ServiceReminderInsert,
  ServiceReminderUpdate,
} from "@/routes/_authenticated/car-service/types";

export async function createServiceReminder(
  client: SupabaseClient<Database>,
  userId: string,
  data: Omit<ServiceReminderInsert, "id" | "created_at" | "user_id">,
): Promise<ServiceReminder> {
  const row: ServiceReminderInsert = { ...data, user_id: userId };
  const { data: inserted, error } = await client
    .from("service_reminders")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return inserted;
}

export async function updateServiceReminder(
  client: SupabaseClient<Database>,
  id: string,
  data: ServiceReminderUpdate,
): Promise<ServiceReminder> {
  const { data: updated, error } = await client
    .from("service_reminders")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

export async function deleteServiceReminder(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await client.from("service_reminders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createManualReminder(
  client: SupabaseClient<Database>,
  userId: string,
  data: Omit<ManualReminderInsert, "id" | "created_at" | "user_id" | "is_done">,
): Promise<ManualReminder> {
  const row: ManualReminderInsert = { ...data, user_id: userId, is_done: false };
  const { data: inserted, error } = await client
    .from("manual_reminders")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return inserted;
}

export async function toggleManualReminderDone(
  client: SupabaseClient<Database>,
  id: string,
  isDone: boolean,
): Promise<void> {
  const payload: ManualReminderUpdate = { is_done: isDone };
  const { error } = await client.from("manual_reminders").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteManualReminder(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await client.from("manual_reminders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

