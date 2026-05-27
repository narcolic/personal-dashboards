import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  ServiceJobInput,
  ServiceJobInsert,
  ServiceVisit,
  ServiceVisitFormInput,
  ServiceVisitInsert,
  ServiceVisitUpdate,
} from "@/routes/_authenticated/car-service/types";

function toJobInsertRows(serviceVisitId: string, jobs: ServiceJobInput[]): ServiceJobInsert[] {
  return jobs.map((job) => {
    const lineTotal = Number((job.unitPriceExVat * job.quantity).toFixed(2));
    return {
      service_visit_id: serviceVisitId,
      job_catalog_id: null,
      job_name_snapshot: job.jobName.trim(),
      category_snapshot: job.category.trim() || null,
      quantity: job.quantity,
      unit_price_ex_vat: job.unitPriceExVat,
      line_total_ex_vat: lineTotal,
      notes: job.notes?.trim() || null,
      is_custom: true,
    };
  });
}

export async function createServiceVisit(
  client: SupabaseClient<Database>,
  userId: string,
  visitData: Omit<ServiceVisitFormInput, "user_id">,
  jobs: ServiceJobInput[],
): Promise<ServiceVisit> {
  const visitInsert: ServiceVisitInsert = {
    vehicle_id: visitData.vehicle_id,
    user_id: userId,
    service_date: visitData.service_date,
    odometer_km: visitData.odometer_km,
    workshop: visitData.workshop,
    notes: visitData.notes,
    vat_rate: visitData.vat_rate,
  };

  const { data: visit, error: visitError } = await client
    .from("service_visits")
    .insert(visitInsert)
    .select("*")
    .single();

  if (visitError) throw new Error(visitError.message);

  if (jobs.length > 0) {
    const { error: jobsError } = await client
      .from("service_jobs")
      .insert(toJobInsertRows(visit.id, jobs));
    if (jobsError) throw new Error(jobsError.message);
  }

  const { data: updatedVisit, error: refreshError } = await client
    .from("service_visits")
    .select("*")
    .eq("id", visit.id)
    .single();

  if (refreshError) throw new Error(refreshError.message);
  return updatedVisit;
}

export async function updateServiceVisit(
  client: SupabaseClient<Database>,
  visitId: string,
  visitData: Omit<ServiceVisitFormInput, "user_id" | "vehicle_id"> & { vehicle_id?: string },
  jobs: ServiceJobInput[],
): Promise<ServiceVisit> {
  const visitUpdate: ServiceVisitUpdate = {
    service_date: visitData.service_date,
    odometer_km: visitData.odometer_km,
    workshop: visitData.workshop,
    notes: visitData.notes,
    vat_rate: visitData.vat_rate,
  };

  if (visitData.vehicle_id) {
    visitUpdate.vehicle_id = visitData.vehicle_id;
  }

  const { data: visit, error: visitError } = await client
    .from("service_visits")
    .update(visitUpdate)
    .eq("id", visitId)
    .select("*")
    .single();

  if (visitError) throw new Error(visitError.message);

  const { error: deleteJobsError } = await client
    .from("service_jobs")
    .delete()
    .eq("service_visit_id", visitId);
  if (deleteJobsError) throw new Error(deleteJobsError.message);

  if (jobs.length > 0) {
    const { error: insertJobsError } = await client
      .from("service_jobs")
      .insert(toJobInsertRows(visitId, jobs));
    if (insertJobsError) throw new Error(insertJobsError.message);
  }

  const { data: updatedVisit, error: refreshError } = await client
    .from("service_visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (refreshError) throw new Error(refreshError.message);
  return updatedVisit;
}

export async function deleteServiceVisit(
  client: SupabaseClient<Database>,
  visitId: string,
): Promise<void> {
  const { error: deleteJobsError } = await client
    .from("service_jobs")
    .delete()
    .eq("service_visit_id", visitId);

  if (deleteJobsError) throw new Error(deleteJobsError.message);

  const { error: deleteVisitError } = await client
    .from("service_visits")
    .delete()
    .eq("id", visitId);

  if (deleteVisitError) throw new Error(deleteVisitError.message);
}
