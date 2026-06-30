alter table public.transactions
add column if not exists action text;

update public.transactions
set action = 'buy'
where action is null;

alter table public.transactions
alter column action set default 'buy';

alter table public.transactions
alter column action set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_action_check'
  ) then
    alter table public.transactions
    add constraint transactions_action_check
    check (action in ('buy', 'sell', 'dividend', 'fee'));
  end if;
end $$;
