# Terminal Hub

**Your systems, in view.**

Terminal Hub is an expandable personal command center with a clean terminal-style UI. It brings the systems that shape everyday life—investments, vehicles, utilities, and future dashboards—into one private, focused workspace.

## Features

- Portfolio dashboard with holdings, allocation, and performance views
- Transactions management (manual entry and CSV upload)
- Multi-currency display (EUR default)
- Live market session indicators (ATHEX, NYSE, XETR) with local-time tooltips
- Vehicle service history, maintenance reminders, and ownership-cost analytics
- Subscription Tracker with recurring costs, reusable shared members, dated contributions, and money owed
- Travel Globe with an interactive 3D Earth, place search, and private visit history
- An extensible dashboard hub, with utility-bill tracking planned next
- Supabase authentication with portfolio and car-service data accessed through the .NET API

## Project Structure (high level)

- `src/routes/_authenticated/portfolio/` - portfolio pages, local components, and hooks
- `src/lib/portfolio/` - portfolio domain logic (types, api, mappers, calculations)
- `src/routes/_authenticated/subscriptions/` - subscription overview, editor, details, and payment pages
- `backend/src/App.Subscriptions/` - recurring period and contribution data access and calculations
- `supabase/` - Supabase related assets/config
- `backend/` - .NET 10 API, business logic, market-data integrations, and scheduled
  portfolio snapshot worker; see [`backend/README.md`](backend/README.md)

## Travel Globe

Open **Travel Globe** from the hub or app navigation (`/travel`). Add a city or town
by name, choose the matching location, and optionally record a date and note.
Coordinates can also be entered or adjusted manually. The globe supports drag,
wheel/pinch zoom, arrow keys, plus/minus, and Home to reset. The list selects and
focuses any place; clicking a marker also lists nearby visits, including visits
at identical coordinates. No example travel history is seeded.

### Data and deployment

- Apply `supabase/migrations/20260927212608_travel_places.sql` through the normal
  Supabase migration workflow before deploying the API and frontend.
- The .NET `App.Travel` module exposes authenticated CRUD at `/api/travel/places`.
  Records live in `public.travel_places`; `user_id` comes from the authenticated
  request. The existing `AppDataSource` executes each operation as the Supabase
  authenticated role with JWT claims, so RLS is enforced as well as owner filters.
- Reuse the existing API database connection, Supabase auth, and frontend API URL.
  No new credentials are required. The hosted database is not migrated by a frontend build.
- `react-globe.gl` / Three.js load only when this view opens (about 550 kB gzipped).
  The land texture is drawn from a local 257 kB Natural Earth dataset. Rendering caps pixel density,
  pauses in background tabs, and respects reduced motion for camera transitions.
  WebGL is required for the globe; CRUD and the list remain available without it.
- Place search calls Open-Meteo's GeoNames geocoder on explicit submission, with
  visible provider attribution. Only the search term is sent, not saved notes or
  account details. Internet access is needed for search; manual coordinates are
  available during outages. Search primarily covers cities and towns. The free
  Open-Meteo endpoint is for noncommercial use; review its terms and subscription
  options before commercial deployment: https://open-meteo.com/en/terms
- English and Greek interface translations are included. Search uses English place
  and country names for consistent stored labels; these can be edited.

### Verification

Run `npm run build`, `npm run typecheck`, `npm run test:unit`, and
`dotnet test backend/PortfolioTerminal.sln`. For the real PostgreSQL CRUD/RLS test,
set `TRAVEL_TEST_DATABASE` to a **disposable PostgreSQL server** connection string
with permission to create databases. The test creates and drops its own database;
it verifies persistence, cross-user isolation, owner reassignment denial, and deletion.
