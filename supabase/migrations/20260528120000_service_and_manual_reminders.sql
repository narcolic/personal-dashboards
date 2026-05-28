create table public.service_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  job_name text not null,
  interval_km integer,
  interval_months integer,
  warning_km integer default 500,
  warning_days integer default 30,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint service_reminders_interval_km_check check (interval_km is null or interval_km > 0),
  constraint service_reminders_interval_months_check check (interval_months is null or interval_months > 0),
  constraint service_reminders_warning_km_check check (warning_km is null or warning_km >= 0),
  constraint service_reminders_warning_days_check check (warning_days is null or warning_days >= 0),
  constraint service_reminders_has_interval_check check (interval_km is not null or interval_months is not null)
);

create table public.manual_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  title text not null,
  due_date date,
  notes text,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index service_reminders_user_id_idx on public.service_reminders(user_id);
create index service_reminders_vehicle_id_idx on public.service_reminders(vehicle_id);
create index manual_reminders_user_id_idx on public.manual_reminders(user_id);
create index manual_reminders_vehicle_id_idx on public.manual_reminders(vehicle_id);
create index manual_reminders_due_date_idx on public.manual_reminders(due_date);

alter table public.service_reminders enable row level security;
alter table public.manual_reminders enable row level security;

create policy "Users view own service reminders" on public.service_reminders
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own service reminders" on public.service_reminders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = auth.uid()
    )
  );
create policy "Users update own service reminders" on public.service_reminders
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = auth.uid()
    )
  );
create policy "Users delete own service reminders" on public.service_reminders
  for delete to authenticated using (auth.uid() = user_id);

create policy "Users view own manual reminders" on public.manual_reminders
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own manual reminders" on public.manual_reminders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = auth.uid()
    )
  );
create policy "Users update own manual reminders" on public.manual_reminders
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = auth.uid()
    )
  );
create policy "Users delete own manual reminders" on public.manual_reminders
  for delete to authenticated using (auth.uid() = user_id);

notify pgrst, 'reload schema';
