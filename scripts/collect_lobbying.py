"""
Senate LDA API Lobbying Collector — Phase 2 of docs/AUDIT.md.

Queries the Senate LDA API (lda.senate.gov/api) for exact registrant and client names
for the six tracked think tanks and Heritage Action for America (affiliated 501(c)(4)).
Stores filing_uuid, canonical print source_url, amounts, and issue areas.
Replaces the 5 seeded demo lobbying rows.
"""

import os
import sys
import json
import uuid
import sqlite3
import urllib.request
import urllib.parse
import time
import re

# Load .env if present
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    v = v.strip('"\'')
                    if k not in os.environ:
                        os.environ[k] = v

load_env()

API_KEY = os.environ.get('LDA_API_KEY') or os.environ.get('SENATE_LDA_API_KEY')
if not API_KEY:
    print("❌ Error: Neither LDA_API_KEY nor SENATE_LDA_API_KEY is set in environment or .env")
    sys.exit(1)

BASE_URL = "https://lda.senate.gov/api/v1/filings/"
DB_PATH = os.environ.get(
    'DB_PATH',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'data', 'ttit.db')
)

TARGET_ENTITIES = [
    {"name": "Brookings Institution", "slug": "brookings-institution"},
    {"name": "Center for American Progress", "slug": "center-for-american-progress"},
    {"name": "Heritage Foundation", "slug": "heritage-foundation"},
    {"name": "Cato Institute", "slug": "cato-institute"},
    {"name": "Council on Foreign Relations", "slug": "council-on-foreign-relations"},
    {"name": "Atlantic Council", "slug": "atlantic-council"},
    {"name": "Heritage Action for America", "slug": "heritage-action-for-america"},
]

def clean_name(s: str) -> str:
    return re.sub(r'[\s.,\-/]+', ' ', (s or '').strip().upper())

def fetch_filings_for_name(name: str):
    """Fetch all filings from Senate LDA API matching exact registrant or client name."""
    headers = {
        "Authorization": f"Token {API_KEY}",
        "User-Agent": "TTIT-Monitor/1.0"
    }
    
    clean_target = clean_name(name)
    filings_by_uuid = {}
    
    for search_field in ['registrant_name', 'client_name']:
        params = {search_field: name}
        url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
        page = 1
        
        while url:
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
            except Exception as e:
                print(f"    ⚠ API request failed for {name} ({search_field} page {page}): {e}")
                break
                
            results = data.get('results', [])
            for r in results:
                fuuid = r.get('filing_uuid')
                if not fuuid:
                    continue
                    
                reg_name = clean_name(r.get('registrant', {}).get('name') or '')
                cli_name = clean_name(r.get('client', {}).get('name') or '')
                
                # Rule 3: Join records only on exact identifiers, never substrings.
                # Must match exact target name on registrant or client.
                if reg_name == clean_target or cli_name == clean_target:
                    filings_by_uuid[fuuid] = r
                    
            url = data.get('next')
            page += 1
            time.sleep(0.2)  # courteous rate-limiting
            
    return list(filings_by_uuid.values())

