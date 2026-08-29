-- The baseline created human-readable quoted policy names. Replace either naming
-- variant so this optimization is safe on both an empty replay and the live shape.
drop policy if exists "Users view own portfolios" on public.portfolios;
drop policy if exists "Users insert own portfolios" on public.portfolios;
drop policy if exists "Users update own portfolios" on public.portfolios;
drop policy if exists "Users delete own portfolios" on public.portfolios;
drop policy if exists portfolios_select_own on public.portfolios;
drop policy if exists portfolios_insert_own on public.portfolios;
drop policy if exists portfolios_update_own on public.portfolios;
drop policy if exists portfolios_delete_own on public.portfolios;

create policy portfolios_select_own on public.portfolios
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy portfolios_insert_own on public.portfolios
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy portfolios_update_own on public.portfolios
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy portfolios_delete_own on public.portfolios
  for delete to authenticated
  using ((select auth.uid()) = user_id);
