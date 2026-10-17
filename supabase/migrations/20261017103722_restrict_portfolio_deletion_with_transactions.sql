-- Replace the historical CASCADE/SET NULL variants atomically with a restriction.
-- No portfolio or transaction data is changed by this migration.
do $migration$
declare
  portfolio_fk record;
begin
  for portfolio_fk in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and confrelid = 'public.portfolios'::regclass
      and contype = 'f'
      and conkey = array[(select attnum from pg_attribute
        where attrelid = 'public.transactions'::regclass and attname = 'portfolio_id')]
  loop
    execute format('alter table public.transactions drop constraint %I', portfolio_fk.conname);
  end loop;
end
$migration$;

alter table public.transactions
  add constraint transactions_portfolio_id_fkey
  foreign key (portfolio_id) references public.portfolios(id) on delete restrict;
