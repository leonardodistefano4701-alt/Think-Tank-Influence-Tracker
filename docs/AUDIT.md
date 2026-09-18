# Think Tank Influence Tracker: Data Integrity Audit and Fix Plan

Audited repo `leonardodistefano4701-alt/Think-Tank-Influence-Tracker` at commit `8d6698d` and its shipped database `web/data/ttit.db`. Audit date: September 18, 2026.

## 1. Verdict

The platform contains fabricated content, and it comes from three distinct failure modes. **Missing API keys caused almost none of it.**

| Layer | Rows | Where it comes from | Trustworthy? |
|---|---|---|---|
| 990 financials | 51 | ProPublica API | Mostly. CAP and the Atlantic Council have **zero** (wrong EINs), and every "net assets" figure is actually total assets (A1) |
| Legislation | 20,428 | GovInfo bulk | Yes, except 8 hand-seeded bills whose titles overwrite the real records |
| Donors | 39 | Hand-typed in `seed_full.py` | **No.** Invented amounts and years, originally labeled `irs_990` / `fara` / `opensecrets` |
| Lobbying | 5 | Hand-typed | **No** |
| Influence links (seeded) | 74 | Hand-typed, including invented evidence ("74% language overlap", "cited in NDAA conference report") | **No** |
| Policy papers | 125 | Perplexity sonar-pro | **Mostly unreliable.** Duplicates, invented titles, 53 have no URL |
| Influence links (AI) | 172 | Perplexity output plus a broken bill matcher | **No. 109 of 172 (63%) point to the wrong bill** |
| AI verdicts | 153 | Perplexity summarizing the demo data above | **No.** They restate fake data as findings |
| FEC committees | 27 | FEC API plus fuzzy name search | **Partly.** About a third are matched to the wrong committee |

Your diagnosis was partly right. The core problem is **correlation**: joining records across sources by name strings, substrings and model output instead of by stable identifiers (EIN, congress plus bill type plus bill number, FEC committee ID). Where the code uses a real key, the data is correct. Where it guesses, the data is wrong.

## 2. Critical findings, ranked

### C1. The bill matcher attaches AI claims to the wrong legislation (63% error rate)
`scripts/collect_perplexity.py → find_bill_in_db()`

The bug has four parts:
1. It matches with `bill_id LIKE '%HR-2%'` and has **no congress constraint**, so "HR 2" (Secure the Border Act) matches `118-HR-2670` (NDAA), and "S 505" (DREAM Act) matches `117-S-5054` (Honest Ads Act).
2. `b_id.replace('S', 'S-')` replaces **every** S, which breaks SRES, HRES and similar prefixes.
3. It takes `rows[0]` from an unordered result set.
4. When the ID fails, it falls back to FTS on 5 words of the title and links to whatever ranks first.

Real examples from your DB:

| Perplexity said | Linked to |
|---|---|
| HR 2617 Equality Act | 117-HR-2617 Consolidated Appropriations Act, 2023 |
| HR 1 For the People Act of 2021 | 118-HR-1 Lower Energy Costs Act |
| S 686 Abraham Accords Security Supplement Act | 118-S-686 RESTRICT Act |
| S 686 PEPFAR Reauthorization Act | 118-S-686 RESTRICT Act |
| HR 3684 Infrastructure Investment and Jobs Act | 118-HR-3684 Psychedelic Therapy to Save Lives Act |
| HR 2 Secure the Border Act | 118-HR-2670 NDAA FY2024 |

### C2. Wrong EINs silently disable the only verified financial data
`scripts/seed.py`

| Org | EIN in code | Correct EIN |
|---|---|---|
| Atlantic Council | 52-1328663 | **52-0742294** |
| Center for American Progress | 20-1541158 | **30-0126510** |

The ProPublica collector logs a warning and moves on, which is why those two pages say "No 990 filings recorded." The other four EINs are correct, since they returned filings.

### C3. The donor table is invented, and was originally labeled as sourced from filings
`scripts/seed_full.py` opens with *"Sources: publicly reported donor lists, IRS 990 supplements..."*, but every row is hand-typed with point amounts. Think tanks publish donor **ranges**, not exact figures, and public 990 copies redact Schedule B names. Specific errors I checked:
- Adrienne Arsht, $25M, 2023: her $25M gifts were in **2019** (Resilience Center) and **2022** (Latin America Center).
- "NATO / Allied Governments" is not a donor entity.
- Brookings "State of Qatar $14.8M, 2022": the $14.8M figure is a four-year total from 2014 reporting, not a 2022 gift.

