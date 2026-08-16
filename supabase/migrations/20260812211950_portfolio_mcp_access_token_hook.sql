-- Configure this function as the project's Custom Access Token Hook after the
-- OAuth 2.1 server and asymmetric JWT signing keys have been enabled.
-- The audience is deliberately a constant canonical resource URI: never derive
-- it from a request header or an OAuth parameter that Supabase does not bind.
create or replace function public.portfolio_mcp_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event->'claims';
  oauth_client_id text := nullif(event->'claims'->>'client_id', '');
begin
  if oauth_client_id is not null then
    claims := jsonb_set(
      claims,
      '{aud}',
      to_jsonb('https://portfolio-terminal-api.yellowforest-c9892f85.northeurope.azurecontainerapps.io/mcp'::text),
      true);
    claims := jsonb_set(claims, '{portfolio_access}', '"read"'::jsonb, true);
    event := jsonb_set(event, '{claims}', claims, true);
  end if;

  return event;
end;
$$;

grant execute on function public.portfolio_mcp_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke execute on function public.portfolio_mcp_access_token_hook(jsonb)
  from public, anon, authenticated;

comment on function public.portfolio_mcp_access_token_hook(jsonb) is
  'Binds OAuth access tokens with client_id to the Portfolio Terminal MCP audience and read-only access claim.';
