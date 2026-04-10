from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime, date

class EntityModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    name: str
    slug: str
    type: str # 'think_tank', 'media_amplifier', 'politician', 'donor'
    ein: Optional[str] = None
    lean: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    metadata: Dict = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class FinancialModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    entity_id: str
    fiscal_year: int
    total_revenue: Optional[int] = None
    total_expenses: Optional[int] = None
    net_assets: Optional[int] = None
    executive_compensation: Optional[List[Dict]] = None
    program_revenue: Optional[int] = None
    contributions_and_grants: Optional[int] = None
    investment_income: Optional[int] = None
    raw_990: Optional[Dict] = None

class DonorModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    entity_id: str
    donor_name: str
    donor_entity_id: Optional[str] = None
    amount: Optional[int] = None
    year: Optional[int] = None
    source: Optional[str] = None # 'irs_990', 'opensecrets', 'manual'
    industry: Optional[str] = None
    is_foreign_govt: bool = False
    metadata: Dict = {}

class PolicyPaperModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    entity_id: str
    title: str
    url: Optional[str] = None
    published_date: Optional[date] = None
    topic_tags: Optional[List[str]] = None
    summary: Optional[str] = None
    embedding: Optional[List[float]] = None
    metadata: Dict = {}

class LegislationModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    bill_id: Optional[str] = None
    title: Optional[str] = None
    congress: Optional[int] = None
    chamber: Optional[str] = None
    status: Optional[str] = None
    sponsor_id: Optional[str] = None
    topic_tags: Optional[List[str]] = None
    summary: Optional[str] = None
    introduced_date: Optional[date] = None
    metadata: Dict = {}

class InfluenceLinkModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    link_type: Optional[str] = None
    strength: Optional[float] = None
    evidence: Optional[str] = None
    year: Optional[int] = None
    metadata: Dict = {}

class LobbyingModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    client_name: str
    client_entity_id: Optional[str] = None
    registrant_name: Optional[str] = None
    issue_code: Optional[str] = None
    issue_description: Optional[str] = None
    amount: Optional[int] = None
    filing_year: Optional[int] = None
    filing_period: Optional[str] = None
    metadata: Dict = {}

class GovtContractModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    recipient_name: str
    recipient_entity_id: Optional[str] = None
    agency: Optional[str] = None
    amount: Optional[int] = None
    fiscal_year: Optional[int] = None
    naics_code: Optional[str] = None
    description: Optional[str] = None
    contract_type: Optional[str] = None
    metadata: Dict = {}

class MediaCoverageModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    entity_id: str
    headline: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    published_date: Optional[date] = None
    mentions_policy_id: Optional[str] = None
    sentiment: Optional[float] = None
    summary: Optional[str] = None
    metadata: Dict = {}

class AnalysisVerdictModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[str] = None
    entity_id: str
    verdict: str
    confidence: Optional[float] = None
    reasoning: Optional[str] = None
    evidence_summary: Optional[str] = None
    generated_at: Optional[datetime] = None
    model_used: str = 'minimax/highspeed'
