-- Reviewed ETF classifications are based on each issuer's published fund
-- mandate/tracked index. Exchange and trading currency are deliberately not
-- used as geographic signals.

create temporary table reviewed_etf_classifications (
  symbol text primary key,
  geographic_exposure_code text not null,
  market_exposure_category_code text not null,
  reason text not null
) on commit drop;

insert into reviewed_etf_classifications(
  symbol,
  geographic_exposure_code,
  market_exposure_category_code,
  reason
) values
  (
    'DGRW.L',
    'united_states',
    'factor',
    'Reviewed against the WisdomTree US Quality Dividend Growth UCITS ETF fund objective.'
  ),
  (
    'EUNK.DE',
    'europe_developed',
    'broad_market',
    'Reviewed against the iShares Core MSCI Europe UCITS ETF fund objective and tracked index.'
  ),
  (
    'EUNL.DE',
    'developed_world',
    'broad_market',
    'Reviewed against the iShares Core MSCI World UCITS ETF fund objective and tracked index.'
  ),
  (
    'IS3N.DE',
    'emerging_markets',
    'broad_market',
    'Reviewed against the iShares Core MSCI Emerging Markets IMI UCITS ETF fund objective and tracked index.'
  ),
  (
    'QUTM.DE',
    'global',
    'thematic',
    'Reviewed against the VanEck Quantum Computing UCITS ETF global thematic fund objective.'
  ),
  (
    'XDEQ.DE',
    'developed_world',
    'factor',
    'Reviewed against the Xtrackers MSCI World Quality UCITS ETF fund objective and tracked factor index.'
  );

update public.securities security
set geographic_exposure_code = reviewed.geographic_exposure_code,
    market_exposure_category_code = reviewed.market_exposure_category_code,
    updated_at = now()
from public.security_listings listing
join reviewed_etf_classifications reviewed
  on reviewed.symbol = listing.symbol
where listing.security_id = security.id
  and security.security_type_code = 'etf';

insert into private.metadata_field_locks(security_id, field_name, reason)
select
  security.id,
  field.field_name,
  reviewed.reason
from public.security_listings listing
join public.securities security on security.id = listing.security_id
join reviewed_etf_classifications reviewed on reviewed.symbol = listing.symbol
cross join (
  values ('geographic_exposure_code'), ('market_exposure_category_code')
) as field(field_name)
where security.security_type_code = 'etf'
on conflict (security_id, field_name) where security_id is not null do update
set reason = excluded.reason,
    updated_at = now();

-- These provider-discovered values have been reviewed against the companies
-- currently using them and their canonical parent sectors.
update public.industries
set review_status = 'approved',
    reviewed_at = now()
where code in (
  'internet_content_information',
  'semiconductors',
  'software_infrastructure'
)
  and review_status = 'discovered';

update private.metadata_provider_mappings
set review_status = 'approved',
    reviewed_at = now(),
    updated_at = now()
where provider_code = 'alpha_vantage'
  and dimension = 'industry'
  and canonical_code in (
    'internet_content_information',
    'semiconductors',
    'software_infrastructure'
  );

-- A clean migration replay has no user-derived listings or discovered industries.
-- Accept the empty case, retain the exact production assertions for a complete
-- reviewed set, and reject partial sets so missing backfill data cannot pass.
do $$
declare
  actual integer;
  reviewed_industry_count integer;
  reviewed_listing_count integer;
begin
  select count(distinct reviewed.symbol) into reviewed_listing_count
  from reviewed_etf_classifications reviewed
  join public.security_listings listing on listing.symbol = reviewed.symbol;

  if reviewed_listing_count not in (0, 6) then
    raise exception
      'expected either no reviewed ETF listings or all 6, found %',
      reviewed_listing_count;
  end if;

  select count(*) into actual
  from reviewed_etf_classifications reviewed
  join public.security_listings listing on listing.symbol = reviewed.symbol
  join public.securities security on security.id = listing.security_id
  where security.geographic_exposure_code = reviewed.geographic_exposure_code
    and security.market_exposure_category_code = reviewed.market_exposure_category_code;

  if reviewed_listing_count = 6 and actual <> 6 then
    raise exception 'expected 6 reviewed ETF classifications, found %', actual;
  end if;

  select count(*) into actual
  from reviewed_etf_classifications reviewed
  join public.security_listings listing on listing.symbol = reviewed.symbol
  join public.securities security on security.id = listing.security_id
  join private.metadata_field_locks field_lock on field_lock.security_id = security.id
  where field_lock.field_name in (
    'geographic_exposure_code',
    'market_exposure_category_code'
  );

  if reviewed_listing_count = 6 and actual <> 12 then
    raise exception 'expected 12 reviewed ETF field locks, found %', actual;
  end if;

  select count(*) into reviewed_industry_count
  from public.industries
  where code in (
    'internet_content_information',
    'semiconductors',
    'software_infrastructure'
  );

  if reviewed_industry_count not in (0, 3) then
    raise exception
      'expected either no reviewed provider industries or all 3, found %',
      reviewed_industry_count;
  end if;

  select count(*) into actual
  from public.industries
  where code in (
    'internet_content_information',
    'semiconductors',
    'software_infrastructure'
  )
    and review_status = 'approved'
    and reviewed_at is not null;

  if reviewed_industry_count = 3 and actual <> 3 then
    raise exception 'expected 3 approved provider-discovered industries, found %', actual;
  end if;
end $$;
