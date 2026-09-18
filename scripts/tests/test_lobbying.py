"""
Test Senate LDA lobbying data integrity (Phase 2).

Verifies:
1. Every lobbying row has a non-empty filing_uuid (Rule 2).
2. Every lobbying row has a non-empty source_url pointing to the Senate LDA filing.
3. Every client_entity_id resolves to an existing entity in the database.
4. No seeded_demo rows exist in lobbying.
5. All records carry provenance='verified_filing'.
6. 501(c)(3)s with no LDA filings return 0 rows.
"""

import os
import sqlite3
import pytest

DB_PATH = os.environ.get(
    'DB_PATH',
    os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'data', 'ttit.db')
)

@pytest.fixture
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()

def test_no_seeded_demo_lobbying(db):
    seeded_count = db.execute("SELECT COUNT(*) FROM lobbying WHERE provenance = 'seeded_demo'").fetchone()[0]
    assert seeded_count == 0, f"Found {seeded_count} seeded_demo lobbying rows that were not replaced."

def test_lobbying_identifiers_and_urls(db):
    rows = db.execute("SELECT id, filing_uuid, source_url, provenance, client_name FROM lobbying").fetchall()
    assert len(rows) > 0, "Expected lobbying rows to be ingested from Senate LDA API."
    
    for row in rows:
        fuuid = row['filing_uuid']
        surl = row['source_url']
        prov = row['provenance']
        
        assert fuuid is not None and len(fuuid.strip()) > 0, f"Row {row['id']} has null or empty filing_uuid"
        assert surl is not None and surl.startswith("https://lda.senate.gov/filings/public/filing/"), (
            f"Row {row['id']} has invalid source_url: {surl}"
        )
        assert fuuid in surl, f"Row {row['id']} source_url does not contain filing_uuid {fuuid}"
        assert prov == 'verified_filing', f"Row {row['id']} has unexpected provenance: {prov}"

def test_lobbying_client_entity_foreign_key(db):
    rows = db.execute("""
        SELECT l.id, l.client_entity_id, e.id as entity_exists
        FROM lobbying l
        LEFT JOIN entities e ON l.client_entity_id = e.id
    """).fetchall()
    
    for row in rows:
        assert row['client_entity_id'] is not None, f"Lobbying row {row['id']} has NULL client_entity_id"
        assert row['entity_exists'] is not None, f"Lobbying row {row['id']} points to non-existent entity {row['client_entity_id']}"

def test_think_tanks_without_filings(db):
    # Brookings, Cato, CFR, Atlantic Council have no exact LDA filings
    no_filing_slugs = ['brookings-institution', 'cato-institute', 'council-on-foreign-relations', 'atlantic-council']
    for slug in no_filing_slugs:
        count = db.execute("""
            SELECT COUNT(*) FROM lobbying l
            JOIN entities e ON l.client_entity_id = e.id
            WHERE e.slug = ?
        """, (slug,)).fetchone()[0]
        assert count == 0, f"Expected 0 LDA filings for {slug}, but found {count}."

def test_heritage_action_affiliated_entity(db):
    entity = db.execute("SELECT id, name, slug, type FROM entities WHERE slug = 'heritage-action-for-america'").fetchone()
    assert entity is not None, "Heritage Action for America was not created in entities table."
    assert entity['type'] == 'affiliated_entity', f"Expected type 'affiliated_entity', got '{entity['type']}'."
    
    filing_count = db.execute("SELECT COUNT(*) FROM lobbying WHERE client_entity_id = ?", (entity['id'],)).fetchone()[0]
    assert filing_count > 0, "Heritage Action for America should have verified LDA filings."
