import os
import sqlite3
import json
import uuid
import time
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ.get("PERPLEXITY_API_KEY", "").strip('"').strip("'")
if not API_KEY:
    raise ValueError("PERPLEXITY_API_KEY is not set.")

db_path = os.path.join(os.path.dirname(__file__), "..", "ttit.db")

MODEL_NAME = "sonar-pro"
API_URL = "https://api.perplexity.ai/chat/completions"

def query_openrouter(prompt_text):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "TTIT Analysis Node",
        "Content-Type": "application/json"
    }

    data = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": """You are an elite geopolitical intelligence analyst. Your goal is to review raw financial and legislative data and output a concise, highly analytical synthesis evaluating influence strategy. 
You must return only perfect JSON matching this schema:
{
    "verdict": "A 1-2 sentence high-level takeaway of their strategic objective or battleground state.",
    "reasoning": "A brief paragraph explaining how their funding, papers, and targeting align.",
    "evidence_summary": "A 3-4 bullet point summary (encoded as a single string with newline bullets) highlighting the most critical pieces of data.",
    "confidence": 0.95 (float between 0 and 1 estimating confidence in this synthesis based on data volume)
}"""
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ]
    }
    
    for attempt in range(3):
        try:
            req = urllib.request.Request(API_URL, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_json = json.loads(resp.read().decode('utf-8'))
                content = res_json['choices'][0]['message']['content']
                # Robust extraction: find the first { and the last }
                start_idx = content.find('{')
                end_idx = content.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx+1]
                else:
                    print("Could not locate JSON delimiters.")

                parsed = json.loads(content.strip())
                return parsed
        except urllib.error.URLError as e:
            msg = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
            print(f"Error on attempt {attempt+1}: {e} -> {msg}")
            time.sleep(2)
        except Exception as e:
            print(f"Parse error on attempt {attempt+1}: {e}")
            time.sleep(2)
            
    return None

def write_verdict(conn, target_type, target_id, parsed_json):
    if not parsed_json: return
    
    cur = conn.cursor()
    # Remove existing
    cur.execute("DELETE FROM analysis_verdicts WHERE target_id = ?", (target_id,))
    
    vid = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO analysis_verdicts (id, target_type, target_id, verdict, confidence, reasoning, evidence_summary, model_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vid, target_type, target_id, 
        parsed_json.get("verdict", ""), 
        parsed_json.get("confidence", 0.5),
        parsed_json.get("reasoning", ""),
        parsed_json.get("evidence_summary", ""),
        MODEL_NAME
    ))
    conn.commit()

def process_entities():
    print("Processing Think Tanks...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    entities = cur.execute("SELECT id, name, slug, lean FROM entities").fetchall()
    for ent in entities:
        t_id, name, slug, lean = ent
        print(f"  -> {name}")
        
        # Get stats
        papers = cur.execute("SELECT title, published_date, topic_tags FROM policy_papers WHERE entity_id = ? LIMIT 10", (t_id,)).fetchall()
        donors = cur.execute("SELECT donor_name, amount, industry FROM donors WHERE entity_id = ? ORDER BY amount DESC LIMIT 10", (t_id,)).fetchall()
        
        links = cur.execute("""
            SELECT l.title, l.bill_id, il.link_type 
            FROM influence_links il 
            JOIN legislation l ON il.target_id = l.id 
            WHERE il.source_id IN (SELECT id FROM policy_papers WHERE entity_id = ?)
            LIMIT 15
        """, (t_id,)).fetchall()
        
        prompt = f"Analyze the Think Tank '{name}' (Political Lean: {lean}).\n"
        prompt += "Top Donors:\n" + "\n".join([f"- {d[0]} (${d[1]}) Industry: {d[2]}" for d in donors]) + "\n\n"
        prompt += "Recent Policy Papers:\n" + "\n".join([f"- {p[0]} ({p[1]}) Tags: {p[2]}" for p in papers]) + "\n\n"
        prompt += "Legislative Influence Targets:\n" + "\n".join([f"- {l[2].upper()} on {l[1]}: {l[0]}" for l in links]) + "\n\n"
        prompt += "Synthesize their primary geopolitical focus and the success/direction of their influence."
        
        res = query_openrouter(prompt)
        write_verdict(conn, 'entity', t_id, res)
        
def process_donors():
    print("\nProcessing Donors...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # We want unique donors but we map to the first id that represents them.
    # We'll group by donor_name.
    unique_donors = cur.execute("""
        SELECT MIN(id) as target_id, donor_name
        FROM donors
        GROUP BY donor_name
        HAVING SUM(amount) > 100000 -- Only process significant donors to save time
    """).fetchall()
    
    for d in unique_donors:
        target_id, d_name = d
        print(f"  -> {d_name}")
        
        donations = cur.execute("""
            SELECT d.amount, d.year, e.name, e.lean 
            FROM donors d JOIN entities e ON d.entity_id = e.id 
            WHERE d.donor_name = ?
        """, (d_name,)).fetchall()
        
        prompt = f"Analyze the Funding Source / Donor '{d_name}'.\n"
        prompt += "Donations to Think Tanks:\n" + "\n".join([f"- ${dx[0]} in {dx[1]} to {dx[2]} (Lean: {dx[3]})" for dx in donations]) + "\n\n"
        prompt += "Synthesize what this donor is attempting to influence based on the think tanks they fund."
        
        res = query_openrouter(prompt)
        write_verdict(conn, 'donor', target_id, res)

def process_legislation():
    print("\nProcessing Legislation...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Only process legislation that actually has an influence link mapped
    active_bills = cur.execute("""
        SELECT DISTINCT l.id, l.title, l.bill_id, l.status, l.summary
        FROM legislation l
        JOIN influence_links il ON l.id = il.target_id AND il.target_type = 'legislation'
    """).fetchall()
    
    for b in active_bills:
        l_id, title, bill_id, status, summary = b
        print(f"  -> {bill_id}: {title}")
        
        links = cur.execute("""
            SELECT e.name, pp.title, il.link_type, il.strength
            FROM influence_links il
            JOIN policy_papers pp ON il.source_id = pp.id
            JOIN entities e ON pp.entity_id = e.id
            WHERE il.target_id = ?
        """, (l_id,)).fetchall()
        
        prompt = f"Analyze the Legislative Bill '{bill_id}: {title}' (Status: {status}).\n"
        prompt += f"Summary: {str(summary)[:500]}...\n\n"
        prompt += "Think Tank Influence Campaigns Targeting this Bill:\n"
        for idx, l in enumerate(links):
            prompt += f"- {l[0]} authored '{l[1]}' which {l[2].upper()} the bill (Confidence: {l[3]})\n"
            
        prompt += "\nSynthesize the battleground around this bill and which factions are pushing/opposing it."
        
        res = query_openrouter(prompt)
        write_verdict(conn, 'legislation', l_id, res)

if __name__ == "__main__":
    process_entities()
    process_donors()
    process_legislation()
    print("\nAll syntheis processes complete!")
