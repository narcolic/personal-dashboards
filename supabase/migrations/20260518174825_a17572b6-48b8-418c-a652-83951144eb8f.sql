ALTER TABLE public.positions RENAME TO transactions;
ALTER TABLE public.transactions RENAME COLUMN avg_cost TO price;
ALTER TABLE public.transactions ADD COLUMN transaction_date date NOT NULL DEFAULT CURRENT_DATE;

-- Rename RLS policies for clarity
ALTER POLICY "Users view own positions" ON public.transactions RENAME TO "Users view own transactions";
ALTER POLICY "Users insert own positions" ON public.transactions RENAME TO "Users insert own transactions";
ALTER POLICY "Users update own positions" ON public.transactions RENAME TO "Users update own transactions";
ALTER POLICY "Users delete own positions" ON public.transactions RENAME TO "Users delete own transactions";