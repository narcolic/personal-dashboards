import { apiFetch } from "@/lib/api/client";

export type TravelPlace = {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  visitDate: string | null;
  note: string | null;
};
export type TravelInput = Omit<TravelPlace, "id">;
export type LocationResult = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};
export const travelKey = (userId: string | undefined) => ["travel", userId] as const;
export const listPlaces = (signal: AbortSignal) =>
  apiFetch<TravelPlace[]>("/api/travel/places", { signal });
export const savePlace = (input: TravelInput, id?: string) =>
  apiFetch<TravelPlace>(
    id ? `/api/travel/places/${encodeURIComponent(id)}` : "/api/travel/places",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    },
  );
export const deletePlace = (id: string) =>
  apiFetch<void>(`/api/travel/places/${encodeURIComponent(id)}`, { method: "DELETE" });

// Explicit searches only; no account information or notes go to the provider.
export async function searchLocations(
  query: string,
  signal: AbortSignal,
): Promise<LocationResult[]> {
  const params = new URLSearchParams({
    name: query.trim(),
    count: "10",
    language: "en",
    format: "json",
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) throw new Error("Location search is unavailable.");
  const data = (await response.json()) as { results?: LocationResult[] };
  return (data.results ?? []).filter(
    (place) => place.country && Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
  );
}

// Great-circle distance handles nearby markers across the antimeridian as well.
export function angularDistance(a: TravelPlace, b: TravelPlace): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(Math.min(1, h)))) / rad;
}
