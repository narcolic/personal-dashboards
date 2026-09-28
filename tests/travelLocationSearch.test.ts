import assert from "node:assert/strict";
import test from "node:test";
import { searchLocations } from "../src/lib/travelLocationSearch.ts";

test("Hong Kong and Macau remain selectable when the provider omits country names", async (t) => {
  // Fields from the provider's live responses for Hong Kong and Macau.
  const results = [
    {
      id: 1819729,
      name: "Hong Kong",
      latitude: 22.27832,
      longitude: 114.17469,
      country_code: "HK",
    },
    { id: 1821274, name: "Macao", latitude: 22.20056, longitude: 113.54611, country_code: "MO" },
  ];
  t.mock.method(globalThis, "fetch", async () => Response.json({ results }));
  const places = await searchLocations("Macau", new AbortController().signal);
  assert.deepEqual(
    places.map(({ id, country, latitude, longitude }) => ({ id, country, latitude, longitude })),
    [
      { id: 1819729, country: "Hong Kong", latitude: 22.27832, longitude: 114.17469 },
      { id: 1821274, country: "Macao", latitude: 22.20056, longitude: 113.54611 },
    ],
  );
});

test("keeps provider names and order while rejecting unusable results", async (t) => {
  const base = { name: "Place", latitude: 10, longitude: 20 };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      results: [
        { ...base, id: 1, country: "Greece", country_code: "GR" },
        { ...base, id: 2, country_code: " fr " },
        { ...base, id: 3, country_code: "XX" },
        { ...base, id: 4, country_code: "invalid" },
        { ...base, id: 5 },
        { ...base, id: 6, country: "Greece", latitude: null },
      ],
    }),
  );
  const places = await searchLocations("Place", new AbortController().signal);
  assert.deepEqual(
    places.map(({ id, country }) => ({ id, country })),
    [
      { id: 1, country: "Greece" },
      { id: 2, country: "France" },
    ],
  );
});

test("empty searches and provider errors retain their existing behavior", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({}));
  assert.deepEqual(await searchLocations("Nothing", new AbortController().signal), []);
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(searchLocations("Hong Kong", new AbortController().signal), /unavailable/);
});
