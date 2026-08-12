# Portfolio Terminal backend

This directory contains the .NET 10 backend foundation. The existing React client
continues to use Supabase directly except for the vertical slices listed below.

## Projects

- `App.Api`: ASP.NET Core Minimal API host, Supabase JWT validation, CORS, OpenAPI,
  error handling, and health endpoints.
- `App.Data`: shared Npgsql connection pool. Existing `supabase/migrations` files
  remain the authoritative schema history.
- `App.Portfolio`: portfolio queries, commands, holdings, market data, and snapshot logic.
- `App.CarService`: vehicle, service-visit, reminder, and analytics logic.
- `App.Tests`: foundation-level integration tests.

## Configure

Set these environment variables before running the API:

```text
Supabase__Url=https://xcqxfyylqtcgmugpnjzt.supabase.co
Supabase__Audience=authenticated
ConnectionStrings__AppDatabase=Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true
Cors__AllowedOrigins__0=http://localhost:5173
Mcp__ResourceUri=https://portfolio-terminal-api.yellowforest-c9892f85.northeurope.azurecontainerapps.io/mcp
Mcp__AuthorizationServer=https://xcqxfyylqtcgmugpnjzt.supabase.co/auth/v1
Mcp__RequiredAccessClaim=read
Mcp__MaxHoldings=100
```

The backend does not load the Vite `.env` file. Configure `Supabase__Url` in the
API process environment (or keep `appsettings.json` aligned with the frontend project).

For local development, keep the database password out of files and set the
connection string through .NET user secrets:

```powershell
dotnet user-secrets set "ConnectionStrings:AppDatabase" "Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true" --project .\src\App.Api\App.Api.csproj
```

Use Supabase's direct connection for a persistent backend when IPv6 is available,
or its session pooler when the host requires IPv4. Do not use the transaction pooler
for this API unless Npgsql prepared statements are explicitly disabled.

The API validates asymmetric Supabase access tokens from
`/auth/v1/.well-known/jwks.json`. A project still using the legacy shared HS256 JWT
secret must be rotated to an asymmetric signing key before client migration.

Direct Npgsql connections do not automatically inherit the current user's PostgREST
RLS context. No domain queries are exposed in this foundation. Before the first data
slice, create a least-privileged backend database role and make user ownership an
explicit part of every query/transaction. Never use `SUPABASE_SERVICE_ROLE_KEY` as a
browser secret or as the PostgreSQL password.

## Run and test

```powershell
dotnet test .\PortfolioTerminal.sln
dotnet run --project .\src\App.Api\App.Api.csproj
```

The local API listens on `http://localhost:5080` by default.

- `GET /health/live` confirms that the process is running.
- `GET /health/ready` confirms that PostgreSQL is configured and reachable.
- `GET /openapi/v1.json` exposes the OpenAPI document.
- `GET /api/me` is the first protected smoke-test endpoint.
- `GET /api/portfolio/portfolios` lists the authenticated user's portfolios.
- `GET /api/portfolio/transactions` lists the authenticated user's transactions. It supports Activity-page pagination and the existing ticker, portfolio, asset-type, currency, and date filters.
- `GET /api/portfolio/holdings` returns server-aggregated holdings and weighted average costs.
- `GET /api/portfolio/ticker-catalog` lists the authenticated user's ticker catalogue.
- `GET /api/portfolio/snapshots` lists daily portfolio-value snapshots.
- `GET /api/portfolio/quotes`, `/fx-rates`, and `/market-status` proxy external market data through the authenticated API.
- `GET /api/car-service/vehicles` lists the authenticated user's vehicles.
- `GET /api/car-service/visits?vehicleId={vehicleId}` lists service visits with nested jobs. Omit `vehicleId` to list all vehicles.
- `GET /api/car-service/visits/{visitId}` returns one owned service visit with its nested jobs.
- `GET /api/car-service/analytics?vehicleId={vehicleId}` returns server-calculated service analytics. Omit `vehicleId` for all vehicles.
- `GET /api/car-service/reminders?vehicleId={vehicleId}` returns service intervals with server-calculated status. Use `activeOnly=true` for the dashboard list.

## Portfolio MCP server

The API hosts a stateless, read-only MCP server at `/mcp`. It exposes exactly these
tools: `portfolio_list`, `portfolio_get_summary`, `portfolio_get_holdings`,
`portfolio_get_history`, `portfolio_get_allocation`, and
`portfolio_simulate_purchase`. No Car Service or mutation handlers are registered.

MCP access uses a separate Supabase JWT audience and authorization policy. A valid
token must have:

```text
aud = the exact Mcp__ResourceUri
client_id = the Supabase OAuth client ID
portfolio_access = read
```

Ordinary frontend tokens retain `aud=authenticated`, so they cannot call `/mcp`.
Conversely, MCP tokens cannot call the existing REST API. User identity always comes
from JWT `sub`, then application ownership filters and PostgreSQL RLS both enforce
isolation.

### Enable Supabase OAuth

1. Confirm the frontend, backend, and `supabase/config.toml` all use project
   `xcqxfyylqtcgmugpnjzt`.
2. Rotate the project to an asymmetric signing key if it still uses HS256. The
   `openid` scope and remote JWT validation require asymmetric keys.
3. Apply the migration containing `portfolio_mcp_access_token_hook`.
4. In **Authentication → OAuth Server**, enable OAuth 2.1, set the authorization
   path to `/oauth/consent`, and enable dynamic client registration for private
   ChatGPT testing.
5. In **Authentication → Hooks**, select
   `public.portfolio_mcp_access_token_hook` as the Custom Access Token Hook.
