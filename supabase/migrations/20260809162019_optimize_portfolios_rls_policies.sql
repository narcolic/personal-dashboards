-- Evaluate auth.uid() once per statement rather than once per candidate row.
alter policy portfolios_select_own on public.portfolios
using ((select auth.uid()) = user_id);

alter policy portfolios_insert_own on public.portfolios
with check ((select auth.uid()) = user_id);

alter policy portfolios_update_own on public.portfolios
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy portfolios_delete_own on public.portfolios
using ((select auth.uid()) = user_id);
