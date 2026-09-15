alter table public.transactions
  add column cash_used numeric not null default 0,
  add column fee_amount numeric not null default 0,
  add column settles_to_cash boolean not null default false;

alter table public.transactions
  add constraint transactions_cash_used_check
    check (cash_used >= 0 and (action = 'buy' or cash_used = 0)),
  add constraint transactions_fee_amount_check
    check (fee_amount >= 0),
  add constraint transactions_cash_used_purchase_check
    check (cash_used <= (shares * price) + fee_amount),
  add constraint transactions_settles_to_cash_check
    check (action = 'sell' or settles_to_cash = false),
  add constraint transactions_net_sale_proceeds_check
    check (action <> 'sell' or (shares * price) >= fee_amount);

comment on column public.transactions.cash_used is
  'Amount of this BUY funded from prior sale proceeds in the same portfolio and currency.';
comment on column public.transactions.fee_amount is
  'Fee directly attributable to this BUY or SELL. BUY fees enter cost basis; SELL fees reduce proceeds.';
comment on column public.transactions.settles_to_cash is
  'True when this SELL contributes proceeds to tracked portfolio cash. Existing rows are intentionally false.';

create table public.portfolio_cash_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  currency text not null,
  amount numeric not null,
  withdrawal_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_cash_withdrawals_currency_check
    check (currency ~ '^[A-Z]{3,5}$'),
  constraint portfolio_cash_withdrawals_amount_check
    check (amount > 0)
);

create index portfolio_cash_withdrawals_user_scope_date_idx
  on public.portfolio_cash_withdrawals (
    user_id,
    portfolio_id,
    currency,
    withdrawal_date,
    id
  );

create index portfolio_cash_withdrawals_portfolio_id_idx
  on public.portfolio_cash_withdrawals (portfolio_id);

alter table public.portfolio_cash_withdrawals enable row level security;

create policy portfolio_cash_withdrawals_select_own
  on public.portfolio_cash_withdrawals
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy portfolio_cash_withdrawals_insert_own
  on public.portfolio_cash_withdrawals
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      portfolio_id is null
      or exists (
        select 1
        from public.portfolios p
        where p.id = portfolio_id
          and p.user_id = (select auth.uid())
      )
    )
  );

create policy portfolio_cash_withdrawals_update_own
  on public.portfolio_cash_withdrawals
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      portfolio_id is null
      or exists (
        select 1
        from public.portfolios p
        where p.id = portfolio_id
          and p.user_id = (select auth.uid())
      )
    )
  );

create policy portfolio_cash_withdrawals_delete_own
  on public.portfolio_cash_withdrawals
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger portfolio_cash_withdrawals_touch_updated_at
before update on public.portfolio_cash_withdrawals
for each row execute function public.touch_updated_at();

alter table public.portfolio_value_snapshots
  add column cash_balance_eur numeric not null default 0,
  add column cash_balance_usd numeric not null default 0,
  add column total_value_eur numeric not null default 0,
  add column total_value_usd numeric not null default 0,
  add column realized_eur numeric not null default 0,
  add column realized_usd numeric not null default 0,
  add column total_pnl_eur numeric not null default 0,
  add column total_pnl_usd numeric not null default 0,
  add column external_flow_eur numeric not null default 0,
  add column external_flow_usd numeric not null default 0,
  add column accounting_version smallint not null default 1;

update public.portfolio_value_snapshots
set total_value_eur = market_value_eur,
    total_value_usd = market_value_usd;

comment on column public.portfolio_value_snapshots.accounting_version is
  'Version 1 is the legacy securities-only snapshot; version 2 includes sale cash and external-flow adjustments.';
