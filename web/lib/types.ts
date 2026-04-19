export interface Entity {
  id: string;
  name: string;
  slug: string;
  type: string;
  ein: string | null;
  lean: string | null;
  description: string | null;
  image_url: string | null;
  metadata: string; // JSON holding extra state
  created_at: string;
  updated_at: string;
}

export interface Financial {
  id: string;
  entity_id: string;
  fiscal_year: number;
  total_revenue: number | null;
  total_expenses: number | null;
  net_assets: number | null;
  executive_compensation: string | null; // JSON
  program_revenue: number | null;
  contributions_and_grants: number | null;
  investment_income: number | null;
}

export interface MediaCoverage {
  id: string;
  entity_id: string;
  headline: string;
  source: string;
  url: string;
  published_date: string;
  summary: string;
}

export interface Donor {
  id: string;
  entity_id: string;
  donor_name: string;
  donor_entity_id: string | null;
  amount: number | null;
  year: number | null;
  source: string | null;
  industry: string | null;
  is_foreign_govt: number;
  metadata: string;
}

export interface Legislation {
  id: string;
  bill_id: string;
  title: string;
  congress: number | null;
  chamber: string | null;
  status: string | null;
  sponsor_id: string | null;
  topic_tags: string | null;
  summary: string | null;
  introduced_date: string | null;
  metadata: string;
  policy_area: string | null;
  latest_action: string | null;
}

export interface InfluenceLink {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  link_type: string | null;
  strength: number | null;
  evidence: string | null;
  year: number | null;
}

export interface Lobbying {
  id: string;
  client_name: string;
  client_entity_id: string | null;
  registrant_name: string | null;
  issue_code: string | null;
  issue_description: string | null;
  amount: number | null;
  filing_year: number | null;
  filing_period: string | null;
}

export interface PolicyPaper {
  id: string;
  entity_id: string;
  title: string;
  url: string | null;
  published_date: string | null;
  topic_tags: string | null;
  summary: string | null;
}
