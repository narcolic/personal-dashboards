create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.security_types (
  code text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint security_types_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.regions (
  code text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint regions_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.countries (
  code text primary key,
  name text not null unique,
  region_code text references public.regions(code) on delete restrict,
  created_at timestamptz not null default now(),
  constraint countries_code_format check (code ~ '^[A-Z]{2}$')
);

create index countries_region_code_idx on public.countries(region_code);

create table public.sectors (
  code text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint sectors_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.industries (
  code text primary key,
  sector_code text not null references public.sectors(code) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  constraint industries_code_format check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint industries_name_key unique (sector_code, name),
  constraint industries_code_sector_key unique (code, sector_code)
);

create index industries_sector_code_idx on public.industries(sector_code);

create table public.exchanges (
  id uuid primary key default gen_random_uuid(),
  mic text unique,
  code text not null unique,
  name text not null,
  country_code text references public.countries(code) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exchanges_mic_format check (mic is null or mic ~ '^[A-Z0-9]{4}$'),
  constraint exchanges_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create index exchanges_country_code_idx on public.exchanges(country_code);

create table public.geographic_exposures (
  code text primary key,
  name text not null unique,
  exposure_scope text not null,
  country_code text references public.countries(code) on delete restrict,
  region_code text references public.regions(code) on delete restrict,
  created_at timestamptz not null default now(),
  constraint geographic_exposures_scope_check
    check (exposure_scope in ('country', 'region', 'economic_group', 'global', 'other')),
  constraint geographic_exposures_shape_check check (
    (exposure_scope = 'country' and country_code is not null and region_code is null)
    or (exposure_scope = 'region' and country_code is null and region_code is not null)
    or (exposure_scope in ('economic_group', 'global', 'other') and country_code is null)
  )
);

create index geographic_exposures_country_code_idx
  on public.geographic_exposures(country_code) where country_code is not null;
create index geographic_exposures_region_code_idx
  on public.geographic_exposures(region_code) where region_code is not null;

create table public.market_exposure_categories (
  code text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint market_exposure_categories_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.metadata_providers (
  code text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint metadata_providers_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  country_code text references public.countries(code) on delete restrict,
  sector_code text references public.sectors(code) on delete restrict,
  industry_code text references public.industries(code) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_legal_name_not_blank check (btrim(legal_name) <> ''),
  constraint companies_industry_requires_sector
    check (industry_code is null or sector_code is not null),
  constraint companies_industry_sector_fkey
    foreign key (industry_code, sector_code)
    references public.industries(code, sector_code) on delete restrict
);

create index companies_country_code_idx on public.companies(country_code);
create index companies_sector_code_idx on public.companies(sector_code);
create index companies_industry_code_idx on public.companies(industry_code);

create table public.securities (
  id uuid primary key default gen_random_uuid(),
  security_type_code text not null references public.security_types(code) on delete restrict,
  name text not null,
  company_id uuid references public.companies(id) on delete set null,
  primary_market_country_code text references public.countries(code) on delete restrict,
  geographic_exposure_code text references public.geographic_exposures(code) on delete restrict,
  market_exposure_category_code text references public.market_exposure_categories(code) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint securities_name_not_blank check (btrim(name) <> '')
);

create index securities_security_type_code_idx on public.securities(security_type_code);
create index securities_company_id_idx on public.securities(company_id);
create index securities_primary_market_country_code_idx
  on public.securities(primary_market_country_code) where primary_market_country_code is not null;
create index securities_geographic_exposure_code_idx
  on public.securities(geographic_exposure_code) where geographic_exposure_code is not null;
create index securities_market_exposure_category_code_idx
  on public.securities(market_exposure_category_code)
  where market_exposure_category_code is not null;

create table public.security_listings (
  id uuid primary key default gen_random_uuid(),
  security_id uuid not null references public.securities(id) on delete cascade,
  symbol text not null,
  exchange_id uuid references public.exchanges(id) on delete restrict,
  trading_currency_code text,
  is_primary boolean not null default true,
  status text not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_listings_symbol_not_blank check (btrim(symbol) <> ''),
  constraint security_listings_symbol_normalized check (symbol = upper(btrim(symbol))),
  constraint security_listings_currency_format
    check (trading_currency_code is null or trading_currency_code ~ '^[A-Z]{3,5}$'),
  constraint security_listings_status_check
    check (status in ('provisional', 'active', 'inactive', 'unresolved'))
);

create index security_listings_security_id_idx on public.security_listings(security_id);
create index security_listings_exchange_id_idx on public.security_listings(exchange_id);
create unique index security_listings_exchange_symbol_key
  on public.security_listings(exchange_id, symbol) where exchange_id is not null;

create table public.security_listing_provider_identifiers (
  listing_id uuid not null references public.security_listings(id) on delete cascade,
  provider_code text not null references public.metadata_providers(code) on delete restrict,
  provider_symbol text not null,
  provider_security_id text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (listing_id, provider_code),
  constraint security_listing_provider_symbol_not_blank check (btrim(provider_symbol) <> ''),
  constraint security_listing_provider_symbol_key unique (provider_code, provider_symbol)
);

create index security_listing_provider_identifiers_provider_idx
  on public.security_listing_provider_identifiers(provider_code);

create table public.company_provider_identifiers (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_code text not null references public.metadata_providers(code) on delete restrict,
  provider_company_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, provider_code),
  constraint company_provider_id_not_blank check (btrim(provider_company_id) <> ''),
  constraint company_provider_identifier_key unique (provider_code, provider_company_id)
);

create index company_provider_identifiers_provider_idx
  on public.company_provider_identifiers(provider_code);

create table private.security_metadata_refresh_state (
  listing_id uuid not null references public.security_listings(id) on delete cascade,
  provider_code text not null references public.metadata_providers(code) on delete restrict,
  status text not null default 'pending',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  stale_after timestamptz,
  next_attempt_at timestamptz not null default now(),
  failure_count integer not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (listing_id, provider_code),
  constraint security_metadata_refresh_status_check
    check (status in ('pending', 'processing', 'succeeded', 'incomplete', 'not_found', 'failed', 'rate_limited')),
  constraint security_metadata_refresh_failure_count_check check (failure_count >= 0),
  constraint security_metadata_refresh_error_message_length
    check (error_message is null or length(error_message) <= 500)
);

create index security_metadata_refresh_due_idx
  on private.security_metadata_refresh_state(next_attempt_at, listing_id)
  where status in ('pending', 'succeeded', 'incomplete', 'not_found', 'failed', 'rate_limited');

create table private.security_metadata_provider_observations (
  listing_id uuid not null references public.security_listings(id) on delete cascade,
  provider_code text not null references public.metadata_providers(code) on delete restrict,
  attributes jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (listing_id, provider_code),
  constraint security_metadata_provider_observations_attributes_object
    check (jsonb_typeof(attributes) = 'object'),
  constraint security_metadata_provider_observations_no_holdings
    check (not (attributes ? 'holdings') and not (attributes ? 'sectors'))
);

create index security_metadata_provider_observations_provider_idx
  on private.security_metadata_provider_observations(provider_code);

create table private.metadata_provider_mappings (
  provider_code text not null references public.metadata_providers(code) on delete cascade,
  dimension text not null,
  provider_value text not null,
  canonical_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_code, dimension, provider_value),
  constraint metadata_provider_mappings_dimension_check
    check (dimension in ('security_type', 'country', 'sector', 'industry', 'exchange', 'geographic_exposure', 'market_exposure')),
  constraint metadata_provider_mappings_provider_value_normalized
    check (provider_value = lower(btrim(provider_value))),
  constraint metadata_provider_mappings_canonical_code_not_blank
    check (btrim(canonical_code) <> '')
);

create table private.metadata_field_locks (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  security_id uuid references public.securities(id) on delete cascade,
  listing_id uuid references public.security_listings(id) on delete cascade,
  field_name text not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metadata_field_locks_one_entity
    check (num_nonnulls(company_id, security_id, listing_id) = 1),
  constraint metadata_field_locks_field_name_format
    check (field_name ~ '^[a-z][a-z0-9_]*$'),
  constraint metadata_field_locks_reason_not_blank check (btrim(reason) <> '')
);

create unique index metadata_field_locks_company_field_key
  on private.metadata_field_locks(company_id, field_name) where company_id is not null;
create unique index metadata_field_locks_security_field_key
  on private.metadata_field_locks(security_id, field_name) where security_id is not null;
create unique index metadata_field_locks_listing_field_key
  on private.metadata_field_locks(listing_id, field_name) where listing_id is not null;
create index metadata_field_locks_created_by_idx
  on private.metadata_field_locks(created_by) where created_by is not null;

alter table public.transactions add column if not exists security_listing_id uuid;
alter table public.ticker_catalog add column if not exists security_listing_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_security_listing_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_security_listing_id_fkey
      foreign key (security_listing_id) references public.security_listings(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ticker_catalog_security_listing_id_fkey'
      and conrelid = 'public.ticker_catalog'::regclass
  ) then
    alter table public.ticker_catalog
      add constraint ticker_catalog_security_listing_id_fkey
      foreign key (security_listing_id) references public.security_listings(id) on delete restrict;
  end if;
end $$;

create index if not exists transactions_security_listing_id_idx
  on public.transactions(security_listing_id);
create index if not exists ticker_catalog_security_listing_id_idx
  on public.ticker_catalog(security_listing_id);
create unique index if not exists ticker_catalog_user_listing_key
  on public.ticker_catalog(user_id, security_listing_id)
  where security_listing_id is not null;

-- The API-preparation migration introduced optimized transaction policies but the
-- baseline's quoted policies can still coexist on older databases. Remove only those
-- legacy duplicates; the canonical transactions_* policies remain in place.
drop policy if exists "Users view own transactions" on public.transactions;
drop policy if exists "Users insert own transactions" on public.transactions;
drop policy if exists "Users update own transactions" on public.transactions;
drop policy if exists "Users delete own transactions" on public.transactions;

drop policy if exists "Users view own ticker catalog" on public.ticker_catalog;
drop policy if exists "Users insert own ticker catalog" on public.ticker_catalog;
drop policy if exists "Users update own ticker catalog" on public.ticker_catalog;
drop policy if exists "Users delete own ticker catalog" on public.ticker_catalog;
create policy ticker_catalog_select_own on public.ticker_catalog
  for select to authenticated using ((select auth.uid()) = user_id);
create policy ticker_catalog_insert_own on public.ticker_catalog
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ticker_catalog_update_own on public.ticker_catalog
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy ticker_catalog_delete_own on public.ticker_catalog
  for delete to authenticated using ((select auth.uid()) = user_id);

insert into public.security_types(code, name) values
  ('stock', 'Stock'), ('etf', 'ETF'), ('fund', 'Fund'),
  ('bond', 'Bond'), ('crypto', 'Crypto'), ('other', 'Other')
on conflict (code) do nothing;

insert into public.regions(code, name) values
  ('north_america', 'North America'),
  ('europe', 'Europe'),
  ('asia_pacific', 'Asia Pacific'),
  ('latin_america', 'Latin America'),
  ('middle_east_africa', 'Middle East & Africa')
on conflict (code) do nothing;

insert into public.countries(code, name, region_code) values
  ('US', 'United States', 'north_america'), ('CA', 'Canada', 'north_america'),
  ('GR', 'Greece', 'europe'), ('GB', 'United Kingdom', 'europe'),
  ('DE', 'Germany', 'europe'), ('NL', 'Netherlands', 'europe'),
  ('IE', 'Ireland', 'europe'), ('LU', 'Luxembourg', 'europe'),
  ('FR', 'France', 'europe'), ('CH', 'Switzerland', 'europe'),
  ('ES', 'Spain', 'europe'), ('IT', 'Italy', 'europe'),
  ('BE', 'Belgium', 'europe'), ('AT', 'Austria', 'europe'),
  ('DK', 'Denmark', 'europe'), ('FI', 'Finland', 'europe'),
  ('NO', 'Norway', 'europe'), ('PT', 'Portugal', 'europe'),
  ('SE', 'Sweden', 'europe'), ('JP', 'Japan', 'asia_pacific'),
  ('CN', 'China', 'asia_pacific'), ('TW', 'Taiwan', 'asia_pacific'),
  ('IN', 'India', 'asia_pacific'), ('AU', 'Australia', 'asia_pacific')
on conflict (code) do nothing;

insert into public.sectors(code, name) values
  ('communication_services', 'Communication Services'),
  ('consumer_discretionary', 'Consumer Discretionary'),
  ('consumer_staples', 'Consumer Staples'),
  ('energy', 'Energy'), ('financials', 'Financials'),
  ('health_care', 'Health Care'), ('industrials', 'Industrials'),
  ('information_technology', 'Information Technology'),
  ('materials', 'Materials'), ('real_estate', 'Real Estate'),
  ('utilities', 'Utilities')
on conflict (code) do nothing;

insert into public.exchanges(mic, code, name, country_code) values
  ('XNAS', 'nasdaq', 'Nasdaq', 'US'), ('XNYS', 'nyse', 'New York Stock Exchange', 'US'),
  ('ARCX', 'nyse_arca', 'NYSE Arca', 'US'), ('XLON', 'lse', 'London Stock Exchange', 'GB'),
  ('XETR', 'xetra', 'Xetra', 'DE'), ('XATH', 'athex', 'Athens Exchange', 'GR'),
  ('XAMS', 'euronext_amsterdam', 'Euronext Amsterdam', 'NL')
on conflict (code) do nothing;

insert into public.geographic_exposures(code, name, exposure_scope, country_code, region_code) values
  ('united_states', 'United States', 'country', 'US', null),
  ('greece', 'Greece', 'country', 'GR', null),
  ('north_america', 'North America', 'region', null, 'north_america'),
  ('europe_developed', 'Europe Developed', 'economic_group', null, 'europe'),
  ('developed_world', 'Developed World', 'economic_group', null, null),
  ('emerging_markets', 'Emerging Markets', 'economic_group', null, null),
  ('global', 'Global', 'global', null, null)
on conflict (code) do nothing;

insert into public.market_exposure_categories(code, name) values
  ('broad_market', 'Broad Market'), ('sector', 'Sector'),
  ('thematic', 'Thematic'), ('factor', 'Factor'),
  ('fixed_income', 'Fixed Income'), ('commodity', 'Commodity'),
  ('mixed', 'Mixed'), ('other', 'Other')
on conflict (code) do nothing;

insert into public.metadata_providers(code, name) values
  ('yahoo', 'Yahoo Finance'), ('alpha_vantage', 'Alpha Vantage')
on conflict (code) do nothing;

insert into private.metadata_provider_mappings(provider_code, dimension, provider_value, canonical_code) values
  ('alpha_vantage', 'security_type', 'common stock', 'stock'),
  ('alpha_vantage', 'security_type', 'stock', 'stock'),
  ('alpha_vantage', 'security_type', 'etf', 'etf'),
  ('alpha_vantage', 'country', 'usa', 'US'),
  ('alpha_vantage', 'country', 'united states', 'US'),
  ('alpha_vantage', 'country', 'united kingdom', 'GB'),
  ('alpha_vantage', 'country', 'germany', 'DE'),
  ('alpha_vantage', 'country', 'greece', 'GR'),
  ('alpha_vantage', 'country', 'canada', 'CA'),
  ('alpha_vantage', 'sector', 'technology', 'information_technology'),
  ('alpha_vantage', 'sector', 'information technology', 'information_technology'),
  ('alpha_vantage', 'sector', 'financial services', 'financials'),
  ('alpha_vantage', 'sector', 'financials', 'financials'),
  ('alpha_vantage', 'sector', 'healthcare', 'health_care'),
  ('alpha_vantage', 'sector', 'industrials', 'industrials'),
  ('alpha_vantage', 'sector', 'consumer cyclical', 'consumer_discretionary'),
  ('alpha_vantage', 'sector', 'consumer defensive', 'consumer_staples'),
  ('alpha_vantage', 'sector', 'communication services', 'communication_services'),
  ('alpha_vantage', 'sector', 'basic materials', 'materials'),
  ('alpha_vantage', 'sector', 'real estate', 'real_estate'),
  ('alpha_vantage', 'sector', 'utilities', 'utilities'),
  ('alpha_vantage', 'sector', 'energy', 'energy'),
  ('alpha_vantage', 'exchange', 'nasdaq', 'nasdaq'),
  ('alpha_vantage', 'exchange', 'nyse', 'nyse'),
  ('alpha_vantage', 'exchange', 'nyse arca', 'nyse_arca'),
  ('alpha_vantage', 'exchange', 'xetra', 'xetra'),
  ('alpha_vantage', 'exchange', 'london stock exchange', 'lse')
on conflict (provider_code, dimension, provider_value) do nothing;

do $$
declare
  item record;
  company_key uuid;
  security_key uuid;
  listing_key uuid;
  normalized_type text;
  normalized_currency text;
  exchange_key uuid;
begin
  for item in
    select
      upper(btrim(c.ticker)) as ticker,
      max(nullif(btrim(c.name), '')) as name,
      mode() within group (order by lower(coalesce(nullif(btrim(c.asset_type), ''), 'other'))) as asset_type,
      mode() within group (order by upper(coalesce(nullif(btrim(c.currency), ''), 'USD'))) as currency,
      max(nullif(lower(btrim(c.market)), '')) as market
    from public.ticker_catalog c
    where c.ticker is not null and btrim(c.ticker) <> ''
    group by upper(btrim(c.ticker))
    order by upper(btrim(c.ticker))
  loop
    normalized_type := case
      when item.asset_type in ('stock', 'etf', 'fund', 'bond', 'crypto', 'other') then item.asset_type
      else 'other'
    end;
    normalized_currency := case
      when item.currency ~ '^[A-Z]{3,5}$' then item.currency
      else null
    end;
    company_key := null;

    if normalized_type = 'stock' then
      insert into public.companies(legal_name)
      values (coalesce(item.name, item.ticker))
      returning id into company_key;
    end if;

    insert into public.securities(security_type_code, name, company_id)
    values (normalized_type, coalesce(item.name, item.ticker), company_key)
    returning id into security_key;

    select e.id into exchange_key
    from public.exchanges e
    where e.code = case item.market
      when 'nasdaq' then 'nasdaq'
      when 'nyse' then 'nyse'
      when 'xetra' then 'xetra'
      when 'lse' then 'lse'
      when 'athex' then 'athex'
      else null
    end;

    insert into public.security_listings(
      security_id, symbol, exchange_id, trading_currency_code, status)
    values (
      security_key, item.ticker, exchange_key, normalized_currency,
      case when exchange_key is null then 'provisional' else 'active' end)
    returning id into listing_key;

    insert into public.security_listing_provider_identifiers(
      listing_id, provider_code, provider_symbol, last_verified_at)
    values (listing_key, 'yahoo', item.ticker, now());

    insert into private.security_metadata_refresh_state(
      listing_id, provider_code, status, next_attempt_at)
    values (listing_key, 'alpha_vantage', 'pending', now())
    on conflict (listing_id, provider_code) do nothing;

    update public.ticker_catalog c
    set security_listing_id = listing_key
    where upper(btrim(c.ticker)) = item.ticker
      and c.security_listing_id is null;

    update public.transactions t
    set security_listing_id = listing_key
    where upper(btrim(t.ticker)) = item.ticker
      and t.security_listing_id is null;
  end loop;
end $$;

create temporary table legacy_security_overrides as
  select distinct
    s.id as security_id,
    s.company_id,
    s.security_type_code,
    case
      when l.symbol in ('AETF', 'TPEIR.AT') then 'greece'
      when l.symbol in ('ERNX', 'ERNX.DE') or l.symbol like 'SMEA%' then 'europe_developed'
      when l.symbol in ('VUAA', 'DGRP', 'DGRW') or l.symbol like 'VUAA%' then 'united_states'
      when l.symbol like 'EIMI%' then 'emerging_markets'
      when l.symbol in ('QTUM', 'QUTM') then 'global'
      else null
    end as geographic_exposure_code,
    case
      when l.symbol in ('QTUM', 'QUTM') then 'thematic'
      else null
    end as market_exposure_category_code
  from public.security_listings l
  join public.securities s on s.id = l.security_id;

update public.securities s
set
  geographic_exposure_code = o.geographic_exposure_code,
  market_exposure_category_code = o.market_exposure_category_code,
  updated_at = now()
from legacy_security_overrides o
where o.security_id = s.id
  and o.security_type_code <> 'stock'
  and (o.geographic_exposure_code is not null or o.market_exposure_category_code is not null);

update public.companies company
set country_code = case o.geographic_exposure_code
      when 'greece' then 'GR'
      when 'united_states' then 'US'
      else company.country_code
    end,
    updated_at = now()
from legacy_security_overrides o
where o.company_id = company.id
  and o.security_type_code = 'stock'
  and o.geographic_exposure_code in ('greece', 'united_states');

insert into private.metadata_field_locks(security_id, field_name, reason)
select s.id, 'geographic_exposure_code', 'Migrated from the legacy exact/prefix classification for current listings.'
from public.securities s
where s.security_type_code <> 'stock' and s.geographic_exposure_code is not null
on conflict (security_id, field_name) where security_id is not null do nothing;

insert into private.metadata_field_locks(company_id, field_name, reason)
select distinct company.id, 'country_code',
  'Migrated from the legacy exact classification for a current stock listing.'
from public.companies company
join legacy_security_overrides o on o.company_id = company.id
where o.security_type_code = 'stock'
  and o.geographic_exposure_code in ('greece', 'united_states')
on conflict (company_id, field_name) where company_id is not null do nothing;

insert into private.metadata_field_locks(security_id, field_name, reason)
select s.id, 'market_exposure_category_code', 'Migrated from the legacy classification for current listings.'
from public.securities s
where s.market_exposure_category_code is not null
on conflict (security_id, field_name) where security_id is not null do nothing;

drop table legacy_security_overrides;

create trigger exchanges_touch_updated_at before update on public.exchanges
  for each row execute function public.touch_updated_at();
create trigger companies_touch_updated_at before update on public.companies
  for each row execute function public.touch_updated_at();
create trigger securities_touch_updated_at before update on public.securities
  for each row execute function public.touch_updated_at();
create trigger security_listings_touch_updated_at before update on public.security_listings
  for each row execute function public.touch_updated_at();
create trigger security_listing_provider_identifiers_touch_updated_at
  before update on public.security_listing_provider_identifiers
  for each row execute function public.touch_updated_at();
create trigger company_provider_identifiers_touch_updated_at
  before update on public.company_provider_identifiers
  for each row execute function public.touch_updated_at();
create trigger security_metadata_refresh_state_touch_updated_at
  before update on private.security_metadata_refresh_state
  for each row execute function public.touch_updated_at();
create trigger security_metadata_provider_observations_touch_updated_at
  before update on private.security_metadata_provider_observations
  for each row execute function public.touch_updated_at();
create trigger metadata_provider_mappings_touch_updated_at
  before update on private.metadata_provider_mappings
  for each row execute function public.touch_updated_at();
create trigger metadata_field_locks_touch_updated_at
  before update on private.metadata_field_locks
  for each row execute function public.touch_updated_at();

alter table public.security_types enable row level security;
alter table public.regions enable row level security;
alter table public.countries enable row level security;
alter table public.sectors enable row level security;
alter table public.industries enable row level security;
alter table public.exchanges enable row level security;
alter table public.geographic_exposures enable row level security;
alter table public.market_exposure_categories enable row level security;
alter table public.metadata_providers enable row level security;
alter table public.companies enable row level security;
alter table public.securities enable row level security;
alter table public.security_listings enable row level security;
alter table public.security_listing_provider_identifiers enable row level security;
alter table public.company_provider_identifiers enable row level security;

create policy security_types_authenticated_read on public.security_types
  for select to authenticated using (true);
create policy regions_authenticated_read on public.regions
  for select to authenticated using (true);
create policy countries_authenticated_read on public.countries
  for select to authenticated using (true);
create policy sectors_authenticated_read on public.sectors
  for select to authenticated using (true);
create policy industries_authenticated_read on public.industries
  for select to authenticated using (true);
create policy exchanges_authenticated_read on public.exchanges
  for select to authenticated using (true);
create policy geographic_exposures_authenticated_read on public.geographic_exposures
  for select to authenticated using (true);
create policy market_exposure_categories_authenticated_read on public.market_exposure_categories
  for select to authenticated using (true);
create policy metadata_providers_authenticated_read on public.metadata_providers
  for select to authenticated using (true);
create policy companies_authenticated_read on public.companies
  for select to authenticated using (true);
create policy securities_authenticated_read on public.securities
  for select to authenticated using (true);
create policy security_listings_authenticated_read on public.security_listings
  for select to authenticated using (true);
create policy security_listing_provider_identifiers_authenticated_read
  on public.security_listing_provider_identifiers
  for select to authenticated using (true);
create policy company_provider_identifiers_authenticated_read
  on public.company_provider_identifiers
  for select to authenticated using (true);

revoke all on table
  public.security_types, public.regions, public.countries, public.sectors,
  public.industries, public.exchanges, public.geographic_exposures,
  public.market_exposure_categories, public.metadata_providers,
  public.companies, public.securities, public.security_listings,
  public.security_listing_provider_identifiers, public.company_provider_identifiers
from anon, authenticated;

grant select on table
  public.security_types, public.regions, public.countries, public.sectors,
  public.industries, public.exchanges, public.geographic_exposures,
  public.market_exposure_categories, public.metadata_providers,
  public.companies, public.securities, public.security_listings,
  public.security_listing_provider_identifiers, public.company_provider_identifiers
to authenticated;

grant all on table
  public.security_types, public.regions, public.countries, public.sectors,
  public.industries, public.exchanges, public.geographic_exposures,
  public.market_exposure_categories, public.metadata_providers,
  public.companies, public.securities, public.security_listings,
  public.security_listing_provider_identifiers, public.company_provider_identifiers
to service_role;

revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;
grant usage, select on all sequences in schema private to service_role;

notify pgrst, 'reload schema';