`add_provenance.py` later relabeled these rows as `seeded_demo`, which was the right call, but the AI verdicts had already been generated from them.

### C4. Donor → think tank links point at nothing
`seed_full.py` step 6 inserts `source_id = uid()`, a fresh random UUID, so **all 39 donor→think tank links reference a donor that does not exist**. Their "strength" is also just `amount / max(amount)` within each tank.

### C5. The Perplexity prompt forces fabrication
- *"Include at least 8 to 12 major papers"* sets a quota. When the model cannot find 8 real ones, it invents plausible titles ("Testimony on PRC Disinformation Efforts", "Atlantic Council Strategy Papers Series on Non-Partisan US Challenges").
- It asks for *"exact title"* and a URL "if known." Neither is ever checked.
- The response-level `citations` list is copied onto **every** paper in the batch, so no individual paper is tied to a source. This is the correlation gap you suspected.
- Every AI link gets a hard-coded `strength = 0.8`.
- There is no dedup across runs. The Atlantic Council page shows the same Congress article twice and the FBIC index twice, and Brookings has 3 exact duplicate titles.
- "Strategic Posture Commission Report" is attributed to the Atlantic Council, but it is a congressionally chartered commission's report.

### C6. AI verdicts are built on demo data, with meaningless confidence scores
`generate_ai_synthesis.py` feeds the fake donors and the misattached links into sonar-pro with an "elite geopolitical intelligence analyst" persona and asks the model to self-rate confidence. Every think tank received 0.92 or 0.95. The Brookings verdict cites "heavy foreign funding from Qatar" as a finding.

The media-amplifier verdicts characterize real named people (for example, Hasan Piker "amplif[ying] far-left narratives") with no underlying data at all. **I recommend deleting these outright**, because they create reputational and legal exposure for you and HWS.

### C7. Hand-seeded bills overwrite real GovInfo records
Eight `LEGISLATION` rows were inserted first with `INSERT OR IGNORE`, so the bulk import skipped those IDs, and `add_provenance.py` then stamped all legislation `verified_filing`. Several titles are wrong. For example, `118-S-2073` is labeled "Social Security Fairness Act", but the enacted 118th Congress version was **H.R. 82**. "RESTRICT Act (TikTok Ban)" and "Responsible AI & Innovation Act" are editorialized or unverified titles. The 20,420 bulk rows also have `congress = NULL`.

### C8. FEC committee matching is fuzzy
`collect_fec.py` searches `/committees/?q=<donor name>` and keeps the top 2 results:
- Bill & Melinda Gates Foundation → "1980 Committee to Re-elect Congressman Bill Green"
- MacArthur Foundation → "2008 Draft Sen John Edwards for Labor President"
- Apple Inc. → "Applejam Inc" and "Appleton Papers PAC"
- Microsoft → "Committee to Fight Microsoft Corp"

Foundations cannot have PACs, so they should never be searched. The query is also driven by the fake donor list.

### C9. Security: live keys remain in git history
Commit `7cd9b31` removed FEC, Senate LDA, NYT (key and secret) and OpenRouter keys from `CLAUDE.md`, but the repo is public, so they are still readable in history. **Rotate all four today.** Then rewrite history with `git filter-repo` or accept the leak once the keys are dead.

### C10. Labeling gaps in the UI
Donor and summary sections carry badges, but individual policy papers and influence links do not, so a visitor reads them as sourced. The "Bipartisan/Globalist" and "Establishment" leans are editorial labels with no source.

## 3. Fix plan

### Phase 0: Stop the bleeding (1 day)
1. Rotate the FEC, LDA, NYT and OpenRouter keys (C9).
2. Correct the two EINs in `seed.py` and re-run the ProPublica collector (C2).
3. Hide from the UI: all `seeded_demo` rows, all `ai_generated` links, and all media-amplifier verdicts.
4. Add a per-item provenance badge to `PolicyPaperCard` and to influence-link rows (C10).

