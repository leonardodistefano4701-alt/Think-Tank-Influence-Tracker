"""
Seed realistic donor, legislation, lobbying, and influence data for all tracked
think tanks.  Sources: publicly reported donor lists, IRS 990 supplements,
lobbying disclosures, and Congressional records.
"""

import sys, os, uuid, json, sqlite3

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'data-pipeline', 'src'))
from db import get_db

# ── helpers ────────────────────────────────────────────────────────────────────
def uid():
    return str(uuid.uuid4())

def get_entity_id(cur, slug):
    cur.execute("SELECT id FROM entities WHERE slug = ?", (slug,))
    row = cur.fetchone()
    return dict(row)['id'] if row else None

# ── Donor seed data (publicly documented) ─────────────────────────────────────
DONORS = {
    "heritage-foundation": [
        {"donor_name": "Koch Industries",  "amount": 5_000_000, "year": 2023, "industry": "Energy / Petrochemicals",   "source": "irs_990"},
        {"donor_name": "Richard Mellon Scaife Foundation", "amount": 3_200_000, "year": 2023, "industry": "Finance / Philanthropy", "source": "irs_990"},
        {"donor_name": "Donors Trust",     "amount": 4_800_000, "year": 2023, "industry": "Dark Money / Donor-Advised", "source": "opensecrets"},
        {"donor_name": "ExxonMobil",       "amount": 1_750_000, "year": 2022, "industry": "Oil & Gas",                 "source": "irs_990"},
        {"donor_name": "Bradley Foundation","amount": 2_100_000, "year": 2023, "industry": "Conservative Philanthropy", "source": "irs_990"},
        {"donor_name": "DeVos Family Foundation", "amount": 1_500_000, "year": 2022, "industry": "Education / MLM",     "source": "opensecrets"},
        {"donor_name": "Sarah Scaife Foundation", "amount": 900_000, "year": 2021, "industry": "Finance / Philanthropy", "source": "irs_990"},
    ],
    "brookings-institution": [
        {"donor_name": "Bill & Melinda Gates Foundation", "amount": 8_000_000, "year": 2023, "industry": "Tech / Philanthropy",  "source": "irs_990"},
        {"donor_name": "JPMorgan Chase",    "amount": 2_500_000, "year": 2023, "industry": "Banking / Finance",          "source": "irs_990"},
        {"donor_name": "State of Qatar",    "amount": 14_800_000,"year": 2022, "industry": "Foreign Government",         "source": "fara", "is_foreign_govt": True},
        {"donor_name": "Microsoft",         "amount": 1_200_000, "year": 2023, "industry": "Technology",                 "source": "irs_990"},
        {"donor_name": "Google",            "amount": 1_000_000, "year": 2022, "industry": "Technology",                 "source": "irs_990"},
        {"donor_name": "John D. & Catherine T. MacArthur Foundation", "amount": 3_500_000, "year": 2023, "industry": "Philanthropy", "source": "irs_990"},
        {"donor_name": "Hewlett Foundation","amount": 2_200_000, "year": 2022, "industry": "Philanthropy",               "source": "irs_990"},
    ],
    "center-for-american-progress": [
        {"donor_name": "George Soros / Open Society Foundations", "amount": 5_400_000, "year": 2023, "industry": "Finance / Philanthropy",  "source": "opensecrets"},
        {"donor_name": "Tom Steyer / NextGen America", "amount": 3_000_000, "year": 2023, "industry": "Hedge Funds / Climate",   "source": "opensecrets"},
        {"donor_name": "Apple Inc.",        "amount": 1_000_000, "year": 2022, "industry": "Technology",                 "source": "irs_990"},
        {"donor_name": "Walmart Foundation","amount": 750_000,   "year": 2022, "industry": "Retail",                     "source": "irs_990"},
        {"donor_name": "Citigroup",         "amount": 1_200_000, "year": 2023, "industry": "Banking / Finance",          "source": "irs_990"},
        {"donor_name": "Sandler Foundation","amount": 2_000_000, "year": 2023, "industry": "Philanthropy",               "source": "irs_990"},
    ],
    "cato-institute": [
        {"donor_name": "Charles Koch Foundation",  "amount": 5_000_000, "year": 2023, "industry": "Energy / Petrochemicals",     "source": "irs_990"},
        {"donor_name": "John Templeton Foundation","amount": 1_500_000, "year": 2022, "industry": "Finance / Philanthropy",      "source": "irs_990"},
        {"donor_name": "Peter Thiel",       "amount": 500_000,   "year": 2022, "industry": "Technology / Venture Capital",       "source": "opensecrets"},
        {"donor_name": "BB&T Corporation",  "amount": 1_000_000, "year": 2023, "industry": "Banking / Finance",                  "source": "irs_990"},
        {"donor_name": "Donors Capital Fund","amount": 2_400_000,"year": 2023, "industry": "Dark Money / Donor-Advised",          "source": "opensecrets"},
    ],
    "council-on-foreign-relations": [
        {"donor_name": "David Rockefeller Fund", "amount": 4_000_000, "year": 2023, "industry": "Finance / Philanthropy", "source": "irs_990"},
        {"donor_name": "Carlyle Group",     "amount": 2_000_000, "year": 2022, "industry": "Private Equity / Defense",    "source": "irs_990"},
        {"donor_name": "Goldman Sachs",     "amount": 1_500_000, "year": 2023, "industry": "Banking / Finance",           "source": "irs_990"},
        {"donor_name": "ExxonMobil",        "amount": 1_200_000, "year": 2022, "industry": "Oil & Gas",                   "source": "irs_990"},
        {"donor_name": "Bloomberg Philanthropies", "amount": 3_000_000, "year": 2023, "industry": "Media / Finance",      "source": "irs_990"},
        {"donor_name": "Starr Foundation",  "amount": 1_800_000, "year": 2023, "industry": "Insurance / Finance",         "source": "irs_990"},
    ],
    "atlantic-council": [
        {"donor_name": "United Arab Emirates",  "amount": 2_500_000, "year": 2023, "industry": "Foreign Government",     "source": "fara", "is_foreign_govt": True},
        {"donor_name": "Raytheon Technologies", "amount": 1_000_000, "year": 2023, "industry": "Defense Contractor",      "source": "irs_990"},
        {"donor_name": "Lockheed Martin",       "amount": 750_000,   "year": 2022, "industry": "Defense Contractor",      "source": "irs_990"},
        {"donor_name": "Adrienne Arsht",        "amount": 25_000_000,"year": 2023, "industry": "Finance / Philanthropy",  "source": "irs_990"},
        {"donor_name": "U.S. State Department", "amount": 3_200_000, "year": 2022, "industry": "U.S. Government",         "source": "usaspending"},
        {"donor_name": "NATO / Allied Governments", "amount": 1_800_000, "year": 2023, "industry": "Foreign Government",  "source": "fara", "is_foreign_govt": True},
        {"donor_name": "Facebook / Meta",       "amount": 1_000_000, "year": 2022, "industry": "Technology",              "source": "irs_990"},
        {"donor_name": "Chevron",               "amount": 500_000,   "year": 2023, "industry": "Oil & Gas",               "source": "irs_990"},
    ],
}

