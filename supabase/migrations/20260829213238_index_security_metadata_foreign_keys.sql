create index if not exists companies_industry_sector_idx
  on public.companies(industry_code, sector_code);

create index if not exists security_metadata_refresh_provider_idx
  on private.security_metadata_refresh_state(provider_code);
