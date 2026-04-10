import { getDb } from "@/lib/db";
import { Entity, Financial, Donor, InfluenceLink, Legislation, PolicyPaper, Lobbying } from "@/lib/types";
import FinancialBreakdown from "@/components/FinancialBreakdown";
import { Building2, DollarSign, AlertTriangle, Scale, Globe, FileText, Link2, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

function strengthBar(strength: number | null) {
  const s = strength ?? 0;
  const pct = Math.round(s * 100);
  const color = s >= 0.85 ? "bg-red-500" : s >= 0.6 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-24 h-2 rounded-full bg-card-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted">{pct}%</span>
    </div>
  );
}

export default async function ThinkTankProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const db = getDb();

  const entity = db.prepare("SELECT * FROM entities WHERE slug = ?").get(resolvedParams.slug) as Entity | undefined;
  if (!entity) return notFound();

  const financials = db.prepare("SELECT * FROM financials WHERE entity_id = ? ORDER BY fiscal_year ASC").all(entity.id) as Financial[];
  const donors = db.prepare("SELECT * FROM donors WHERE entity_id = ? ORDER BY amount DESC").all(entity.id) as Donor[];
  const policyPapers = db.prepare("SELECT * FROM policy_papers WHERE entity_id = ? ORDER BY published_date DESC").all(entity.id) as PolicyPaper[];
  const lobbying = db.prepare("SELECT * FROM lobbying WHERE client_entity_id = ? ORDER BY filing_year DESC").all(entity.id) as Lobbying[];

  // Get influence links where this entity is the source
  const influenceLinks = db.prepare(`
    SELECT il.*, l.title as leg_title, l.bill_id, l.status as leg_status
    FROM influence_links il
    LEFT JOIN legislation l ON il.target_id = l.id
    WHERE il.source_id = ? AND il.source_type = 'think_tank'
    ORDER BY il.strength DESC
  `).all(entity.id) as (InfluenceLink & { leg_title?: string; bill_id?: string; leg_status?: string })[];

  const totalDonorAmount = donors.reduce((sum, d) => sum + (d.amount || 0), 0);
  const foreignDonors = donors.filter(d => d.is_foreign_govt);
  const latestFinancial = financials.length > 0 ? financials[financials.length - 1] : null;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="glass p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-yellow-500 to-red-500" />
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="p-6 bg-card-border/50 rounded-xl">
            <Building2 className="w-16 h-16 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <h1 className="text-4xl font-extrabold">{entity.name}</h1>
              {entity.lean && (
                <span className="px-3 py-1 bg-card-border rounded-full text-sm font-medium">{entity.lean}</span>
              )}
            </div>
            <p className="text-xl text-muted max-w-3xl">{entity.description || 'Tracked nonprofit policy organization.'}</p>
            <div className="flex gap-6 mt-4 text-sm text-muted flex-wrap">
              {entity.ein && <div><span className="font-bold text-white">EIN:</span> {entity.ein}</div>}
              <div><span className="font-bold text-white">Entity Type:</span> Think Tank</div>
              <div><span className="font-bold text-white">Tracked Donors:</span> {donors.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-xl text-center">
          <DollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">{formatDollar(totalDonorAmount)}</div>
          <div className="text-xs text-muted mt-1">Total Tracked Donations</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <Scale className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{influenceLinks.length}</div>
          <div className="text-xs text-muted mt-1">Influence Links</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-bold">{policyPapers.length}</div>
          <div className="text-xs text-muted mt-1">Policy Papers</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          {foreignDonors.length > 0 ? (
            <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          ) : (
            <Globe className="w-6 h-6 text-green-500 mx-auto mb-2" />
          )}
          <div className="text-2xl font-bold">{foreignDonors.length}</div>
          <div className="text-xs text-muted mt-1">Foreign Gov't Donors</div>
        </div>
      </div>

      {/* ── Financial + Donors Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <FinancialBreakdown financials={financials} />

        {/* Donors List */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Top Donors
          </h3>
          {donors.length === 0 ? (
            <div className="text-muted italic flex items-center justify-center h-48 border border-dashed border-card-border rounded-lg">
              No donor data available.
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-2">
              {donors.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-card-border/30 hover:bg-card-border/50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <span className="font-semibold text-white truncate">{d.donor_name}</span>
                      {d.is_foreign_govt === 1 && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-md uppercase tracking-wider">Foreign</span>
                      )}
                    </div>
                    <div className="text-xs text-muted mt-1 flex gap-3">
                      <span>{d.industry}</span>
                      {d.year && <span>({d.year})</span>}
                      <span className="text-primary/60">{d.source}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary text-lg">{formatDollar(d.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Policy Papers ─────────────────────────────────────────── */}
      {policyPapers.length > 0 && (
        <div className="glass p-6 rounded-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Key Policy Papers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policyPapers.map(p => (
              <div key={p.id} className="p-4 rounded-lg bg-card-border/30 hover:bg-card-border/50 transition-colors">
                <h4 className="font-semibold text-white mb-2 leading-tight">{p.title}</h4>
                <p className="text-sm text-muted line-clamp-3 mb-3">{p.summary}</p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{p.published_date}</span>
                  <div className="flex gap-1 flex-wrap">
                    {p.topic_tags?.split(",").map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md">{tag.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Influence Links → Legislation ─────────────────────────── */}
      {influenceLinks.length > 0 && (
        <div className="glass p-6 rounded-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-yellow-500" />
            Influence on Legislation
          </h3>
          <div className="flex flex-col gap-4">
            {influenceLinks.map(link => (
              <div key={link.id} className="p-4 rounded-lg bg-card-border/30 border-l-4 border-l-yellow-500/50">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md uppercase tracking-wider ${
                        link.link_type === 'advocates_for' ? 'bg-green-500/20 text-green-400' :
                        link.link_type === 'opposes' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {link.link_type?.replace("_", " ")}
                      </span>
                      <h4 className="font-semibold text-white">{link.leg_title || "Unknown Bill"}</h4>
                    </div>
                    <div className="flex gap-3 text-xs text-muted mb-2">
                      {link.bill_id && <span className="font-mono">{link.bill_id}</span>}
                      {link.leg_status && <span className="px-1.5 py-0.5 bg-card-border rounded text-muted">{link.leg_status}</span>}
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
        <div className="glass p-6 rounded-xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Lobbying Disclosures
          </h3>
          <div className="flex flex-col gap-3">
            {lobbying.map(lob => (
              <div key={lob.id} className="p-4 rounded-lg bg-card-border/30 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-bold bg-card-border rounded-md text-muted">{lob.issue_code}</span>
                    <span className="font-semibold text-white">{lob.registrant_name}</span>
                  </div>
                  <p className="text-sm text-muted">{lob.issue_description}</p>
                  <span className="text-xs text-muted mt-1 block">{lob.filing_year} • {lob.filing_period}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary text-lg">{formatDollar(lob.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Foreign Funding Warning ────────────────────────────────── */}
      {foreignDonors.length > 0 && (
        <div className="rounded-xl p-6 bg-red-500/5 border border-red-500/20">
          <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            Foreign Government Funding Alert
          </h3>
          <p className="text-sm text-muted mb-4">
            This think tank receives funding from {foreignDonors.length} foreign government source(s). Foreign funding of U.S. policy organizations
            is tracked under FARA (Foreign Agents Registration Act) and raises potential conflicts of interest in domestic policy advocacy.
          </p>
          <div className="flex flex-col gap-2">
            {foreignDonors.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                <span className="font-semibold text-red-300">{d.donor_name}</span>
                <span className="font-bold text-red-400">{formatDollar(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Back link ──────────────────────────────────────────────── */}
      <div className="mt-4">
        <Link href="/" className="text-primary hover:underline">← Back to all think tanks</Link>
      </div>
    </div>
  );
}
