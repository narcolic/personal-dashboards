-- Security metadata coexistence report.
--
-- Run with:
--   npx --yes supabase@2.116.0 db query --linked \
--     --file supabase/validation/security_metadata_parity_report.sql
--
-- A consumer cutover requires every `gate` row to be `pass`. Rows marked
-- `review` are intentionally explicit unknown/incomplete states and require an
-- operator decision; they are not silently treated as successful metadata.

with
legacy_holdings as (
  select
    transaction_row.user_id,
    coalesce(transaction_row.portfolio_id::text, 'unassigned') as portfolio_key,
    upper(btrim(transaction_row.ticker)) as symbol,
    upper(coalesce(nullif(btrim(transaction_row.currency), ''), 'USD')) as currency,
    sum(coalesce(transaction_row.shares, 0)::numeric) as shares,
    sum(
      coalesce(transaction_row.shares, 0)::numeric
      * coalesce(transaction_row.price, 0)::numeric
    ) as cost
  from public.transactions transaction_row
  where lower(transaction_row.action) = 'buy'
    and transaction_row.ticker is not null
  group by
    transaction_row.user_id,
    coalesce(transaction_row.portfolio_id::text, 'unassigned'),
    upper(btrim(transaction_row.ticker)),
    upper(coalesce(nullif(btrim(transaction_row.currency), ''), 'USD'))
),
canonical_holdings as (
  select
    transaction_row.user_id,
    coalesce(transaction_row.portfolio_id::text, 'unassigned') as portfolio_key,
    listing.symbol,
    upper(coalesce(nullif(btrim(transaction_row.currency), ''), 'USD')) as currency,
    sum(coalesce(transaction_row.shares, 0)::numeric) as shares,
    sum(
      coalesce(transaction_row.shares, 0)::numeric
      * coalesce(transaction_row.price, 0)::numeric
    ) as cost
  from public.transactions transaction_row
  join public.security_listings listing
    on listing.id = transaction_row.security_listing_id
  where lower(transaction_row.action) = 'buy'
    and transaction_row.ticker is not null
  group by
    transaction_row.user_id,
    coalesce(transaction_row.portfolio_id::text, 'unassigned'),
    listing.symbol,
    upper(coalesce(nullif(btrim(transaction_row.currency), ''), 'USD'))
),
parity_differences as (
  select
    coalesce(legacy.user_id, canonical.user_id) as user_id,
    coalesce(legacy.portfolio_key, canonical.portfolio_key) as portfolio_key,
    coalesce(legacy.symbol, canonical.symbol) as symbol,
    coalesce(legacy.currency, canonical.currency) as currency,
    legacy.shares as legacy_shares,
    canonical.shares as canonical_shares,
    legacy.cost as legacy_cost,
    canonical.cost as canonical_cost
  from legacy_holdings legacy
  full join canonical_holdings canonical
    using (user_id, portfolio_key, symbol, currency)
  where legacy.shares is distinct from canonical.shares
     or legacy.cost is distinct from canonical.cost
),
active_listings as (
  -- This intentionally matches the application's current buy-only holding
  -- semantics. It must change together with PortfolioHoldingCalculator if
  -- sell transactions become quantity-affecting in a later feature.
  select distinct transaction_row.security_listing_id as listing_id
  from public.transactions transaction_row
  where lower(transaction_row.action) = 'buy'
    and coalesce(transaction_row.shares, 0) > 0
    and transaction_row.security_listing_id is not null
),
effective_metadata as (
  select
    listing.id as listing_id,
    listing.symbol,
    security.id as security_id,
    security.company_id,
    security.security_type_code,
    company.country_code,
    company.sector_code,
    company.industry_code,
    security.geographic_exposure_code,
    state.status as metadata_status,
    state.last_attempt_at,
    state.last_success_at,
    state.error_code,
    exists (
      select 1
      from private.metadata_field_locks field_lock
      where field_lock.listing_id = listing.id
         or field_lock.security_id = security.id
         or field_lock.company_id = security.company_id
    ) as has_manual_lock
  from active_listings active
  join public.security_listings listing on listing.id = active.listing_id
  join public.securities security on security.id = listing.security_id
  left join public.companies company on company.id = security.company_id
  left join private.security_metadata_refresh_state state
    on state.listing_id = listing.id
   and state.provider_code = 'alpha_vantage'
),
duplicate_provider_identifiers as (
  select provider_code, provider_symbol, count(*) as duplicate_count
  from public.security_listing_provider_identifiers
  group by provider_code, provider_symbol
  having count(*) > 1
),
forbidden_observations as (
  select listing.symbol, observation.provider_code
  from private.security_metadata_provider_observations observation
  join public.security_listings listing on listing.id = observation.listing_id
  where observation.attributes ?| array[
      'holdings',
      'constituents',
      'sectors',
      'sector_weights',
      'percentage_exposures'
    ]
    or jsonb_path_exists(
      observation.attributes,
      '$.** ? (@.type() == "array")'
    )
),
report as (
  select
    10 as sort_order,
    'gate'::text as category,
    'transactions_without_listing'::text as check_name,
    case when count(*) = 0 then 'pass' else 'fail' end::text as status,
    count(*)::bigint as actual,
    '0'::text as expected,
    jsonb_build_object(
      'symbols', coalesce(jsonb_agg(distinct upper(btrim(ticker))), '[]'::jsonb)
    ) as details
  from public.transactions
  where security_listing_id is null

  union all

  select
    20,
    'gate',
    'catalog_rows_without_listing',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'symbols', coalesce(jsonb_agg(distinct upper(btrim(ticker))), '[]'::jsonb)
    )
  from public.ticker_catalog
  where security_listing_id is null

  union all

  select
    30,
    'gate',
    'duplicate_provider_identifiers',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'duplicates', coalesce(jsonb_agg(to_jsonb(duplicate_provider_identifiers)), '[]'::jsonb)
    )
  from duplicate_provider_identifiers

  union all

  select
    40,
    'gate',
    'observations_with_forbidden_arrays',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'observations', coalesce(jsonb_agg(to_jsonb(forbidden_observations)), '[]'::jsonb)
    )
  from forbidden_observations

  union all

  select
    50,
    'gate',
    'holding_quantity_or_cost_differences',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'legacy_holding_count', (select count(*) from legacy_holdings),
      'canonical_holding_count', (select count(*) from canonical_holdings),
      'differences', coalesce(jsonb_agg(to_jsonb(parity_differences)), '[]'::jsonb)
    )
  from parity_differences

  union all

  select
    60,
    'gate',
    'active_listings_without_accepted_metadata_state',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'listings', coalesce(
        jsonb_agg(jsonb_build_object(
          'symbol', symbol,
          'status', metadata_status,
          'error_code', error_code,
          'last_attempt_at', last_attempt_at
        ) order by symbol),
        '[]'::jsonb
      )
    )
  from effective_metadata
  where metadata_status is null
     or metadata_status not in ('succeeded', 'incomplete', 'not_found')

  union all

  select
    65,
    'gate',
    'active_incomplete_without_manual_lock',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'symbols', coalesce(jsonb_agg(symbol order by symbol), '[]'::jsonb)
    )
  from effective_metadata
  where metadata_status = 'incomplete'
    and not has_manual_lock

  union all

  select
    70,
    'gate',
    'active_not_found_without_manual_lock',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'symbols', coalesce(jsonb_agg(symbol order by symbol), '[]'::jsonb)
    )
  from effective_metadata
  where metadata_status = 'not_found'
    and not has_manual_lock

  union all

  select
    80,
    'gate',
    'stale_processing_claims',
    case when count(*) = 0 then 'pass' else 'fail' end,
    count(*)::bigint,
    '0',
    jsonb_build_object(
      'listings', coalesce(
        jsonb_agg(jsonb_build_object(
          'symbol', listing.symbol,
          'last_attempt_at', state.last_attempt_at
        ) order by listing.symbol),
        '[]'::jsonb
      )
    )
  from private.security_metadata_refresh_state state
  join public.security_listings listing on listing.id = state.listing_id
  where state.status = 'processing'
    and state.last_attempt_at < now() - interval '1 hour'

  union all

  select
    100,
    'info',
    'active_incomplete_metadata_inventory',
    'info',
    count(*)::bigint,
    'inventory',
    jsonb_build_object(
      'listings', coalesce(
        jsonb_agg(jsonb_build_object(
          'symbol', symbol,
          'has_manual_lock', has_manual_lock
        ) order by symbol),
        '[]'::jsonb
      )
    )
  from effective_metadata
  where metadata_status = 'incomplete'

  union all

  select
    110,
    'review',
    'active_stock_classification_gaps',
    case when count(*) = 0 then 'pass' else 'review' end,
    count(*)::bigint,
    'operator review',
    jsonb_build_object(
      'listings', coalesce(
        jsonb_agg(jsonb_build_object(
          'symbol', symbol,
          'country_missing', country_code is null,
          'sector_missing', sector_code is null,
          'industry_missing', industry_code is null
        ) order by symbol),
        '[]'::jsonb
      )
    )
  from effective_metadata
  where security_type_code = 'stock'
    and (country_code is null or sector_code is null or industry_code is null)

  union all

  select
    120,
    'review',
    'active_etf_geography_gaps',
    case when count(*) = 0 then 'pass' else 'review' end,
    count(*)::bigint,
    'operator review',
    jsonb_build_object(
      'symbols', coalesce(jsonb_agg(symbol order by symbol), '[]'::jsonb)
    )
  from effective_metadata
  where security_type_code = 'etf'
    and geographic_exposure_code is null

  union all

  select
    130,
    'review',
    'provider_discovered_industries',
    case when count(*) = 0 then 'pass' else 'review' end,
    count(*)::bigint,
    'operator review',
    jsonb_build_object(
      'industries', coalesce(
        jsonb_agg(jsonb_build_object(
          'code', industry.code,
          'name', industry.name,
          'sector_code', industry.sector_code,
          'provider', industry.source_provider_code
        ) order by industry.sector_code, industry.code),
        '[]'::jsonb
      )
    )
  from public.industries industry
  where industry.review_status = 'discovered'

  union all

  select
    140,
    'review',
    'provider_failures_or_rate_limits',
    case when count(*) = 0 then 'pass' else 'review' end,
    count(*)::bigint,
    'operator review',
    jsonb_build_object(
      'listings', coalesce(
        jsonb_agg(jsonb_build_object(
          'symbol', listing.symbol,
          'status', state.status,
          'error_code', state.error_code,
          'next_attempt_at', state.next_attempt_at
        ) order by listing.symbol),
        '[]'::jsonb
      )
    )
  from private.security_metadata_refresh_state state
  join public.security_listings listing on listing.id = state.listing_id
  where state.provider_code = 'alpha_vantage'
    and state.status in ('failed', 'rate_limited')

  union all

  select
    190,
    'info',
    'canonical_only_transaction_writes',
    'info',
    count(*)::bigint,
    'observation counter',
    jsonb_build_object(
      'first_created_at', min(created_at),
      'last_created_at', max(created_at)
    )
  from public.transactions
  where security_listing_id is not null
    and ticker is null
    and name is null
    and asset_type is null
    and market is null

  union all

  select
    195,
    'info',
    'canonical_only_catalog_writes',
    'info',
    count(*)::bigint,
    'observation counter',
    jsonb_build_object(
      'first_created_at', min(created_at),
      'last_created_at', max(created_at)
    )
  from public.ticker_catalog
  where security_listing_id is not null
    and ticker is null
    and name is null
    and asset_type is null
    and market is null
    and currency is null

  union all

  select
    200,
    'info',
    'refresh_status_summary',
    'info',
    count(*)::bigint,
    'n/a',
    jsonb_build_object(
      'by_status', coalesce(
        (
          select jsonb_object_agg(summary.status, summary.listing_count)
          from (
            select status, count(*) as listing_count
            from private.security_metadata_refresh_state
            where provider_code = 'alpha_vantage'
            group by status
            order by status
          ) summary
        ),
        '{}'::jsonb
      )
    )
  from private.security_metadata_refresh_state
  where provider_code = 'alpha_vantage'

  union all

  select
    210,
    'info',
    'manual_field_locks',
    'info',
    count(*)::bigint,
    'n/a',
    jsonb_build_object(
      'by_entity', jsonb_build_object(
        'company', count(*) filter (where company_id is not null),
        'security', count(*) filter (where security_id is not null),
        'listing', count(*) filter (where listing_id is not null)
      )
    )
  from private.metadata_field_locks

  union all

  select
    220,
    'info',
    'market_value_and_allocation_parity',
    'info',
    0::bigint,
    'API cutover check',
    jsonb_build_object(
      'note', 'Live quote market value and allocation parity must be compared at the API layer during consumer cutover; this SQL report proves persisted quantities and cost basis only.'
    )
)
select
  category,
  check_name,
  status,
  actual,
  expected,
  details
from report
order by sort_order;
