import type { SecurityMetadata } from "@/lib/portfolio/types";

export type TickerCatalogRow = {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  asset_type: string | null;
  market: string | null;
  currency: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  security_listing_id: string | null;
  security: SecurityMetadata | null;
};

export type TickerSuggestion = Pick<
  TickerCatalogRow,
  "ticker" | "name" | "asset_type" | "market" | "currency" | "security_listing_id"
>;

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}
