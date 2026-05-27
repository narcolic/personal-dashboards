import { z } from "zod";

const PortfolioInput = z.object({
  name: z.string().trim().min(1).max(80),
  broker: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type PortfolioInputType = z.infer<typeof PortfolioInput>;
