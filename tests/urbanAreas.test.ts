import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findUrbanArea, urbanTile, type UrbanArea } from "../src/components/travel/urbanAreas.ts";

test("tile keys cover poles, the date line and cell edges", () => {
  assert.equal(urbanTile({ latitude: 90, longitude: 180 }), "0-17");
  assert.equal(urbanTile({ latitude: -90, longitude: -180 }), "0-0");
  assert.equal(urbanTile({ latitude: 0, longitude: 0 }), "18-9");
});

test("containment excludes polygon holes and unrelated nearby locations", () => {
  const area: UrbanArea = {
    id: 1,
    type: "Feature",
    properties: {},
    bbox: [0, 0, 10, 10],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    },
  };
  assert.equal(findUrbanArea([area], { latitude: 2, longitude: 2 }), area);
  assert.equal(findUrbanArea([area], { latitude: 5, longitude: 5 }), undefined);
  assert.equal(findUrbanArea([area], { latitude: 2, longitude: 10.1 }), undefined);
  const multi: UrbanArea = {
    ...area,
    geometry: {
      type: "MultiPolygon",
      coordinates: [area.geometry.type === "Polygon" ? area.geometry.coordinates : []],
    },
  };
  assert.equal(findUrbanArea([multi], { latitude: 2, longitude: 2 }), multi);
});

test("packaged city footprints cover representative cities without inventing coverage", () => {
  const cities = [
    { name: "Madrid", latitude: 40.4165, longitude: -3.7026 },
    { name: "Paris", latitude: 48.8534, longitude: 2.3488 },
    { name: "Athens", latitude: 37.9838, longitude: 23.7275 },
    { name: "Toronto", latitude: 43.7001, longitude: -79.4163 },
    { name: "Sydney", latitude: -33.8679, longitude: 151.2073 },
  ];
  for (const city of cities) {
    const areas = JSON.parse(
      readFileSync(
        new URL(`../public/travel/urban/${urbanTile(city)}.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.ok(findUrbanArea(areas, city), `${city.name} should have a footprint`);
  }
  const ocean = { latitude: 0, longitude: -150 };
  const areas = JSON.parse(
    readFileSync(
      new URL(`../public/travel/urban/${urbanTile(ocean)}.json`, import.meta.url),
      "utf8",
    ),
  );
  assert.equal(findUrbanArea(areas, ocean), undefined);
});
