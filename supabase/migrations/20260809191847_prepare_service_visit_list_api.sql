create index if not exists service_visits_user_service_date_id_idx
on public.service_visits (user_id, service_date desc, id);

create index if not exists service_visits_user_vehicle_service_date_id_idx
on public.service_visits (user_id, vehicle_id, service_date desc, id);

create index if not exists service_jobs_visit_created_at_id_idx
on public.service_jobs (service_visit_id, created_at, id);

alter policy "Users view own service visits"
on public.service_visits
using ((select auth.uid()) = user_id);

alter policy "Users insert own service visits"
on public.service_visits
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and v.user_id = (select auth.uid())
  )
);

alter policy "Users update own service visits"
on public.service_visits
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and v.user_id = (select auth.uid())
  )
);

alter policy "Users delete own service visits"
on public.service_visits
using ((select auth.uid()) = user_id);

alter policy "Users view own service jobs"
on public.service_jobs
using (exists (
  select 1 from public.service_visits sv
  where sv.id = service_visit_id
    and sv.user_id = (select auth.uid())
));

alter policy "Users insert own service jobs"
on public.service_jobs
with check (
  exists (
    select 1 from public.service_visits sv
    where sv.id = service_visit_id
      and sv.user_id = (select auth.uid())
  )
  and (
    job_catalog_id is null
    or exists (
      select 1 from public.job_catalog jc
      where jc.id = job_catalog_id
        and jc.user_id = (select auth.uid())
    )
  )
);

alter policy "Users update own service jobs"
on public.service_jobs
using (exists (
  select 1 from public.service_visits sv
  where sv.id = service_visit_id
    and sv.user_id = (select auth.uid())
))
with check (
  exists (
    select 1 from public.service_visits sv
    where sv.id = service_visit_id
      and sv.user_id = (select auth.uid())
  )
  and (
    job_catalog_id is null
    or exists (
      select 1 from public.job_catalog jc
      where jc.id = job_catalog_id
        and jc.user_id = (select auth.uid())
    )
  )
);

alter policy "Users delete own service jobs"
on public.service_jobs
using (exists (
  select 1 from public.service_visits sv
  where sv.id = service_visit_id
    and sv.user_id = (select auth.uid())
));
