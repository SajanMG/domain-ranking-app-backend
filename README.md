# Domain Ranking App — Backend

Lightweight NestJS backend that stores and serves historical Tranco/Tranco-like ranking data for domains.

## Overview

This service exposes a small API to fetch domain ranking time-series. It uses Sequelize + Postgres for storage and caches Tranco API responses for a configurable TTL.

Key behaviors:
- GET `/ranking/:domains` — accepts comma-separated domains and returns labels + ranks for each domain.
- Cached results: data is refreshed from the configured Tranco API when the local cache is stale.

## Tech stack

- Node.js + TypeScript
- NestJS framework
- Sequelize (sequelize-typescript) + (Neon) PostgreSQL

## Repo structure (important files)

- `src/` — application source
- `src/ranking` — ranking controller + service
- `src/db/models/domain-rank.model.ts` — Sequelize model for stored ranks
- `src/health.controller.ts` — DB health endpoint
- `src/main.ts` — application bootstrap
- `package.json` — scripts & dependencies

## Prerequisites

- Node.js (18+ recommended)
- PostgreSQL database accessible to the app

## Environment variables

Set these in your environment or in a `.env` file at the project root.

- `DB_HOST` — Postgres host
- `DB_PORT` — Postgres port (default: 5432)
- `DB_USER` — DB username
- `DB_PASSWORD` — DB password
- `DB_NAME` — DB name
- `PORT` — HTTP port the app listens on (default: 3000)
- `FRONTEND_URL` — allowed CORS origin for frontend (default: http://localhost:5173)
- `TRANCO_API_BASE_URL` — base URL for the Tranco-like API used to fetch ranking data (required for refresh)
- `CACHE_TTL_HOURS` — number of hours to keep cached entries before refreshing (default: 24)

### Neon (Postgres) notes

- If you host Postgres on Neon, get the connection details from the Neon Console and set the DB variables accordingly.
- Neon requires TLS. The application already sets `dialectOptions.ssl` when `DB_HOST` contains `neon` (or `aws`/`ssl`). That enables `ssl: { require: true, rejectUnauthorized: false }` for Sequelize.
- Neon connection strings look like `postgres://<user>:<password>@<host>:<port>/<database>`. This project reads DB values from `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` — you can parse the Neon connection string into these variables or set them directly in your environment.
- Use the Neon Console to create a dedicated DB role and a database for this app. Store credentials securely (do not commit `.env` to git).

## Quickstart

1. Install dependencies

```bash
npm install
```

2. Provide environment variables (example `.env`):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret
DB_NAME=domain_ranking
PORT=3000
TRANCO_API_BASE_URL=https://tranco.example/api/domain
CACHE_TTL_HOURS=24
FRONTEND_URL=http://localhost:5173
```

3. Run in development

```bash
npm run start:dev
```

The server will log the listening URL (e.g., http://localhost:3000).

## API

- `GET /` — root hello endpoint
- `GET /health/db` — verifies DB connection
- `GET /ranking/:domains` — main endpoint; provide comma-separated domains

Example request:

```bash
curl "http://localhost:3000/ranking/example.com,example.org"
```

Response shape (example):

```json
{
  "example.com": {
    "domain": "example.com",
    "labels": ["2024-01-01","2024-01-02"],
    "ranks": [12345, 12350],
    "outOfTop1M": false
  }
}
```

If no rows are found for a domain, `outOfTop1M` will be `true`.

## Database and model notes

- The project uses `sequelize-typescript` and auto-loads the `DomainRank` model (`src/db/models/domain-rank.model.ts`).
- `synchronize: true` is enabled in `SequelizeModule` for convenience during development — this will create tables automatically. For production, consider using explicit migrations and disabling auto-sync.

## Scripts

- `npm run start` — start production (uses `nest start`)
- `npm run start:dev` — start in watch mode
- `npm run build` — build the project
- `npm run lint` — run and auto-fix ESLint
- `npm run format` — format with Prettier
- `npm run test` — run unit tests
- `npm run test:e2e` — run e2e tests

See `package.json` for full details.

## Testing

- Unit tests are configured with Jest. Run `npm run test`.
- E2E tests can be run with `npm run test:e2e` (ensure a test database is available and environment variables are set).

## Development notes

- Ranking refreshes use the `TRANCO_API_BASE_URL` environment variable; the service expects the external API to return an array of `{ date, rank }` objects under `ranks` for a domain.
- Cache freshness is controlled via `CACHE_TTL_HOURS`.

## Contributing

Contributions welcome. Open issues or PRs with a clear description and tests where applicable.

## License

MIT — change as appropriate for your project.
