import sqlite3
import json
import uuid
from config import DB_PATH

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  ein TEXT,
  lean TEXT,
  description TEXT,
  image_url TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financials (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  fiscal_year INT NOT NULL,
  total_revenue BIGINT,
  total_expenses BIGINT,
  net_assets BIGINT,
  executive_compensation TEXT,
  program_revenue BIGINT,
  contributions_and_grants BIGINT,
  investment_income BIGINT,
  raw_990 TEXT,
  UNIQUE(entity_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS donors (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  donor_name TEXT NOT NULL,
  donor_entity_id TEXT REFERENCES entities(id),
  amount BIGINT,
  year INT,
  source TEXT,
  industry TEXT,
  is_foreign_govt INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS policy_papers (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  title TEXT NOT NULL,
  url TEXT,
  published_date TEXT,
  topic_tags TEXT,
  summary TEXT,
  embedding TEXT, -- stored as JSON array of floats if available
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS legislation (
  id TEXT PRIMARY KEY,
  bill_id TEXT,
  title TEXT,
  congress INT,
  chamber TEXT,
  status TEXT,
  sponsor_id TEXT REFERENCES entities(id),
  topic_tags TEXT,
  summary TEXT,
  introduced_date TEXT,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS influence_links (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  link_type TEXT,
  strength REAL,
  evidence TEXT,
  year INT,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS lobbying (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_entity_id TEXT REFERENCES entities(id),
  registrant_name TEXT,
  issue_code TEXT,
  issue_description TEXT,
  amount BIGINT,
  filing_year INT,
  filing_period TEXT,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS govt_contracts (
  id TEXT PRIMARY KEY,
  recipient_name TEXT NOT NULL,
  recipient_entity_id TEXT REFERENCES entities(id),
  agency TEXT,
  amount BIGINT,
  fiscal_year INT,
  naics_code TEXT,
  description TEXT,
  contract_type TEXT,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS media_coverage (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  headline TEXT,
  source TEXT,
  url TEXT,
  published_date TEXT,
  mentions_policy_id TEXT REFERENCES policy_papers(id),
  sentiment REAL,
  summary TEXT,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS analysis_verdicts (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id),
  verdict TEXT NOT NULL,
  confidence REAL,
  reasoning TEXT,
  evidence_summary TEXT,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  model_used TEXT DEFAULT 'minimax/highspeed'
);
"""

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = 1")
    return conn

def create_schema():
    with get_db() as conn:
        conn.executescript(SCHEMA_SQL)
    print("SQLite schema created successfully!")

if __name__ == "__main__":
    create_schema()
