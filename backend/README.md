# Portfolio Terminal backend

This directory contains the .NET 10 backend foundation. The existing React client
continues to use Supabase directly except for the vertical slices listed below.

## Projects

- `App.Api`: ASP.NET Core Minimal API host, Supabase JWT validation, CORS, OpenAPI,
  error handling, and health endpoints.
- `App.Data`: shared Npgsql connection pool. Existing `supabase/migrations` files
  remain the authoritative schema history.
- `App.Portfolio`: portfolio business module placeholder.
- `App.CarService`: car-service business module placeholder.
- `App.Tests`: foundation-level integration tests.

## Configure

Set these environment variables before running the API:

```text
Supabase__Url=https://xcqxfyylqtcgmugpnjzt.supabase.co
Supabase__Audience=authenticated
ConnectionStrings__AppDatabase=Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true
Cors__AllowedOrigins__0=http://localhost:5173
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
- `GET /api/car-service/vehicles` lists the authenticated user's vehicles.
- `GET /api/car-service/visits?vehicleId={vehicleId}` lists service visits with nested jobs. Omit `vehicleId` to list all vehicles.
- `GET /api/car-service/visits/{visitId}` returns one owned service visit with its nested jobs.
- `GET /api/car-service/analytics?vehicleId={vehicleId}` returns server-calculated service analytics. Omit `vehicleId` for all vehicles.
- `GET /api/car-service/reminders?vehicleId={vehicleId}` returns service intervals with server-calculated status. Use `activeOnly=true` for the dashboard list.

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
- Car Service vehicle, service-visit, analytics, and reminder reads and writes now
  flow through the .NET API. Service-visit and job changes are committed atomically.
