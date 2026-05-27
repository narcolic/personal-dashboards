-- Portfolios table (brokers / platforms)
CREATE TABLE public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  broker TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own portfolios" ON public.portfolios
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own portfolios" ON public.portfolios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own portfolios" ON public.portfolios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own portfolios" ON public.portfolios
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER portfolios_touch_updated_at
BEFORE UPDATE ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link positions to portfolios (nullable = "unassigned")
ALTER TABLE public.positions
  ADD COLUMN portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL;

CREATE INDEX idx_positions_portfolio_id ON public.positions(portfolio_id);
CREATE INDEX idx_positions_user_id ON public.positions(user_id);
