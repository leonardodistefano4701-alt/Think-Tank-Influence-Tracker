# Think Tank Influence Tracker (TTIT)

A research prototype that traces funding, policy output and legislative activity
across a set of US think tanks and media commentators, and renders the
connections as a browsable web app.

> **Read this first.** Parts of this project are demonstration data or unverified
> language-model output. Those parts are labelled in the interface and explained
> on the `/methodology` page. Nothing in this app is a finding of fact about any
> named organization or person.

## What is actually verified

The app distinguishes three provenance levels, and shows a badge next to values
that are not drawn from a primary source.

| Provenance | What it means | Where it comes from |
|---|---|---|
| **Verified filing** | Retrieved from a source the pipeline actually queried | IRS Form 990 filings (ProPublica Nonprofit Explorer), FEC records, GovInfo BILLSTATUS |
| **Demo data** | Hand-authored so the interface has something to render | `scripts/seed_full.py`, `scripts/seed_analysis.py` |
| **AI-generated** | Unverified language-model output | Perplexity `sonar-pro` via `scripts/collect_perplexity.py` |

Roughly: financials, FEC records and 20,428 bills are real; donors, lobbying
rows, influence links and AI verdicts are not. The influence "strength" values
mix three incompatible scales and should not be read as measurements. See
`/methodology` in the running app for the full account.

## Stack

- **Web** — Next.js 16 (App Router, server components), Tailwind 4, `better-sqlite3`
- **Database** — SQLite at `web/data/ttit.db`, read-only at runtime, opened once per process
- **Pipeline** — Python 3.11+, `httpx` for the async collectors, `urllib` in the standalone scripts

## Running it

```bash
cd web
npm ci
npm run dev
```

The database is committed, so the app runs with no pipeline setup. Open
http://localhost:3000.

### Checks

```bash
cd web && npm run typecheck && npm run lint && npm run build
```

```bash
uv run --python 3.12 --with pytest --with httpx --with structlog --with python-dotenv --with pydantic pytest -q
```

Both run in CI on every push and pull request.

## Pipeline scripts

API keys are read from the environment only — see `.env.example`. No script
carries a default credential.

| Script | What it does |
|---|---|
| `scripts/seed_full.py` | Writes the demonstration entities, donors and lobbying rows |
| `scripts/import_bulk_bills.py` | Imports GovInfo BILLSTATUS bulk data and builds the FTS5 index |
| `scripts/repair_bill_status.py` | Re-derives bill status from authoritative GovInfo XML |
| `scripts/add_provenance.py` | Backfills the `provenance` column across every rendered table |
| `scripts/collect_perplexity.py` | Surfaces candidate policy papers via an LLM |
| `scripts/export_excel.py` / `export_pdf.py` | Exports the database to portable formats |

`scripts/bill_status.py` holds the status classifier and is covered by tests in
`scripts/tests/`.

## Deployment

Deploys to Vercel with the `web/` directory as the project root. The SQLite file
is pulled into the serverless bundle through `outputFileTracingIncludes` in
`web/next.config.ts`; without that the function cannot open it.

## Known limitations

- Donor, lobbying and influence-link data is illustrative, not sourced.
- Link types are causal verbs applied to topical overlap. There is no control
  group and no base rate, so a "success rate" is not evidence of influence.
- The `data-pipeline/src` collector layer is largely superseded by the standalone
  scripts in `scripts/`, which are what actually populated the database.
- `govt_contracts` and `media_coverage` are empty; the pages that read them
  render empty states.
- The database is committed to git, which is convenient for a demo but means the
  repository grows by roughly 10 MB every time the data is refreshed.

## License

MIT — see [LICENSE](LICENSE).
