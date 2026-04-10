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
from config import NYT_API_KEY

logger = structlog.get_logger()
# NYT enforces 10 requests per minute
limiter = RateLimiter(calls=1, period=6.0)

@with_retry(retries=3, backoffs=(1, 2, 4))
async def search_articles(client: httpx.AsyncClient, query: str) -> Optional[Dict[str, Any]]:
    await limiter.wait()
    url = f"https://api.nytimes.com/svc/search/v2/articlesearch.json"
    params = {
        "api-key": NYT_API_KEY,
        "q": query,
    }
    logger.info(f"Fetching NYT articles for {query}")
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()

async def run_nyt_collector():
    client = get_async_client()
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, name FROM entities WHERE type = 'think_tank'")
            entities = cur.fetchall()
            
            for entity in entities:
                entity_id, name = dict(entity)['id'], dict(entity)['name']
                data = await search_articles(client, name)
                docs = data.get('response', {}).get('docs', []) if data else []
                
                for doc in docs:
                    new_id = str(uuid.uuid4())
                    headline = doc.get('headline', {}).get('main')
                    url = doc.get('web_url')
                    pub_date = doc.get('pub_date')
                    summary = doc.get('snippet')
                    
                    cur.execute('''
                        INSERT OR IGNORE INTO media_coverage (id, entity_id, headline, source, url, published_date, summary)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (new_id, entity_id, headline, 'nytimes', url, pub_date, summary))
            conn.commit()
    except httpx.HTTPError as e:
        logger.error(f"NYT API Exception: {e}")
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run_nyt_collector())
