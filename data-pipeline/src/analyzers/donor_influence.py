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

async def flag_donor_influence():
    system_prompt = """
    You are a forensic accountant focusing on dark money analysis. Identify suspicious anomaly correlations between donor funding spikes and resulting entity action.
    Respond exclusively in JSON with keys: "verdict", "confidence" (float), "reasoning", "evidence_summary".
    """
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM entities WHERE type = 'think_tank'")
        tanks = cur.fetchall()
        
        for tank in tanks:
            try:
                # Naive dummy query fetching random financials logic structurally
                cur.execute("SELECT total_revenue FROM financials WHERE entity_id = ? ORDER BY fiscal_year DESC LIMIT 2", (tank['id'],))
                fin = cur.fetchall()
                if len(fin) < 2: continue
                
                spike = "Yes" if fin[0]['total_revenue'] > (fin[1]['total_revenue'] * 1.5) else "No"
                user_prompt = f"Think Tank: {tank['name']}\nIdentified sudden revenue spike greater than 50% year-over-year: {spike}\nAssess the structural severity."
                
                logger.info(f"Checking donor influence integrity for {tank['name']}")
                result_raw = await query_llm(system_prompt, user_prompt)
                res = json.loads(result_raw)
                
                cur.execute('''
                    INSERT INTO analysis_verdicts (id, entity_id, verdict, confidence, reasoning, evidence_summary)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (str(uuid.uuid4()), tank['id'], res.get('verdict'), res.get('confidence'), res.get('reasoning'), res.get('evidence_summary')))
                conn.commit()
            except Exception as e:
                logger.error(f"Failed donor influence check: {e}")

if __name__ == "__main__":
    asyncio.run(flag_donor_influence())
