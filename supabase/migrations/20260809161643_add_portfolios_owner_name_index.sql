-- Supports ownership filtering plus the stable name ordering used by the .NET API.
create index if not exists idx_portfolios_user_id_name_id
on public.portfolios (user_id, name, id);
