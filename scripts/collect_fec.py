"""
FEC Data Collector — Uses data.gov API key to pull real campaign finance data.
Queries:
  1. PAC/committee records for each tracked donor
  2. Top individual contributions by donor employees
  3. Independent expenditure data
Stores results in the database and creates influence links.
"""
import sys, os, uuid, sqlite3, json, urllib.request, time

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'data-pipeline', 'src'))
from db import get_db

API_KEY = os.environ.get('FEC_API_KEY', 'kOL6CKT2XB7yJCZXTyoEkfUZ2TacsdRYcp4y8hKI')
BASE_URL = 'https://api.open.fec.gov/v1'

def uid():
    return str(uuid.uuid4())

def fec_get(path, params=None, retries=3):
    """Make a GET request to the FEC API with rate limiting."""
    if params is None:
        params = {}
    params['api_key'] = API_KEY
    query = '&'.join(f'{k}={v}' for k, v in params.items())
    url = f'{BASE_URL}{path}?{query}'
    
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'TTIT/1.0')
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                print(f"  ⚠ API error after {retries} attempts: {e}")
                return None

def run():
    with get_db() as conn:
        cur = conn.cursor()
        
        # Create FEC-specific tables if they don't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS fec_committees (
                id TEXT PRIMARY KEY,
                fec_id TEXT UNIQUE,
                name TEXT NOT NULL,
                sponsor TEXT,
                committee_type TEXT,
                designation TEXT,
                party TEXT,
                total_receipts REAL,
                total_disbursements REAL,
                cycle INTEGER,
                linked_donor TEXT,
                linked_entity_id TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS fec_contributions (
                id TEXT PRIMARY KEY,
                contributor_name TEXT,
                contributor_employer TEXT,
                contribution_amount REAL,
                contribution_date TEXT,
                recipient_committee TEXT,
                recipient_committee_id TEXT,
                recipient_name TEXT,
                memo_text TEXT,
                linked_donor TEXT,
                linked_entity_id TEXT
            )
        """)
        conn.commit()

        # Get all donors from the database
        donors = cur.execute("""
            SELECT d.donor_name, d.industry, d.entity_id, e.name as tank_name
            FROM donors d
            JOIN entities e ON d.entity_id = e.id
            GROUP BY d.donor_name
        """).fetchall()

        print("=" * 60)
        print("FEC DATA COLLECTOR — Live Campaign Finance Data")
        print("=" * 60)

        # ── 1. Find PACs/Committees for each donor ─────────────────────
        print("\n📋 Phase 1: Finding PACs and Committees...")
        pac_count = 0
        for donor_row in donors:
            donor = dict(donor_row)
            name = donor['donor_name']
            
            # Skip foreign government donors (they don't have PACs)
            if any(x in name.lower() for x in ['qatar', 'emirates', 'nato', 'state department']):
                continue
            
            search_name = name.split('/')[0].strip()  # Handle "George Soros / Open Society"
            data = fec_get('/committees/', {'q': search_name.replace(' ', '+'), 'per_page': '3'})
            if not data:
                continue
                
            results = data.get('results', [])
            if not results:
                print(f"  ○ {name}: No PACs found")
                continue

            for pac in results[:2]:  # Store top 2 PACs per donor
                fec_id = pac.get('committee_id', '')
                existing = cur.execute("SELECT id FROM fec_committees WHERE fec_id = ?", (fec_id,)).fetchone()
                if existing:
                    continue

                # Get financial totals for this committee
                financials = fec_get(f'/committee/{fec_id}/totals/', {'per_page': '1'})
                total_receipts = 0
                total_disbursements = 0
                if financials and financials.get('results'):
                    fin = financials['results'][0]
                    total_receipts = fin.get('receipts', 0) or 0
                    total_disbursements = fin.get('disbursements', 0) or 0
                
                cur.execute("""
                    INSERT OR IGNORE INTO fec_committees (id, fec_id, name, sponsor, committee_type, designation, party, total_receipts, total_disbursements, cycle, linked_donor, linked_entity_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (uid(), fec_id, pac.get('name', ''), pac.get('sponsor_candidate_ids', [''])[0] if pac.get('sponsor_candidate_ids') else '',
                      pac.get('committee_type_full', ''), pac.get('designation_full', ''),
                      pac.get('party_full', ''), total_receipts, total_disbursements,
                      pac.get('cycles', [2024])[0] if pac.get('cycles') else 2024,
                      name, donor['entity_id']))
                pac_count += 1
                print(f"  ✓ {name} → {pac.get('name','')} (${total_receipts:,.0f} receipts)")
                
            time.sleep(0.5)  # Rate limit

        # ── 2. Pull top contributions by employer ──────────────────────
        print(f"\n💰 Phase 2: Pulling individual contributions...")
        contrib_count = 0
        employer_donors = [
            'Koch Industries', 'Raytheon', 'Lockheed Martin', 'Goldman Sachs',
            'ExxonMobil', 'Google', 'Microsoft'
        ]
        
        for employer in employer_donors:
            donor_row = cur.execute("""
                SELECT d.entity_id FROM donors d WHERE d.donor_name LIKE ? LIMIT 1
            """, (f'%{employer}%',)).fetchone()
            entity_id = dict(donor_row)['entity_id'] if donor_row else None

            data = fec_get('/schedules/schedule_a/', {
                'contributor_employer': employer.replace(' ', '+'),
                'sort': '-contribution_receipt_amount',
                'per_page': '10',
                'two_year_transaction_period': '2024'
            })
            if not data:
                continue
            
            results = data.get('results', [])
            if not results:
                print(f"  ○ {employer}: No contributions found")
                continue

            for c in results[:10]:
                cur.execute("""
                    INSERT INTO fec_contributions (id, contributor_name, contributor_employer, contribution_amount, contribution_date, recipient_committee, recipient_committee_id, recipient_name, memo_text, linked_donor, linked_entity_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (uid(),
                      c.get('contributor_name', ''),
                      c.get('contributor_employer', ''),
                      c.get('contribution_receipt_amount', 0),
                      c.get('contribution_receipt_date', ''),
                      c.get('committee', {}).get('name', ''),
                      c.get('committee_id', ''),
                      c.get('recipient_name', c.get('committee', {}).get('name', '')),
                      c.get('memo_text', ''),
                      employer, entity_id))
                contrib_count += 1

            top = results[0]
            print(f"  ✓ {employer}: {len(results)} contributions | Top: {top.get('contributor_name','?')} → ${top.get('contribution_receipt_amount',0):,.0f} to {top.get('committee',{}).get('name','?')}")
            time.sleep(0.5)

        conn.commit()

        # ── Summary ────────────────────────────────────────────────────
        total_pacs = cur.execute("SELECT COUNT(*) FROM fec_committees").fetchone()[0]
        total_contribs = cur.execute("SELECT COUNT(*) FROM fec_contributions").fetchone()[0]
        total_amount = cur.execute("SELECT SUM(contribution_amount) FROM fec_contributions").fetchone()[0] or 0

        print(f"\n{'=' * 60}")
        print(f"✅ FEC Collection Complete!")
        print(f"   PACs/Committees tracked: {total_pacs}")
        print(f"   Individual contributions: {total_contribs}")
        print(f"   Total contribution amount: ${total_amount:,.0f}")
        print(f"{'=' * 60}")

if __name__ == "__main__":
    run()
