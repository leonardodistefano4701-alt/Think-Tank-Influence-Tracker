"""Rematch existing policy paper claims against legislation using the strict
parse_bill / find_bill exact-matcher from docs/AUDIT.md.

Replaces the 63% mismatched FTS links with strictly verified matches.
"""

import os
import sys
import json
import uuid
import sqlite3
import re
from difflib import SequenceMatcher

DB_PATH = os.environ.get(
    'DB_PATH',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'data', 'ttit.db')
)

TYPES = {
    'HR': 'HR', 'S': 'S', 'HRES': 'HRES', 'SRES': 'SRES',
    'HJRES': 'HJRES', 'SJRES': 'SJRES', 'HCONRES': 'HCONRES', 'SCONRES': 'SCONRES'
}

def parse_bill(raw: str):
    s = re.sub(r'[\s.]', '', raw.upper())
    m = re.fullmatch(r'(HCONRES|SCONRES|HJRES|SJRES|HRES|SRES|HR|S)(\d+)', s)
    return (TYPES[m.group(1)], int(m.group(2))) if m else None

def find_bill(cur, raw_id, claimed_title, congresses=(117, 118)):
    key = parse_bill(raw_id)
    if not key:
        return None  # no FTS guessing, ever
    btype, num = key
    for c in congresses:
        row = cur.execute(
            'SELECT id, bill_id, title FROM legislation WHERE bill_id = ?',
            (f'{c}-{btype}-{num}',)
        ).fetchone()
        if row and SequenceMatcher(None, claimed_title.lower(), row[2].lower()).ratio() >= 0.6:
            return row
    return None  # log as unmatched; do not link

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Fetch all existing claims before deleting
    claims = cur.execute("""
        SELECT source_id, link_type, strength, evidence, metadata
        FROM influence_links
        WHERE provenance = 'ai_generated'
    """).fetchall()

    print(f'Found {len(claims)} ai_generated links to process.')

    # 2. Delete all ai_generated influence_links
    cur.execute("DELETE FROM influence_links WHERE provenance = 'ai_generated'")
    print('Deleted all ai_generated influence_links.')

    # 3. Re-match claims
    matched_count = 0
    unmatched_count = 0
    inserted_links = set()

    for source_id, link_type, strength, evidence, meta_str in claims:
        meta = json.loads(meta_str) if meta_str else {}
        raw_id = meta.get('perplexity_raw_id', '')
        claimed_title = meta.get('perplexity_title', '')

        if not raw_id:
            unmatched_count += 1
            print(f'  ⚠ Skipped claim with missing bill_id: {claimed_title[:40]}')
            continue

        matched_bill = find_bill(cur, raw_id, claimed_title)
        if matched_bill:
            leg_id = matched_bill[0]
            leg_bill_id = matched_bill[1]
            leg_title = matched_bill[2]

            # Avoid duplicates on (source_id, leg_id)
            link_key = (source_id, leg_id)
            if link_key in inserted_links:
                continue
            inserted_links.add(link_key)

            link_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO influence_links
                (id, source_type, source_id, target_type, target_id, link_type, strength, evidence, metadata, provenance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                link_id, 'policy_paper', source_id, 'legislation', leg_id,
                link_type or 'informs', strength or 0.8, evidence,
                json.dumps({'perplexity_raw_id': raw_id, 'perplexity_title': claimed_title}),
                'ai_generated'
            ))
            matched_count += 1
            print(f'  ✓ Linked to {leg_bill_id}: "{claimed_title[:35]}" -> "{leg_title[:35]}"')
        else:
            unmatched_count += 1
            print(f'  ⚠ Unmatched claim: {raw_id} ("{claimed_title[:40]}")')

    conn.commit()
    conn.close()
    print(f'\nDone: {matched_count} matched and linked, {unmatched_count} unmatched (logged and skipped).')

if __name__ == '__main__':
    main()
