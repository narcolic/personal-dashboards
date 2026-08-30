-- Representative pre-migration data for local backfill verification.
-- Apply after resetting through 20260812211950 and before the metadata migration.

insert into auth.users(id, email, aud, role, created_at, updated_at) values
  ('10000000-0000-0000-0000-000000000001', 'metadata-one@example.test',
   'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'metadata-two@example.test',
   'authenticated', 'authenticated', now(), now());

insert into public.ticker_catalog(
  user_id, ticker, name, asset_type, market, currency, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'MSFT', 'Microsoft', 'stock', 'nasdaq', 'USD', true),
  ('10000000-0000-0000-0000-000000000001', 'VUAA', 'Vanguard S&P 500', 'etf', null, 'USD', true),
  ('10000000-0000-0000-0000-000000000001', 'QTUM', 'Defiance Quantum ETF', 'etf', null, 'USD', true),
  ('10000000-0000-0000-0000-000000000001', 'ERNX', 'European ETF', 'etf', 'xetra', 'EUR', true),
  ('10000000-0000-0000-0000-000000000002', 'MSFT', 'Microsoft Corporation', 'stock', 'nasdaq', 'USD', true),
  ('10000000-0000-0000-0000-000000000002', 'VUAA', 'Vanguard S&P 500', 'etf', null, 'USD', true);

insert into public.transactions(
  user_id, ticker, action, name, asset_type, market, currency,
  shares, price, transaction_date, notes) values
  ('10000000-0000-0000-0000-000000000001', 'MSFT', 'buy', null, 'stock', null, 'USD', 2, 100, '2026-01-02', null),
  ('10000000-0000-0000-0000-000000000001', 'MSFT', 'buy', null, 'etf', null, 'USD', 1, 110, '2026-02-02', 'historical type conflict'),
  ('10000000-0000-0000-0000-000000000001', 'VUAA', 'buy', null, 'etf', null, 'USD', 3, 90, '2026-03-02', null),
  ('10000000-0000-0000-0000-000000000001', 'QTUM', 'buy', null, 'etf', null, 'USD', 4, 50, '2026-04-02', null),
  ('10000000-0000-0000-0000-000000000002', 'MSFT', 'buy', null, 'stock', null, 'USD', 5, 120, '2026-05-02', null),
  ('10000000-0000-0000-0000-000000000002', 'VUAA', 'buy', null, 'etf', null, 'USD', 6, 95, '2026-06-02', null);
