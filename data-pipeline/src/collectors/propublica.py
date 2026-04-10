import httpx
import asyncio
import json
import uuid
from typing import Optional, Dict, Any, List
import structlog
import sys
import os

# Append the src directory to path for local execution to find other modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from db import get_db
from utils import RateLimiter, with_retry, get_async_client
from models import FinancialModel

logger = structlog.get_logger()
# ProPublica doesn't strictly rate limit, but limiting to 5/sec is respectful
limiter = RateLimiter(calls=5, period=1.0) 

@with_retry(retries=3, backoffs=(1, 2, 4))
async def fetch_propublica_990(client: httpx.AsyncClient, ein: str) -> Optional[Dict[str, Any]]:
    await limiter.wait()
    clean_ein = ein.replace('-', '')
    url = f"https://projects.propublica.org/nonprofits/api/v2/organizations/{clean_ein}.json"
    logger.info(f"Fetching 990 data for EIN {ein}")
    response = await client.get(url)
    if response.status_code == 404:
        logger.warning(f"No ProPublica data found for {ein}")
        return None
    response.raise_for_status()
    return response.json()

def process_990_data(entity_id: str, data: Optional[Dict[str, Any]]) -> List[FinancialModel]:
    financials = []
    if not data or 'filings_with_data' not in data:
        return financials
        
    for filing in data['filings_with_data']:
        year = filing.get('tax_prd_yr')
        if not year:
            continue
            
        financials.append(FinancialModel(
            id=str(uuid.uuid4()),
            entity_id=entity_id,
            fiscal_year=int(year),
            total_revenue=filing.get('totrevenue'),
            total_expenses=filing.get('totfuncexpns'),
            net_assets=filing.get('totassetsend'),
            executive_compensation=None, # Often requires deeper filing parse
            program_revenue=filing.get('totprgmrevnue'),
            contributions_and_grants=filing.get('totcntrbgfts'),
            investment_income=filing.get('invstmntinc'),
            raw_990=filing
        ))
    return financials

async def run_propublica_collector():
    client = get_async_client()
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, ein, name FROM entities WHERE type = 'think_tank' AND ein IS NOT NULL")
            entities = cur.fetchall()
            
            for entity in entities:
                entity_id, ein, name = dict(entity)['id'], dict(entity)['ein'], dict(entity)['name']
                logger.info(f"Processing {name} ({ein})")
                
                try:
                    data = await fetch_propublica_990(client, ein)
                    records = process_990_data(entity_id, data)
                    
                    for rec in records:
                        cur.execute('''
                            INSERT OR IGNORE INTO financials 
                            (id, entity_id, fiscal_year, total_revenue, total_expenses, net_assets, 
                            program_revenue, contributions_and_grants, investment_income, raw_990)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            rec.id, rec.entity_id, rec.fiscal_year, rec.total_revenue, 
                            rec.total_expenses, rec.net_assets, rec.program_revenue, 
                            rec.contributions_and_grants, rec.investment_income, 
                            json.dumps(rec.raw_990) if rec.raw_990 else None
                        ))
                    conn.commit()
                    logger.info(f"Saved {len(records)} financial records for {name}")
                except httpx.HTTPError as e:
                    logger.error(f"Failed to fetch data for {ein}: {str(e)}")
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run_propublica_collector())
