create index if not exists service_reminders_user_vehicle_created_at_id_idx
on public.service_reminders (user_id, vehicle_id, created_at, id);

create index if not exists service_reminders_active_user_created_at_id_idx
on public.service_reminders (user_id, created_at, id)
where is_active;

alter policy "Users view own service reminders"
on public.service_reminders
using ((select auth.uid()) = user_id);

alter policy "Users insert own service reminders"
on public.service_reminders
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and v.user_id = (select auth.uid())
  )
);

alter policy "Users update own service reminders"
on public.service_reminders
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and v.user_id = (select auth.uid())
  )
);

alter policy "Users delete own service reminders"
on public.service_reminders
using ((select auth.uid()) = user_id);
