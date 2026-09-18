import re
from difflib import SequenceMatcher
"""
Perplexity AI Data Collector — Uses the Sonar Pro model to discover policy papers 
and link them to legislation for each think tank.
"""
import sys, os, uuid, json, sqlite3, urllib.request, time

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'data-pipeline', 'src'))
from db import get_db

PPLX_API_KEY = os.environ.get('PERPLEXITY_API_KEY')

def uid():
    return str(uuid.uuid4())

def get_perplexity_influence(tank_name):
    print(f"\n🧠 Querying Perplexity Sonar Pro for {tank_name}...")
    url = 'https://api.perplexity.ai/chat/completions'
    headers = {
        'Authorization': f'Bearer {PPLX_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    prompt = f'''For the think tank "{tank_name}", identify specific policy papers, reports, or memos that directly influenced or were closely related to legislation in the 117th-118th US Congress (2021-2024).

Return ONLY a valid JSON array where each item has:
- "paper_title": exact title of the policy paper/report
- "paper_date": approximate publication date (YYYY-MM)
- "paper_topic": policy area (e.g. defense, energy, immigration)
- "paper_url": URL if known, else null
- "related_bills": array of objects with:
  - "bill_id": e.g. "HR 2670" or "S 686"
  - "bill_title": name of the bill
  - "relationship": "advocates_for" | "opposes" | "informs"
  - "evidence": 1-2 sentence explanation of how the paper relates to the bill

Include at least 8 to 12 major papers with clear legislative connections. Do not use markdown blocks, return pure JSON.'''

    body = json.dumps({
        'model': 'sonar-pro',
        'messages': [
            {'role': 'system', 'content': 'You are a legislative analyst specializing in think tank influence on US federal legislation. Return ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.1,
    }).encode()

    try:
        req = urllib.request.Request(url, body, headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            content = data['choices'][0]['message']['content']
            
            # Try to extract the JSON array safely
            try:
                start_idx = content.find('[')
                end_idx = content.rfind(']') + 1
                if start_idx >= 0 and end_idx > start_idx:
                    content = content[start_idx:end_idx]
            except:
                pass
                
            return {
                'results': json.loads(content.strip()),
                'citations': data.get('citations', [])
            }
    except Exception as e:
        print(f"  ✗ Error querying Perplexity for {tank_name}: {e}")
        return None

TYPES = {
    "HR": "HR", "S": "S", "HRES": "HRES", "SRES": "SRES",
    "HJRES": "HJRES", "SJRES": "SJRES", "HCONRES": "HCONRES", "SCONRES": "SCONRES"
}

def parse_bill(raw: str):
    s = re.sub(r"[\s.]", "", raw.upper())
    m = re.fullmatch(r"(HCONRES|SCONRES|HJRES|SJRES|HRES|SRES|HR|S)(\d+)", s)
    return (TYPES[m.group(1)], int(m.group(2))) if m else None

def find_bill(cur, raw_id, claimed_title, congresses=(117, 118)):
    key = parse_bill(raw_id)
    if not key:
        return None  # no FTS guessing, ever
    btype, num = key
    for c in congresses:
        row = cur.execute(
            "SELECT id, bill_id, title FROM legislation WHERE bill_id = ?",
            (f"{c}-{btype}-{num}",)
        ).fetchone()
        if row and SequenceMatcher(None, claimed_title.lower(), row[2].lower()).ratio() >= 0.6:
            return row
    return None  # log as unmatched; do not link

def find_bill_in_db(cur, raw_bill_id, bill_title):
    return find_bill(cur, raw_bill_id, bill_title)

def run():
    print("=" * 60)
    print("PERPLEXITY POLICY INFLUENCE COLLECTOR")
    print("=" * 60)

    if not PPLX_API_KEY:
        print("Error: PERPLEXITY_API_KEY environment variable not set.")
        sys.exit(1)

    with get_db() as conn:
        cur = conn.cursor()
        tanks = cur.execute("SELECT id, name FROM entities WHERE type='think_tank'").fetchall()
        
        total_papers = 0
        total_links = 0
        
        for tank_row in tanks:
            tank = dict(tank_row)
            response = get_perplexity_influence(tank['name'])
            if not response:
                continue
                
            papers = response['results']
            citations = response['citations']
            print(f"  ✓ Discovered {len(papers)} papers")
            
            for p in papers:
                # Insert paper
                paper_id = uid()
                meta = {'source': 'perplexity_sonar_pro', 'citations': citations}
                
                # Check if paper already exists
                existing_paper = cur.execute("SELECT id FROM policy_papers WHERE entity_id = ? AND title = ?", 
                                          (tank['id'], p.get('paper_title', ''))).fetchone()
                
                if existing_paper:
                    paper_id = existing_paper[0]
                else:
                    cur.execute('''
                        INSERT INTO policy_papers (id, entity_id, title, url, published_date, topic_tags, summary, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (paper_id, tank['id'], p.get('paper_title', ''), p.get('paper_url'), 
                          p.get('paper_date'), p.get('paper_topic'), '', json.dumps(meta)))
                    total_papers += 1
                
                # Process related bills
                for b in p.get('related_bills', []):
                    rel = b.get('relationship', 'informs')
                    evidence = b.get('evidence', '')
                    raw_id = b.get('bill_id') or ''
                    b_title = b.get('bill_title') or ''
                    
                    if not raw_id:
                        print(f"    ⚠ Skipped entry missing bill_id: {b_title[:40]}...")
                        continue
                        
                    matched_bill = find_bill_in_db(cur, raw_id, b_title)
                    
                    if matched_bill:
                        leg_id = matched_bill[0]
                        leg_bill_id = matched_bill[1]
                        # Create influence link
                        link_meta = {'perplexity_raw_id': raw_id, 'perplexity_title': b_title}
                        
                        # Check if link exists
                        existing_link = cur.execute('''
                            SELECT id FROM influence_links 
                            WHERE source_type='policy_paper' AND source_id=? AND target_type='legislation' AND target_id=?
                        ''', (paper_id, leg_id)).fetchone()
                        
                        if not existing_link:
                            cur.execute('''
                                INSERT INTO influence_links (id, source_type, source_id, target_type, target_id, link_type, strength, evidence, metadata)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (uid(), 'policy_paper', paper_id, 'legislation', leg_id, rel, 0.8, evidence, json.dumps(link_meta)))
                            total_links += 1
                            print(f"    🔗 Linked to {leg_bill_id}: {b_title[:40]}...")
                    else:
                        print(f"    ⚠ Unmatched bill: {raw_id} - {b_title[:40]}...")
                        
            conn.commit()
            time.sleep(2) # Respect rate limits
            
        print(f"\n{'=' * 60}")
        print(f"✅ Perplexity Collection Complete!")
        print(f"   New papers added: {total_papers}")
        print(f"   New influence links: {total_links}")
        print(f"{'=' * 60}")

if __name__ == "__main__":
    run()
