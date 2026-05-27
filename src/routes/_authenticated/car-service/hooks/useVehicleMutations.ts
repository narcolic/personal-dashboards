import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  Vehicle,
  VehicleInsert,
  VehicleUpdate,
} from "@/routes/_authenticated/car-service/types";

type VehicleMutationInput = {
  make: string;
  model: string;
  year: number;
  plate: string;
  colour?: string;
  notes?: string;
};

function serializeVehicleName(data: VehicleMutationInput): string {
  const meta = {
    colour: data.colour?.trim() || "",
    notes: data.notes?.trim() || "",
  };
  return `${data.make.trim()} ${data.model.trim()}||${JSON.stringify(meta)}`;
}

export function parseVehicleMeta(name: string | null | undefined): {
  colour: string;
  notes: string;
} {
  if (!name || !name.includes("||")) {
    return { colour: "", notes: "" };
  }

  const json = name.split("||")[1];
  try {
    const parsed = JSON.parse(json) as { colour?: string; notes?: string };
    return {
      colour: parsed.colour ?? "",
      notes: parsed.notes ?? "",
    };
  } catch {
    return { colour: "", notes: "" };
  }
}

export async function createVehicle(
  client: SupabaseClient<Database>,
  userId: string,
  data: VehicleMutationInput,
): Promise<Vehicle> {
  const row: VehicleInsert = {
    user_id: userId,
    name: serializeVehicleName(data),
    make: data.make.trim(),
    model: data.model.trim(),
    year: data.year,
    plate: data.plate.trim(),
  };

  const { data: inserted, error } = await client.from("vehicles").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return inserted;
}

export async function updateVehicle(
  client: SupabaseClient<Database>,
  vehicleId: string,
  data: VehicleMutationInput,
): Promise<Vehicle> {
  const row: VehicleUpdate = {
    name: serializeVehicleName(data),
    make: data.make.trim(),
    model: data.model.trim(),
    year: data.year,
    plate: data.plate.trim(),
  };

  const { data: updated, error } = await client
    .from("vehicles")
    .update(row)
    .eq("id", vehicleId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return updated;
}

export async function deleteVehicle(
  client: SupabaseClient<Database>,
  vehicleId: string,
): Promise<void> {
  const { count, error: countError } = await client
    .from("service_visits")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);

  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    throw new Error(`CANNOT DELETE - ${count} SERVICE VISITS LINKED`);
  }

  const { error } = await client.from("vehicles").delete().eq("id", vehicleId);
  if (error) throw new Error(error.message);
}
