import { z } from "zod";

const TransactionInput = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9.\-^=:_]+$/),
  name: z.string().trim().max(120).optional().nullable(),
  asset_type: z.enum(["stock", "etf", "crypto", "bond", "fund", "other"]),
  market: z.string().trim().max(40).optional().nullable(),
  currency: z.string().trim().min(3).max(5).default("USD"),
  shares: z.number().positive().max(1e9),
  price: z.number().nonnegative().max(1e9),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional().nullable(),
  portfolio_id: z.string().uuid().optional().nullable(),
});

export type TransactionInputType = z.infer<typeof TransactionInput>;
