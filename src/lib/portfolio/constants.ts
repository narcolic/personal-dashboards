import type { RegionCategory } from "@/lib/portfolio/types";

export const REGION_OVERRIDES: Record<string, RegionCategory> = {
  AETF: "Greece",
  "TPEIR.AT": "Greece",
  ERNX: "Europe Developed",
  "ERNX.DE": "Europe Developed",
  VUAA: "United States",
  DGRP: "United States",
  DGRW: "United States",
  QTUM: "Global Thematic",
  QUTM: "Global Thematic",
};

export const REGION_PREFIX_OVERRIDES: Array<[string, RegionCategory]> = [
  ["VUAA", "United States"],
  ["SMEA", "Europe Developed"],
  ["EIMI", "Emerging Markets"],
];

export const EUROPE_COUNTRIES = new Set([
  "Austria",
  "Belgium",
  "Denmark",
  "Finland",
  "France",
  "Germany",
  "Ireland",
  "Italy",
  "Netherlands",
  "Norway",
  "Portugal",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
]);