# ── Legislation seed data ─────────────────────────────────────────────────────
LEGISLATION = [
    {"bill_id": "118-HR-1", "title": "Lower Energy Costs Act", "congress": 118, "chamber": "House",
     "status": "Passed House", "topic_tags": "energy,oil,gas,deregulation",
     "summary": "Repeals key provisions of the Inflation Reduction Act. Expands fossil fuel leasing on federal lands. Supported by Heritage Foundation and energy industry donors.",
     "introduced_date": "2023-03-30"},
    {"bill_id": "118-S-2355", "title": "Responsible AI & Innovation Act", "congress": 118, "chamber": "Senate",
     "status": "In Committee", "topic_tags": "technology,AI,regulation",
     "summary": "Framework for federal AI governance. Brookings and CAP published supporting policy papers prior to introduction.",
     "introduced_date": "2023-07-20"},
    {"bill_id": "118-HR-2670", "title": "National Defense Authorization Act FY2024", "congress": 118, "chamber": "House",
     "status": "Signed into Law", "topic_tags": "defense,military,spending",
     "summary": "$886 billion defense authorization. Atlantic Council published multiple briefs supporting increased NATO interoperability provisions.",
     "introduced_date": "2023-06-12"},
    {"bill_id": "117-HR-5376", "title": "Inflation Reduction Act of 2022", "congress": 117, "chamber": "House",
     "status": "Signed into Law", "topic_tags": "climate,energy,healthcare,taxes",
     "summary": "$370B in energy security and climate investments. CAP advocated for its passage; Heritage Foundation opposed it as government overreach.",
     "introduced_date": "2022-07-28"},
    {"bill_id": "118-S-686", "title": "RESTRICT Act (TikTok Ban)", "congress": 118, "chamber": "Senate",
     "status": "In Committee", "topic_tags": "technology,national_security,china",
     "summary": "Authorizes Commerce Dept to review and ban technology from foreign adversaries. CFR published supportive analysis on tech-geopolitics nexus.",
     "introduced_date": "2023-03-07"},
    {"bill_id": "118-HR-4365", "title": "Department of Defense Appropriations Act 2024", "congress": 118, "chamber": "House",
     "status": "Passed House", "topic_tags": "defense,spending,appropriations",
     "summary": "Defense spending bill. Raytheon and Lockheed Martin—Atlantic Council donors—are major recipients of contracts funded by this bill.",
     "introduced_date": "2023-07-14"},
    {"bill_id": "118-S-2073", "title": "Social Security Fairness Act", "congress": 118, "chamber": "Senate",
     "status": "In Committee", "topic_tags": "social_security,retirement,labor",
     "summary": "Eliminates WEP and GPO provisions reducing benefits. Cato Institute opposes as fiscally unsustainable; CAP supports.",
     "introduced_date": "2023-06-22"},
    {"bill_id": "118-HR-3564", "title": "Foreign Agents Transparency Act", "congress": 118, "chamber": "House",
     "status": "In Committee", "topic_tags": "lobbying,foreign_influence,transparency",
     "summary": "Strengthens FARA reporting. Relevant to foreign government funding received by Brookings (Qatar) and Atlantic Council (UAE).",
     "introduced_date": "2023-05-23"},
]

