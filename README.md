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

Check the API with `curl localhost:4000/api/health`, which should return `{"database":"postgres","migrations":"ok",...}`. The feed fills from 23 curated publisher RSS feeds within seconds of startup (polled every 10 min). GDELT runs hourly as a fallback; its state, including any rate-limit cooldown, shows under `providers` in the health check.

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
| `pnpm clean` | Delete build output: `dist/`, `.next/`, `apps/web/.next`, `apps/web/out`, `tsconfig.tsbuildinfo` |
| `pnpm clean:all` | `clean` plus `nx reset` (clears the Nx cache and daemon) |

## AI summaries (Ollama)

Story pages show an AI-written **"What happened"** paragraph with key points, built from the headlines and excerpts of every source in the timeline (ADR-004). Topic summaries (`/api/summaries`) use the same model on a 4-hourly cron. Everything runs on a local model through Ollama; a cloud provider can replace it later via `LLM_PROVIDER`.

```bash
brew install ollama            # or the Ollama app from ollama.com
ollama serve                   # or open the Ollama app (listens on :11434)
ollama pull llama3.2           # 3B, ~2 GB; fits on an 8 GB Mac
curl localhost:4000/api/health # → "llm": {"id":"ollama","model":"llama3.2","state":"ok"}
```

| Env var | Default | Meaning |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | `ollama` | `ollama`, or `none` to turn AI summaries off |
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama listens |
| `OLLAMA_MODEL` | `llama3.2` | Any pulled model; larger ones (e.g. `qwen2.5:7b`) need about 5 GB of free RAM |
| `LLM_TIMEOUT_MS` | `120000` | Per-generation timeout |

How it behaves:
- The timeline never waits for the model. The first view of a story starts writing the brief in the background, and the page shows "Writing a summary…" until it's ready (about 10–40 s on the first call while the model loads, then a few seconds).
- Briefs are stored in Postgres and reused until the story's coverage changes (and are at least 30 min old).
- Each brief is labelled as AI-generated. It is written only from the listed reports, but small models can still make mistakes.

Troubleshooting:
- **No summary panel:** check `llm.state` in `/api/health`. `down: Ollama not reachable` means start Ollama; `model not pulled` means run `ollama pull <model>`. After a failure the API waits 5 min before retrying the same story.
- **A story needs at least 3 reports from 2 sources** before a brief is written.

## Mobile (Capacitor)

```bash
pnpm export            # static export to apps/web/out
pnpm mobile:sync       # copy the export into the native projects
pnpm mobile:ios        # open in Xcode
pnpm mobile:android    # open in Android Studio
```

Native builds need a reachable API host in `NEXT_PUBLIC_API_URL`, for example `http://192.168.1.20:4000/api`.
