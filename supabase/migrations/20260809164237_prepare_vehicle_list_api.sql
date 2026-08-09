-- Supports ownership filtering plus the stable creation ordering used by the .NET API.
create index if not exists vehicles_user_created_at_id_idx
on public.vehicles (user_id, created_at, id);

-- Evaluate auth.uid() once per statement rather than once per candidate row.
alter policy "Users view own vehicles" on public.vehicles
using ((select auth.uid()) = user_id);

alter policy "Users insert own vehicles" on public.vehicles
with check ((select auth.uid()) = user_id);

alter policy "Users update own vehicles" on public.vehicles
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "Users delete own vehicles" on public.vehicles
using ((select auth.uid()) = user_id);
