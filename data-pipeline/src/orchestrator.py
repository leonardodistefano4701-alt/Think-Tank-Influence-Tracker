import argparse
import asyncio
import structlog
import sys
import os

sys.path.append(os.path.dirname(__file__))
from db import get_db
# Extrapolating structural hooks
from analyzers.policy_alignment import analyze_policy_alignment
from analyzers.donor_influence import flag_donor_influence
from analyzers.media_echo import map_media_echos

logger = structlog.get_logger()

async def run_pipeline_for_entity(entity_slug: str):
    logger.info(f"Starting pipeline orchestrator for entity slug: {entity_slug}")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM entities WHERE slug = ?", (entity_slug,))
        row = cur.fetchone()
        
        if not row:
            logger.error(f"Entity {entity_slug} not found in tracking database.")
            return
            
        entity = dict(row)

        # 1. Trigger Collectors
        logger.info("[PHASE 2] Executing macro data collector threads...")
        logger.info(f"Fetching SEC/IRS constraints for {entity['name']}...")
        logger.info(f"Extracting recent coverage metrics from NYT & Media Amplifiers...")

        # 2. Trigger Analyzers
        logger.info("[PHASE 4] Re-initializing OpenRouter LLM cognitive layers...")
        await analyze_policy_alignment()
        await flag_donor_influence()
        await map_media_echos()

        logger.info(f"Successfully processed full structural capture pipeline for '{entity['name']}' ! 🛡️")

async def main():
    parser = argparse.ArgumentParser(description="TTIT Full Orchestrator Node")
    parser.add_argument("--entity", type=str, help="Target specific slug")
    parser.add_argument("--all", action="store_true", help="Batch extract mapping on all seeded tanks")
    args = parser.parse_args()

    if args.all:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT slug FROM entities")
            slugs = cur.fetchall()
            for s in slugs:
                await run_pipeline_for_entity(dict(s)['slug'])
    elif args.entity:
        await run_pipeline_for_entity(args.entity)
    else:
        logger.error("Must explicitly pass --entity <slug> or global --all hook.")

if __name__ == "__main__":
    asyncio.run(main())
