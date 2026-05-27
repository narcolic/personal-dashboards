create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  make text,
  model text,
  plate text,
  year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_year_check check (year is null or year >= 1886)
);

create table public.job_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_catalog_user_name_key unique (user_id, name)
);

create table public.service_visits (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  user_id uuid not null,
  service_date date not null,
  odometer_km integer not null,
  workshop text,
  notes text,
  vat_rate numeric(5,4) not null default 0.24,
  subtotal_ex_vat numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_visits_vehicle_fk foreign key (vehicle_id) references public.vehicles(id) on delete cascade,
  constraint service_visits_user_fk foreign key (user_id) references auth.users(id) on delete cascade,
  constraint service_visits_odometer_check check (odometer_km >= 0),
  constraint service_visits_subtotal_check check (subtotal_ex_vat >= 0),
  constraint service_visits_vat_amount_check check (vat_amount >= 0),
  constraint service_visits_total_amount_check check (total_amount >= 0),
  constraint service_visits_vat_rate_check check (vat_rate >= 0 and vat_rate <= 1)
);

create table public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  service_visit_id uuid not null references public.service_visits(id) on delete cascade,
  job_catalog_id uuid references public.job_catalog(id) on delete set null,
  job_name_snapshot text not null,
  category_snapshot text,
  quantity numeric(10,2) not null default 1,
  unit_price_ex_vat numeric(12,2) not null,
  line_total_ex_vat numeric(12,2) not null,
  notes text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_jobs_quantity_check check (quantity > 0),
  constraint service_jobs_unit_price_check check (unit_price_ex_vat >= 0),
  constraint service_jobs_line_total_check check (line_total_ex_vat >= 0)
);

create index vehicles_user_id_idx on public.vehicles(user_id);
create index job_catalog_user_id_idx on public.job_catalog(user_id);
create index service_visits_user_id_idx on public.service_visits(user_id);
create index service_visits_vehicle_id_idx on public.service_visits(vehicle_id);
create index service_visits_service_date_desc_idx on public.service_visits(service_date desc);
create index service_jobs_service_visit_id_idx on public.service_jobs(service_visit_id);
create index service_jobs_job_catalog_id_idx on public.service_jobs(job_catalog_id);

-- Optional but useful for import quality and duplicate prevention within a user.
create unique index vehicles_user_plate_unique_idx
  on public.vehicles(user_id, plate)
  where plate is not null;

alter table public.vehicles enable row level security;
alter table public.job_catalog enable row level security;
alter table public.service_visits enable row level security;
alter table public.service_jobs enable row level security;

create policy "Users view own vehicles" on public.vehicles
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own vehicles" on public.vehicles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own vehicles" on public.vehicles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own vehicles" on public.vehicles
  for delete to authenticated using (auth.uid() = user_id);

create policy "Users view own job catalog" on public.job_catalog
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own job catalog" on public.job_catalog
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own job catalog" on public.job_catalog
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own job catalog" on public.job_catalog
  for delete to authenticated using (auth.uid() = user_id);

create policy "Users view own service visits" on public.service_visits
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own service visits" on public.service_visits
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.user_id = auth.uid()
    )
  );
create policy "Users update own service visits" on public.service_visits
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.user_id = auth.uid()
    )
  );
create policy "Users delete own service visits" on public.service_visits
  for delete to authenticated using (auth.uid() = user_id);

create policy "Users view own service jobs" on public.service_jobs
  for select to authenticated
  using (
    exists (
      select 1
      from public.service_visits sv
      where sv.id = service_visit_id
        and sv.user_id = auth.uid()
    )
  );
create policy "Users insert own service jobs" on public.service_jobs
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.service_visits sv
      where sv.id = service_visit_id
        and sv.user_id = auth.uid()
    )
    and (
      job_catalog_id is null
      or exists (
        select 1
        from public.job_catalog jc
        where jc.id = job_catalog_id
          and jc.user_id = auth.uid()
      )
    )
  );
create policy "Users update own service jobs" on public.service_jobs
  for update to authenticated
  using (
    exists (
      select 1
      from public.service_visits sv
      where sv.id = service_visit_id
        and sv.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.service_visits sv
      where sv.id = service_visit_id
        and sv.user_id = auth.uid()
    )
    and (
      job_catalog_id is null
      or exists (
        select 1
        from public.job_catalog jc
        where jc.id = job_catalog_id
          and jc.user_id = auth.uid()
      )
    )
  );
create policy "Users delete own service jobs" on public.service_jobs
  for delete to authenticated
  using (
    exists (
      select 1
      from public.service_visits sv
      where sv.id = service_visit_id
        and sv.user_id = auth.uid()
    )
  );

create trigger vehicles_touch_updated_at
before update on public.vehicles
for each row execute function public.touch_updated_at();

create trigger job_catalog_touch_updated_at
before update on public.job_catalog
for each row execute function public.touch_updated_at();

create trigger service_visits_touch_updated_at
before update on public.service_visits
for each row execute function public.touch_updated_at();

create trigger service_jobs_touch_updated_at
before update on public.service_jobs
for each row execute function public.touch_updated_at();

create or replace function public.recalculate_service_visit_totals(p_service_visit_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_subtotal numeric(12,2);
  v_vat_rate numeric(5,4);
begin
  select
    coalesce(sum(sj.line_total_ex_vat), 0)::numeric(12,2),
    sv.vat_rate
  into v_subtotal, v_vat_rate
  from public.service_visits sv
  left join public.service_jobs sj on sj.service_visit_id = sv.id
  where sv.id = p_service_visit_id
  group by sv.id, sv.vat_rate;

  if v_vat_rate is null then
    return;
  end if;

  update public.service_visits
  set
    subtotal_ex_vat = v_subtotal,
    vat_amount = round(v_subtotal * v_vat_rate, 2),
    total_amount = round(v_subtotal + (v_subtotal * v_vat_rate), 2)
  where id = p_service_visit_id;
end;
$$;

create or replace function public.sync_service_visit_totals_from_jobs()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_service_visit_totals(old.service_visit_id);
  else
    perform public.recalculate_service_visit_totals(new.service_visit_id);

    if tg_op = 'UPDATE' and new.service_visit_id <> old.service_visit_id then
      perform public.recalculate_service_visit_totals(old.service_visit_id);
    end if;
  end if;

  return null;
end;
$$;

create trigger service_jobs_recalculate_visit_totals
after insert or update or delete on public.service_jobs
for each row execute function public.sync_service_visit_totals_from_jobs();

create or replace function public.sync_service_visit_totals_from_visit_vat()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.vat_rate is distinct from old.vat_rate then
    perform public.recalculate_service_visit_totals(new.id);
  end if;

  return new;
end;
$$;

create trigger service_visits_recalculate_on_vat_change
after update of vat_rate on public.service_visits
for each row execute function public.sync_service_visit_totals_from_visit_vat();

notify pgrst, 'reload schema';
