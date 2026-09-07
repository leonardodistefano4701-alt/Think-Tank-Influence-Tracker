"""
Bulk Congress Bill Importer — Downloads filtered legislation from GovInfo bulk XML.
Only imports bills matching think-tank-relevant policy areas.
Also creates SQLite indexes and FTS5 full-text search tables.
"""
import sys, os, uuid, json, sqlite3, urllib.request, zipfile, io, time
import xml.etree.ElementTree as ET

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'data-pipeline', 'src'))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db import get_db
from bill_status import derive_status, latest_action, most_recent_actions
from slim_fts import SPECS as FTS_SPECS, build_statements as build_fts_statements

BULK_BASE = 'https://www.govinfo.gov/bulkdata/BILLSTATUS'
# GovInfo bulkdata does not require a key. GOVINFO_API_KEY is only used for the
# api.govinfo.gov endpoints, and must come from the environment - never a default.
API_KEY = os.environ.get('GOVINFO_API_KEY', '')

def uid():
    return str(uuid.uuid4())

# Policy area keywords that match think tank influence domains
RELEVANT_POLICY_AREAS = {
    'Armed Forces and National Security',
    'International Affairs',
    'Energy',
    'Science, Technology, Communications',
    'Environmental Protection',
    'Economics and Public Finance',
    'Foreign Trade and International Finance',
    'Government Operations and Politics',
    'Taxation',
    'Social Welfare',
    'Social Sciences and History',
    'Finance and Financial Sector',
    'Commerce',
    'Immigration',
    'Crime and Law Enforcement',
    'Civil Rights and Liberties, Minority Issues',
}

# Additional keyword filters for titles
TITLE_KEYWORDS = [
    'defense', 'military', 'nato', 'arms', 'weapons', 'security',
    'energy', 'oil', 'gas', 'climate', 'carbon', 'renewable', 'fossil',
    'artificial intelligence', ' ai ', 'technology', 'cyber', 'data privacy',
    'social security', 'medicare', 'medicaid', 'pension',
    'foreign', 'sanctions', 'trade', 'tariff', 'china', 'russia',
    'lobby', 'transparency', 'ethics', 'campaign finance', 'dark money',
    'tax', 'budget', 'appropriation', 'spending',
    'nonprofit', 'foundation', 'think tank',
    'deregulation', 'regulation', 'epa', 'fcc',
    'immigration', 'border',
]

