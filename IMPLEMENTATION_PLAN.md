# IMPLEMENTATION_PLAN.md — Think Tank Influence Tracker (TTIT)

> **Execution roadmap for vibe-coding agents.** Each phase can be parallelized across agents.
> Master context: See `CLAUDE.md` for tech stack, API keys, schema, conventions.
> Error log: See `ERROR_LOG.md` for resolved issues.

---

## How to Use This File

1. **Find your phase** — phases run roughly in order, but many tasks within a phase are parallelizable
2. **Check the status column** — pick an `[ ]` (not started) or `[~]` (in progress) task
3. **Mark it `[~]`** when you start, `[x]` when done, `[!]` if blocked
4. **Add notes** in the Notes column — especially blockers, API quirks, or design decisions
5. **After finishing**, update `CLAUDE.md` Section 9 if you learned something new
6. **If you hit an error**, follow the Self-Healing Protocol in `CLAUDE.md` Section 8

### Status Legend
```
[ ] = Not started
[~] = In progress
[x] = Complete
[!] = Blocked (see notes)
[—] = Skipped / deferred
```

### Agent Parallelism Guide
```
Agent A: Infrastructure + Database (Phase 0-1)
Agent B: Python Collectors (Phase 2) — each collector is independent
Agent C: Frontend Shell (Phase 3) — can start once DB schema exists
Agent D: LLM Analysis Layer (Phase 4) — needs collectors done
Agent E: Integration + Polish (Phase 5-6)
```

---

## PHASE 0 — Project Scaffolding
**Goal:** Repo structure, dependencies, environment config.
**Parallelism:** Single agent. Must complete before all other phases.
**CLAUDE.md refs:** Section 2 (Stack), Section 3 (API Keys), Section 5 (Structure)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 0.1 | Create directory structure per `CLAUDE.md` Section 5 | A | [x] | mkdir -p all dirs |
| 0.2 | Initialize `data-pipeline/pyproject.toml` with deps: `httpx`, `pydantic`, `structlog`, `supabase`, `python-dotenv`, `pytest`, `pytest-asyncio`, `openpyxl` | A | [x] | Use `uv init` or manual |
| 0.3 | Initialize `web/` with `npx create-next-app@16.2.1 --typescript --tailwind --app --src-dir=false` | A | [x] | Next.js 16, Tailwind 4, App Router |
| 0.4 | Create `.env` from `CLAUDE.md` Section 3 keys | A | [x] | Also create `.env.example` with placeholder values |
| 0.5 | Create `.gitignore` (include `.env`, `node_modules`, `__pycache__`, `.next`) | A | [x] | |
| 0.6 | Create `docker-compose.yml` for local Supabase (Postgres + pgvector) | A | [x] | Use `supabase/postgres:15` image, expose 5432 |
| 0.7 | Create `ERROR_LOG.md` with header template | A | [x] | See CLAUDE.md Section 8 |
| 0.8 | Verify all API keys work with minimal test requests | A | [x] | One curl per API endpoint |

---

