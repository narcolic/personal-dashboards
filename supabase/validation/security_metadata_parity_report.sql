-- Canonical security metadata validation report.
--
-- Run with:
--   npx --yes supabase@2.116.0 db query --linked \
--     --file supabase/validation/security_metadata_parity_report.sql
--
-- A consumer cutover requires every `gate` row to be `pass`. Rows marked
-- `review` are intentionally explicit unknown/incomplete states and require an
-- operator decision; they are not silently treated as successful metadata.

with recursive
ordered_position_transactions as (
  select
    transaction_row.user_id,
    transaction_row.portfolio_id,
    transaction_row.security_listing_id as listing_id,
    upper(coalesce(nullif(btrim(transaction_row.transaction_currency), ''), 'USD')) as currency,
    lower(transaction_row.action) as action,
    coalesce(transaction_row.shares, 0)::numeric as shares,
    coalesce(transaction_row.price, 0)::numeric as price,
    coalesce(transaction_row.fee_amount, 0)::numeric as fee_amount,
    row_number() over (
      partition by
        transaction_row.user_id,
        transaction_row.portfolio_id,
        transaction_row.security_listing_id,
        upper(coalesce(nullif(btrim(transaction_row.transaction_currency), ''), 'USD'))
      order by
        transaction_row.transaction_date,
        case when lower(transaction_row.action) = 'buy' then 0 else 1 end,
        transaction_row.created_at,
        transaction_row.id
    ) as sequence_number
  from public.transactions transaction_row
  where lower(transaction_row.action) in ('buy', 'sell')
    and transaction_row.security_listing_id is not null
),
position_history as (
  select
    ordered.user_id,
    ordered.portfolio_id,
    ordered.listing_id,
    ordered.currency,
    ordered.sequence_number,
    case when ordered.action = 'buy' then ordered.shares else -ordered.shares end::numeric
      as shares,
    case when ordered.action = 'buy'
      then ordered.shares * ordered.price + ordered.fee_amount
      else 0 end::numeric as cost
  from ordered_position_transactions ordered
  where ordered.sequence_number = 1

  union all

  select
    ordered.user_id,
    ordered.portfolio_id,
    ordered.listing_id,
    ordered.currency,
    ordered.sequence_number,
    case when ordered.action = 'buy'
      then history.shares + ordered.shares
      else history.shares - ordered.shares end::numeric as shares,
    case
      when ordered.action = 'buy'
        then history.cost + ordered.shares * ordered.price + ordered.fee_amount
      when history.shares > 0
        then greatest(0, history.cost - (history.cost / history.shares) * ordered.shares)
      else history.cost
    end::numeric as cost
  from position_history history
  join ordered_position_transactions ordered
    on ordered.user_id = history.user_id
   and ordered.portfolio_id is not distinct from history.portfolio_id
   and ordered.listing_id = history.listing_id
   and ordered.currency = history.currency
   and ordered.sequence_number = history.sequence_number + 1
),
canonical_holdings as (
  select distinct on (
      history.user_id, history.portfolio_id, history.listing_id, history.currency)
    history.user_id,
    coalesce(history.portfolio_id::text, 'unassigned') as portfolio_key,
    history.listing_id,
    listing.symbol,
    history.currency,
    history.shares,
    history.cost
  from position_history history
  join public.security_listings listing on listing.id = history.listing_id
  order by
    history.user_id,
    history.portfolio_id,
    history.listing_id,
    history.currency,
    history.sequence_number desc
),
active_listings as (
  select distinct holding.listing_id
  from canonical_holdings holding
  where holding.shares > 0
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
      'transaction_ids', coalesce(jsonb_agg(id order by id), '[]'::jsonb)
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
      'catalog_ids', coalesce(jsonb_agg(id order by id), '[]'::jsonb)
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
    'canonical_holdings',
    'info',
    count(*)::bigint,
    'observation counter',
    jsonb_build_object(
      'holding_count', count(*),
      'total_shares', coalesce(sum(shares), 0),
      'total_cost', coalesce(sum(cost), 0)
    )
  from canonical_holdings

  union all

  select
    195,
    'info',
    'canonical_catalog_rows',
    'info',
    count(*)::bigint,
    'observation counter',
    jsonb_build_object(
      'first_created_at', min(created_at),
      'last_created_at', max(created_at)
    )
  from public.ticker_catalog

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
