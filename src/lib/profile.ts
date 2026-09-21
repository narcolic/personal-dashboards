import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/api/client";
import { supabase } from "@/integrations/supabase/client";

const homeCurrencyKey = ["profile", "homeCurrency"] as const;
export const supportedHomeCurrencies = ["EUR", "GBP", "USD", "TRY"] as const;

export function useHomeCurrency() {
  return useQuery({
    queryKey: homeCurrencyKey,
    queryFn: () => apiFetch<{ homeCurrency: string }>("/api/subscriptions/settings"),
    staleTime: 60_000,
  });
}

export function useRefreshHomeCurrency() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: homeCurrencyKey });
}

export function profileName(user: User | null | undefined): string {
  const metadata = user?.user_metadata;
  return typeof metadata?.display_name === "string" && metadata.display_name.trim()
    ? metadata.display_name.trim()
    : typeof metadata?.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : (user?.email ?? "");
}

export function avatarUrl(user: User | null | undefined): string | null {
  if (!user || user.user_metadata?.avatar_path !== `${user.id}/avatar`) return null;
  const { data } = supabase.storage.from("profile-avatars").getPublicUrl(`${user.id}/avatar`);
  const version = Number(user.user_metadata?.avatar_updated_at) || 0;
  return `${data.publicUrl}?v=${version}`;
}
