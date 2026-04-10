# Think Tank Influence Tracker (TTIT)

> Follow the money. Trace the policy. Expose the structural capture of political pipelines.

## Project Architecture
TTIT is built to autonomously forensically trace money and ideology moving from structural Think Tanks and SuperPACs directly into Congressional Policy and amplifier messaging via advanced API cross-referencing and an internal OpenRouter LLM system.

### Tech Stack
- **Database:** Fast local native SQLite (`ttit.db`) tracking structural datasets safely and offline.
- **AI Processing Layer:** `openrouter` executing fast semantic comparisons. Node modules written using `httpx` async pipelines via exponential backoff strategies to prevent API locking.
- **Frontend:** Next.js 16 server-components driving standard tailwind v4 data visualizations dynamically pulling from local nodes without middle layers.

## Operation Sequences

### 1. Database Provisioning
Populate initial structural logic locally.
```bash
python scripts/seed.py
```

### 2. Global Orchestrator Flow
Pull raw APIs and analyze ideological overlap via the internal LLMs:
```bash
python data-pipeline/src/orchestrator.py --all
```

### 3. Generate Analytical Briefs
Output the entire network vector trace directly into portable Excel formats:
```bash
python scripts/export_excel.py
```

### 4. Interactive Node UI Map
```bash
cd web
npm install
npm run dev
```
