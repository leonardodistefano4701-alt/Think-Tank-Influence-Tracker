# CLAUDE.md — Think Tank Influence Tracker (TTIT)

> **This is the master context file.** Read this FIRST on every task. Then check `IMPLEMENTATION_PLAN.md` for your current phase and task assignment.

---

## 1. PROJECT IDENTITY

**Name:** Think Tank Influence Tracker (TTIT)
**Tagline:** Follow the money. Trace the policy. Expose the pipeline.
**Inspired by:** [Track AIPAC](https://www.trackaipac.com/) — but deeper. We trace the full chain:

```
Donor → Think Tank → Policy Paper → Media Amplifier → Politician Vote/Bill
```

**Runs:** Locally (dev machine). No cloud deploy yet.
**Creator:** Leo (HWS student, AI Club project)

---

## 2. TECH STACK (LOCKED — do not change without updating this file)

| Layer | Technology | Version |
|---|---|---|
| Language | Python | 3.13.12 |
| Frontend | Next.js | 16.2.1 |
| CSS | Tailwind CSS | 4.2.2 |
| Database | SQLite | 3 |
| AI/LLM | OpenRouter → minimax/highspeed | — |
| Package mgr (Python) | uv or pip | — |
| Package mgr (JS) | npm | — |

---

## 3. API KEYS & ENDPOINTS

> ⚠️ These are real keys. Keep them in `.env` files, never commit to git.

### 3a. Data Pipeline APIs

| API | Base URL | Key / Auth | Purpose |
|---|---|---|---|
| **FEC (Federal Election Commission)** | `https://api.open.fec.gov/v1/` | `DJ9DliADMQgEOIh4gvid7c8dLTUuUwklD5BjwdgD` | Campaign finance: candidate receipts, PAC contributions, independent expenditures |
| **ProPublica Nonprofit Explorer** | `https://projects.propublica.org/nonprofits/api/v2/` | None (free, no key) | IRS 990 filings: think tank revenue, expenses, executive compensation, grants |
| **Congress.gov API** | `https://api.congress.gov/v3/` | Use FEC key or get separate key at api.data.gov | Bills, votes, members, committees |
| **OpenCorporates** | `https://api.opencorporates.com/v0.4/` | None (free tier) | Corporate entity resolution — tie donor names to parent companies |
| **NAICS API** | `https://naicsapi.docs.apiary.io/` | None (free) | Industry classification codes → map donors to sectors (fossil fuel, defense, etc.) |
| **USAspending** | `https://api.usaspending.gov/api/v2/` | None (free) | Federal contracts & grants by recipient — quantify govt revenue dependency |
| **Senate LDA (Lobbying)** | `https://lda.senate.gov/api/v1/` | `f62bbb8217f8ca89c8389672be7b59154d693eaf` | Lobbying disclosures: client, issue, spend amount |
| **NY Times** | `https://api.nytimes.com/svc/` | Key: `vvJKq0V4ngNCGkMh2G6KeNHhsJdrfj5kY4f2Zuixi1XCfm1h` / Secret: `vKxxGXLozGvHbtFNQEypPTOyA6JhXPCk63lgbGoxWY6Y33L9l7ZMPgsz50kBJrSG` | Article search — trace media coverage of think tank policy positions |

### 3b. AI / LLM

| Service | Model | Key |
|---|---|---|
| **OpenRouter** | `minimax/highspeed` | `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` |

### 3c. Infrastructure

| Service | Purpose |
|---|---|
| **SQLite** | Local standalone `ttit.db` storage. Embeddings saved contextually via np matrices. |

---

## 4. TRACKED ENTITIES (v1 Scope)

### Think Tanks
| Entity | EIN | Lean | Key Angle |
|---|---|---|---|
| Heritage Foundation | 23-7327730 | Right | Corporate & conservative donors, Project 2025 |
| Brookings Institution | 53-0196577 | Center | Wall Street, tech, Qatar foreign funding |
| Center for American Progress | 20-1541158 | Left | Democratic donor network, healthcare donor conflict |
| Cato Institute | 23-7432162 | Libertarian | Koch network, independence test |
| Council on Foreign Relations | 13-1628168 | Establishment | Elite capture, Carlyle Group overlap |
| Atlantic Council | 52-1328663 | Bipartisan/Globalist | Foreign govt funding, defense contractor capture |

### Media Amplifiers
| Entity | Type | Key Angle |
|---|---|---|
| Ezra Klein | Columnist/Podcaster (NYT) | Think-tank-to-mainstream pipeline, Abundance Agenda |
| Hasan Piker | Twitch Streamer | Compare accountability standards vs. think tanks |

---

## 5. PROJECT STRUCTURE

```
ttit/
├── CLAUDE.md                    ← YOU ARE HERE
├── IMPLEMENTATION_PLAN.md       ← Phase tracker, task list, agent assignments
├── ERROR_LOG.md                 ← Auto-appended errors and fixes (self-healing)
├── .env                         ← All API keys (gitignored)
├── .env.example                 ← Template without real values
├── docker-compose.yml           ← Supabase local
│
├── data-pipeline/               ← Python data ingestion layer
│   ├── pyproject.toml
│   ├── src/
│   │   ├── __init__.py
│   │   ├── config.py            ← Loads .env, shared constants
│   │   ├── db.py                ← Supabase/Postgres connection + schema
│   │   ├── models.py            ← Pydantic models for all entities
│   │   ├── collectors/          ← One module per API source
│   │   │   ├── __init__.py
│   │   │   ├── fec.py           ← FEC campaign finance
│   │   │   ├── propublica.py    ← IRS 990 nonprofit data
│   │   │   ├── congress.py      ← Bills, votes, members
│   │   │   ├── opencorporates.py← Corporate entity resolution
│   │   │   ├── naics.py         ← Industry classification
│   │   │   ├── usaspending.py   ← Federal contracts/grants
│   │   │   ├── lda.py           ← Lobbying disclosures
│   │   │   └── nytimes.py       ← Article search
│   │   ├── analyzers/           ← LLM-powered analysis
│   │   │   ├── __init__.py
│   │   │   ├── policy_alignment.py  ← Does funding predict policy?
│   │   │   ├── donor_influence.py   ← Score donor→policy correlation
│   │   │   └── media_tracer.py      ← Think tank → media echo detection
│   │   ├── orchestrator.py      ← Runs full pipeline for an entity
│   │   └── utils.py             ← Rate limiting, retry logic, logging
│   └── tests/
│       └── ...
│
├── web/                         ← Next.js 16 frontend
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← Landing / search
│   │   ├── think-tanks/
│   │   │   ├── page.tsx         ← Grid of all think tank cards
│   │   │   └── [slug]/
│   │   │       └── page.tsx     ← Individual profile page
│   │   ├── amplifiers/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── donors/
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── politicians/
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── explore/
│   │   │   └── page.tsx         ← Donor→Policy flow visualization
│   │   └── api/                 ← Next.js API routes (proxy to DB)
│   │       ├── think-tanks/
│   │       ├── donors/
│   │       ├── politicians/
│   │       └── analyze/
│   ├── components/
│   │   ├── ui/                  ← Shared UI primitives
│   │   ├── ProfileCard.tsx
│   │   ├── FinancialBreakdown.tsx
│   │   ├── DonorFlowChart.tsx
│   │   ├── PolicyTimeline.tsx
│   │   ├── InfluenceScore.tsx
│   │   └── SearchBar.tsx
│   └── lib/
│       ├── supabase.ts
│       └── types.ts
│
└── scripts/
    ├── seed.py                  ← Initial data load for all 8 entities
    ├── refresh.py               ← Incremental update
    └── export_excel.py          ← Generate Excel financial reports
```

---

## 6. DATABASE SCHEMA (Supabase/Postgres)

```sql
-- Core entity tables
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('think_tank', 'media_amplifier', 'politician', 'donor')),
  ein TEXT,                        -- for nonprofits
  lean TEXT,                       -- political lean
  description TEXT,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- IRS 990 financials
CREATE TABLE financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  fiscal_year INT NOT NULL,
  total_revenue BIGINT,
  total_expenses BIGINT,
  net_assets BIGINT,
  executive_compensation JSONB,   -- array of {name, title, amount}
  program_revenue BIGINT,
  contributions_and_grants BIGINT,
  investment_income BIGINT,
  raw_990 JSONB,                  -- full 990 response for reference
  UNIQUE(entity_id, fiscal_year)
);

-- Donor relationships
CREATE TABLE donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),    -- who receives
  donor_name TEXT NOT NULL,
  donor_entity_id UUID REFERENCES entities(id), -- if donor is also tracked
  amount BIGINT,
  year INT,
  source TEXT,                    -- 'irs_990', 'opensecrets', 'manual'
  industry TEXT,                  -- NAICS-derived sector
  is_foreign_govt BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);

-- Policy publications
CREATE TABLE policy_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  title TEXT NOT NULL,
  url TEXT,
  published_date DATE,
  topic_tags TEXT[],
  summary TEXT,                   -- LLM-generated
  embedding vector(1536),         -- pgvector for semantic search
  metadata JSONB DEFAULT '{}'
);

-- Legislative connections
CREATE TABLE legislation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id TEXT,                   -- congress.gov ID
  title TEXT,
  congress INT,
  chamber TEXT,
  status TEXT,
  sponsor_id UUID REFERENCES entities(id),
  topic_tags TEXT[],
  summary TEXT,
  introduced_date DATE,
  metadata JSONB DEFAULT '{}'
);

-- The key join: policy → legislation alignment
CREATE TABLE influence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('donor', 'think_tank', 'policy_paper', 'media', 'lobby')),
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('think_tank', 'policy_paper', 'legislation', 'politician', 'media')),
  target_id UUID NOT NULL,
  link_type TEXT,                 -- 'funds', 'publishes', 'echoes', 'sponsors', 'cites', 'lobbies_for'
  strength FLOAT,                -- 0-1 confidence score
  evidence TEXT,                 -- explanation of the connection
  year INT,
  metadata JSONB DEFAULT '{}'
);

-- Lobbying disclosures
CREATE TABLE lobbying (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_entity_id UUID REFERENCES entities(id),
  registrant_name TEXT,
  issue_code TEXT,
  issue_description TEXT,
  amount BIGINT,
  filing_year INT,
  filing_period TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Federal contracts/grants
CREATE TABLE govt_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name TEXT NOT NULL,
  recipient_entity_id UUID REFERENCES entities(id),
  agency TEXT,
  amount BIGINT,
  fiscal_year INT,
  naics_code TEXT,
  description TEXT,
  contract_type TEXT CHECK (contract_type IN ('contract', 'grant', 'loan', 'direct_payment')),
  metadata JSONB DEFAULT '{}'
);

-- Media coverage tracking
CREATE TABLE media_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  headline TEXT,
  source TEXT,                   -- 'nytimes', 'manual'
  url TEXT,
  published_date DATE,
  mentions_policy_id UUID REFERENCES policy_papers(id),
  sentiment FLOAT,               -- -1 to 1
  summary TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Analysis verdicts (LLM-generated)
CREATE TABLE analysis_verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  verdict TEXT NOT NULL,          -- 'captured', 'partially_captured', 'independent', 'mixed'
  confidence FLOAT,
  reasoning TEXT,
  evidence_summary TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  model_used TEXT DEFAULT 'minimax/highspeed'
);
```

---

## 7. CODING CONVENTIONS

### Python (data-pipeline/)
- Use `httpx` for async HTTP (not requests)
- All API calls go through `utils.py` rate limiter
- Pydantic v2 for all data models
- Type hints everywhere
- `async/await` for all I/O
- Logging via `structlog`
- Tests with `pytest` + `pytest-asyncio`
- SQLite for persistence using native `sqlite3`

### TypeScript/Next.js (web/)
- App Router only (no pages/ directory)
- Server Components by default; `'use client'` only when needed
- Tailwind 4 utility classes — no CSS modules
- `zod` for runtime validation on API routes
- Fetch from Supabase via `@supabase/supabase-js`

### Both
- **No hardcoded API keys** — always read from `.env`
- **Every collector must handle**: rate limits (429), timeouts, missing data gracefully
- **Retry with exponential backoff**: 3 retries, 1s/2s/4s delays
- **Log every API call**: endpoint, status code, latency

---

## 8. SELF-HEALING PROTOCOL

> When an error occurs during development, the agent MUST:

1. **Log it** → Append to `ERROR_LOG.md` with timestamp, phase, file, error message, and stack trace
2. **Diagnose** → Identify root cause
3. **Fix** → Apply the fix
4. **Update CLAUDE.md** → If the error reveals a new convention, API quirk, or constraint, add it to Section 9 ("Known Gotchas") below
5. **Update IMPLEMENTATION_PLAN.md** → Mark the task status and add a note about the fix

### Error Log Format (ERROR_LOG.md)
```markdown
## [YYYY-MM-DD HH:MM] Phase X.Y — filename.py
**Error:** <error message>
**Cause:** <root cause>
**Fix:** <what was changed>
**Prevention:** <convention added to CLAUDE.md>
```

---

## 9. KNOWN GOTCHAS & LEARNINGS

> This section grows over time. Agents MUST check here before starting any task.

- **FEC API**: Rate limit is 1000 requests/hour. Pagination uses `last_index` and `last_<sort_field>` params, NOT page numbers.
- **ProPublica Nonprofit API**: Returns 990 data as nested JSON. `filing_type` can be `990`, `990EZ`, or `990PF` — handle all three.
- **Congress.gov API**: Requires `api_key` as query param. Rate limit: 5000/hour.
- **Senate LDA API**: Uses token-based auth (`Authorization: Token <key>`). Pagination is offset-based.
- **OpenCorporates**: Free tier is 500 requests/month. Cache aggressively.
- **NAICS API**: Returns codes as strings, not integers. Some codes have been retired between revisions.
- **USAspending**: Large result sets paginated with `page` and `limit`. Max `limit=100`.
- **NYT API**: Rate limit 10 requests/minute for Article Search. Needs `api-key` query param.
- **OpenRouter**: Use `Authorization: Bearer <key>` header. Model string is `minimax/highspeed`. Max context varies.
- **Docker**: Docker must be installed locally to run Supabase (`docker compose up`) and execute the seed scripts.

---

## 10. CROSS-REFERENCES

- **Implementation phases & task assignments** → See `IMPLEMENTATION_PLAN.md`
- **Error history & fixes** → See `ERROR_LOG.md`
- **API key values** → See `.env` (generated from Section 3 above)
- **Database migrations** → `data-pipeline/src/db.py` contains schema

---

## 11. AGENT INSTRUCTIONS

When working on this project:

1. **Always read this file first** — it is the source of truth
2. **Check IMPLEMENTATION_PLAN.md** for your assigned phase/task
3. **Check ERROR_LOG.md** for known issues before starting
4. **After completing a task**: update IMPLEMENTATION_PLAN.md status
5. **After hitting an error**: follow the Self-Healing Protocol (Section 8)
6. **After learning something new**: add it to Known Gotchas (Section 9)
7. **Never change the tech stack** without updating Section 2
8. **Never hardcode API keys** — always use `.env`
9. **Test each collector independently** before integration
10. **When in doubt**, read the API docs (URLs in Section 3) before guessing
