import { apiFetch } from "@/lib/api/client";
import type { EnergyBill, EnergyInput } from "./types";

export const energyKey = (userId: string) => ["energy-bills", userId] as const;
export const listBills = (signal?: AbortSignal) =>
  apiFetch<EnergyBill[]>("/api/energy/bills", { signal });
export const saveBill = (summary: EnergyInput, id?: string) =>
  apiFetch<EnergyBill>(`/api/energy/bills${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(summary),
  });
export const deleteBill = (id: string) =>
  apiFetch<void>(`/api/energy/bills/${id}`, { method: "DELETE" });