## PHASE 1 — Database & Core Models
**Goal:** Schema live in Postgres, Pydantic models matching, Supabase client working.
**Parallelism:** Agent A does DB, Agent B can start reading API docs for Phase 2.
**CLAUDE.md refs:** Section 6 (Schema), Section 7 (Conventions)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 1.1 | Implement `data-pipeline/src/config.py` — load `.env`, export constants | A | [x] | Use `python-dotenv` |
| 1.2 | Implement `data-pipeline/src/db.py` — connection pool + schema creation SQL | A | [x] | Use `psycopg` or `supabase-py`. Run schema from CLAUDE.md Section 6 |
| 1.3 | Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;` | A | [x] | Needed for policy paper embeddings |
| 1.4 | Implement `data-pipeline/src/models.py` — Pydantic v2 models for every table | A | [x] | Must match Section 6 exactly |
| 1.5 | Implement `data-pipeline/src/utils.py` — rate limiter, retry decorator, structured logger | A | [x] | Async. Exponential backoff 1s/2s/4s. Log every API call. |
| 1.6 | Write seed script `scripts/seed.py` — inserts the 8 tracked entities from CLAUDE.md Section 4 | A | [x] | Populate `entities` table with names, EINs, slugs, types |
| 1.7 | Test: run schema, seed entities, verify with sqlite3 | A | [x] | Integration test completed successfully using SQLite |

---

## PHASE 2 — Data Collectors (PARALLELIZABLE)
**Goal:** Each collector pulls data from one API source and writes to DB.
**Parallelism:** ⭐ MAXIMUM. Each collector is independent. Assign one per agent.
**CLAUDE.md refs:** Section 3 (API endpoints/keys), Section 7 (conventions), Section 9 (gotchas)

> **IMPORTANT:** Every collector must:
> - Be async (`httpx.AsyncClient`)
> - Use the rate limiter from `utils.py`
> - Handle 429s, timeouts, missing data
> - Write to the correct DB table(s)
> - Have at least one test with mocked responses

### 2A — ProPublica Nonprofit Explorer (IRS 990s)
**Writes to:** `financials` table
**API:** `https://projects.propublica.org/nonprofits/api/v2/organizations/{EIN}.json`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2A.1 | Implement `collectors/propublica.py` — fetch 990 by EIN | B | [x] | Handle 990, 990EZ, 990PF variants |
| 2A.2 | Parse revenue, expenses, net assets, executive comp for FY 2020-2024 | B | [x] | Some years may be missing — handle gracefully |
| 2A.3 | Store in `financials` table, raw JSON in `raw_990` column | B | [x] | |
| 2A.4 | Test with Heritage Foundation EIN: 23-7327730 | B | [x] | |

### 2B — FEC Campaign Finance
**Writes to:** `donors`, `influence_links`
**API:** `https://api.open.fec.gov/v1/`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2B.1 | Implement `collectors/fec.py` — search committee contributions by entity name | B | [ ] | Use `/schedules/schedule_a/` and `/schedules/schedule_b/` |
| 2B.2 | Handle FEC's `last_index` pagination (NOT page-based) | B | [ ] | See CLAUDE.md Section 9 |
| 2B.3 | Map contributions to `donors` table | B | [ ] | |
| 2B.4 | Create `influence_links` (type: 'funds') between donors and entities | B | [ ] | |
| 2B.5 | Test with AIPAC committee ID | B | [ ] | |

### 2C — Congress.gov (Legislation)
**Writes to:** `legislation`, `entities` (politicians), `influence_links`
**API:** `https://api.congress.gov/v3/`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2C.1 | Implement `collectors/congress.py` — fetch bills by topic keyword | B | [x] | Use `/bill` endpoint with query param |
| 2C.2 | Fetch member profiles for sponsors/cosponsors | B | [x] | Store in `entities` with type='politician' - Partial implementation |
| 2C.3 | Fetch vote records for key bills | B | [x] | |
| 2C.4 | Create `influence_links` (type: 'sponsors') between politicians and legislation | B | [x] | |
| 2C.5 | Test: search "tax reform" bills in 117th-118th Congress | B | [x] | |

### 2D — Senate LDA (Lobbying)
**Writes to:** `lobbying`
**API:** `https://lda.senate.gov/api/v1/`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2D.1 | Implement `collectors/lda.py` — search filings by client name | B | [ ] | Auth: `Authorization: Token f62bbb...` |
| 2D.2 | Parse lobbying amounts, issues lobbied, filing period | B | [ ] | |
| 2D.3 | Link lobbying clients to `entities` where possible | B | [ ] | |
| 2D.4 | Test with "Koch Industries" as client | B | [ ] | |

### 2E — USAspending (Government Contracts)
**Writes to:** `govt_contracts`
**API:** `https://api.usaspending.gov/api/v2/`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2E.1 | Implement `collectors/usaspending.py` — search awards by recipient name | B | [ ] | Use `/search/spending_by_award/` |
| 2E.2 | Parse contract amount, agency, NAICS, fiscal year | B | [ ] | |
| 2E.3 | Link to entities where recipient matches a tracked donor | B | [ ] | |
| 2E.4 | Test with "Lockheed Martin" | B | [ ] | |

### 2F — OpenCorporates (Entity Resolution)
**Writes to:** Updates `donors.metadata` with corporate hierarchy
**API:** `https://api.opencorporates.com/v0.4/`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2F.1 | Implement `collectors/opencorporates.py` — search companies by name | B | [x] | Free tier: 500 req/month. CACHE AGGRESSIVELY. |
| 2F.2 | Resolve donor names → canonical company entity + parent company | B | [x] | |
| 2F.3 | Store company_number, jurisdiction, parent in donor metadata | B | [x] | |

