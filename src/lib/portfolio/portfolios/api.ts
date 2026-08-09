import { z } from "zod";
import { apiFetch } from "@/lib/api/client";

export type PortfolioRecord = {
  id: string;
  name: string;
  broker: string | null;
  notes: string | null;
};

const PortfolioInput = z.object({
  name: z.string().trim().min(1).max(80),
  broker: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type PortfolioInputType = z.infer<typeof PortfolioInput>;

export function listPortfolios(signal?: AbortSignal) {
  return apiFetch<PortfolioRecord[]>("/api/portfolio/portfolios", { signal });
}
