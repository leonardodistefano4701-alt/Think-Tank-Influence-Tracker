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

async def map_media_echos():
    system_prompt = """
    You trace media narratives. Does the media snippet regurgitate specific structural talking points popularized by a Think Tank?
    Extract verbatim semantic overlap. Respond matching this JSON schema ONLY: {"verdict": string, "confidence": float, "reasoning": string, "evidence_summary": string}
    """
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT m.id, m.headline, m.summary, e.name FROM media_coverage m JOIN entities e ON m.entity_id = e.id LIMIT 20")
        docs = cur.fetchall()
        
        for doc in docs:
            user_prompt = f"Target Entity: {doc['name']}\nHeadline: {doc['headline']}\nBody Snippet: {doc['summary']}\nAre they acting as a megaphone for partisan/aligned narrative?"
            
            try:
                logger.info(f"Extracting echo vectors for {doc['name']} article.")
                result_raw = await query_llm(system_prompt, user_prompt)
                res = json.loads(result_raw)
                
                if res.get('confidence', 0.0) >= 0.70:
                    cur.execute('''
                        UPDATE media_coverage SET sentiment = ?, summary = ? WHERE id = ?
                    ''', (res.get('confidence'), f"ANALYZED ECHO ({res.get('verdict')}): {res.get('evidence_summary')}", doc['id']))
                    conn.commit()
            except Exception as e:
                logger.error(f"Failed echo analysis: {e}")

if __name__ == "__main__":
    asyncio.run(map_media_echos())