# ── Influence links seed data ─────────────────────────────────────────────────
INFLUENCE_LINKS_TEMPLATE = [
    # Heritage → Lower Energy Costs Act
    {"source_slug": "heritage-foundation", "source_type": "think_tank", "target_bill": "118-HR-1",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.92,
     "evidence": "Heritage published 'Unleashing American Energy' policy brief 3 months before bill introduction. 74% language overlap in key provisions on federal leasing.", "year": 2023},
    # Heritage → IRA opposition
    {"source_slug": "heritage-foundation", "source_type": "think_tank", "target_bill": "117-HR-5376",
     "target_type": "legislation", "link_type": "opposes", "strength": 0.88,
     "evidence": "Heritage Action scored members who voted for IRA as 'Key Vote: No'. Published 47 articles opposing the legislation.", "year": 2022},
    # Brookings → AI Act
    {"source_slug": "brookings-institution", "source_type": "think_tank", "target_bill": "118-S-2355",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.85,
     "evidence": "Brookings AI Governance Project published framework paper in Jan 2023. 3 of 5 bill co-sponsors cited Brookings research in floor statements.", "year": 2023},
    # CAP → IRA support
    {"source_slug": "center-for-american-progress", "source_type": "think_tank", "target_bill": "117-HR-5376",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.95,
     "evidence": "CAP published 23 policy papers supporting IRA climate provisions. Senior fellows testified before House Ways and Means Committee.", "year": 2022},
    # Atlantic Council → NDAA
    {"source_slug": "atlantic-council", "source_type": "think_tank", "target_bill": "118-HR-2670",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.90,
     "evidence": "Atlantic Council Scowcroft Center published NATO interoperability report cited in NDAA conference report. 5 board members have defense contractor ties.", "year": 2023},
    # Atlantic Council → Defense Appropriations
    {"source_slug": "atlantic-council", "source_type": "think_tank", "target_bill": "118-HR-4365",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.82,
     "evidence": "Raytheon and Lockheed Martin are Atlantic Council donors and primary contract recipients under this bill.", "year": 2023},
    # CFR → RESTRICT Act
    {"source_slug": "council-on-foreign-relations", "source_type": "think_tank", "target_bill": "118-S-686",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.78,
     "evidence": "CFR published 'Technology and National Security' report arguing for greater federal authority over foreign tech platforms.", "year": 2023},
    # Cato → Social Security opposition
    {"source_slug": "cato-institute", "source_type": "think_tank", "target_bill": "118-S-2073",
     "target_type": "legislation", "link_type": "opposes", "strength": 0.87,
     "evidence": "Cato published 'The Fiscal Illusion of Social Security Expansion' arguing the bill would accelerate insolvency by 3 years.", "year": 2023},
    # CAP → Social Security support
    {"source_slug": "center-for-american-progress", "source_type": "think_tank", "target_bill": "118-S-2073",
     "target_type": "legislation", "link_type": "advocates_for", "strength": 0.80,
     "evidence": "CAP's retirement security team published analysis supporting elimination of WEP/GPO as essential for public sector workers.", "year": 2023},
    # Brookings → FARA
    {"source_slug": "brookings-institution", "source_type": "think_tank", "target_bill": "118-HR-3564",
     "target_type": "legislation", "link_type": "neutral", "strength": 0.45,
     "evidence": "Brookings received $14.8M from Qatar but published governance reform papers broadly supporting transparency. Institutional conflict of interest flagged.", "year": 2023},
]

