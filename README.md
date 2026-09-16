# Job Radar

Personal infrastructure job search agent — **zero AI cost**, **zero infra cost**, deployable on **Vercel Hobby (free)**.

Discover → normalize → deduplicate → score (rules) → notify → track.

**No LinkedIn.** No LLM APIs. No embedding APIs. No paid database required.

## Architecture

```
Vercel Cron (daily on Hobby)
  → POST /api/cron/scan
      → create scan_run + tasks (per company + EU aggregators)
      → process 3 tasks per invocation (60s limit)
      → self-chain /api/internal/worker until done
      → send email digest (optional, Resend free tier)

Sources (official public APIs — no HTML scraping):
  Direct ATS: Greenhouse · Lever · Ashby (~44+ companies in market-universe.json)
  EU aggregators: Arbeitnow (paginated EU feed) · Remotive · RemoteOK
  Discovery: npm run discover:companies (auto-probe ATS slugs for long-tail employers)
```

### Matching engine (100% deterministic)

| Layer | Method |
|-------|--------|
| Title filter | Search rings (exact / adjacent / emerging) |
| Seniority | Title + staff signal phrases |
| AI infra | Keyword/phrase counting |
| Location | EU / CH / JP / remote rules |
| Relevance | Weighted multi-dimensional score |
| Dedup | source ID → canonical URL → content hash |

## Vercel free tier constraints (researched)

| Resource | Hobby (free) limit | How we handle it |
|----------|-------------------|------------------|
| Cron | **Once per day** only | `0 8 * * *` in `vercel.json` |
| Cron precision | ±59 minutes | Acceptable for personal use |
| Function timeout | **60 seconds** | Chunked task queue (3 companies/invocation) |
| Function invocations | 1M/month | ~30 cron + ~25 worker chains/day = well under limit |
| Edge requests | 1M/month | Personal dashboard only |

## Zero-cost stack

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | $0 |
| Neon Postgres | Free (via Vercel Marketplace) | $0 — 0.5 GB, 100 CU-hrs/mo |
| Resend | Free (optional) | $0 — 3000 emails/mo |
| AI/LLM | None | $0 |
| Embeddings | None (rules + Jaccard) | $0 |

## Quick start (local)

### Option A — Docker Postgres (recommended for local testing)

```bash
cd smart-ai-agent
npm install

# .env.local is already set up for local Docker Postgres (port 5433)
# Start Colima/Docker if needed: colima start

docker compose up -d
DATABASE_URL=postgresql://jobradar:jobradar@localhost:5433/jobradar npm run db:generate
docker exec -i smart-ai-agent-postgres-1 psql -U jobradar -d jobradar < drizzle/0000_whole_ogun.sql

npm run dev
# Open http://localhost:3000 — password: localdev
```

Run a full scan manually (no dev server needed):

```bash
npm run scan:cron
```

### Local background cron (every 4 hours while laptop is on)

Uses macOS **launchd** — no dev server required; starts Docker Postgres automatically.

```bash
npm run cron:install    # install agent (runs every 4h + once at login)
npm run cron:run        # trigger scan now
npm run cron:status     # check agent status
npm run cron:uninstall  # remove agent

# Logs:
tail -f ~/Library/Logs/JobRadar/scan.log
```

Legacy (requires `npm run dev` running):

```bash
npm run scan:local
```

### Option B — Neon (same as production)

```bash
cp .env.example .env.local
# Set DATABASE_URL from Neon dashboard

DATABASE_URL=... npm run db:generate
# Apply drizzle/*.sql or use Neon SQL editor

npm run dev
```

Open http://localhost:3000 — login with `APP_PASSWORD`.

### Run a manual scan

Click **Run scan now** on the dashboard, or:

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Cookie: job_radar_session=authenticated"
```

## Deploy to Vercel

1. Push repo to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Add Neon integration: Project → Storage → Connect Neon (free plan)
4. Set environment variables:

```env
DATABASE_URL=          # auto-injected by Neon integration
APP_PASSWORD=          # your dashboard password
SESSION_SECRET=        # random 32+ chars
CRON_SECRET=           # random string (Vercel sends as Authorization: Bearer)
WORKER_SECRET=         # random string for worker self-chaining
NEXT_PUBLIC_APP_URL=   # https://your-app.vercel.app

# Optional email digest:
RESEND_API_KEY=
NOTIFICATION_EMAIL=you@example.com
RESEND_FROM_EMAIL=onboarding@resend.dev
```

5. Deploy. Cron runs daily at ~08:00 UTC.

### Vercel Cron auth

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set as an env var. Our `/api/cron/scan` route validates this.

For manual cron testing:

```bash
curl -X GET https://your-app.vercel.app/api/cron/scan \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Company seeds

Edit `src/data/company-seeds.json` to add companies. Each entry needs:

```json
{ "id": "datadog", "name": "Datadog", "atsType": "greenhouse", "atsSlug": "datadog" }
```

ATS types: `greenhouse`, `lever`, `ashby`. Remotive is fetched globally once per scan.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard + stats |
| `/jobs` | All matched jobs |
| `/jobs/:id` | Job detail + save/reject |
| `/saved` | Saved jobs |
| `/preferences` | Candidate DNA (JSON editor) |
| `/sources` | Source health |

## Tests

```bash
npm test
```

Covers URL canonicalization, location rules, visa extraction, relevance scoring (PRD fixtures A–E), and dedup similarity.

## What is intentionally not included (zero-cost MVP)

- LLM analysis (use rules instead)
- pgvector / embeddings API
- 16+ ATS sources (add incrementally)
- Workday / Indeed (require per-company config or restricted APIs)
- 4-hour cron (requires Vercel Pro $20/mo)
- Preference learning (Phase 2)

## License

MIT — personal use.
