import { getDb } from "@/lib/db";
import { StatList } from "@/components/ui";
import type { VerdictRow } from "@/lib/rows";
import { Entity, Financial, Donor, InfluenceLink, PolicyPaper, Lobbying } from "@/lib/types";
import FinancialBreakdown from "@/components/FinancialBreakdown";
import { Building2, AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import AIVerdictCard from "@/components/AIVerdictCard";
import PolicyPaperCard from "@/components/PolicyPaperCard";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = getDb()
    .prepare("SELECT name, description FROM entities WHERE slug = ?")
    .get(slug) as { name: string; description: string | null } | undefined;
  if (!row) return { title: "Not found" };
  return {
    title: row.name,
    description:
      row.description ??
      `Funding, policy output and legislative links tracked for ${row.name}.`,
  };
}

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

// Strength is a magnitude, not a judgement. The previous ramp ran green (weak)
// to red (strong), which inverted the bill-status palette where green means
// enacted and red means failed. One neutral ramp removes that contradiction.
function strengthBar(strength: number | null) {
  const pct = Math.max(0, Math.min(100, Math.round((strength ?? 0) * 100)));
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-24 h-1.5 rounded-sm bg-surface-sunken overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted tnum">{pct}%</span>
    </div>
  );
}

export default async function ThinkTankProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const db = getDb();

  const entity = db.prepare("SELECT * FROM entities WHERE slug = ?").get(resolvedParams.slug) as Entity | undefined;
  if (!entity) return notFound();

  const financials = db.prepare("SELECT * FROM financials WHERE entity_id = ? ORDER BY fiscal_year ASC").all(entity.id) as Financial[];
  const donors = db.prepare("SELECT * FROM donors WHERE entity_id = ? AND (provenance IS NULL OR provenance != 'seeded_demo') ORDER BY amount DESC").all(entity.id) as Donor[];
  const policyPapers = db.prepare("SELECT * FROM policy_papers WHERE entity_id = ? ORDER BY published_date DESC").all(entity.id) as PolicyPaper[];
  const lobbying = db.prepare("SELECT * FROM lobbying WHERE client_entity_id = ? AND (provenance IS NULL OR provenance != 'seeded_demo') ORDER BY filing_year DESC").all(entity.id) as Lobbying[];

  const verdictRow = db.prepare("SELECT * FROM analysis_verdicts WHERE target_id = ?")
    .get(entity.id) as VerdictRow | undefined;
  
  const aiInfo = verdictRow ? {
    verdict: verdictRow.verdict,
    reasoning: verdictRow.reasoning,
    evidenceSummary: verdictRow.evidence_summary,
    confidence: verdictRow.confidence,
    modelUsed: verdictRow.model_used
  } : null;

  // Get influence links where this entity is the source
  const influenceLinks = db.prepare(`
    SELECT il.*, l.title as leg_title, l.bill_id, l.status as leg_status
    FROM influence_links il
    LEFT JOIN legislation l ON il.target_id = l.id
    WHERE il.source_id = ? AND il.source_type = 'think_tank'
      AND (il.provenance IS NULL OR il.provenance NOT IN ('seeded_demo', 'ai_generated'))
    ORDER BY il.strength DESC
  `).all(entity.id) as (InfluenceLink & { leg_title?: string; bill_id?: string; leg_status?: string })[];

  const totalDonorAmount = donors.reduce((sum, d) => sum + (d.amount || 0), 0);
  const foreignDonors = donors.filter(d => d.is_foreign_govt);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-md p-5">
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="p-6 bg-surface-sunken rounded-md">
            <Building2 className="w-16 h-16 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{entity.name}</h1>
              {entity.lean && (
                <span className="px-3 py-1 bg-surface-sunken rounded-full text-sm font-medium">{entity.lean}</span>
              )}
            </div>
            <p className="text-xl text-muted max-w-3xl">{entity.description || 'Tracked nonprofit policy organization.'}</p>
            <div className="flex gap-6 mt-4 text-sm text-muted flex-wrap">
              {entity.ein && <div><span className="font-bold text-foreground">EIN:</span> {entity.ein}</div>}
              <div><span className="font-bold text-foreground">Entity Type:</span> Think Tank</div>
              <div><span className="font-bold text-foreground">Tracked Donors:</span> {donors.length}</div>
            </div>
          </div>
        </div>
      </div>

      <StatList
        items={[
          { label: "Tracked donations", value: formatDollar(totalDonorAmount), hint: "demo data" },
          { label: "Influence links", value: influenceLinks.length },
          { label: "Policy papers", value: policyPapers.length },
          { label: "Foreign gov't donors", value: foreignDonors.length },
        ]}
      />

      {aiInfo && <AIVerdictCard info={aiInfo} />}

      {/* ── Financial + Donors Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <FinancialBreakdown financials={financials} />

        {/* Donors List */}
        <div className="bg-surface border border-border rounded-md p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Top Donors
          </h3>
          {donors.length === 0 ? (
            <div className="text-muted italic flex items-center justify-center h-48 border border-dashed border-border rounded-sm">
              No donor data available.
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-2">
              {donors.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <span className="font-semibold text-foreground truncate">{d.donor_name}</span>
                      {d.is_foreign_govt === 1 && (
                        <span className="px-1.5 py-0.5 bg-failed-wash text-failed text-2xs font-bold rounded-md uppercase tracking-wider">Foreign</span>
                      )}
                    </div>
                    <div className="text-xs text-muted mt-1 flex gap-3">
                      <span>{d.industry}</span>
                      {d.year && <span>({d.year})</span>}
                      <span className="text-muted">{d.source}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-accent text-lg">{formatDollar(d.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Policy papers ─────────────────────────────────────────── */}
      {policyPapers.length > 0 && (
        <div className="bg-surface border border-border rounded-md p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Policy papers
            <span className="text-sm font-normal text-muted">({policyPapers.length})</span>
          </h3>
          <p className="text-sm text-muted mb-4">Click any title to read the summary.</p>
          <div className="flex flex-col gap-3">
            {policyPapers.map(p => (
              <PolicyPaperCard
                key={p.id}
                title={p.title}
                summary={p.summary}
                publishedDate={p.published_date}
                topicTags={p.topic_tags}
                url={p.url}
                provenance={p.provenance}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Influence links → Legislation ─────────────────────────── */}
      {influenceLinks.length > 0 && (
        <div className="bg-surface border border-border rounded-md p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Influence on Legislation
          </h3>
          <div className="flex flex-col gap-4">
            {influenceLinks.map(link => (
              <div key={link.id} className="p-4 rounded-sm bg-surface-sunken border-l-4 border-l-yellow-500/50">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md uppercase tracking-wider ${
                        link.link_type === 'advocates_for' ? 'bg-enacted-wash text-enacted' :
                        link.link_type === 'opposes' ? 'bg-failed-wash text-failed' :
                        'bg-surface-sunken text-muted'
                      }`}>
                        {link.link_type?.replace("_", " ")}
                      </span>
                      <h4 className="font-semibold text-foreground">{link.leg_title || "Unknown Bill"}</h4>
                    </div>
                    <div className="flex gap-3 text-xs text-muted mb-2">
                      {link.bill_id && <span className="font-mono">{link.bill_id}</span>}
                      {link.leg_status && <span className="px-1.5 py-0.5 bg-surface-sunken rounded text-muted">{link.leg_status}</span>}
                      {link.year && <span>{link.year}</span>}
                    </div>
                    <p className="text-sm text-muted leading-relaxed">{link.evidence}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted">Confidence</span>
                    {strengthBar(link.strength)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lobbying Activity ──────────────────────────────────────── */}
      {lobbying.length > 0 && (
        <div className="bg-surface border border-border rounded-md p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Lobbying Disclosures
          </h3>
          <div className="flex flex-col gap-3">
            {lobbying.map(lob => (
              <div key={lob.id} className="p-4 rounded-sm bg-surface-sunken flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-bold bg-surface-sunken rounded-md text-muted">{lob.issue_code}</span>
                    <span className="font-semibold text-foreground">{lob.registrant_name}</span>
                  </div>
                  <p className="text-sm text-muted">{lob.issue_description}</p>
                  <span className="text-xs text-muted mt-1 block">{lob.filing_year} • {lob.filing_period}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-accent text-lg">{formatDollar(lob.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Foreign Funding Warning ────────────────────────────────── */}
      {foreignDonors.length > 0 && (
        <div className="rounded-md p-6 bg-failed-wash border border-failed/25">
          <h3 className="text-lg font-bold text-demo flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            Foreign government funding
          </h3>
          <p className="text-sm text-muted mb-2">
            {foreignDonors.length} donor row(s) in this prototype are flagged as foreign
            government sources. These rows are hand-authored demonstration data, not filings.
          </p>
          <p className="text-sm text-muted mb-4">
            This is not a statement that this organization is registered under, or required to
            register under, the Foreign Agents Registration Act. No FARA filing has been
            retrieved or checked by this project. See{" "}
            <Link href="/methodology" className="text-accent underline">methodology</Link>.
          </p>
          <div className="flex flex-col gap-2">
            {foreignDonors.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-sm bg-demo-wash">
                <span className="font-semibold text-demo">{d.donor_name}</span>
                <span className="font-bold text-demo">{formatDollar(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Back link ──────────────────────────────────────────────── */}
      <div className="mt-4">
        <Link href="/" className="text-accent hover:underline">← Back to all think tanks</Link>
      </div>
    </div>
  );
}
