import sys
import os
import uuid
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'data-pipeline', 'src'))
from db import get_db

SEED_ENTITIES = [
    {"name": "Heritage Foundation", "slug": "heritage-foundation", "type": "think_tank", "ein": "23-7327730", "lean": "Right"},
    {"name": "Brookings Institution", "slug": "brookings-institution", "type": "think_tank", "ein": "53-0196577", "lean": "Center"},
    {"name": "Center for American Progress", "slug": "center-for-american-progress", "type": "think_tank", "ein": "20-1541158", "lean": "Left"},
    {"name": "Cato Institute", "slug": "cato-institute", "type": "think_tank", "ein": "23-7432162", "lean": "Libertarian"},
    {"name": "Council on Foreign Relations", "slug": "council-on-foreign-relations", "type": "think_tank", "ein": "13-1628168", "lean": "Establishment"},
    {"name": "Atlantic Council", "slug": "atlantic-council", "type": "think_tank", "ein": "52-1328663", "lean": "Bipartisan/Globalist"},
    {"name": "Ezra Klein", "slug": "ezra-klein", "type": "media_amplifier", "lean": "Left", "description": "Columnist/Podcaster"},
    {"name": "Hasan Piker", "slug": "hasan-piker", "type": "media_amplifier", "lean": "Left", "description": "Twitch Streamer"}
]

def run_seed():
    print("Seeding entities...")
    with get_db() as conn:
        cur = conn.cursor()
        for entity in SEED_ENTITIES:
            cur.execute("SELECT id FROM entities WHERE slug = ?", (entity['slug'],))
            row = cur.fetchone()
            if not row:
                new_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO entities (id, name, slug, type, ein, lean, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (new_id, entity['name'], entity['slug'], entity['type'], entity.get('ein'), entity.get('lean'), entity.get('description'))
                )
                print(f"Inserted: {entity['name']}")
            else:
                print(f"Skipped (already exists): {entity['name']}")
        conn.commit()
    print("Seed complete.")

if __name__ == "__main__":
    run_seed()
