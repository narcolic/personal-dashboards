# Terminal Hub

**Your systems, in view.**

Terminal Hub is an expandable personal command center with a clean terminal-style UI. It brings the systems that shape everyday life—investments, vehicles, utilities, and future dashboards—into one private, focused workspace.

## Features

- Portfolio dashboard with holdings, allocation, and performance views
- Transactions management (manual entry and CSV upload)
- Multi-currency display (EUR default)
- Live market session indicators (ATHEX, NYSE, XETR) with local-time tooltips
- Vehicle service history, maintenance reminders, and ownership-cost analytics
- An extensible dashboard hub, with utility-bill tracking planned next
- Supabase authentication with portfolio and car-service data accessed through the .NET API

## Project Structure (high level)

- `src/routes/_authenticated/portfolio/` - portfolio pages, local components, and hooks
- `src/lib/portfolio/` - portfolio domain logic (types, api, mappers, calculations)
- `supabase/` - Supabase related assets/config
- `backend/` - .NET 10 API, business logic, market-data integrations, and scheduled
  portfolio snapshot worker; see [`backend/README.md`](backend/README.md)
