# Portfolio Terminal

Portfolio Terminal is a web app for tracking investment portfolios with a clean terminal-style UI.

It lets you manage transactions, monitor holdings and P&L, and view live market session status across key exchanges.

## Features

- Portfolio dashboard with holdings, allocation, and performance views
- Transactions management (manual entry and CSV upload)
- Multi-currency display (EUR default)
- Live market session indicators (ATHEX, NYSE, XETR) with local-time tooltips
- Supabase-backed storage for portfolios and transactions

## Project Structure (high level)

- `src/routes/_authenticated/portfolio/` - portfolio pages, local components, and hooks
- `src/lib/portfolio/` - portfolio domain logic (types, api, mappers, calculations)
- `api/` - server-side API routes (including market status proxy)
- `supabase/` - Supabase related assets/config