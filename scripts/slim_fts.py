"""Rebuild the FTS5 search indexes as external-content tables, and keep them in sync.

Two problems this fixes.

1. Size. A standard FTS5 table stores its own copy of every indexed column in a
   `<name>_content` shadow table. For `search_legislation` that copy is ~8 MB of a
   42.8 MB database. External content (`content=`) makes FTS5 read columns from the
   source table instead, so the shadow copy disappears. The `_data` table — the
   actual inverted index, ~5 MB — necessarily stays.

2. Drift. There were no triggers on this database, so anything that updated a row
   without rebuilding the index left the index stale. That had already happened:
   repair_bill_status.py corrected 38 bill statuses, after which a full-text search
   for "Signed into Law" returned 2 rows while the table held 15. External content
   fixes stale *column reads* by construction, but the inverted index is still a
   separate structure, so the triggers below are what keep MATCH correct.

`search_legislation` reads through a view because it indexes a `sponsors` column
that does not exist on `legislation` — sponsor names live inside `metadata` JSON.
The other three map straight onto their base tables.

Idempotent: drops and recreates everything, then VACUUMs to reclaim the freed pages.

    python scripts/slim_fts.py --dry-run
    python scripts/slim_fts.py
"""

from __future__ import annotations

import argparse
import os
import sqlite3

DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data", "ttit.db"),
)

LEGISLATION_VIEW = """
CREATE VIEW legislation_fts_src AS
  SELECT l.rowid AS rowid,
         l.bill_id,
         l.title,
         COALESCE(l.summary, '') AS summary,
         COALESCE(l.status, '')  AS status,
         COALESCE(l.policy_area, json_extract(l.metadata, '$.policy_area'), '') AS policy_area,
         COALESCE(json_extract(l.metadata, '$.sponsors'), '') AS sponsors
    FROM legislation l
"""

# (fts table, content source, content is a view, base table, columns)
SPECS = [
    (
        "search_legislation",
        "legislation_fts_src",
        True,
        "legislation",
        ["bill_id", "title", "summary", "status", "policy_area", "sponsors"],
    ),
    ("search_entities", "entities", False, "entities", ["name", "type", "description", "lean"]),
    ("search_donors", "donors", False, "donors", ["donor_name", "industry", "source"]),
    ("search_papers", "policy_papers", False, "policy_papers", ["title", "summary", "topic_tags"]),
]

# How the legislation view derives each column, reused by the delete triggers:
# an AFTER DELETE trigger cannot read the view, because the row is already gone.
LEGISLATION_OLD_EXPR = {
    "bill_id": "old.bill_id",
    "title": "old.title",
    "summary": "COALESCE(old.summary, '')",
    "status": "COALESCE(old.status, '')",
    "policy_area": "COALESCE(old.policy_area, json_extract(old.metadata, '$.policy_area'), '')",
    "sponsors": "COALESCE(json_extract(old.metadata, '$.sponsors'), '')",
}


def build_statements() -> list[str]:
    stmts: list[str] = []

    # Tear down anything from a previous run or from the old standalone schema.
    for fts, _src, _is_view, base, _cols in SPECS:
        for suffix in ("ai", "ad", "au"):
            stmts.append(f"DROP TRIGGER IF EXISTS {base}_fts_{suffix}")
        stmts.append(f"DROP TABLE IF EXISTS {fts}")
    stmts.append("DROP VIEW IF EXISTS legislation_fts_src")
    stmts.append(LEGISLATION_VIEW.strip())

    for fts, src, is_view, base, cols in SPECS:
        collist = ", ".join(cols)
        stmts.append(
            f"CREATE VIRTUAL TABLE {fts} USING fts5(\n"
            f"  {collist},\n"
            f"  content='{src}', content_rowid='rowid'\n"
            f")"
        )
        stmts.append(f"INSERT INTO {fts}({fts}) VALUES('rebuild')")

        # Values for the FTS 'delete' command must be exactly what was indexed.
        if is_view:
            old_vals = ", ".join(LEGISLATION_OLD_EXPR[c] for c in cols)
        else:
            old_vals = ", ".join(f"old.{c}" for c in cols)

        new_select = (
            f"SELECT rowid, {collist} FROM {src} WHERE rowid = new.rowid"
            if is_view
            else f"SELECT new.rowid, {', '.join('new.' + c for c in cols)}"
        )

        stmts.append(
            f"CREATE TRIGGER {base}_fts_ai AFTER INSERT ON {base} BEGIN\n"
            f"  INSERT INTO {fts}(rowid, {collist}) {new_select};\n"
            f"END"
        )
        stmts.append(
            f"CREATE TRIGGER {base}_fts_ad AFTER DELETE ON {base} BEGIN\n"
            f"  INSERT INTO {fts}({fts}, rowid, {collist})\n"
            f"  VALUES('delete', old.rowid, {old_vals});\n"
            f"END"
        )
        stmts.append(
            f"CREATE TRIGGER {base}_fts_au AFTER UPDATE ON {base} BEGIN\n"
            f"  INSERT INTO {fts}({fts}, rowid, {collist})\n"
            f"  VALUES('delete', old.rowid, {old_vals});\n"
            f"  INSERT INTO {fts}(rowid, {collist}) {new_select};\n"
            f"END"
        )
    return stmts


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="print the SQL without running it")
    args = ap.parse_args()

    stmts = build_statements()
    if args.dry_run:
        for s in stmts:
            print(s.strip() + ";\n")
        return 0

    before = os.path.getsize(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    # A trigger that writes to a virtual table needs a trusted schema. Both
    # better-sqlite3 and Python default this ON, but the sqlite3 CLI does not,
    # so set it explicitly rather than depending on the driver.
    conn.execute("PRAGMA trusted_schema=ON")

    for s in stmts:
        conn.execute(s)
    conn.commit()

    print("FTS5 tables rebuilt as external content:\n")
    for fts, src, _is_view, _base, _cols in SPECS:
        rows = conn.execute(f"SELECT COUNT(*) FROM {fts}").fetchone()[0]
        conn.execute(f"INSERT INTO {fts}({fts}) VALUES('integrity-check')")
        print(f"  {fts:<20} {rows:>6} rows   content={src:<22} integrity ok")

    ok = conn.execute("PRAGMA integrity_check").fetchone()[0]
    print(f"\n  database integrity_check: {ok}")
    conn.commit()

    # Reclaim the pages the dropped _content shadow tables were using.
    conn.execute("VACUUM")
    conn.close()

    after = os.path.getsize(DB_PATH)
    print(
        f"\n  size {before / 1048576:.1f} MB -> {after / 1048576:.1f} MB "
        f"({(before - after) / 1048576:.1f} MB reclaimed, {100 * (before - after) / before:.0f}%)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
