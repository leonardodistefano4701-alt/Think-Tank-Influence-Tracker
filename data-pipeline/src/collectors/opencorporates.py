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

logger = structlog.get_logger()
limiter = RateLimiter(calls=1, period=2.0)

@with_retry(retries=3, backoffs=(1, 2, 4))
async def resolve_company(client: httpx.AsyncClient, company_name: str) -> Optional[Dict[str, Any]]:
    await limiter.wait()
    url = f"https://api.opencorporates.com/v0.4/companies/search"
    params = {
        "q": company_name
    }
    logger.info(f"Resolving corporate entity: {company_name}")
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()

async def run_opencorporates_collector():
    client = get_async_client()
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, donor_name FROM donors WHERE metadata = '{}' LIMIT 10")
            donors = cur.fetchall()
            
            for donor in donors:
                donor_id, name = dict(donor)['id'], dict(donor)['donor_name']
                data = await resolve_company(client, name)
                results = data.get('results', {}).get('companies', []) if data else []
                if results:
                    best_match = results[0].get('company', {})
                    meta = json.dumps({
                        "opencorporates_id": best_match.get('company_number'), 
                        "jurisdiction": best_match.get('jurisdiction_code')
                    })
                    cur.execute("UPDATE donors SET metadata = ? WHERE id = ?", (meta, donor_id))
            conn.commit()
    except httpx.HTTPError as e:
         logger.error(f"OpenCorporates Exception: {e}")
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run_opencorporates_collector())
