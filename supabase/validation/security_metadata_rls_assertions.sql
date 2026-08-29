begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  actual integer;
begin
  select count(*) into actual from public.transactions;
  if actual <> 4 then raise exception 'RLS exposed unexpected transaction count: %', actual; end if;

  select count(*) into actual from public.ticker_catalog;
  if actual <> 4 then raise exception 'RLS exposed unexpected catalog count: %', actual; end if;

  select count(*) into actual from public.security_listings;
  if actual <> 4 then raise exception 'authenticated role cannot read shared listings'; end if;

  if has_table_privilege('authenticated', 'public.securities', 'UPDATE') then
    raise exception 'authenticated role can update canonical securities';
  end if;

  if has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'authenticated role has private schema usage';
  end if;
end $$;

rollback;
