-- Final destructive cleanup after canonical linkage, consumer cutover, and the
-- deployed observation window have all passed. Abort before changing anything
-- if the data no longer satisfies the cleanup gates.
do $$
begin
  if exists (
    select 1 from public.transactions where security_listing_id is null
  ) then
    raise exception 'Cannot finalize security metadata: transactions without listings remain.';
  end if;

  if exists (
    select 1 from public.ticker_catalog where security_listing_id is null
  ) then
    raise exception 'Cannot finalize security metadata: catalog rows without listings remain.';
  end if;
end
$$;

alter table public.transactions
  alter column security_listing_id set not null;

alter table public.ticker_catalog
  alter column security_listing_id set not null;

drop index if exists public.ticker_catalog_user_listing_key;
create unique index ticker_catalog_user_listing_key
  on public.ticker_catalog(user_id, security_listing_id);

alter table public.transactions
  rename column currency to transaction_currency;

alter table public.transactions
  drop column ticker,
  drop column name,
  drop column asset_type,
  drop column market;

alter table public.ticker_catalog
  drop column ticker,
  drop column name,
  drop column asset_type,
  drop column market,
  drop column currency;

comment on column public.transactions.transaction_currency is
  'Currency of the transaction price; distinct from the listing trading currency.';
