do $$
declare
  actual integer;
begin
  select count(*) into actual from public.transactions where security_listing_id is null;
  if actual <> 0 then raise exception 'unlinked transactions: %', actual; end if;

  select count(*) into actual from public.ticker_catalog where security_listing_id is null;
  if actual <> 0 then raise exception 'unlinked catalog rows: %', actual; end if;

  select count(*) into actual from public.security_listings;
  if actual <> 4 then raise exception 'expected 4 canonical listings, found %', actual; end if;

  select count(*) into actual
  from public.security_listing_provider_identifiers where provider_code = 'yahoo';
  if actual <> 4 then raise exception 'expected 4 Yahoo identifiers, found %', actual; end if;

  select count(*) into actual
  from private.security_metadata_refresh_state
  where provider_code = 'alpha_vantage' and status = 'pending';
  if actual <> 4 then raise exception 'expected 4 pending refresh rows, found %', actual; end if;

  select count(*) into actual
  from public.security_listings listing
  join public.ticker_catalog catalog on catalog.security_listing_id = listing.id
  where listing.symbol = 'MSFT';
  if actual <> 2 then raise exception 'shared MSFT listing was not reused by both catalogs'; end if;

  select count(*) into actual
  from public.security_listings listing
  join public.securities security on security.id = listing.security_id
  where listing.symbol = 'VUAA' and security.geographic_exposure_code = 'united_states';
  if actual <> 1 then raise exception 'VUAA override was not migrated'; end if;

  select count(*) into actual
  from public.security_listings listing
  join public.securities security on security.id = listing.security_id
  where listing.symbol = 'QTUM'
    and security.geographic_exposure_code = 'global'
    and security.market_exposure_category_code = 'thematic';
  if actual <> 1 then raise exception 'QTUM global/thematic split was not migrated'; end if;

  select count(*) into actual
  from public.security_listings listing
  join public.securities security on security.id = listing.security_id
  where listing.symbol = 'ERNX' and security.geographic_exposure_code = 'europe_developed';
  if actual <> 1 then raise exception 'catalog-only ERNX override was not migrated'; end if;

  select count(*) into actual from private.metadata_field_locks;
  if actual <> 4 then raise exception 'expected 4 exact field locks, found %', actual; end if;
end $$;

select 1 / case when count(*) = 0 then 1 else 0 end as canonical_links_valid
from public.transactions transaction_row
left join public.security_listings listing
  on listing.id = transaction_row.security_listing_id
where listing.id is null;
