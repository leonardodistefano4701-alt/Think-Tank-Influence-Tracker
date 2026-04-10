import httpx
import asyncio
import json
import uuid
from typing import Optional, Dict, Any, List
import structlog
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from db import get_db
from utils import RateLimiter, with_retry, get_async_client
from config import CONGRESS_API_KEY

logger = structlog.get_logger()
# Congress allows 5000/hour natively.
limiter = RateLimiter(calls=1, period=1.0)

@with_retry(retries=3, backoffs=(1, 2, 4))
async def search_bills(client: httpx.AsyncClient, topic: str) -> Optional[Dict[str, Any]]:
    await limiter.wait()
    url = f"https://api.congress.gov/v3/bill"
    params = {
        "api_key": CONGRESS_API_KEY,
        "query": topic,
        "limit": 10
    }
    logger.info(f"Fetching bills for topic {topic}")
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()

async def run_congress_collector():
    client = get_async_client()
    try:
        # Example hardcoded topics based on tracked entities
        topics = ["tax reform", "healthcare", "defense"]
        with get_db() as conn:
            cur = conn.cursor()
            for topic in topics:
                data = await search_bills(client, topic)
                if not data or 'bills' not in data:
                    continue
                    
                for bill in data.get('bills', []):
                    new_id = str(uuid.uuid4())
                    bill_id = f"{bill.get('congress')}-{bill.get('type')}-{bill.get('number')}"
                    title = bill.get('title')
                    cur.execute('''
                        INSERT OR IGNORE INTO legislation (id, bill_id, title, congress, summary)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (new_id, bill_id, title, bill.get('congress'), "Placeholder summary"))
            
            conn.commit()
    except httpx.HTTPError as e:
        logger.error(f"Congress API Exception: {e}")
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run_congress_collector())
