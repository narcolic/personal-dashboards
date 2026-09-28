// Rebuild the checked-in, public-domain Natural Earth urban-area tiles.
import { mkdir, writeFile } from "node:fs/promises";

const revision = "693f11422f4e08d2da4566b854dda53eb7c39fb3";
const source = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/ne_10m_urban_areas.geojson`;
const response = await fetch(source);
if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
const data = await response.json();
const tiles = new Map();
const round = (value) =>
  Array.isArray(value) ? value.map(round) : Math.round(value * 10000) / 10000;
for (const [id, feature] of data.features.entries()) {
  const geometry = { ...feature.geometry, coordinates: round(feature.geometry.coordinates) };
  const positions = geometry.coordinates.flat(geometry.type === "Polygon" ? 1 : 2);
  const bbox = [180, 90, -180, -90];
  for (const [lng, lat] of positions) {
    bbox[0] = Math.min(bbox[0], lng);
    bbox[1] = Math.min(bbox[1], lat);
    bbox[2] = Math.max(bbox[2], lng);
    bbox[3] = Math.max(bbox[3], lat);
  }
  const area = { type: "Feature", id, bbox, properties: {}, geometry };
  for (
    let x = Math.floor((bbox[0] + 180) / 10);
    x <= Math.min(35, Math.floor((bbox[2] + 180) / 10));
    x++
  ) {
    for (
      let y = Math.floor((bbox[1] + 90) / 10);
      y <= Math.min(17, Math.floor((bbox[3] + 90) / 10));
      y++
    ) {
      const key = `${x}-${y}`;
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key).push(area);
    }
  }
}
const target = new URL("../public/travel/urban/", import.meta.url);
await mkdir(target, { recursive: true });
// Empty cells are included so a location without urban coverage returns [] rather than a 404.
for (let x = 0; x < 36; x++) {
  for (let y = 0; y < 18; y++) {
    const key = `${x}-${y}`;
    await writeFile(new URL(`${key}.json`, target), JSON.stringify(tiles.get(key) ?? []));
  }
}
console.log(`Wrote 648 tiles, ${data.features.length} urban areas. Source: ${source}`);
