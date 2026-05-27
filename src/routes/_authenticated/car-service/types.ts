import type { Database } from "@/integrations/supabase/types";

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
export type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export type ServiceVisit = Database["public"]["Tables"]["service_visits"]["Row"];
export type ServiceJob = Database["public"]["Tables"]["service_jobs"]["Row"];

export type ServiceVisitInsert = Database["public"]["Tables"]["service_visits"]["Insert"];
export type ServiceVisitUpdate = Database["public"]["Tables"]["service_visits"]["Update"];
export type ServiceJobInsert = Database["public"]["Tables"]["service_jobs"]["Insert"];

export type ServiceVisitWithJobs = ServiceVisit & { jobs: ServiceJob[] };

export type ServiceJobInput = {
  jobName: string;
  category: string;
  unitPriceExVat: number;
  quantity: number;
  notes?: string;
};

export type ServiceVisitFormInput = {
  vehicle_id: string;
  user_id: string;
  service_date: string;
  odometer_km: number;
  workshop: string | null;
  notes: string | null;
  vat_rate: number;
};
