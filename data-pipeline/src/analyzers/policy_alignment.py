import asyncio
import uuid
import json
import structlog
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from db import get_db
from analyzers.llm_client import query_llm

logger = structlog.get_logger()

async def analyze_policy_alignment():
    system_prompt = """
    You are an expert policy tracker. Analyze the semantic alignment between Think Tank ideologies/agendas and incoming Congressional legislation.
    You MUST respond exclusively in valid JSON with these exact keys: "verdict" (string), "confidence" (float 0.0-1.0), "reasoning" (string), "evidence_summary" (string).
    """
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM entities WHERE type = 'think_tank'")
        tanks = cur.fetchall()
        
        cur.execute("SELECT id, title, summary FROM legislation LIMIT 10")
        bills = cur.fetchall()
        
        for tank in tanks:
            for bill in bills:
                user_prompt = f"Think Tank Entity: {tank['name']}\nLegislation Title: {bill['title']}\nBill Summary: {bill['summary']}\nDoes this legislation represent ideological capture by this organization?"
                
                try:
                    logger.info(f"Executing policy alignment: {tank['name']} against {bill['id']}")
                    result_raw = await query_llm(system_prompt, user_prompt)
                    try:
                        res = json.loads(result_raw)
                    except json.JSONDecodeError:
                        res = {"verdict": "Unknown", "confidence": 0.0, "reasoning": result_raw, "evidence_summary": ""}
                    
                    if res.get('confidence', 0.0) > 0.75:
                        cur.execute('''
                            INSERT OR REPLACE INTO influence_links (id, source_type, source_id, target_type, target_id, link_type, strength, evidence)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (str(uuid.uuid4()), 'entities', tank['id'], 'legislation', bill['id'], 'ideological_alignment', res.get('confidence'), res.get('evidence_summary')))
                        
                        cur.execute('''
                            INSERT OR REPLACE INTO analysis_verdicts (id, entity_id, verdict, confidence, reasoning, evidence_summary)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', (str(uuid.uuid4()), tank['id'], res.get('verdict'), res.get('confidence'), res.get('reasoning'), res.get('evidence_summary')))
                        
                        conn.commit()
                        logger.info("Saved ideological alignment influence link!")
                except Exception as e:
                    logger.error(f"Failed policy analysis: {e}")

if __name__ == "__main__":
    asyncio.run(analyze_policy_alignment())
