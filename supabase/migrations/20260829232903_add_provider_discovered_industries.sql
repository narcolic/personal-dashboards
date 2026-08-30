alter table public.industries
  add column source_provider_code text
    references public.metadata_providers(code) on delete restrict,
  add column review_status text not null default 'approved',
  add column reviewed_at timestamptz;

alter table public.industries
  add constraint industries_review_status_check
    check (review_status in ('discovered', 'approved')),
  add constraint industries_discovered_source_check
    check (review_status <> 'discovered' or source_provider_code is not null);

create index industries_source_provider_code_idx
  on public.industries(source_provider_code)
  where source_provider_code is not null;

create unique index industries_sector_normalized_name_key
  on public.industries(sector_code, lower(btrim(name)));

alter table private.metadata_provider_mappings
  add column review_status text not null default 'approved',
  add column reviewed_at timestamptz;

alter table private.metadata_provider_mappings
  add constraint metadata_provider_mappings_review_status_check
    check (review_status in ('discovered', 'approved'));

comment on column public.industries.source_provider_code is
  'Provider that first supplied this industry; null for curated classifications.';
comment on column public.industries.review_status is
  'Provider-discovered industries remain usable while awaiting operator approval.';
comment on column private.metadata_provider_mappings.review_status is
  'Distinguishes reviewed mappings from mappings created by controlled provider discovery.';
