-- Evaluate auth.uid() once per statement rather than once for every candidate row.
-- These alterations preserve each policy's command, role, and ownership checks.

alter policy "Users view own job catalog"
  on public.job_catalog
  using ((select auth.uid()) = user_id);

alter policy "Users insert own job catalog"
  on public.job_catalog
  with check ((select auth.uid()) = user_id);

alter policy "Users update own job catalog"
  on public.job_catalog
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users delete own job catalog"
  on public.job_catalog
  using ((select auth.uid()) = user_id);

alter policy "Users view own manual reminders"
  on public.manual_reminders
  using ((select auth.uid()) = user_id);

alter policy "Users insert own manual reminders"
  on public.manual_reminders
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.user_id = (select auth.uid())
    )
  );

alter policy "Users update own manual reminders"
  on public.manual_reminders
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_id
        and v.user_id = (select auth.uid())
    )
  );

alter policy "Users delete own manual reminders"
  on public.manual_reminders
  using ((select auth.uid()) = user_id);

alter policy "Users view own portfolio value snapshots"
  on public.portfolio_value_snapshots
  using ((select auth.uid()) = user_id);