### Phase 1: Fix correlation (the root cause)
**Bill matching:** parse the ID into a structured key, require an exact match, and verify the title.
```python
import re
from difflib import SequenceMatcher

TYPES = {"HR":"HR","S":"S","HRES":"HRES","SRES":"SRES","HJRES":"HJRES",
         "SJRES":"SJRES","HCONRES":"HCONRES","SCONRES":"SCONRES"}

def parse_bill(raw: str):
    s = re.sub(r"[\s.]", "", raw.upper())
    m = re.fullmatch(r"(HCONRES|SCONRES|HJRES|SJRES|HRES|SRES|HR|S)(\d+)", s)
    return (TYPES[m.group(1)], int(m.group(2))) if m else None

def find_bill(cur, raw_id, claimed_title, congresses=(117, 118)):
    key = parse_bill(raw_id)
    if not key:
        return None                      # no FTS guessing, ever
    btype, num = key
    for c in congresses:
        row = cur.execute("SELECT id, bill_id, title FROM legislation WHERE bill_id = ?",
                          (f"{c}-{btype}-{num}",)).fetchone()
        if row and SequenceMatcher(None, claimed_title.lower(), row[2].lower()).ratio() >= 0.6:
            return row
    return None                          # log as unmatched; do not link
```
Also ask the model for `congress` explicitly, and backfill `legislation.congress` from the `bill_id` prefix.

**Donor → think tank links:** use the real `donors.id` as `source_id` and add a foreign-key constraint so that dangling links become impossible.

**FEC:** match on committee `connected_organization_name` or an explicit hand-verified mapping table of `donor_id → fec_committee_id`, and skip foundations and individuals.

### Phase 2: Replace demo data with real sources (your chosen direction)
| Data | Real source | Notes |
|---|---|---|
| Donors | Each think tank's published donor lists and annual reports (the Atlantic Council honor roll, Brookings, CFR and CAP annual reports) | Store `amount_min` / `amount_max` ranges plus `source_url`, never point amounts. Heritage and Cato do not publish lists, so show "not disclosed" |
| Foreign government funding | FARA eFile API (efile.fara.gov) plus the think tanks' own foreign-government disclosures | Link by registrant or foreign principal ID |
| U.S. government funding | USAspending.gov API, searching awards by recipient UEI | Replaces "U.S. State Department $3.2M" |
| Lobbying | Senate LDA API (lda.senate.gov/api), queried by registrant or client | Most 501(c)(3)s file nothing, and that is a real, correct result. Heritage Action is a separate 501(c)(4) and should be its own entity |
| Grants received | 990 Schedule I of **other** foundations' filings (e.g. the Gates, Hewlett and MacArthur 990-PFs list grantees by name) | This is the best public route to real donor→think tank dollar amounts |
| Policy papers | Each think tank's site (sitemap or RSS), or congressional testimony via GovInfo CHRG / congress.gov committee documents | Titles and URLs come from the source, not the model |

### Phase 3: Constrain the LLM to verification, not discovery
1. **Remove the quota.** Say "Return an empty array if you cannot cite a source for a paper."
2. Require `paper_url` for every paper, then **validate it**: HTTP 200, the domain belongs to the think tank or congress.gov/govinfo.gov, and the page title fuzzy-matches the claimed title. Reject failures.
3. Store the citation per paper, not per batch.
4. Better still, invert the flow. Scrape real papers first, then ask the model only to classify the relationship between a **given** paper text and a **given** bill text, and store the quoted passage as evidence.
5. Drop model-reported "confidence" from the UI. If you want a score, compute it from checkable signals (URL verified, bill number exact, quoted passage found in the bill text).
6. Regenerate verdicts only from verified rows, and never for individual people.

### Phase 4: Guardrails so this cannot recur
- A CI test that fails if any `influence_links.source_id` or `target_id` does not resolve.
- A CI test that re-verifies every EIN name against ProPublica.
- Unique constraints on `(entity_id, lower(title))` for papers.
- `seed_*.py` scripts move to `scripts/demo/` and refuse to run against the production DB path.

## 4. Additional findings from the site-wide pass

### A1. "Verified" 990 data mislabels total assets as net assets (all 51 rows)
`data-pipeline/src/collectors/propublica.py:49` maps `net_assets = filing['totassetsend']`. That field is **total assets**; net assets is `totnetassetend`. Every net-asset figure on the site is therefore overstated by the organization's liabilities. Heritage FY2022, for example, shows $387.7M when the correct figure is $332.0M. `executive_compensation` is hard-coded to `None`, even though `compnsatncurrofcr` is present in the raw filing ($5.94M for Heritage FY2022).
**Fix:** use `totnetassetend`, populate compensation from `compnsatncurrofcr`, and re-run the collector.