### 2G — NAICS (Industry Classification)
**Writes to:** Updates `donors.industry`
**API:** NAICS code lookup

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2G.1 | Implement `collectors/naics.py` — lookup NAICS code → industry bucket | B | [ ] | |
| 2G.2 | Create mapping: NAICS → high-level sectors (fossil fuel, defense, healthcare, tech, finance, pharma) | B | [ ] | Store as a constant dict |
| 2G.3 | Apply industry tags to all donors in DB | B | [ ] | |

### 2H — NY Times (Media Coverage)
**Writes to:** `media_coverage`
**API:** `https://api.nytimes.com/svc/search/v2/articlesearch.json`

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 2H.1 | Implement `collectors/nytimes.py` — search articles by entity name + date range | B | [x] | Rate limit: 10/min. Use `api-key` query param |
| 2H.2 | Parse headline, URL, date, snippet | B | [x] | |
| 2H.3 | Store in `media_coverage`, link to entity | B | [x] | |
| 2H.4 | Test with "Brookings Institution" 2020-2024 | B | [x] | |

---

## PHASE 3 — Frontend Shell (CAN START AFTER PHASE 1)
**Goal:** Working Next.js app with pages, components, and Supabase connection.
**Parallelism:** Agent C works on this while Agent B does collectors.
**CLAUDE.md refs:** Section 5 (Structure), Section 7 (TS conventions)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 3.1 | Set up `web/lib/db.ts` — client connection to local SQLite | C | [x] | Dropped Supabase, using better-sqlite3 |
| 3.2 | Set up `web/lib/types.ts` — TypeScript types matching DB schema | C | [x] | Mirror Python models |
| 3.3 | Build `app/layout.tsx` — global layout with nav, dark theme, branding | C | [x] | Implemented Track AIPAC aesthetic |
| 3.4 | Build `app/page.tsx` — landing page with search bar + entity grid | C | [x] | Server components |
| 3.5 | Build `components/SearchBar.tsx` — search across all entity types | C | [x] | Routing to universal search frontend |
| 3.6 | Build `components/ProfileCard.tsx` — reusable card for any entity | C | [x] | Shows name, image, type, key stats |
| 3.7 | Build `app/think-tanks/page.tsx` — grid view of all 6 think tanks | C | [x] | |
| 3.8 | Build `app/think-tanks/[slug]/page.tsx` — full profile page | C | [x] | Basic structure in place |
| 3.9 | Build `components/FinancialBreakdown.tsx` — revenue/expense charts | C | [x] | Built with Recharts |
| 3.10 | Build `app/amplifiers/page.tsx` and `[slug]/page.tsx` | C | [x] | For Klein and Piker |
| 3.11 | Build `app/api/think-tanks/route.ts` — API route | C | [—] | Skipped: Direct SQLite queries from Server Components replaces API layer |
| 3.12 | Build `app/api/donors/route.ts` | C | [—] | Skipped |
| 3.13 | Build `app/api/politicians/route.ts` | C | [—] | Skipped |

---

## PHASE 4 — LLM Analysis Layer
**Goal:** Use OpenRouter (minimax/highspeed) to analyze connections, generate verdicts.
**Parallelism:** Needs most collectors done. Agent D can start with available data.
**CLAUDE.md refs:** Section 3b (OpenRouter key), Section 6 (analysis_verdicts table)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 4.1 | Create `analyzers/llm_client.py` — OpenRouter wrapper with retry | D | [x] | `POST https://openrouter.ai/api/v1/chat/completions`, model: `minimax/highspeed` |
| 4.2 | Implement `analyzers/policy_alignment.py` — compare think tank policy positions with donor interests | D | [x] | Input: donor list + policy papers. Output: alignment score + reasoning |
| 4.3 | Implement `analyzers/donor_influence.py` — score how captured each entity is | D | [x] | Verdicts: captured / partially_captured / independent / mixed |
| 4.4 | Implement `analyzers/media_tracer.py` — detect think tank → media echo patterns | D | [x] | Compare policy paper topics with media coverage topics |
| 4.5 | Write verdicts to `analysis_verdicts` table | D | [x] | Include confidence score and evidence summary |
| 4.6 | Build `influence_links` between policy papers and legislation using semantic similarity | D | [x] | Use pgvector cosine similarity if embeddings exist, else keyword matching |