6. Set the Supabase Site URL to the deployed frontend and allow the frontend login
   callback URLs. The React consent route uses Supabase's validated authorization
   details and approve/deny APIs.
7. Configure the Azure Container App with the four `Mcp__*` settings above. The
   resource URI must exactly match the token hook's canonical URI.

The migration intentionally stamps only tokens containing `client_id`; normal web
sessions are unchanged. Refresh-token issuance must be verified to retain both MCP
claims before release.

### OAuth release gate

Do not treat deployment as complete until all of the following pass against the
cloud project:

1. `GET /.well-known/oauth-protected-resource` returns the exact `/mcp` resource and
   Supabase authorization server.
2. MCP Inspector completes DCR, authorization code + PKCE, consent, token exchange,
   `tools/list`, refresh, and revoked-grant rejection.
3. The access and refreshed tokens contain the exact MCP `aud`, a nonempty
   `client_id`, and `portfolio_access=read`.
4. ChatGPT Developer Mode connects to the production URL ending in `/mcp` and can
   run the six read-only tools.
5. Wrong-audience frontend tokens fail on `/mcp`, MCP tokens fail on `/api`, and an
   attempted write or Car Service request has no available tool.

Supabase's OAuth server is beta and currently does not natively bind the RFC 8707
`resource` parameter into `aud`; the access-token hook is the single-resource
workaround. If the Inspector or ChatGPT rejects the flow, do not add a custom OAuth
proxy. Switch to a compliant identity provider or wait for native support.

## Run with Docker

Build the production container from the repository root:

```powershell
docker build --file .\backend\Dockerfile --tag portfolio-terminal-api:local .\backend
```

Create `backend/.env.docker.local` with the runtime settings below. This file is
ignored by Git; never commit the real database password.

```text
ASPNETCORE_ENVIRONMENT=Production
Supabase__Url=https://xcqxfyylqtcgmugpnjzt.supabase.co
Supabase__Audience=authenticated
ConnectionStrings__AppDatabase=Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true
Cors__AllowedOrigins__0=http://localhost:5173
```

Run the container and expose its port as `http://localhost:8080`:

```powershell
docker run --rm --name portfolio-terminal-api --publish 8080:8080 --env-file .\backend\.env.docker.local portfolio-terminal-api:local
```

Verify `GET /health/live` for process health and `GET /health/ready` for the
database connection. Stop the foreground container with `Ctrl+C`.

## Run the portfolio snapshot worker

The same API image can run as a finite background worker. A forced local run is
useful for validation and upserts the requested day's records atomically:

```powershell
dotnet run --project .\src\App.Api\App.Api.csproj -c Release -- --run-portfolio-snapshot=true --snapshot-force=true
```

Omit `--snapshot-force=true` for scheduled executions. The worker then writes only
during the Athens midnight hour, allowing the UTC schedule to cover both standard
time and daylight-saving time without creating duplicate rows. To backfill a date,
add `--snapshot-date=YYYY-MM-DD` together with the force flag.

The worker uses the trusted backend PostgreSQL connection to read all users and
upsert `portfolio_value_snapshots`. Never expose this command through a public HTTP
endpoint or place the database connection string in the frontend.

The production Azure Container Apps Job is named `portfolio-snapshot-job`. Configure
it in the existing `portfolio-terminal-env` environment with:

```text
Trigger: Schedule
Cron expression: 0 21,22 * * *
Image: ghcr.io/narcolic/portfolio-terminal-api:latest
Arguments override: --run-portfolio-snapshot=true
CPU / memory: 0.25 / 0.5 Gi
Parallelism / completions: 1 / 1
Retry limit: 2
Replica timeout: 600 seconds
Secret environment variable: ConnectionStrings__AppDatabase
```

Azure evaluates the cron expression in UTC. The two executions cover midnight in
Athens across DST changes; the worker skips whichever execution is outside the
Athens midnight window. After the job exists, the deployment workflow updates it to
the same immutable `sha-<commit>` image deployed to the API.

## Publish the container

The `Publish backend container` GitHub Actions workflow builds the API whenever
backend files change on `main`. It publishes two Linux image tags to GitHub
Container Registry and deploys the immutable commit image to Azure Container
Apps:

```text
ghcr.io/narcolic/portfolio-terminal-api:latest
ghcr.io/narcolic/portfolio-terminal-api:sha-<full-commit-sha>
```

Azure uses the immutable commit tag for controlled deployments. The `latest`
tag remains available for convenient manual smoke tests. The package must be
public before Azure Container Apps can pull it without registry credentials.

Azure authentication uses GitHub OIDC rather than a stored client secret. The
repository must define `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
`AZURE_SUBSCRIPTION_ID` Actions secrets. The corresponding Microsoft Entra
application trusts only the repository's `main` branch and has the `Container
Apps Contributor` role scoped to `portfolio-terminal-rg`. After deployment, the
workflow verifies the production `/health/ready` endpoint.

## Migrated slices

- Portfolio and transaction reads and writes now flow through the .NET API.
  Transaction writes update the ticker catalogue in the same transaction, and CSV
  imports atomically create missing portfolios, transactions, and catalogue entries.
- Portfolio holdings, ticker catalogue, snapshots, quotes, FX rates, and market
  status now flow through .NET. The same Portfolio services power the finite daily
  snapshot worker used by Azure Container Apps Jobs.
- Car Service vehicle, service-visit, analytics, and reminder reads and writes now
  flow through the .NET API. Service-visit and job changes are committed atomically.
