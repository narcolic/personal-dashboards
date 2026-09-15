import { apiFetch } from "@/lib/api/client";

export type PortfolioCashBalance = {
  portfolioId: string | null;
  currency: string;
  availableAmount: number;
  externalFlow: number;
};

export function listPortfolioCash(signal?: AbortSignal) {
  return apiFetch<PortfolioCashBalance[]>("/api/portfolio/cash", { signal });
}

export function withdrawPortfolioCash(value: {
  portfolio_id: string | null;
  currency: string;
  amount: number;
  withdrawal_date: string;
  notes?: string | null;
}) {
  return apiFetch<{ id: string }>("/api/portfolio/cash/withdrawals", {
    method: "POST",
    body: JSON.stringify(value),
  });
}
