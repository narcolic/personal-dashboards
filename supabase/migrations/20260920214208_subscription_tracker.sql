create table public.subscription_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_currency text not null default 'EUR' check (home_currency ~ '^[A-Z]{3}$')
);

create table public.subscription_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  description text,
  category text,
  notes text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  interval_months integer not null check (interval_months between 1 and 120),
  next_billing_date date not null,
  billing_anchor_day integer not null check (billing_anchor_day between 1 and 31),
  split_mode text not null default 'equal' check (split_mode in ('equal', 'fixed')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.subscription_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null,
  person_id uuid not null,
  payment_behavior text not null default 'manual' check (payment_behavior in ('manual', 'auto')),
  fixed_amount numeric(14,2) check (fixed_amount is null or fixed_amount >= 0),
  unique (subscription_id, person_id),
  unique (user_id, id),
  foreign key (user_id, subscription_id) references public.subscriptions(user_id, id) on delete cascade,
  foreign key (user_id, person_id) references public.subscription_people(user_id, id) on delete restrict
);

create table public.subscription_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null,
  billing_date date not null,
  full_amount numeric(14,2) not null check (full_amount > 0),
  my_amount numeric(14,2) not null check (my_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (subscription_id, billing_date),
  unique (user_id, id),
  foreign key (user_id, subscription_id) references public.subscriptions(user_id, id) on delete cascade
);

create table public.subscription_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null,
  person_id uuid not null,
  amount numeric(14,2) not null check (amount >= 0),
  payment_behavior text not null check (payment_behavior in ('manual', 'auto')),
  status text not null check (status in ('unpaid', 'paid', 'auto_received')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_id, person_id),
  foreign key (user_id, period_id) references public.subscription_periods(user_id, id) on delete cascade,
  foreign key (user_id, person_id) references public.subscription_people(user_id, id) on delete restrict,
  check ((payment_behavior = 'auto' and status = 'auto_received') or
         (payment_behavior = 'manual' and status in ('unpaid', 'paid')))
);

create index subscription_people_owner_name_idx on public.subscription_people(user_id, name);
create index subscriptions_owner_due_idx on public.subscriptions(user_id, is_active, next_billing_date);
create index subscription_memberships_owner_subscription_idx on public.subscription_memberships(user_id, subscription_id);
create index subscription_memberships_owner_person_idx on public.subscription_memberships(user_id, person_id);
create index subscription_periods_owner_subscription_date_idx on public.subscription_periods(user_id, subscription_id, billing_date desc);
create index subscription_contributions_owner_status_idx on public.subscription_contributions(user_id, status);
create index subscription_contributions_owner_person_idx on public.subscription_contributions(user_id, person_id);

alter table public.subscription_settings enable row level security;
alter table public.subscription_people enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_memberships enable row level security;
alter table public.subscription_periods enable row level security;
alter table public.subscription_contributions enable row level security;

create policy "Own subscription settings" on public.subscription_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own subscription people" on public.subscription_people for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own subscriptions" on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own subscription memberships" on public.subscription_memberships for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own subscription periods" on public.subscription_periods for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own subscription contributions" on public.subscription_contributions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
