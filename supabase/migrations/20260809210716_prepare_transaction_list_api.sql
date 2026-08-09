create index if not exists transactions_user_date_id_idx
  on public.transactions (user_id, transaction_date desc, id);

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own
  on public.transactions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own
  on public.transactions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own
  on public.transactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
