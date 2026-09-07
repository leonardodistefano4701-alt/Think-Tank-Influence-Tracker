/**
 * Row shapes for the joined queries the pages actually run.
 *
 * lib/types.ts describes the base tables, but every page does `SELECT *` with
 * joins and then asserts `as any[]`, so nothing described the real shape and
 * `strict: true` bought us nothing at the one boundary that mattered.
 *
 * These are still assertions, not runtime validation — better-sqlite3 returns
 * `unknown` and we do not parse. But they document the shape, catch typos, and
 * make nullability explicit, which the previous interfaces actively got wrong
 * (several nullable columns were typed as plain `string`).
 */

/** A value read back from SQLite. */
export type SqlValue = string | number | bigint | Buffer | null;

/** Any row whose columns we haven't enumerated. Use instead of `any`. */
export type UnknownRow = Record<string, SqlValue | undefined>;

export type Provenance = "verified_filing" | "seeded_demo" | "ai_generated" | null;

export interface VerdictRow {
  id: string;
  target_type: string | null;
  target_id: string | null;
  verdict: string | null;
  confidence: number | null;
  reasoning: string | null;
  evidence_summary: string | null;
  model_used: string | null;
  provenance?: Provenance;
}

export interface DonationRow {
  id: string;
  entity_id: string | null;
  donor_name: string | null;
  amount: number | null;
  year: number | null;
  source: string | null;
  industry: string | null;
  is_foreign_govt: number | null;
  provenance?: Provenance;
  tank_name: string | null;
  tank_slug: string | null;
  lean?: string | null;
}

export interface InfluenceLinkRow {
  id: string;
  source_type: string | null;
  source_id: string | null;
  target_type: string | null;
  target_id: string | null;
  link_type: string | null;
  strength: number | null;
  evidence: string | null;
  provenance?: Provenance;
  /** Present when the query resolves the endpoints by name. */
  source_name?: string | null;
  target_name?: string | null;
}

/** influence_link joined to the policy paper it targets. */
export interface PaperLinkRow extends InfluenceLinkRow {
  paper_title: string | null;
  published_date: string | null;
  paper_url: string | null;
  paper_summary: string | null;
  tank_name: string | null;
  tank_slug: string | null;
  tank_lean?: string | null;
}

/** influence_link joined to the legislation it targets. */
export interface LegislationLinkRow extends InfluenceLinkRow {
  leg_id: string | null;
  leg_title: string | null;
  bill_id: string | null;
  leg_status: string | null;
  /** Present when the query also selects the bill's own columns. */
  title?: string | null;
  summary?: string | null;
  paper_title?: string | null;
}

export interface PolicyPaperRow {
  id: string;
  entity_id: string | null;
  title: string | null;
  summary: string | null;
  url: string | null;
  published_date: string | null;
  topic_tags: string | null;
  provenance?: Provenance;
  /** Present when joined to the publishing entity. */
  tank_name?: string | null;
  tank_slug?: string | null;
}

export interface LegislationRow {
  id: string;
  bill_id: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  chamber: string | null;
  congress: number | null;
  introduced_date: string | null;
  policy_area?: string | null;
  latest_action?: string | null;
  metadata?: string | null;
  provenance?: Provenance;
}

export interface LobbyingRow {
  id: string;
  entity_id: string | null;
  registrant_name: string | null;
  client_name: string | null;
  amount: number | null;
  year: number | null;
  issue_areas: string | null;
  issue_description?: string | null;
  provenance?: Provenance;
  tank_name?: string | null;
  tank_slug?: string | null;
}

export interface GrantRow {
  id?: string;
  entity_id?: string | null;
  name?: string | null;
  slug?: string | null;
  total_revenue: number | null;
  contributions_and_grants: number | null;
  fiscal_year?: number | null;
  provenance?: Provenance;
  tank_name?: string | null;
  tank_slug?: string | null;
}

/** Aggregated donor totals shown on the grants page. */
export interface DonorAggregateRow {
  donor_name: string | null;
  industry: string | null;
  total_given: number | null;
  tanks_funded: number | null;
  latest_year: number | null;
}

/** A federal contract row. The govt_contracts table is currently empty. */
export interface ContractRow {
  id?: string | null;
  recipient_name?: string | null;
  entity_id?: string | null;
  amount: number | null;
  agency?: string | null;
  description?: string | null;
  fiscal_year?: number | null;
  tank_name?: string | null;
}

/** Parsed legislation.metadata JSON. */
export interface LegislationMeta {
  sponsors?: string;
  cosponsors_count?: number;
  committees?: string;
  policy_area?: string;
  govinfo_url?: string;
  congress_session?: string;
  recent_actions?: unknown;
  action_count?: number;
  status_source?: string;
}
