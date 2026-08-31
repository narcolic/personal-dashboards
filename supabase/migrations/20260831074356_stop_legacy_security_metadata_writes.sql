-- Canonical listing identity is now the ticker catalog association key. Keep
-- the legacy ticker column during the observation window, but allow new rows
-- to stop duplicating the listing symbol.
alter table public.ticker_catalog
  alter column ticker drop not null;
