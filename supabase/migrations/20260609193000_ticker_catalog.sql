create table public.ticker_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  asset_type text,
  market text,
  currency text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticker_catalog_user_ticker_key unique (user_id, ticker)
);

create index ticker_catalog_user_id_idx on public.ticker_catalog(user_id);

alter table public.ticker_catalog enable row level security;

create policy "Users view own ticker catalog" on public.ticker_catalog
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own ticker catalog" on public.ticker_catalog
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own ticker catalog" on public.ticker_catalog
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own ticker catalog" on public.ticker_catalog
  for delete to authenticated using (auth.uid() = user_id);

create trigger ticker_catalog_touch_updated_at
before update on public.ticker_catalog
for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