def parse_bill_xml(xml_text):
    """Parse a BILLSTATUS XML file and extract relevant fields."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    bill = root.find('.//bill')
    if bill is None:
        return None

    bill_type = (bill.findtext('type') or '').upper()
    bill_number = bill.findtext('number') or ''
    congress = bill.findtext('congress') or ''
    title = bill.findtext('title') or ''

    if not bill_number or not congress or not title:
        return None

    # Check policy area relevance
    policy_area = bill.findtext('.//policyArea/name') or ''
    is_relevant_policy = policy_area in RELEVANT_POLICY_AREAS

    # Check title keyword relevance
    title_lower = title.lower()
    is_relevant_title = any(kw in title_lower for kw in TITLE_KEYWORDS)

    if not is_relevant_policy and not is_relevant_title:
        return None

    # Extract status from latest action
    actions = []
    for action in bill.findall('.//actions/item'):
        date = action.findtext('actionDate') or ''
        text = action.findtext('text') or ''
        action_type = action.findtext('type') or ''
        action_code = action.findtext('actionCode') or ''
        if text:
            actions.append({
                'date': date,
                'text': text,
                'type': action_type,
                'action_code': action_code,
            })

    # Status is derived by scripts/bill_status.py, which ranks every action
    # rather than taking the first match while walking the list. BILLSTATUS is
    # ordered newest-first, so the latest action is never actions[-1].
    status = derive_status(actions)
    _latest = latest_action(actions)
    latest_action_text = _latest['text'] if _latest else ''

    # Extract sponsors
    sponsors = []
    for sponsor in bill.findall('.//sponsors/item'):
        name = sponsor.findtext('fullName') or sponsor.findtext('firstName', '') + ' ' + sponsor.findtext('lastName', '')
        party = sponsor.findtext('party') or ''
        state = sponsor.findtext('state') or ''
        sponsors.append(f'{name} ({party}-{state})')

    cosponsors_count = len(bill.findall('.//cosponsors/item'))

    # Extract committees
    committees = []
    for committee in bill.findall('.//committees/item'):
        name = committee.findtext('name') or ''
        if name and name not in committees:
            committees.append(name)

    # Extract summary
    summaries = bill.findall('.//summaries/summary')
    summary_text = ''
    for s in summaries:
        text = s.findtext('text') or ''
        if text and len(text) > len(summary_text):
            # Strip HTML tags from summary
            import re
            summary_text = re.sub('<[^<]+?>', '', text).strip()[:500]

    bill_id = f'{congress}-{bill_type}-{bill_number}'
    introduced = bill.findtext('.//introducedDate') or ''

    return {
        'bill_id': bill_id,
        'title': title[:300],
        'status': status,
        'summary': summary_text,
        'introduced_date': introduced,
        'policy_area': policy_area,
        'sponsors': ', '.join(sponsors),
        'cosponsors_count': cosponsors_count,
        'committees': ', '.join(committees),
        'latest_action': latest_action_text,
        'actions': json.dumps(most_recent_actions(actions, 5)),
    }


def download_and_parse_congress(congress_num):
    """Download bill status XMLs for a Congress and parse relevant bills."""
    bills = []
    bill_types = ['hr', 's', 'hjres', 'sjres']

    for bt in bill_types:
        url = f'{BULK_BASE}/{congress_num}/{bt}/BILLSTATUS-{congress_num}-{bt}.zip'
        print(f"  Downloading {congress_num}/{bt}...", end=' ', flush=True)

        try:
            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'TTIT/1.0')
            with urllib.request.urlopen(req, timeout=60) as resp:
                zip_data = io.BytesIO(resp.read())
                with zipfile.ZipFile(zip_data) as zf:
                    xml_files = [f for f in zf.namelist() if f.endswith('.xml')]
                    count = 0
                    for xml_file in xml_files:
                        xml_text = zf.read(xml_file).decode('utf-8')
                        parsed = parse_bill_xml(xml_text)
                        if parsed:
                            bills.append(parsed)
                            count += 1
                    print(f"✓ {count}/{len(xml_files)} relevant bills")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"skipped (not available)")
            else:
                print(f"✗ HTTP {e.code}")
        except Exception as e:
            print(f"✗ {e}")

    return bills


def create_indexes(conn):
    """Create performance indexes on key tables."""
    cur = conn.cursor()
    print("\n🔧 Creating indexes...")

    indexes = [
        ("idx_legislation_bill_id", "legislation", "bill_id"),
        ("idx_legislation_status", "legislation", "status"),
        ("idx_donors_entity_id", "donors", "entity_id"),
        ("idx_donors_name", "donors", "donor_name"),
        ("idx_donors_amount", "donors", "amount"),
        ("idx_influence_links_source", "influence_links", "source_type, source_id"),
        ("idx_influence_links_target", "influence_links", "target_type, target_id"),
        ("idx_influence_links_strength", "influence_links", "strength"),
        ("idx_policy_papers_entity", "policy_papers", "entity_id"),
        ("idx_lobbying_client", "lobbying", "client_entity_id"),
        ("idx_entities_slug", "entities", "slug"),
        ("idx_entities_type", "entities", "type"),
    ]

    for idx_name, table, columns in indexes:
        try:
            cur.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({columns})")
            print(f"  ✓ {idx_name}")
        except Exception as e:
            print(f"  ⚠ {idx_name}: {e}")

    conn.commit()


def create_fts5(conn):
    """(Re)build the FTS5 search indexes as external-content tables.

    The schema lives in scripts/slim_fts.py so there is exactly one definition of
    it. Duplicating it here is how the two would drift apart, and a re-import
    silently reverting the external-content conversion is precisely the failure
    this avoids.
    """
    print("\n🔍 Creating FTS5 full-text search indexes (external content)...")

    # A trigger that writes to a virtual table requires a trusted schema.
    conn.execute("PRAGMA trusted_schema=ON")
    for statement in build_fts_statements():
        conn.execute(statement)
    conn.commit()

    for fts, src, _is_view, _base, _cols in FTS_SPECS:
        try:
            count = conn.execute(f"SELECT COUNT(*) FROM {fts}").fetchone()[0]
            conn.execute(f"INSERT INTO {fts}({fts}) VALUES('integrity-check')")
            print(f"  ✓ {fts}: {count} rows indexed from {src}")
        except Exception as e:
            print(f"  ⚠ {fts}: {e}")

    conn.commit()


def run():
    print("=" * 60)
    print("BULK CONGRESS IMPORTER")
    print("Filtered by think-tank-relevant policy areas")
    print("=" * 60)

    # Download and parse bills from 117th and 118th Congress
    all_bills = []
    for congress in [117, 118]:
        print(f"\n📥 Congress {congress}:")
        bills = download_and_parse_congress(congress)
        all_bills.extend(bills)
        print(f"  → {len(bills)} relevant bills found")

    print(f"\n📊 Total relevant bills parsed: {len(all_bills)}")

    # Insert into database
    with get_db() as conn:
        cur = conn.cursor()

        # Add new columns if they don't exist
        for col, dtype in [('policy_area', 'TEXT'), ('latest_action', 'TEXT')]:
            try:
                cur.execute(f"ALTER TABLE legislation ADD COLUMN {col} {dtype}")
            except:
                pass

        inserted = 0
        updated = 0
        for bill in all_bills:
            existing = cur.execute("SELECT id FROM legislation WHERE bill_id = ?",
                                  (bill['bill_id'],)).fetchone()
            meta = json.dumps({
                'sponsors': bill['sponsors'],
                'cosponsors_count': bill['cosponsors_count'],
                'committees': bill['committees'],
                'recent_actions': bill['actions'],
                'policy_area': bill['policy_area'],
            })

            if existing:
                cur.execute("""
                    UPDATE legislation SET status = ?, summary = ?, metadata = ?,
                    policy_area = ?, latest_action = ?
                    WHERE bill_id = ?
                """, (bill['status'], bill['summary'], meta,
                      bill['policy_area'], bill['latest_action'], bill['bill_id']))
                updated += 1
            else:
                cur.execute("""
                    INSERT INTO legislation (id, bill_id, title, status, summary, introduced_date, metadata, policy_area, latest_action)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (uid(), bill['bill_id'], bill['title'], bill['status'],
                      bill['summary'], bill['introduced_date'], meta,
                      bill['policy_area'], bill['latest_action']))
                inserted += 1

        conn.commit()
        print(f"\n✅ Database updated: {inserted} new + {updated} updated")

        # Create indexes
        create_indexes(conn)

        # Create FTS5
        create_fts5(conn)

        # Final stats
        total = cur.execute("SELECT COUNT(*) FROM legislation").fetchone()[0]
        by_status = cur.execute("""
            SELECT status, COUNT(*) as c FROM legislation
            GROUP BY status ORDER BY c DESC
        """).fetchall()
        by_area = cur.execute("""
            SELECT policy_area, COUNT(*) as c FROM legislation
            WHERE policy_area IS NOT NULL AND policy_area != ''
            GROUP BY policy_area ORDER BY c DESC LIMIT 10
        """).fetchall()

        print(f"\n{'=' * 60}")
        print(f"📋 FINAL STATS")
        print(f"   Total legislation: {total}")
        print(f"\n   By status:")
        for row in by_status:
            r = dict(row)
            print(f"     {r['status']}: {r['c']}")
        print(f"\n   Top policy areas:")
        for row in by_area:
            r = dict(row)
            print(f"     {r['policy_area']}: {r['c']}")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    run()
