import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { TransactionInputType } from "@/lib/portfolio/transactions/api";

export type TickerCatalogRow = Tables<"ticker_catalog">;

export type TickerSuggestion = Pick<
  TickerCatalogRow,
  "ticker" | "name" | "asset_type" | "market" | "currency"
>;

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}

function toCatalogInsert(userId: string, value: TickerSuggestion) {
  const ticker = normalizeTicker(value.ticker);
  return {
    user_id: userId,
    ticker,
    name: value.name?.trim() || null,
    asset_type: value.asset_type?.trim() || null,
    market: value.market?.trim() || null,
    currency: value.currency?.trim() || null,
    is_active: true,
  };
}

export async function upsertTickerCatalogEntry(
  userId: string,
  value: Pick<TransactionInputType, "ticker" | "name" | "asset_type" | "market" | "currency">,
) {
  const ticker = normalizeTicker(value.ticker);
  if (!ticker) return;

  const { error } = await supabase.from("ticker_catalog").upsert(toCatalogInsert(userId, {
    ticker,
    name: value.name ?? null,
    asset_type: value.asset_type ?? null,
    market: value.market ?? null,
    currency: value.currency ?? null,
  }), {
    onConflict: "user_id,ticker",
  });

  if (error) throw new Error(error.message);
}

export async function upsertTickerCatalogEntries(
  userId: string,
  values: Array<Pick<TransactionInputType, "ticker" | "name" | "asset_type" | "market" | "currency">>,
) {
  const deduped = new Map<string, ReturnType<typeof toCatalogInsert>>();

  for (const value of values) {
    const ticker = normalizeTicker(value.ticker);
    if (!ticker) continue;
    deduped.set(
      ticker,
      toCatalogInsert(userId, {
        ticker,
        name: value.name ?? null,
        asset_type: value.asset_type ?? null,
        market: value.market ?? null,
        currency: value.currency ?? null,
      }),
    );
  }

  if (deduped.size === 0) return;

  const { error } = await supabase
    .from("ticker_catalog")
    .upsert(Array.from(deduped.values()), { onConflict: "user_id,ticker" });

  if (error) throw new Error(error.message);
}
