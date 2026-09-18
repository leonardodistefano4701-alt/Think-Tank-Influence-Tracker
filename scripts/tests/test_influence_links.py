import os
import sqlite3
import pytest

DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "web", "data", "ttit.db"),
)

@pytest.fixture
def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()

def test_influence_links_referential_integrity(db_conn):
    """Every influence_links row must have source_id and target_id resolving to a real entity."""
    cur = db_conn.cursor()

    links = cur.execute("""
        SELECT id, source_type, source_id, target_type, target_id
        FROM influence_links
    """).fetchall()

    assert len(links) > 0, "Expected influence_links table to contain rows"

    unresolved = []

    for link in links:
        link_id = link["id"]
        stype = link["source_type"]
        sid = link["source_id"]
        ttype = link["target_type"]
        tid = link["target_id"]

        # Check source resolution
        source_found = False
        if stype == "donor":
            source_found = bool(cur.execute("SELECT 1 FROM donors WHERE id = ?", (sid,)).fetchone())
        elif stype == "policy_paper":
            source_found = bool(cur.execute("SELECT 1 FROM policy_papers WHERE id = ?", (sid,)).fetchone())
        elif stype in ("think_tank", "media_amplifier", "entity"):
            source_found = bool(cur.execute("SELECT 1 FROM entities WHERE id = ?", (sid,)).fetchone())
        elif stype == "legislation":
            source_found = bool(cur.execute("SELECT 1 FROM legislation WHERE id = ?", (sid,)).fetchone())
        else:
            source_found = False

        if not source_found:
            unresolved.append(f"Link {link_id}: source {stype}:{sid} does not resolve")

        # Check target resolution
        target_found = False
        if ttype == "legislation":
            target_found = bool(cur.execute("SELECT 1 FROM legislation WHERE id = ?", (tid,)).fetchone())
        elif ttype in ("think_tank", "media_amplifier", "entity"):
            target_found = bool(cur.execute("SELECT 1 FROM entities WHERE id = ?", (tid,)).fetchone())
        elif ttype == "policy_paper":
            target_found = bool(cur.execute("SELECT 1 FROM policy_papers WHERE id = ?", (tid,)).fetchone())
        elif ttype == "donor":
            target_found = bool(cur.execute("SELECT 1 FROM donors WHERE id = ?", (tid,)).fetchone())
        else:
            target_found = False

        if not target_found:
            unresolved.append(f"Link {link_id}: target {ttype}:{tid} does not resolve")

    assert not unresolved, f"Found {len(unresolved)} dangling influence links:\n" + "\n".join(unresolved[:10])