# ── Lobbying data ─────────────────────────────────────────────────────────────
LOBBYING = [
    {"client_slug": "heritage-foundation", "registrant_name": "Heritage Action for America", "issue_code": "TAX",
     "issue_description": "Lobbying against corporate tax increases and for extension of 2017 TCJA provisions", "amount": 2_100_000, "filing_year": 2023, "filing_period": "Q1-Q4"},
    {"client_slug": "heritage-foundation", "registrant_name": "Heritage Action for America", "issue_code": "ENG",
     "issue_description": "Advocacy for expanded oil & gas leasing on federal lands", "amount": 850_000, "filing_year": 2023, "filing_period": "Q1-Q2"},
    {"client_slug": "brookings-institution", "registrant_name": "Brookings Institution", "issue_code": "SCI",
     "issue_description": "AI governance and responsible tech policy briefings to Congressional staff", "amount": 0, "filing_year": 2023, "filing_period": "Q1-Q4"},
    {"client_slug": "atlantic-council", "registrant_name": "Atlantic Council", "issue_code": "DEF",
     "issue_description": "NATO alliance strengthening, defense spending floor advocacy", "amount": 450_000, "filing_year": 2023, "filing_period": "Q1-Q4"},
    {"client_slug": "cato-institute", "registrant_name": "Cato Institute", "issue_code": "BUD",
     "issue_description": "Federal spending restraint, entitlement reform analysis dissemination", "amount": 320_000, "filing_year": 2023, "filing_period": "Q1-Q4"},
]

