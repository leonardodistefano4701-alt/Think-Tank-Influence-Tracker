"""The FTS index must follow the tables it indexes.

This pins the bug that actually happened: repair_bill_status.py corrected 38 bill
statuses, and because the database had no triggers, the search index kept the old
values. A full-text search for "Signed into Law" returned 2 rows while the table
held 15. Nothing caught it.

Each test builds a small database with the real schema from slim_fts.py.
"""

import os
import sqlite3
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from slim_fts import SPECS, build_statements  # noqa: E402

BASE_SCHEMA = """
CREATE TABLE legislation (
    id TEXT PRIMARY KEY, bill_id TEXT, title TEXT, congress INTEGER, chamber TEXT,
    status TEXT, sponsor_id TEXT, topic_tags TEXT, summary TEXT,
    introduced_date TEXT, metadata TEXT DEFAULT '{}', policy_area TEXT,
    latest_action TEXT, provenance TEXT
);
CREATE TABLE entities (
    id TEXT PRIMARY KEY, name TEXT, slug TEXT, type TEXT, ein TEXT, lean TEXT,
    description TEXT, image_url TEXT, metadata TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE donors (
    id TEXT PRIMARY KEY, entity_id TEXT, donor_name TEXT, donor_entity_id TEXT,
    amount INTEGER, year INTEGER, source TEXT, industry TEXT,
    is_foreign_govt INTEGER, metadata TEXT, provenance TEXT
);
CREATE TABLE policy_papers (
    id TEXT PRIMARY KEY, entity_id TEXT, title TEXT, url TEXT, published_date TEXT,
    topic_tags TEXT, summary TEXT, embedding BLOB, metadata TEXT, provenance TEXT
);
"""


@pytest.fixture
def db():
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA trusted_schema=ON")
    conn.executescript(BASE_SCHEMA)
    conn.execute(
        "INSERT INTO legislation (id, bill_id, title, summary, status, metadata) VALUES "
        "('a', '117-HR-5376', 'Inflation Reduction Act', 'energy provisions', "
        "'Reported by Committee', '{\"sponsors\": \"Rep. Yarmuth, John A.\"}')"
    )
    conn.execute(
        "INSERT INTO entities (id, name, slug, type, lean, description) VALUES "
        "('e1', 'Heritage Foundation', 'heritage-foundation', 'think_tank', 'Right', 'A think tank')"
    )
    conn.execute(
        "INSERT INTO donors (id, entity_id, donor_name, industry) VALUES "
        "('d1', 'e1', 'ExxonMobil', 'Energy')"
    )
    conn.execute(
        "INSERT INTO policy_papers (id, entity_id, title, summary, topic_tags) VALUES "
        "('p1', 'e1', 'Energy Policy Paper', 'about energy', 'energy')"
    )
    for stmt in build_statements():
        conn.execute(stmt)
    conn.commit()
    yield conn
    conn.close()


def hits(db, table, query):
    return db.execute(f"SELECT COUNT(*) FROM {table} WHERE {table} MATCH ?", (query,)).fetchone()[0]


def test_external_content_stores_no_duplicate_copy(db):
    """The whole point of the size change: no _content shadow table."""
    names = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "search_legislation_content" not in names
    assert "search_legislation_data" in names  # the index itself must still exist


def test_index_follows_a_status_update(db):
    """The exact regression: a status correction must move the search hit."""
    assert hits(db, "search_legislation", 'status:"Reported by Committee"') == 1
    assert hits(db, "search_legislation", 'status:"Signed into Law"') == 0

    db.execute("UPDATE legislation SET status = 'Signed into Law' WHERE id = 'a'")

    assert hits(db, "search_legislation", 'status:"Reported by Committee"') == 0
    assert hits(db, "search_legislation", 'status:"Signed into Law"') == 1


def test_index_follows_insert_and_delete(db):
    assert hits(db, "search_legislation", "WOMBAT") == 0
    db.execute(
        "INSERT INTO legislation (id, bill_id, title, status, metadata) "
        "VALUES ('z', '999-HR-1', 'WOMBAT Act', 'Introduced', '{}')"
    )
    assert hits(db, "search_legislation", "WOMBAT") == 1
    db.execute("DELETE FROM legislation WHERE id = 'z'")
    assert hits(db, "search_legislation", "WOMBAT") == 0


def test_sponsors_indexed_from_metadata_json(db):
    """search_legislation indexes a column that does not exist on the table."""
    assert hits(db, "search_legislation", "Yarmuth") == 1


def test_other_tables_stay_in_sync(db):
    db.execute("UPDATE donors SET industry = 'QUUXINDUSTRY' WHERE id = 'd1'")
    assert hits(db, "search_donors", "QUUXINDUSTRY") == 1

    db.execute("UPDATE policy_papers SET title = 'FROBNICATE Paper' WHERE id = 'p1'")
    assert hits(db, "search_papers", "FROBNICATE") == 1

    db.execute("UPDATE entities SET description = 'BAZQUUX org' WHERE id = 'e1'")
    assert hits(db, "search_entities", "BAZQUUX") == 1


@pytest.mark.parametrize("fts", [s[0] for s in SPECS])
def test_integrity_check_passes(db, fts):
    db.execute(f"INSERT INTO {fts}({fts}) VALUES('integrity-check')")


def test_prefix_query_and_rank_still_work(db):
    """The search page uses prefix queries ordered by rank."""
    rows = db.execute(
        "SELECT rowid FROM search_legislation WHERE search_legislation MATCH ? ORDER BY rank",
        ('"infla"*',),
    ).fetchall()
    assert len(rows) == 1
