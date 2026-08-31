-- Run after 20260829191006_persisted_security_metadata.sql on a production-shaped copy.
-- Every result marked expected_zero must return zero before consumer cutover.

select 'transactions_without_listing' as check_name, count(*) as expected_zero
from public.transactions where security_listing_id is null
union all
select 'catalog_without_listing', count(*)
from public.ticker_catalog where security_listing_id is null
union all
select 'broken_transaction_listing_fk', count(*)
from public.transactions transaction_row
left join public.security_listings listing on listing.id = transaction_row.security_listing_id
where transaction_row.security_listing_id is not null and listing.id is null
union all
select 'broken_catalog_listing_fk', count(*)
from public.ticker_catalog catalog
left join public.security_listings listing on listing.id = catalog.security_listing_id
where catalog.security_listing_id is not null and listing.id is null
union all
select 'observations_with_forbidden_etf_arrays', count(*)
from private.security_metadata_provider_observations
where attributes ? 'holdings' or attributes ? 'sectors'
union all
select 'successful_listings_without_alpha_identifier', count(*)
from private.security_metadata_refresh_state state
left join public.security_listing_provider_identifiers identifier
  on identifier.listing_id = state.listing_id
 and identifier.provider_code = 'alpha_vantage'
where state.provider_code = 'alpha_vantage'
  and state.status = 'succeeded'
  and identifier.listing_id is null;

select provider_code, provider_symbol, count(*) as expected_one
from public.security_listing_provider_identifiers
group by provider_code, provider_symbol
having count(*) > 1;

select status, count(*) as listing_count,
       min(last_attempt_at) as oldest_attempt,
       max(last_success_at) as newest_success
from private.security_metadata_refresh_state
where provider_code = 'alpha_vantage'
group by status
order by status;

-- Provider-discovered industries remain usable but must be visible for review.
select industry.code, industry.name, industry.sector_code,
       industry.source_provider_code, industry.review_status,
       mapping.provider_value, mapping.review_status as mapping_review_status
from public.industries industry
left join private.metadata_provider_mappings mapping
  on mapping.provider_code = industry.source_provider_code
 and mapping.dimension = 'industry'
 and mapping.canonical_code = industry.code
where industry.review_status = 'discovered'
order by industry.sector_code, industry.code, mapping.provider_value;

with active_holdings as (
  select distinct transaction_row.security_listing_id
  from public.transactions transaction_row
  where lower(transaction_row.action) = 'buy'
    and transaction_row.security_listing_id is not null
), effective as (
  select listing.id,
         security.security_type_code,
         company.country_code,
         company.sector_code,
         company.industry_code,
         security.geographic_exposure_code,
         state.status
  from active_holdings holding
  join public.security_listings listing on listing.id = holding.security_listing_id
  join public.securities security on security.id = listing.security_id
  left join public.companies company on company.id = security.company_id
  left join private.security_metadata_refresh_state state
    on state.listing_id = listing.id and state.provider_code = 'alpha_vantage'
)
select * from effective
where status not in ('succeeded', 'incomplete')
   or (security_type_code = 'stock' and country_code is null)
   or (security_type_code = 'etf' and geographic_exposure_code is null)
order by id;

-- Canonical financial aggregation after removal of the legacy identity columns.
with canonical as (
  select transaction_row.user_id,
         coalesce(transaction_row.portfolio_id::text, 'unassigned') as portfolio_key,
         listing.symbol as identity,
         upper(coalesce(transaction_row.transaction_currency, 'USD')) as currency,
         sum(coalesce(transaction_row.shares, 0)::numeric) as shares,
         sum(coalesce(transaction_row.shares, 0)::numeric
             * coalesce(transaction_row.price, 0)::numeric) as cost
  from public.transactions transaction_row
  join public.security_listings listing on listing.id = transaction_row.security_listing_id
  where lower(transaction_row.action) = 'buy'
  group by transaction_row.user_id,
           coalesce(transaction_row.portfolio_id::text, 'unassigned'), listing.symbol,
           upper(coalesce(transaction_row.transaction_currency, 'USD'))
)
select * from canonical
order by user_id, portfolio_key, identity, currency;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'transactions', 'ticker_catalog', 'security_types', 'regions', 'countries',
    'sectors', 'industries', 'exchanges', 'geographic_exposures',
    'market_exposure_categories', 'metadata_providers', 'companies',
    'securities', 'security_listings', 'security_listing_provider_identifiers',
    'company_provider_identifiers'
  )
order by tablename, policyname;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated')
  and (table_schema = 'private'
       or table_name in ('companies', 'securities', 'security_listings'))
order by grantee, table_schema, table_name, privilege_type;
