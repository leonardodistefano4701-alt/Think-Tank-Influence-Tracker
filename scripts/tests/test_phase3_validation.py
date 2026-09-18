import os
import sys
import sqlite3
import pytest
from pathlib import Path
from urllib.parse import urlparse

# Add scripts directory to path
SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from collect_perplexity import (
    ALLOWED_DOMAINS,
    GLOBAL_ALLOWED,
    validate_paper_url,
    slug_title_match,
)

DB_PATH = SCRIPTS_DIR.parent / "web" / "data" / "ttit.db"


def is_valid_domain(url: str, tank_slug: str = None) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if tank_slug and tank_slug in ALLOWED_DOMAINS:
        allowed = ALLOWED_DOMAINS[tank_slug] + GLOBAL_ALLOWED
    else:
        allowed = [d for sub in ALLOWED_DOMAINS.values() for d in sub] + GLOBAL_ALLOWED
    return any(hostname == d or hostname.endswith("." + d) for d in allowed)


class TestURLValidation:
    """Test Phase 3 URL and domain validation gates."""

    def test_allowed_domains(self):
        assert is_valid_domain("https://www.brookings.edu/articles/china-policy", "brookings-institution")
        assert is_valid_domain("https://cato.org/policy-analysis/free-trade", "cato-institute")
        assert is_valid_domain("https://www.heritage.org/defense/report/missiles", "heritage-foundation")
        assert is_valid_domain("https://www.americanprogress.org/article/climate", "center-for-american-progress")
        assert is_valid_domain("https://www.cfr.org/backgrounder/taiwan", "council-on-foreign-relations")
        assert is_valid_domain("https://www.atlanticcouncil.org/in-depth-research-reports/ukraine", "atlantic-council")
        assert is_valid_domain("https://www.congress.gov/bill/118th-congress/house-bill/8070")
        assert is_valid_domain("https://www.govinfo.gov/app/details/BILLS-118hr8070ih")

    def test_reject_unauthorized_domains(self):
        assert not is_valid_domain("https://unknownblog.com/post/paper")
        assert not is_valid_domain("https://evil-site.org/report")
        assert not is_valid_domain("https://subdomain.brookings.edu.phishing.com/test")
        assert not is_valid_domain("")
        assert not is_valid_domain(None)

    def test_slug_title_matching(self):
        url = "https://www.cato.org/commentary/making-us-voters-happier-not-safer"
        ok, ratio, overlap = slug_title_match(url, "Making US Voters Happier, Not Safer")
        assert ok
        assert ratio >= 0.5 or overlap >= 0.5

        # Mismatch
        ok, ratio, overlap = slug_title_match(url, "Completely Unrelated Report on Arctic Oceans")
        assert not ok

    def test_validate_paper_url_rejects_empty_or_bad_domain(self):
        valid, reason, _ = validate_paper_url("", "brookings-institution", "Some Title")
        assert not valid
        assert "missing" in reason.lower()

        valid, reason, _ = validate_paper_url("https://randomsite.net/paper", "brookings-institution", "Some Title")
        assert not valid
        assert "not allowed" in reason.lower()


class TestDatabaseIntegrityPhase3:
    """Verify that all policy_papers in ttit.db conform to Phase 3 requirements."""

    @pytest.fixture
    def db_conn(self):
        if not DB_PATH.exists():
            pytest.skip(f"Database not found at {DB_PATH}")
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        yield conn
        conn.close()

    def test_no_null_or_empty_paper_urls(self, db_conn):
        cursor = db_conn.cursor()
        cursor.execute("SELECT count(*) FROM policy_papers WHERE url IS NULL OR trim(url) = ''")
        null_count = cursor.fetchone()[0]
        assert null_count == 0, f"Found {null_count} policy papers with NULL/empty URL"

    def test_all_paper_urls_have_valid_domains(self, db_conn):
        cursor = db_conn.cursor()
        cursor.execute("SELECT id, title, url FROM policy_papers")
        rows = cursor.fetchall()
        assert len(rows) > 0, "No policy papers found in database"
        for row in rows:
            url = row["url"]
            assert is_valid_domain(url), f"Paper {row['id']} has invalid domain URL: {url}"

    def test_influence_links_have_evidence(self, db_conn):
        cursor = db_conn.cursor()
        cursor.execute(
            """
            SELECT count(*) FROM influence_links
            WHERE source_type = 'policy_paper' AND target_type = 'legislation'
            AND (evidence IS NULL OR trim(evidence) = '')
            """
        )
        empty_evidence = cursor.fetchone()[0]
        assert empty_evidence == 0, f"Found {empty_evidence} influence links without evidence"


class TestUIConfidenceRemoved:
    """Verify that model self-reported confidence percentages are not rendered in the UI."""

    def test_no_confidence_level_in_legislation_view(self):
        leg_page = SCRIPTS_DIR.parent / "web" / "app" / "legislation" / "[id]" / "page.tsx"
        content = leg_page.read_text()
        assert "Confidence Level:" not in content
        assert "% confidence" not in content

    def test_no_confidence_in_donors_view(self):
        donors_page = SCRIPTS_DIR.parent / "web" / "app" / "donors" / "[id]" / "page.tsx"
        content = donors_page.read_text()
        assert "Confidence: {" not in content

    def test_no_confidence_in_analysis_view(self):
        analysis_page = SCRIPTS_DIR.parent / "web" / "app" / "analysis" / "page.tsx"
        content = analysis_page.read_text()
        assert "% confidence" not in content
        assert "Avg influence strength:" not in content

    def test_no_confidence_in_compare_view(self):
        compare_page = SCRIPTS_DIR.parent / "web" / "app" / "compare" / "page.tsx"
        content = compare_page.read_text()
        assert 'label="Avg Influence Confidence"' not in content
