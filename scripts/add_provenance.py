"""Add explicit provenance to every table the UI renders, and stop the database
from claiming government sources for hand-written rows.

The problem this fixes: donors, lobbying rows and influence links were typed as
Python literals in seed_full.py / seed_analysis.py, but stamped with
`source='irs_990'|'opensecrets'|'fara'|'usaspending'`. The UI rendered those
strings to users as citations. There is no OpenSecrets collector in this repo,
and the FARA rows were never checked against a FARA filing.

Three provenance values:

  verified_filing  Derived from a primary source we actually queried:
                   ProPublica 990 filings, FEC records, GovInfo BILLSTATUS.
  seeded_demo      Hand-authored demonstration data. Plausible, not sourced.
  ai_generated     Produced by an LLM. Unverified model output.

The original `source` string is preserved in metadata as
`unverified_source_claim` so nothing is lost - it just stops being displayed as
a citation.

Idempotent: safe to re-run.
"""

from __future__ import annotations

import os
import sqlite3
import sys

DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ttit.db")
)

VERIFIED = "verified_filing"
SEEDED = "seeded_demo"
AI = "ai_generated"

TABLES = [
    "donors",
    "financials",
    "lobbying",
    "policy_papers",
    "influence_links",
    "analysis_verdicts",
    "legislation",
    "govt_contracts",
    "media_coverage",
]


def column_exists(conn, table, column) -> bool:
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})"))


def table_exists(conn, table) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone() is not None


def main() -> int:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    for t in TABLES:
        if not table_exists(conn, t):
            continue
        if not column_exists(conn, t, "provenance"):
            conn.execute(f"ALTER TABLE {t} ADD COLUMN provenance TEXT")
            print(f"  + {t}.provenance")

    # --- verified: things we actually fetched from a primary source ---------
    conn.execute(f"UPDATE financials SET provenance = '{VERIFIED}'")
    conn.execute(f"UPDATE legislation SET provenance = '{VERIFIED}'")

    # --- seeded: hand-authored literals -------------------------------------
    # Preserve the original claim, then stop presenting it as a citation.
    conn.execute(
        """
        UPDATE donors
           SET metadata = json_set(
                   COALESCE(NULLIF(metadata, ''), '{}'),
                   '$.unverified_source_claim', COALESCE(source, '')
               )
         WHERE source IS NOT NULL AND source != ''
           AND json_extract(COALESCE(NULLIF(metadata,''), '{}'), '$.unverified_source_claim') IS NULL
        """
    )
    conn.execute(f"UPDATE donors SET provenance = '{SEEDED}', source = NULL")
    conn.execute(f"UPDATE lobbying SET provenance = '{SEEDED}'")

    # --- ai_generated: LLM output -------------------------------------------
    conn.execute(f"UPDATE analysis_verdicts SET provenance = '{AI}'")
    # Papers came out of a Perplexity "discovery" prompt, not a crawl. Ones with
    # no URL at all are the least verifiable of the set.
    conn.execute(f"UPDATE policy_papers SET provenance = '{AI}'")

    # Influence links: everything here is either hand-typed or LLM-asserted.
    # policy_paper -> legislation links came from collect_perplexity.py, which
    # assigned a constant strength of 0.8 to every link it created.
    conn.execute(
        f"""
        UPDATE influence_links
           SET provenance = CASE
                 WHEN source_type = 'policy_paper' AND target_type = 'legislation'
                      AND strength = 0.8 THEN '{AI}'
                 ELSE '{SEEDED}'
               END
        """
    )

    for t in ("govt_contracts", "media_coverage"):
        if table_exists(conn, t):
            conn.execute(f"UPDATE {t} SET provenance = '{VERIFIED}' WHERE provenance IS NULL")

    conn.commit()

    print("\nprovenance distribution:")
    for t in TABLES:
        if not table_exists(conn, t):
            continue
        rows = conn.execute(
            f"SELECT COALESCE(provenance,'(null)') p, COUNT(*) c FROM {t} GROUP BY p ORDER BY c DESC"
        ).fetchall()
        if rows:
            summary = ", ".join(f"{r['p']}={r['c']}" for r in rows)
            print(f"  {t:20} {summary}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