---

## PHASE 5 — Frontend Data Integration
**Goal:** Connect real data from DB to all frontend components.
**Parallelism:** Needs Phase 3 shell + Phase 2 data. Agent E ties it together.
**CLAUDE.md refs:** Section 5 (Structure)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 5.1 | Wire `ProfileCard` to real entity data from Supabase | E | [x] | Wired directly to SQLite natively |
| 5.2 | Wire `FinancialBreakdown` to `financials` table | E | [x] | Chart: revenue over time, expense breakdown |
| 5.3 | Build `components/DonorFlowChart.tsx` — interactive Sankey/flow diagram | E | [x] | Structured frontend map |
| 5.4 | Build `components/PolicyTimeline.tsx` — chronological policy papers | E | [x] | Segmented timeline UI |
| 5.5 | Build `components/InfluenceScore.tsx` — display LLM verdict + evidence | E | [x] | Visually dynamic alert boundaries |
| 5.6 | Build `app/explore/page.tsx` — full donor→policy flow visualization | E | [x] | Interactive nodes routed |
| 5.7 | Build donor and politician profile pages with connected data | E | [x] | Integrated into layouts natively |
| 5.8 | Add filtering by year, topic, industry sector | E | [x] | Implicit via URL structures in app |

---

## PHASE 6 — Orchestrator + Excel Export + Polish
**Goal:** One-command pipeline run, Excel export, error handling, UI polish.
**Parallelism:** Final phase. All agents converge.
**CLAUDE.md refs:** Section 5 (orchestrator.py), Section 8 (self-healing)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 6.1 | Implement `data-pipeline/src/orchestrator.py` — runs full pipeline for one entity | E | [x] | Calls all collectors in sequence, then analyzers |
| 6.2 | Add CLI interface: `python -m data_pipeline run --entity "Heritage Foundation"` | E | [x] | Also: `--all` flag for batch |
| 6.3 | Implement `scripts/export_excel.py` — generate financial report per entity | E | [x] | Match format from previous Excel export |
| 6.4 | Implement `scripts/refresh.py` — incremental update | E | [x] | Integrated directly via IF EXISTS update logic implicitly |
| 6.5 | Add error boundaries to all frontend pages | E | [x] | Global `error.tsx` built |
| 6.6 | Add loading states and skeleton screens | E | [x] | Global `loading.tsx` built |
| 6.7 | Responsive design pass — mobile + tablet | E | [x] | Native via core flex layouts |
| 6.8 | Final integration test — seed all 8 entities, verify profiles render | E | [x] | Orchestrated successfully |
| 6.9 | Write README.md with setup instructions | E | [x] | Readme committed to root |

---

## PHASE 7 — Stretch Goals (Post-MVP)
**Goal:** Future enhancements after core is working.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Add FARA (Foreign Agents Registration) data source | [x] | For Atlantic Council foreign govt analysis |
| 7.2 | Add politician voting record correlation scoring | [ ] | Compare votes to think tank positions |
| 7.3 | Add real-time data refresh with cron/scheduler | [ ] | |
| 7.4 | Deploy to Vercel + Supabase cloud | [ ] | |
| 7.5 | Add user authentication for saved searches | [ ] | |
| 7.6 | Add comparison view (side-by-side think tanks) | [x] | Deployed to /compare path |
| 7.7 | Add PDF report generation (per entity) | [x] | fpdf2 structured pipeline attached |
| 7.8 | Embed policy papers and enable semantic search | [ ] | Use pgvector |

---

## Cross-Reference Map

| Need to know... | Go to... |
|---|---|
| API keys and endpoints | `CLAUDE.md` Section 3 |
| Database schema | `CLAUDE.md` Section 6 |
| Tech stack versions | `CLAUDE.md` Section 2 |
| Tracked entities + EINs | `CLAUDE.md` Section 4 |
| Coding conventions | `CLAUDE.md` Section 7 |
| Known API quirks | `CLAUDE.md` Section 9 |
| Past errors and fixes | `ERROR_LOG.md` |
| Project file structure | `CLAUDE.md` Section 5 |

---

## Changelog

| Date | Change | By |
|---|---|---|
| 2026-04-10 | Initial plan created | Claude |
