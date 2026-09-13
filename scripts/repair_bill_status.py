"""Re-derive legislative status for bills already in the database.

Why this exists: the original bulk import (a) classified status with logic that
never reached "Signed into Law" — 0 of 20,428 rows were marked as law, including
the Inflation Reduction Act — and (b) stored the five *oldest* actions per bill
while calling the oldest one `latest_action`, because BILLSTATUS XML is ordered
newest-first. The stored subset therefore can't be re-derived from; the signing
action was thrown away at import time.

This script re-fetches the authoritative per-bill XML from GovInfo bulkdata,
which is public and needs no API key, and rewrites status, latest_action and
recent_actions using scripts/bill_status.py.

By default it repairs only the bills referenced by influence_links — the ones
that actually drive the analysis scorecard — rather than all 20k.

    python scripts/repair_bill_status.py --dry-run
    python scripts/repair_bill_status.py
    python scripts/repair_bill_status.py --all --limit 500
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bill_status import derive_status, latest_action, most_recent_actions  # noqa: E402

BULK_BASE = "https://www.govinfo.gov/bulkdata/BILLSTATUS"
DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data", "ttit.db")
)
USER_AGENT = "TTIT-research/1.0 (+https://github.com/leonardodistefano4701-alt/Think-Tank-Influence-Tracker)"

# "117-HR-5376" -> congress 117, type hr, number 5376
BILL_ID_RE = re.compile(r"^(\d+)-([A-Z]+)-(\d+)$")


def bill_url(bill_id: str) -> str | None:
    m = BILL_ID_RE.match(bill_id or "")
    if not m:
        return None
    congress, btype, number = m.group(1), m.group(2).lower(), m.group(3)
    return f"{BULK_BASE}/{congress}/{btype}/BILLSTATUS-{congress}{btype}{number}.xml"


def fetch_actions(bill_id: str, timeout: float = 30.0) -> list[dict] | None:
    """Fetch a bill's full action list, or None if it can't be retrieved."""
    url = bill_url(bill_id)
    if not url:
        return None
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        return None

    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None

    actions = []
    for a in root.findall(".//actions/item"):
        text = a.findtext("text") or ""
        if not text:
            continue
        actions.append(
            {
                "date": a.findtext("actionDate") or "",
                "text": text,
                "type": a.findtext("type") or "",
                "action_code": a.findtext("actionCode") or "",
            }
        )
    return actions


def target_bills(conn: sqlite3.Connection, everything: bool, limit: int | None):
    if everything:
        sql = "SELECT id, bill_id, status FROM legislation WHERE bill_id IS NOT NULL ORDER BY bill_id"
    else:
        sql = """
            SELECT id, bill_id, status FROM legislation
            WHERE bill_id IS NOT NULL
              AND id IN (SELECT target_id FROM influence_links WHERE target_type = 'legislation')
            ORDER BY bill_id
        """
    rows = conn.execute(sql).fetchall()
    return rows[:limit] if limit else rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="report changes without writing")
    ap.add_argument("--all", action="store_true", help="repair every bill, not just linked ones")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=0.5, help="seconds between requests")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = target_bills(conn, args.all, args.limit)
    print(f"{len(rows)} bill(s) to check against GovInfo bulkdata\n")

    changed = unreachable = unchanged = 0
    for i, row in enumerate(rows, 1):
        actions = fetch_actions(row["bill_id"])
        if actions is None:
            unreachable += 1
            print(f"  [{i}/{len(rows)}] {row['bill_id']:<16} UNREACHABLE")
            time.sleep(args.sleep)
            continue

        status = derive_status(actions)
        latest = latest_action(actions)
        recent = most_recent_actions(actions, 5)

        if status != row["status"]:
            changed += 1
            print(f"  [{i}/{len(rows)}] {row['bill_id']:<16} {row['status']!r} -> {status!r}")
        else:
            unchanged += 1

        if not args.dry_run:
            conn.execute(
                """
                UPDATE legislation
                   SET status = ?,
                       latest_action = ?,
                       metadata = json_set(
                           COALESCE(NULLIF(metadata, ''), '{}'),
                           '$.recent_actions', ?,
                           '$.action_count', ?,
                           '$.status_source', 'govinfo_bulkdata'
                       )
                 WHERE id = ?
                """,
                (status, latest["text"] if latest else "", json.dumps(recent), len(actions), row["id"]),
            )
        time.sleep(args.sleep)

    if not args.dry_run:
        conn.commit()
    conn.close()

    print(
        f"\n{'(dry run) ' if args.dry_run else ''}"
        f"changed={changed} unchanged={unchanged} unreachable={unreachable}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
