create table public.travel_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  country text not null check (char_length(btrim(country)) between 1 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  visit_date date,
  note text check (char_length(note) <= 4000),
  created_at timestamptz not null default now()
);
create index travel_places_owner_date_idx on public.travel_places(user_id, visit_date desc, created_at desc);
alter table public.travel_places enable row level security;
revoke all on public.travel_places from anon, authenticated;
grant select, insert, update, delete on public.travel_places to authenticated;
create policy "Own travel places" on public.travel_places for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';
