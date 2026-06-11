create table public.portfolio_value_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  snapshot_at timestamptz not null,
  scope text not null check (scope in ('total', 'portfolio')),
  scope_key text not null,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  portfolio_name text,
  market_value_eur numeric not null default 0,
  market_value_usd numeric not null default 0,
  cost_basis_eur numeric not null default 0,
  cost_basis_usd numeric not null default 0,
  unrealized_eur numeric not null default 0,
  unrealized_usd numeric not null default 0,
  quote_metadata jsonb not null default '{}'::jsonb,
  fx_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_value_snapshots_scope_shape check (
    (scope = 'total' and portfolio_id is null and scope_key = 'total')
    or
    (scope = 'portfolio' and scope_key <> 'total')
  ),
  constraint portfolio_value_snapshots_unique_scope unique (user_id, snapshot_date, scope_key)
);

create index portfolio_value_snapshots_user_date_idx
  on public.portfolio_value_snapshots(user_id, snapshot_date desc);

create index portfolio_value_snapshots_portfolio_idx
  on public.portfolio_value_snapshots(portfolio_id)
  where portfolio_id is not null;

alter table public.portfolio_value_snapshots enable row level security;

create policy "Users view own portfolio value snapshots"
  on public.portfolio_value_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

create trigger portfolio_value_snapshots_touch_updated_at
before update on public.portfolio_value_snapshots
for each row execute function public.touch_updated_at();