### A2. The Analysis scorecard double counts and rewards omnibus bills
The "Laws" column counts **link rows**, not distinct bills. Brookings shows "11 laws", but those are only 6 distinct laws, because the IRA is counted 3 times, the FY2023 NDAA 3 times (one of them through a mismatched link) and CHIPS twice. Most of the counted "successes" are must-pass vehicles (NDAAs, consolidated appropriations, the American Rescue Plan), and those become law whatever any think tank publishes. As a result, the ranking measures which organization wrote about omnibus bills, not which one had influence.
**Fix:** count `DISTINCT l.id`, and exclude appropriations and NDAA vehicles, or report them separately.

### A3. The Analysis page shows fabricated evidence as quoted "influence chains"
Several items under "Notable Influence Chains" come straight from the hand-typed seed text and read as documented facts:
- "cited in NDAA FY2024 conference report" (Atlantic Council)
- "3 of 5 bill co-sponsors" cited Brookings on S.2355
- CAP's "9 million new jobs" projection
- "74% language overlap" (Heritage)

None of these has a source.
**Fix:** remove every seeded evidence string from the UI.

### A4. Invented papers attributed to real organizations (highest reputational risk)
The seed script created papers these organizations never published, including self-critical ones. The URLs are guesses as well:
- Cato, "Koch Network Independence Audit: 2023 Assessment" (`cato.org/blog/independence`)
- Brookings, "The Qatar Connection: Foreign Funding and Think Tank Independence"
- CFR, "The Carlyle Connection: Private Equity and Foreign Policy"
- CFR, "Technology Competition with China: A Strategic Framework"
- Heritage, "Unleashing American Energy..." (URL is only a topic landing page)
- Atlantic Council, "NATO 2030+..." and "Digital Sovereignty and Platform Governance" (URLs are program pages)

These are also mislabeled `ai_generated` when they were hand-typed.
**Fix:** delete all 12 seeded papers.

### A5. Perplexity paper quality across all six think tanks
- **No URL:** 53 of 125. CFR is the worst, with 18 of 21 lacking a URL. Most of its titles are generic enough to be invented ("China Competition and Global Governance", "Revitalizing U.S. Foreign Aid").
- **Wrong author or wrong type:**
  - "Federal Reserve: Policy Issues in the 118th Congress" is a CRS report (everycrsreport.com), not Brookings.
  - "Strategic Posture Commission Report" (ida.org) is not an Atlantic Council paper.
  - Heritage "No Taxpayer Funding for Abortion Act" is a bill, not a paper.
  - A Brookings "Statement ... Before the Senate Foreign Relations Committee" links to a House document.
- **Reused URLs:** different "papers" share one URL:
  - All 7 Atlantic Council "Testimony on..." entries point to the RSS feed `/category/commentary/testimony/feed/`.
  - Heritage's "Siljander Amendment Policy Memo" and "Livingston Amendment Recommendations" reuse other reports' URLs.
  - CFR's "Women, Peace, and Security" reuses the "Women in the 118th Congress" URL.
  - CAP's ICE/CBP entry is just the homepage.
- **Out of scope:**
  - Brookings "Policy Brief #118" (2007, insider trading) matched only because of the number "118".
  - Two Heritage papers dated 2025-11 fall outside the 117th–118th window the prompt requested.
- **Duplicates:** in addition to the Atlantic Council pairs, Heritage has "Pro-Life Progress Report for the 118th Congress" twice and "Mandate for Leadership" twice. Brookings has 3 exact duplicates, and CAP has "Climate Deniers of the 118th Congress" as both an article and a press release.

### A6. Grants page problems
- It cites **USAspending.gov** as a data source, but the `govt_contracts` table has **0 rows**.
- "Average grant dependency 80%" averages different fiscal years (Heritage FY2022, Cato FY2024, and the others FY2023) and silently drops CAP and the Atlantic Council because of the EIN bug.
- "Top donors identified: 15", along with the Gates $8M, Qatar $14.8M and ExxonMobil $3M figures, all come from demo data.

### A7. Heritage page: lobbying attributed to the wrong entity
The $2.1M and $850K lobbying rows name **Heritage Action for America**, a separate 501(c)(4), yet they display under the Heritage Foundation. Even once real LDA data replaces them, they belong to a separate entity linked as an affiliate.

### A8. Heritage page: the donor list and "Dark Money" label
"Donors Trust (Dark Money)" and "DeVos Family Foundation (Education / MLM)" are editorial industry labels on invented amounts. Replace them with neutral categories ("Donor-advised fund", "Family foundation").