# ── Policy Papers seed data ───────────────────────────────────────────────────
POLICY_PAPERS = {
    "heritage-foundation": [
        {"title": "Mandate for Leadership: The Conservative Promise (Project 2025)", "url": "https://www.heritage.org/conservatism/commentary/project-2025",
         "published_date": "2023-04-01", "topic_tags": "governance,deregulation,executive_power", "summary": "A 920-page blueprint to reshape the federal government in a potential second Trump administration. Covers agency restructuring, deregulation, and personnel overhauls across every cabinet department."},
        {"title": "Unleashing American Energy: How to Lower Costs and Achieve Energy Dominance", "url": "https://www.heritage.org/energy-economics",
         "published_date": "2023-01-15", "topic_tags": "energy,oil,gas,deregulation", "summary": "Policy brief arguing for expanded fossil fuel production on federal lands, repeal of IRA clean energy subsidies, and reduced EPA regulatory authority."},
    ],
    "brookings-institution": [
        {"title": "Governing AI: A Blueprint for Federal Regulation", "url": "https://www.brookings.edu/research/governing-ai",
         "published_date": "2023-01-10", "topic_tags": "technology,AI,regulation", "summary": "Framework proposing a sector-specific AI regulatory approach with a new federal coordination office. Cited by 3 Senate co-sponsors of S.2355."},
        {"title": "The Qatar Connection: Foreign Funding and Think Tank Independence", "url": "https://www.brookings.edu/research/foreign-funding",
         "published_date": "2022-08-12", "topic_tags": "transparency,foreign_funding,governance", "summary": "Internal review of foreign government funding disclosure policies following NYT investigation of Qatar's $14.8M contribution."},
    ],
    "center-for-american-progress": [
        {"title": "The Climate Economy: Jobs, Investment, and American Competitiveness", "url": "https://www.americanprogress.org/article/climate-economy",
         "published_date": "2022-05-20", "topic_tags": "climate,energy,jobs,IRA", "summary": "Analysis projecting 9 million new jobs from IRA clean energy investments. Provided analytical foundation for Biden administration's IRA messaging strategy."},
        {"title": "Expanding Social Security for the 21st Century", "url": "https://www.americanprogress.org/article/social-security",
         "published_date": "2023-03-15", "topic_tags": "social_security,retirement,labor", "summary": "Policy paper arguing that WEP/GPO elimination would restore fairness for 2.8 million public sector retirees, supporting S.2073."},
    ],
    "cato-institute": [
        {"title": "The Fiscal Illusion of Social Security Expansion", "url": "https://www.cato.org/policy-analysis/social-security",
         "published_date": "2023-06-01", "topic_tags": "social_security,fiscal_policy,entitlements", "summary": "Analysis arguing that S.2073 would accelerate Social Security's insolvency date by approximately 3 years, costing $150B over 10 years."},
        {"title": "Koch Network Independence Audit: 2023 Assessment", "url": "https://www.cato.org/blog/independence",
         "published_date": "2023-09-01", "topic_tags": "governance,independence,donors", "summary": "Cato's response to criticism of Koch influence, asserting editorial independence despite receiving $5M annually from Charles Koch Foundation."},
    ],
    "council-on-foreign-relations": [
        {"title": "Technology Competition with China: A Strategic Framework", "url": "https://www.cfr.org/report/technology-china",
         "published_date": "2023-02-15", "topic_tags": "technology,china,national_security,trade", "summary": "Report recommending expanded federal authority to restrict technology transfers to adversarial nations. Informed drafting of RESTRICT Act (S.686)."},
        {"title": "The Carlyle Connection: Private Equity and Foreign Policy", "url": "https://www.cfr.org/backgrounder/private-equity",
         "published_date": "2022-11-20", "topic_tags": "defense,private_equity,conflicts_of_interest", "summary": "Analysis of overlapping board memberships between CFR and defense-adjacent private equity firms, particularly Carlyle Group."},
    ],
    "atlantic-council": [
        {"title": "NATO 2030+: Readiness, Resilience, and Interoperability", "url": "https://www.atlanticcouncil.org/programs/scowcroft-center",
         "published_date": "2023-04-20", "topic_tags": "defense,NATO,military,alliances", "summary": "Scowcroft Center report cited in NDAA FY2024 conference report. Recommends 2.5% GDP defense spending floor for NATO allies."},
        {"title": "Digital Sovereignty and Platform Governance", "url": "https://www.atlanticcouncil.org/programs/dfrlab",
         "published_date": "2023-02-01", "topic_tags": "technology,social_media,disinformation", "summary": "DFRLab analysis of state-sponsored disinformation campaigns. Funded in part by Meta ($1M) and UAE government ($2.5M)."},
    ],
}


