import { apiFetch } from "@/lib/api/client";
import type { Vehicle } from "@/routes/_authenticated/car-service/types";

type VehicleMutationInput = {
  make: string;
  model: string;
  year: number;
  plate: string;
  colour?: string;
  notes?: string;
  annualServiceIntervalKm?: number;
  annualServiceIntervalMonths?: number;
};

export function parseVehicleMeta(name: string | null | undefined): {
  colour: string;
  notes: string;
  annualServiceIntervalKm: number;
  annualServiceIntervalMonths: number;
} {
  if (!name || !name.includes("||")) {
    return {
      colour: "",
      notes: "",
      annualServiceIntervalKm: 15000,
      annualServiceIntervalMonths: 12,
    };
  }

  const json = name.split("||")[1];
  try {
    const parsed = JSON.parse(json) as {
      colour?: string;
      notes?: string;
      annualServiceIntervalKm?: number;
      annualServiceIntervalMonths?: number;
    };
    return {
      colour: parsed.colour ?? "",
      notes: parsed.notes ?? "",
      annualServiceIntervalKm:
        typeof parsed.annualServiceIntervalKm === "number" ? parsed.annualServiceIntervalKm : 15000,
      annualServiceIntervalMonths:
        typeof parsed.annualServiceIntervalMonths === "number"
          ? parsed.annualServiceIntervalMonths
          : 12,
    };
  } catch {
    return {
      colour: "",
      notes: "",
      annualServiceIntervalKm: 15000,
      annualServiceIntervalMonths: 12,
    };
  }
}

export async function createVehicle(data: VehicleMutationInput): Promise<Vehicle> {
  return apiFetch<Vehicle>("/api/car-service/vehicles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateVehicle(
  vehicleId: string,
  data: VehicleMutationInput,
): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/api/car-service/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  await apiFetch<void>(`/api/car-service/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: "DELETE",
  });
}
