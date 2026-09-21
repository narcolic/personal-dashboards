alter table public.subscriptions
  add column logo_key text check (logo_key is null or length(logo_key) <= 64);
