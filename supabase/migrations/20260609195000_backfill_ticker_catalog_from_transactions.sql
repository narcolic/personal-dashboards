insert into public.ticker_catalog (
  user_id,
  ticker,
  name,
  asset_type,
  market,
  currency,
  is_active
)
select distinct on (t.user_id, upper(trim(t.ticker)))
  t.user_id,
  upper(trim(t.ticker)) as ticker,
  nullif(trim(t.name), '') as name,
  nullif(trim(t.asset_type), '') as asset_type,
  nullif(trim(t.market), '') as market,
  nullif(trim(t.currency), '') as currency,
  true as is_active
from public.transactions t
where t.user_id is not null
  and t.ticker is not null
  and trim(t.ticker) <> ''
order by
  t.user_id,
  upper(trim(t.ticker)),
  case when nullif(trim(t.name), '') is not null then 0 else 1 end,
  case when nullif(trim(t.asset_type), '') is not null then 0 else 1 end,
  case when nullif(trim(t.market), '') is not null then 0 else 1 end,
  case when nullif(trim(t.currency), '') is not null then 0 else 1 end,
  t.transaction_date desc nulls last,
  t.created_at desc
on conflict (user_id, ticker) do update
set
  name = coalesce(public.ticker_catalog.name, excluded.name),
  asset_type = coalesce(public.ticker_catalog.asset_type, excluded.asset_type),
  market = coalesce(public.ticker_catalog.market, excluded.market),
  currency = coalesce(public.ticker_catalog.currency, excluded.currency),
  is_active = true,
  updated_at = now();

notify pgrst, 'reload schema';
