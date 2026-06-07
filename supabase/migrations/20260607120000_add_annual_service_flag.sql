alter table public.service_visits
add column is_annual_service boolean not null default false;
