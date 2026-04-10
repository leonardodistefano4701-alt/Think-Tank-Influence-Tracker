"""
Congress/GovInfo Data Collector — Uses data.gov API key to pull real legislation data.
Queries the GovInfo BILLSTATUS collection to enrich existing legislation and discover new bills.
"""
import sys, os, uuid, sqlite3, json, urllib.request, time, xml.etree.ElementTree as ET

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'data-pipeline', 'src'))
from db import get_db

API_KEY = os.environ.get('FEC_API_KEY', 'kOL6CKT2XB7yJCZXTyoEkfUZ2TacsdRYcp4y8hKI')
GOVINFO_BASE = 'https://api.govinfo.gov'

def uid():
    return str(uuid.uuid4())

def govinfo_get(path, retries=3):
    """Make a GET request to the GovInfo API."""
    sep = '&' if '?' in path else '?'
    url = f'{GOVINFO_BASE}{path}{sep}api_key={API_KEY}'
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url)
            req.add_header('Accept', 'application/json')
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                print(f"  ⚠ API error: {e}")
                return None

def run():
    with get_db() as conn:
        cur = conn.cursor()

        print("=" * 60)
        print("CONGRESS DATA COLLECTOR — Live GovInfo Bill Data")
        print("=" * 60)

        # ── 1. Enrich existing legislation with GovInfo data ───────────
        print("\n📋 Phase 1: Enriching tracked legislation...")
        bills = cur.execute("SELECT * FROM legislation").fetchall()

        # Map our bill IDs to GovInfo package IDs
        # Our format: 118-HR-2670 → BILLSTATUS-118hr2670
        for bill_row in bills:
            bill = dict(bill_row)
            parts = bill['bill_id'].split('-')
            if len(parts) != 3:
                continue
            congress = parts[0]
            bill_type = parts[1].lower()
            bill_num = parts[2]
            pkg_id = f'BILLSTATUS-{congress}{bill_type}{bill_num}'

            data = govinfo_get(f'/packages/{pkg_id}/summary')
            if not data:
                print(f"  ✗ {bill['bill_id']} ({pkg_id}): not found")
                continue

            # Get the XML content for more detail
            xml_url = data.get('download', {}).get('xmlLink')
            sponsors = []
            cosponsors_count = 0
            committees = []
            actions = []

            if xml_url:
                try:
                    req = urllib.request.Request(f'{xml_url}?api_key={API_KEY}')
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        xml_text = resp.read().decode('utf-8')
                        root = ET.fromstring(xml_text)

                        # Extract sponsors
                        for sponsor in root.findall('.//sponsors/item'):
                            name = sponsor.findtext('fullName', '')
                            party = sponsor.findtext('party', '')
                            state = sponsor.findtext('state', '')
                            sponsors.append(f'{name} ({party}-{state})')

                        # Extract cosponsors count
                        cosponsors = root.findall('.//cosponsors/item')
                        cosponsors_count = len(cosponsors)

                        # Extract committees
                        for committee in root.findall('.//committees/item'):
                            name = committee.findtext('name', '')
                            if name:
                                committees.append(name)

                        # Extract recent actions
                        for action in root.findall('.//actions/item'):
                            date = action.findtext('actionDate', '')
                            text = action.findtext('text', '')
                            if text:
                                actions.append(f'{date}: {text}')

                except Exception as e:
                    print(f"  ⚠ XML parse error for {bill['bill_id']}: {e}")

            # Update the legislation record with enriched data
            enriched = {
                'sponsors': ', '.join(sponsors) if sponsors else None,
                'cosponsors_count': cosponsors_count,
                'committees': ', '.join(committees) if committees else None,
                'recent_actions': json.dumps(actions[-5:]) if actions else None,
                'govinfo_url': f'https://www.govinfo.gov/app/details/{pkg_id}',
                'congress_session': data.get('congress', ''),
            }

            # Store in metadata JSON
            existing_meta = bill.get('metadata', '{}')
            try:
                meta = json.loads(existing_meta) if existing_meta else {}
            except:
                meta = {}
            meta.update(enriched)

            cur.execute("UPDATE legislation SET metadata = ? WHERE id = ?",
                       (json.dumps(meta), bill['id']))

            print(f"  ✓ {bill['bill_id']} — {bill['title'][:50]}...")
            if sponsors:
                print(f"    Sponsors: {sponsors[0]}" + (f" + {cosponsors_count} cosponsors" if cosponsors_count else ""))
            if committees:
                print(f"    Committees: {', '.join(committees[:3])}")
            if actions:
                print(f"    Latest action: {actions[-1][:80]}")

            time.sleep(0.5)

        # ── 2. Discover new relevant legislation ───────────────────────
        print(f"\n🔬 Phase 2: Discovering new relevant legislation...")

        # Search for bills related to our think tank policy areas
        policy_keywords = [
            ('defense', 'Armed Forces and National Security'),
            ('energy', 'Energy'),
            ('technology', 'Science, Technology, Communications'),
            ('foreign affairs', 'International Affairs'),
            ('social security', 'Social Welfare'),
        ]

        # Get the most recent bill status updates from the 118th Congress
        data = govinfo_get('/collections/BILLSTATUS/2024-01-01T00:00:00Z?offset=0&pageSize=20')
        if data and data.get('packages'):
            new_count = 0
            for pkg in data.get('packages', []):
                pkg_id = pkg.get('packageId', '')
                if not pkg_id.startswith('BILLSTATUS-118') and not pkg_id.startswith('BILLSTATUS-119'):
                    continue

                # Get package summary
                summary = govinfo_get(f'/packages/{pkg_id}/summary')
                if not summary:
                    continue

                title = summary.get('title', '')
                if not title:
                    # Try to get from XML
                    xml_url = summary.get('download', {}).get('xmlLink')
                    if xml_url:
                        try:
                            req = urllib.request.Request(f'{xml_url}?api_key={API_KEY}')
                            with urllib.request.urlopen(req, timeout=15) as resp:
                                xml_text = resp.read().decode('utf-8')
                                root = ET.fromstring(xml_text)
                                title = root.findtext('.//title', '')
                        except:
                            pass

                # Parse bill ID from package ID (e.g. BILLSTATUS-118hr2670 → 118-HR-2670)
                raw = pkg_id.replace('BILLSTATUS-', '')
                congress_num = raw[:3]
                remaining = raw[3:]
                bill_type = ''
                bill_num = ''
                for bt in ['hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres', 'hr', 's']:
                    if remaining.startswith(bt):
                        bill_type = bt.upper()
                        bill_num = remaining[len(bt):]
                        break

                if not bill_type or not bill_num:
                    continue

                formatted_id = f'{congress_num}-{bill_type}-{bill_num}'

                # Check if we already have this bill
                existing = cur.execute("SELECT id FROM legislation WHERE bill_id = ?", (formatted_id,)).fetchone()
                if existing:
                    continue

                # Check if title matches any of our policy areas
                title_lower = (title or '').lower()
                is_relevant = any(kw in title_lower for kw in
                    ['defense', 'energy', 'climate', 'tax', 'security', 'technology', 'ai ', 'artificial intelligence',
                     'social security', 'foreign', 'lobby', 'transparency', 'think tank', 'nonprofit'])

                if not is_relevant and title:
                    continue

                if title:
                    # Determine status from actions
                    status = 'Introduced'
                    govinfo_url = f'https://www.govinfo.gov/app/details/{pkg_id}'

                    cur.execute("""
                        INSERT OR IGNORE INTO legislation (id, bill_id, title, status, summary, introduced_date, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (uid(), formatted_id, title[:200], status, '',
                          summary.get('dateIssued', ''), json.dumps({'govinfo_url': govinfo_url, 'source': 'govinfo_discovery'})))
                    new_count += 1
                    print(f"  ✓ NEW: {formatted_id} — {title[:70]}...")

                time.sleep(0.3)

            print(f"\n  Discovered {new_count} new relevant bills")

        conn.commit()

        # ── Summary ────────────────────────────────────────────────────
        total_bills = cur.execute("SELECT COUNT(*) FROM legislation").fetchone()[0]
        enriched_count = cur.execute("SELECT COUNT(*) FROM legislation WHERE metadata != '{}' AND metadata IS NOT NULL AND metadata != ''").fetchone()[0]

        print(f"\n{'=' * 60}")
        print(f"✅ Congress Collection Complete!")
        print(f"   Total legislation tracked: {total_bills}")
        print(f"   Enriched with GovInfo data: {enriched_count}")
        print(f"{'=' * 60}")

if __name__ == "__main__":
    run()
