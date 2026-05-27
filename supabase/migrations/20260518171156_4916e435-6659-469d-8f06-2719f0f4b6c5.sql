
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  asset_type text not null default 'stock',
  market text,
  currency text not null default 'USD',
  shares numeric not null check (shares >= 0),
  avg_cost numeric not null default 0 check (avg_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index positions_user_id_idx on public.positions(user_id);

alter table public.positions enable row level security;

create policy "Users view own positions" on public.positions
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own positions" on public.positions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own positions" on public.positions
  for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own positions" on public.positions
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger positions_updated_at before update on public.positions
  for each row execute function public.touch_updated_at();
