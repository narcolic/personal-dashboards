export type LocationResult = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

type ProviderLocation = Omit<LocationResult, "country"> & {
  country?: string;
  country_code?: string;
};

const regions = new Intl.DisplayNames(["en"], {
  type: "region",
  style: "short",
  fallback: "none",
});

function countryName(place: ProviderLocation): string | undefined {
  if (place.country?.trim()) return place.country.trim();
  const code = place.country_code?.trim().toUpperCase();
  // GeoNames can omit country names for territories, including HK and MO.
  return code && /^[A-Z]{2}$/.test(code) ? regions.of(code) : undefined;
}

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
  const data = (await response.json()) as { results?: ProviderLocation[] };
  return (data.results ?? []).flatMap((place) => {
    const country = countryName(place);
    if (!country || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude))
      return [];
    return [{ ...place, country }];
  });
}
