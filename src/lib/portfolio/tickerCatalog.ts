import type { Tables } from "@/integrations/supabase/types";

export type TickerCatalogRow = Tables<"ticker_catalog">;

export type TickerSuggestion = Pick<
  TickerCatalogRow,
  "ticker" | "name" | "asset_type" | "market" | "currency"
>;

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}