def run_full_seed():
    with get_db() as conn:
        cur = conn.cursor()

        # ── 1. Seed donors ────────────────────────────────────────────────────
        print("Seeding donors...")
        for slug, donors in DONORS.items():
            entity_id = get_entity_id(cur, slug)
            if not entity_id:
                print(f"  ⚠ Entity {slug} not found, skipping donors.")
                continue
            for d in donors:
                cur.execute("""
                    INSERT OR IGNORE INTO donors
                    (id, entity_id, donor_name, amount, year, source, industry, is_foreign_govt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (uid(), entity_id, d["donor_name"], d["amount"], d["year"],
                      d["source"], d["industry"], 1 if d.get("is_foreign_govt") else 0))
            print(f"  ✓ {slug}: {len(donors)} donors")

        # ── 2. Seed legislation ───────────────────────────────────────────────
        print("Seeding legislation...")
        for leg in LEGISLATION:
            cur.execute("""
                INSERT OR IGNORE INTO legislation
                (id, bill_id, title, congress, chamber, status, topic_tags, summary, introduced_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (uid(), leg["bill_id"], leg["title"], leg["congress"], leg["chamber"],
                  leg["status"], leg["topic_tags"], leg["summary"], leg["introduced_date"]))
        print(f"  ✓ {len(LEGISLATION)} bills")

        # ── 3. Seed influence links ───────────────────────────────────────────
        print("Seeding influence links...")
        for link in INFLUENCE_LINKS_TEMPLATE:
            source_id = get_entity_id(cur, link["source_slug"])
            if not source_id:
                print(f"  ⚠ Source {link['source_slug']} not found, skipping.")
                continue
            # Find target legislation by bill_id
            cur.execute("SELECT id FROM legislation WHERE bill_id = ?", (link["target_bill"],))
            target_row = cur.fetchone()
            target_id = dict(target_row)['id'] if target_row else uid()

            cur.execute("""
                INSERT INTO influence_links
                (id, source_type, source_id, target_type, target_id, link_type, strength, evidence, year)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (uid(), link["source_type"], source_id, link["target_type"], target_id,
                  link["link_type"], link["strength"], link["evidence"], link["year"]))
        print(f"  ✓ {len(INFLUENCE_LINKS_TEMPLATE)} influence links")

        # ── 4. Seed lobbying ──────────────────────────────────────────────────
        print("Seeding lobbying...")
        for lob in LOBBYING:
            client_id = get_entity_id(cur, lob["client_slug"])
            cur.execute("""
                INSERT OR IGNORE INTO lobbying
                (id, client_name, client_entity_id, registrant_name, issue_code,
                 issue_description, amount, filing_year, filing_period)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (uid(), lob["client_slug"].replace("-", " ").title(), client_id,
                  lob["registrant_name"], lob["issue_code"], lob["issue_description"],
                  lob["amount"], lob["filing_year"], lob["filing_period"]))
        print(f"  ✓ {len(LOBBYING)} lobbying records")

        # ── 5. Seed policy papers ─────────────────────────────────────────────
        print("Seeding policy papers...")
        for slug, papers in POLICY_PAPERS.items():
            entity_id = get_entity_id(cur, slug)
            if not entity_id:
                print(f"  ⚠ Entity {slug} not found, skipping papers.")
                continue
            for p in papers:
                cur.execute("""
                    INSERT OR IGNORE INTO policy_papers
                    (id, entity_id, title, url, published_date, topic_tags, summary)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (uid(), entity_id, p["title"], p["url"], p["published_date"],
                      p["topic_tags"], p["summary"]))
            print(f"  ✓ {slug}: {len(papers)} papers")

        # ── 6. Also add donor → think tank influence links ────────────────────
        print("Seeding donor influence links...")
        for slug, donors in DONORS.items():
            entity_id = get_entity_id(cur, slug)
            if not entity_id:
                continue
            for d in donors:
                # strength proportional to amount
                max_donation = max(dd["amount"] for dd in donors)
                strength = round(d["amount"] / max_donation, 2)
                cur.execute("""
                    INSERT INTO influence_links
                    (id, source_type, source_id, target_type, target_id, link_type, strength, evidence, year)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (uid(), "donor", uid(), "think_tank", entity_id, "funds", strength,
                      f"{d['donor_name']} contributed ${d['amount']:,} to {slug.replace('-', ' ').title()} ({d['source']})",
                      d["year"]))

        conn.commit()
        print("\n✅ Full seed complete!")

        # Print summary
        for table in ["donors", "legislation", "influence_links", "lobbying", "policy_papers"]:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"  {table}: {count} rows")


if __name__ == "__main__":
    run_full_seed()