def run():
    print("=" * 70)
    print("Senate LDA Lobbying Collector (Phase 2)")
    print("=" * 70)
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # 1. Ensure table columns
    cur.execute("PRAGMA table_info(lobbying)")
    cols = [c[1] for c in cur.fetchall()]
    if 'filing_uuid' not in cols:
        cur.execute("ALTER TABLE lobbying ADD COLUMN filing_uuid TEXT")
    if 'source_url' not in cols:
        cur.execute("ALTER TABLE lobbying ADD COLUMN source_url TEXT")
    conn.commit()

    # 2. Count existing seeded demo rows
    cur.execute("SELECT COUNT(*) FROM lobbying WHERE provenance = 'seeded_demo'")
    seeded_count = cur.fetchone()[0]
    print(f"Found {seeded_count} seeded_demo rows to replace.")
    
    # 3. Delete seeded demo rows
    cur.execute("DELETE FROM lobbying WHERE provenance = 'seeded_demo'")
    conn.commit()
    print(f"Deleted {seeded_count} seeded_demo lobbying rows.")
    
    # 4. Fetch filings per entity
    total_inserted = 0
    entity_summaries = []
    
    for target in TARGET_ENTITIES:
        name = target["name"]
        slug = target["slug"]
        
        # Get entity_id from db
        cur.execute("SELECT id FROM entities WHERE slug = ?", (slug,))
        row = cur.fetchone()
        if not row:
            print(f"⚠ Entity not found in db: {slug} ({name})")
            continue
        entity_id = row[0]
        
        print(f"\nQuerying Senate LDA API for: {name}...")
        filings = fetch_filings_for_name(name)
        print(f"  Found {len(filings)} exact-match filings.")
        
        entity_inserted = 0
        entity_total_amount = 0.0
        
        for f in filings:
            fuuid = f.get('filing_uuid')
            source_url = f"https://lda.senate.gov/filings/public/filing/{fuuid}/print/"
            
            # Amount: expenses (for 501(c)(4)s / self-filing organizations) or income (for lobbying firms)
            expenses = f.get('expenses')
            income = f.get('income')
            amount = None
            if expenses is not None:
                try: amount = int(round(float(expenses)))
                except: pass
            elif income is not None:
                try: amount = int(round(float(income)))
                except: pass
                
            if amount:
                entity_total_amount += amount
                
            reg_name = (f.get('registrant', {}).get('name') or '').strip()
            cli_name = (f.get('client', {}).get('name') or '').strip()
            
            year = f.get('filing_year')
            period = f.get('filing_period_display') or f.get('filing_period') or ''
            
            # Extract issue codes and descriptions
            activities = f.get('lobbying_activities', []) or []
            issue_codes = sorted(set(a.get('general_issue_code') for a in activities if a.get('general_issue_code')))
            issue_code_str = ', '.join(issue_codes) if issue_codes else (activities[0].get('general_issue_code') if activities else None)
            
            descriptions = [a.get('description') for a in activities if a.get('description')]
            desc_str = '; '.join(descriptions)[:1500] if descriptions else None
            
            meta = {
                'filing_uuid': fuuid,
                'filing_type': f.get('filing_type'),
                'filing_type_display': f.get('filing_type_display'),
                'dt_posted': f.get('dt_posted'),
                'source_url': source_url,
                'expenses': expenses,
                'income': income,
                'issue_codes': issue_codes
            }
            
            # Check if row with this filing_uuid already exists
            cur.execute("SELECT id FROM lobbying WHERE filing_uuid = ?", (fuuid,))
            existing = cur.fetchone()
            row_id = existing[0] if existing else str(uuid.uuid4())
            
            cur.execute("""
                INSERT OR REPLACE INTO lobbying
                (id, client_name, client_entity_id, registrant_name, issue_code, issue_description,
                 amount, filing_year, filing_period, metadata, provenance, filing_uuid, source_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row_id,
                cli_name or name,
                entity_id,
                reg_name,
                issue_code_str,
                desc_str,
                amount,
                year,
                period,
                json.dumps(meta),
                'verified_filing',
                fuuid,
                source_url
            ))
            entity_inserted += 1
            total_inserted += 1
            
        conn.commit()
        entity_summaries.append({
            'name': name,
            'slug': slug,
            'count': entity_inserted,
            'total_amount': entity_total_amount
        })
        print(f"  ✓ Stored {entity_inserted} verified filings (total amount: ${entity_total_amount:,.0f}).")
        
    conn.close()
    
    print("\n" + "=" * 70)
    print("Summary of Senate LDA Lobbying Ingestion")
    print("=" * 70)
    for s in entity_summaries:
        status_str = f"{s['count']} filings (${s['total_amount']:,.0f})" if s['count'] > 0 else "No LDA filings"
        print(f"  {s['name']:30s} : {status_str}")
    print(f"\nTotal verified lobbying rows in database: {total_inserted}")
    print("=" * 70)

if __name__ == '__main__':
    run()
