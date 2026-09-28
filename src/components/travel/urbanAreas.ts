import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

export type UrbanArea = Feature<Polygon | MultiPolygon> & { id: number; bbox: number[] };
export type Coordinates = { latitude: number; longitude: number };

export function urbanTile({ latitude, longitude }: Coordinates): string {
  const lng = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return `${Math.floor((lng + 180) / 10)}-${Math.min(17, Math.max(0, Math.floor((latitude + 90) / 10)))}`;
}

function inRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Use containment rather than guessing the nearest city. Holes (water/rural gaps)
// and places outside the dataset keep their coordinate marker.
export function findUrbanArea(areas: UrbanArea[], place: Coordinates): UrbanArea | undefined {
  const { latitude: lat, longitude: lng } = place;
  return areas.find((area) => {
    const [west, south, east, north] = area.bbox;
    if (lng < west || lng > east || lat < south || lat > north) return false;
    const polygons =
      area.geometry.type === "Polygon" ? [area.geometry.coordinates] : area.geometry.coordinates;
    return polygons.some(
      ([outer, ...holes]) =>
        inRing(lng, lat, outer) && !holes.some((hole) => inRing(lng, lat, hole)),
    );
  });
}

export async function loadUrbanTile(tile: string, signal: AbortSignal): Promise<UrbanArea[]> {
  const response = await fetch(`/travel/urban/${tile}.json`, { signal });
  if (!response.ok) throw new Error("Urban areas could not load");
  return response.json() as Promise<UrbanArea[]>;
}
