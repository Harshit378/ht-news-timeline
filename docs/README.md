# Docs

| Path | What it is |
| :--- | :--- |
| [`CHANGE_LEDGER.md`](CHANGE_LEDGER.md) | Keep-a-Changelog formatted release history, phase implementation log, and ADR compliance audit |
| [`adr/architecture_decision_records_adrs.md`](adr/architecture_decision_records_adrs.md) | The 7 Architecture Decision Records (ADR-001 mobile-first pivot, NestJS, GDELT, AI summaries, WebSockets, offline sync, monetization) |
| [`planning/plan.md`](planning/plan.md) | Original product/page/design-system plan |
| [`planning/geminiplan.md`](planning/geminiplan.md) | Consolidated end-to-end plan (generated summary) |
| [`phases/PHASE4.md`](phases/PHASE4.md) | Phase 4 power-features documentation |
| [`phases/PHASE4_IMPLEMENTATION_SUMMARY.md`](phases/PHASE4_IMPLEMENTATION_SUMMARY.md) | Phase 4 implementation summary |

## Database setup (ADR-002)

The API runs without a database (in-memory store), but nothing persists. To use PostgreSQL:

```bash
brew install postgresql@16 && brew services start postgresql@16   # or: docker compose up -d
psql -d postgres -c "create role timeline login createdb password 'timeline'"
createdb -O timeline timeline
cp .env.example .env            # DATABASE_URL is already set for the credentials above
pnpm install                    # postinstall runs `prisma generate`
pnpm db:deploy                  # apply migrations (use `pnpm db:migrate` when changing the schema)
pnpm dev:api                    # GET /api/health → {"database":"postgres","migrations":"ok"}
```

Other scripts: `pnpm db:status`, `pnpm db:studio`, `pnpm db:generate`.
