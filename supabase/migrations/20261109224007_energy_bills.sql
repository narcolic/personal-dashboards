create table public.energy_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 1 and 100),
  supply_number text not null check (char_length(btrim(supply_number)) between 1 and 100),
  invoice_number text check (char_length(invoice_number) between 1 and 100),
  bill_type text not null check (bill_type in ('actual', 'estimated')),
  period_start date not null check (period_start >= date '1900-01-01'),
  period_end date not null check (period_end <= date '2200-12-31'),
  billing_days integer not null check (billing_days between 1 and 733),
  issue_date date not null check (issue_date between date '1900-01-01' and date '2200-12-31'),
  due_date date,
  kwh numeric not null check (kwh between 0 and 10000000 and kwh = round(kwh, 3)),
  supply_charges numeric not null,
  regulated_charges numeric not null,
  taxes numeric not null,
  third_party_charges numeric not null,
  adjustment numeric not null default 0,
  current_total numeric not null,
  previous_balance numeric not null default 0,
  amount_due numeric not null,
  fixed_charge numeric check (fixed_charge between 0 and 1000000 and fixed_charge = round(fixed_charge, 2)),
  discount numeric check (discount between -1000000 and 0 and discount = round(discount, 2)),
  document_hash text check (document_hash ~ '^[0-9a-f]{64}$'),
  file_name text check (char_length(file_name) <= 255),
  parser_version text check (char_length(parser_version) <= 60),
  created_at timestamptz not null default now(),
  constraint energy_period check (period_end >= period_start and period_end - period_start <= 732 and issue_date >= period_end),
  constraint energy_due_date check (due_date >= issue_date and due_date <= date '2200-12-31'),
  constraint energy_charge_sum check (supply_charges + regulated_charges + taxes + third_party_charges + adjustment = current_total),
  constraint energy_due_sum check (current_total + previous_balance = amount_due),
  constraint energy_amount_precision check (
    abs(supply_charges) <= 1000000 and supply_charges = round(supply_charges,2) and
    abs(regulated_charges) <= 1000000 and regulated_charges = round(regulated_charges,2) and
    abs(taxes) <= 1000000 and taxes = round(taxes,2) and
    abs(third_party_charges) <= 1000000 and third_party_charges = round(third_party_charges,2) and
    abs(adjustment) <= 1000000 and adjustment = round(adjustment,2) and
    abs(current_total) <= 1000000 and current_total = round(current_total,2) and
    abs(previous_balance) <= 1000000 and previous_balance = round(previous_balance,2) and
    abs(amount_due) <= 1000000 and amount_due = round(amount_due,2)
  )
);
create index energy_bills_owner_date_idx on public.energy_bills(user_id, issue_date desc);
create unique index energy_bills_document_idx on public.energy_bills(user_id, document_hash) where document_hash is not null;
create unique index energy_bills_invoice_idx on public.energy_bills(user_id, lower(provider), supply_number, lower(invoice_number)) where invoice_number is not null;
alter table public.energy_bills enable row level security;
revoke all on public.energy_bills from anon, authenticated;
grant select, insert, update, delete on public.energy_bills to authenticated;
create policy "Own energy bills" on public.energy_bills for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';
