# News Timeline

Search any story and see what happened from the beginning to now. Nx monorepo:

| App | Stack | Port |
| :--- | :--- | :--- |
| `apps/web` | Next.js 15 · React 19 · Tailwind 4 (mobile-first, Capacitor shell for iOS/Android) | 3000 |
| `apps/api` | NestJS 11 · Prisma · PostgreSQL 16 · GDELT/RSS ingestion · WebSockets (`/ws/events`) | 4000 |

Architecture decisions live in [`docs/adr/`](docs/adr/architecture_decision_records_adrs.md), and the change history is in [`docs/CHANGE_LEDGER.md`](docs/CHANGE_LEDGER.md).

## Quick start

```bash
pnpm install                  # also runs `prisma generate`
cp .env.example .env          # DATABASE_URL, PORT, CORS_ORIGIN, NEXT_PUBLIC_API_URL, ...
pnpm db:deploy                # apply migrations (needs Postgres, see below)
pnpm dev:all                  # web on :3000 + API on :4000
```

Check the API with `curl localhost:4000/api/health`, which should return `{"database":"postgres","migrations":"ok",...}`.

Without a database the API still runs on an in-memory store, but nothing persists. To force that mode, set `DATABASE_URL=` (empty). Unsetting it isn't enough, because Prisma reads `.env` itself.

## Database (PostgreSQL 16)

Use Homebrew or Docker; both use the `timeline` / `timeline` credentials from `.env.example`.

```bash
# Homebrew
brew install postgresql@16 && brew services start postgresql@16
psql -d postgres -c "create role timeline login createdb password 'timeline'"
createdb -O timeline timeline

# or Docker
docker compose up -d
```

| Command | What it does |
| :--- | :--- |
| `pnpm db:deploy` | Apply committed migrations (setup, CI, production) |
| `pnpm db:migrate --name <change>` | After editing `apps/api/prisma/schema.prisma`: create and apply a new migration |
| `pnpm db:status` | Show pending or applied migrations |
| `pnpm db:studio` | Browse data in Prisma Studio |
| `pnpm db:generate` | Regenerate the Prisma client |

## Development

| Command | What it does |
| :--- | :--- |
| `pnpm dev` / `pnpm dev:web` | Web app only |
| `pnpm dev:api` | API only |
| `pnpm dev:all` | Web + API in parallel |
| `pnpm test` | Vitest (API + web tests) |
| `pnpm lint` | Lint the web app |
| `pnpm build` / `pnpm build:api` / `pnpm build:all` | Production builds |

## Mobile (Capacitor)

```bash
pnpm export            # static export to apps/web/out
pnpm mobile:sync       # copy the export into the native projects
pnpm mobile:ios        # open in Xcode
pnpm mobile:android    # open in Android Studio
```

Native builds need a reachable API host in `NEXT_PUBLIC_API_URL`, for example `http://192.168.1.20:4000/api`.
