-- Alpha Vantage does not return compatible matches for these ATHEX instruments.
-- Their canonical metadata is sourced from the Athens Exchange and issuer materials,
-- then protected with field-level locks. The application treats Alpha Vantage
-- not_found as terminal during normal runs; operators can still retry with force.

insert into public.metadata_providers(code, name)
values ('athex', 'Athens Exchange')
on conflict (code) do nothing;

insert into public.industries(code, name, sector_code, review_status, reviewed_at)
values ('banks', 'Banks', 'financials', 'approved', now())
on conflict (code) do nothing;

update public.security_listings listing
set exchange_id = exchange.id,
    trading_currency_code = 'EUR',
    status = 'active',
    updated_at = now()
from public.exchanges exchange
where exchange.code = 'athex'
  and upper(listing.symbol) in ('TPEIR.AT', 'AETF.AT');

update public.securities security
set name = 'Piraeus Bank S.A.',
    security_type_code = 'stock',
    updated_at = now()
from public.security_listings listing
where listing.security_id = security.id
  and upper(listing.symbol) = 'TPEIR.AT';

update public.companies company
set legal_name = 'Piraeus Bank S.A.',
    country_code = 'GR',
    sector_code = 'financials',
    industry_code = 'banks',
    updated_at = now()
from public.securities security
join public.security_listings listing on listing.security_id = security.id
where company.id = security.company_id
  and upper(listing.symbol) = 'TPEIR.AT';

update public.securities security
set name = 'ALPHA ETF FTSE/ATHEX Large Cap Equity UCITS',
    security_type_code = 'etf',
    primary_market_country_code = 'GR',
    geographic_exposure_code = 'greece',
    market_exposure_category_code = 'broad_market',
    updated_at = now()
from public.security_listings listing
where listing.security_id = security.id
  and upper(listing.symbol) = 'AETF.AT';

insert into public.security_listing_provider_identifiers(
  listing_id,
  provider_code,
  provider_symbol,
  provider_security_id,
  last_verified_at)
select
  listing.id,
  'athex',
  case upper(listing.symbol)
    when 'TPEIR.AT' then 'TPEIR'
    when 'AETF.AT' then 'AETF'
  end,
  case upper(listing.symbol)
    when 'TPEIR.AT' then 'GRS831003009'
    when 'AETF.AT' then 'GRF000153004'
  end,
  now()
from public.security_listings listing
where upper(listing.symbol) in ('TPEIR.AT', 'AETF.AT')
on conflict (listing_id, provider_code) do update
set provider_symbol = excluded.provider_symbol,
    provider_security_id = excluded.provider_security_id,
    last_verified_at = excluded.last_verified_at,
    updated_at = now();

insert into private.metadata_field_locks(company_id, field_name, reason)
select company.id, field.field_name,
  'Reviewed against the Athens Exchange corporate-action notice dated 2025-12-22.'
from public.companies company
join public.securities security on security.company_id = company.id
join public.security_listings listing on listing.security_id = security.id
cross join (values
  ('legal_name'),
  ('country_code'),
  ('sector_code'),
  ('industry_code')
) as field(field_name)
where upper(listing.symbol) = 'TPEIR.AT'
on conflict (company_id, field_name) where company_id is not null do update
set reason = excluded.reason,
    updated_at = now();

insert into private.metadata_field_locks(security_id, field_name, reason)
select security.id, field.field_name,
  case upper(listing.symbol)
    when 'TPEIR.AT' then
      'Reviewed against the Athens Exchange corporate-action notice dated 2025-12-22.'
    else
      'Reviewed against the Athens Exchange and Alpha Asset Management ETF records.'
  end
from public.securities security
join public.security_listings listing on listing.security_id = security.id
cross join (values
  ('name'),
  ('security_type_code'),
  ('primary_market_country_code'),
  ('geographic_exposure_code'),
  ('market_exposure_category_code')
) as field(field_name)
where upper(listing.symbol) in ('TPEIR.AT', 'AETF.AT')
  and (
    upper(listing.symbol) = 'AETF.AT'
    or field.field_name in ('name', 'security_type_code')
  )
on conflict (security_id, field_name) where security_id is not null do update
set reason = excluded.reason,
    updated_at = now();

insert into private.metadata_field_locks(listing_id, field_name, reason)
select listing.id, field.field_name,
  'Reviewed against official Athens Exchange instrument records.'
from public.security_listings listing
cross join (values ('exchange_id'), ('trading_currency_code')) as field(field_name)
where upper(listing.symbol) in ('TPEIR.AT', 'AETF.AT')
on conflict (listing_id, field_name) where listing_id is not null do update
set reason = excluded.reason,
    updated_at = now();

update private.security_metadata_refresh_state state
set status = 'not_found',
    stale_after = null,
    error_code = 'not_found',
    error_message = 'No compatible Alpha Vantage symbol; canonical metadata is maintained by reviewed manual overrides.',
    updated_at = now()
from public.security_listings listing
where listing.id = state.listing_id
  and state.provider_code = 'alpha_vantage'
  and upper(listing.symbol) in ('TPEIR.AT', 'AETF.AT');
