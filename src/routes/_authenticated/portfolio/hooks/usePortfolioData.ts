import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TransactionRow } from "@/lib/portfolio/types";

export type PortfolioRecord = {
  id: string;
  name: string;
  broker: string | null;
  notes: string | null;
};

export function usePortfolioData({
  includePortfolios = true,
}: { includePortfolios?: boolean } = {}) {
  const txQ = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as TransactionRow[];
    },
  });

  const portfoliosQ = useQuery({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PortfolioRecord[];
    },
    enabled: includePortfolios,
  });

  return {
    txQ,
    portfoliosQ,
    transactions: txQ.data ?? [],
    portfolios: portfoliosQ.data ?? [],
  };
}
