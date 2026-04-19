import { getDb } from "@/lib/db";
import { Entity, Donor, InfluenceLink, Financial } from "@/lib/types";
import Link from "next/link";
import CompareSelector from "@/components/CompareSelector";
import { ChevronRight, FileText, Scale } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

interface TankStats {
  entity: Entity;
  totalDonations: number;
  donorCount: number;
  foreignDonorCount: number;
  foreignAmount: number;
  influenceCount: number;
  avgStrength: number;
  policyPaperCount: number;
  lobbyingAmount: number;
  latestRevenue: number | null;
  topDonor: string;
  topDonorAmount: number;
  detailedLegislation: any[];
  detailedDonors: any[];
}

function getStats(db: any, entity: Entity): TankStats {
  const donors = db.prepare("SELECT * FROM donors WHERE entity_id = ? ORDER BY amount DESC").all(entity.id) as Donor[];
  const links = db.prepare("SELECT * FROM influence_links WHERE source_id = ? AND source_type = 'think_tank'").all(entity.id) as InfluenceLink[];
  const paperCount = db.prepare("SELECT COUNT(*) as cnt FROM policy_papers WHERE entity_id = ?").get(entity.id) as { cnt: number };
  const lobbyTotal = db.prepare("SELECT SUM(amount) as total FROM lobbying WHERE client_entity_id = ?").get(entity.id) as { total: number | null };
  const latestFinancial = db.prepare("SELECT total_revenue FROM financials WHERE entity_id = ? ORDER BY fiscal_year DESC LIMIT 1").get(entity.id) as { total_revenue: number } | undefined;

  // Complex query to get actual legislation targeted by this think tank via its papers
  const legTargets = db.prepare(`
    SELECT l.id, l.title, l.bill_id, l.summary, il.link_type, pp.title as paper_title
    FROM influence_links il
    JOIN legislation l ON il.target_id = l.id
    JOIN policy_papers pp ON il.source_id = pp.id AND il.source_type = 'policy_paper'
    WHERE pp.entity_id = ? AND il.target_type = 'legislation'
    GROUP BY l.id
    ORDER BY il.strength DESC LIMIT 5
  `).all(entity.id) as any[];

  const foreignDonors = donors.filter(d => d.is_foreign_govt === 1);
  const totalDonations = donors.reduce((s, d) => s + (d.amount || 0), 0);
  const avgStrength = links.length > 0 ? links.reduce((s, l) => s + (l.strength || 0), 0) / links.length : 0;

  return {
    entity,
    totalDonations,
    donorCount: donors.length,
    foreignDonorCount: foreignDonors.length,
    foreignAmount: foreignDonors.reduce((s, d) => s + (d.amount || 0), 0),
    influenceCount: links.length,
    avgStrength,
    policyPaperCount: paperCount.cnt,
    lobbyingAmount: lobbyTotal.total || 0,
    latestRevenue: latestFinancial?.total_revenue || null,
    topDonor: donors[0]?.donor_name || "—",
    topDonorAmount: donors[0]?.amount || 0,
    detailedLegislation: legTargets,
    detailedDonors: donors.slice(0, 5),
  };
}

function StatRow({ label, valueA, valueB, format = "text", highlight = false }: {
  label: string; valueA: string | number; valueB: string | number; format?: string; highlight?: boolean
}) {
  return (
    <div className={`grid grid-cols-3 gap-4 py-3 border-b border-card-border/50 ${highlight ? 'bg-red-500/5' : ''}`}>
      <span className="text-muted text-sm">{label}</span>
      <span className="text-white font-semibold text-center">{typeof valueA === 'number' && format === 'dollar' ? formatDollar(valueA) : valueA}</span>
      <span className="text-white font-semibold text-center">{typeof valueB === 'number' && format === 'dollar' ? formatDollar(valueB) : valueB}</span>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}) {
  const resolvedParams = await searchParams;
  const db = getDb();
  const allTanks = db.prepare("SELECT * FROM entities WHERE type = 'think_tank' ORDER BY name").all() as Entity[];

  const slugA = resolvedParams.a || allTanks[0]?.slug;
  const slugB = resolvedParams.b || allTanks[1]?.slug;

  const tankA = allTanks.find(t => t.slug === slugA);
  const tankB = allTanks.find(t => t.slug === slugB);

  if (!tankA || !tankB) {
    return <div className="p-12 text-center text-muted">Select two think tanks to compare.</div>;
  }

  const statsA = getStats(db, tankA);
  const statsB = getStats(db, tankB);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          Structural <span className="text-primary">Comparison</span>
        </h1>
        <p className="text-muted text-lg max-w-2xl">
          Side-by-side analysis of donor capture, legislative influence, and funding transparency.
        </p>
      </div>

      {/* Tank Selector */}
      <CompareSelector 
        tanks={allTanks.map(t => ({ slug: t.slug, name: t.name }))}
        currentA={slugA}
        currentB={slugB}
      />

      {/* Comparison Table */}
      <div className="glass p-6 rounded-2xl">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 pb-4 border-b-2 border-card-border mb-2">
          <span className="text-sm text-muted uppercase tracking-wider font-bold">Metric</span>
          <div className="text-center">
            <Link href={`/think-tanks/${statsA.entity.slug}`} className="font-bold text-primary hover:underline text-lg">{statsA.entity.name}</Link>
            <div className="text-xs text-muted">{statsA.entity.lean}</div>
          </div>
          <div className="text-center">
            <Link href={`/think-tanks/${statsB.entity.slug}`} className="font-bold text-yellow-500 hover:underline text-lg">{statsB.entity.name}</Link>
            <div className="text-xs text-muted">{statsB.entity.lean}</div>
          </div>
        </div>

        {/* Stats Rows */}
        <StatRow label="Total Tracked Donations" valueA={statsA.totalDonations} valueB={statsB.totalDonations} format="dollar" />
        <StatRow label="Number of Donors" valueA={statsA.donorCount} valueB={statsB.donorCount} />
        <StatRow label="Biggest Donor" valueA={`${statsA.topDonor} (${formatDollar(statsA.topDonorAmount)})`} valueB={`${statsB.topDonor} (${formatDollar(statsB.topDonorAmount)})`} />
        <StatRow label="Foreign Gov't Donors" valueA={statsA.foreignDonorCount} valueB={statsB.foreignDonorCount} highlight={statsA.foreignDonorCount > 0 || statsB.foreignDonorCount > 0} />
        <StatRow label="Foreign Gov't Funding" valueA={statsA.foreignAmount} valueB={statsB.foreignAmount} format="dollar" highlight={statsA.foreignAmount > 0 || statsB.foreignAmount > 0} />
        <StatRow label="Legislative Influence Links" valueA={statsA.influenceCount} valueB={statsB.influenceCount} />
        <StatRow label="Avg Influence Confidence" valueA={`${Math.round(statsA.avgStrength * 100)}%`} valueB={`${Math.round(statsB.avgStrength * 100)}%`} />
        <StatRow label="Policy Papers" valueA={statsA.policyPaperCount} valueB={statsB.policyPaperCount} />
        <StatRow label="Lobbying Spend" valueA={statsA.lobbyingAmount} valueB={statsB.lobbyingAmount} format="dollar" />
        <StatRow label="Latest Annual Revenue" valueA={statsA.latestRevenue ?? 0} valueB={statsB.latestRevenue ?? 0} format="dollar" />
      </div>

      {/* Capture Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[statsA, statsB].map((stats, idx) => {
          const captureScore = (
            (stats.foreignDonorCount > 0 ? 30 : 0) +
            (stats.avgStrength > 0.8 ? 25 : stats.avgStrength > 0.5 ? 15 : 5) +
            (stats.lobbyingAmount > 500000 ? 20 : stats.lobbyingAmount > 0 ? 10 : 0) +
            (stats.totalDonations > 10_000_000 ? 25 : stats.totalDonations > 5_000_000 ? 15 : 5)
          );
          const captureLevel = captureScore >= 70 ? "HIGH" : captureScore >= 40 ? "MODERATE" : "LOW";
          const captureColor = captureScore >= 70 ? "text-red-400 border-red-500/30 bg-red-500/5" : captureScore >= 40 ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" : "text-green-400 border-green-500/30 bg-green-500/5";
          const accentColor = idx === 0 ? "text-primary" : "text-yellow-500";

          return (
            <div key={stats.entity.id} className={`rounded-xl border p-6 ${captureColor}`}>
              <h3 className={`text-lg font-bold ${accentColor} mb-1`}>{stats.entity.name}</h3>
              <div className="text-3xl font-extrabold mb-2">{captureLevel} CAPTURE RISK</div>
              <div className="text-sm text-muted">
                Composite score: {captureScore}/100 — based on foreign funding exposure,
                donor concentration, lobbying spend, and legislative influence confidence.
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Deep Dive Explicit Breakdowns ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
        <DetailedPanel stats={statsA} accentColor="text-primary" borderAccent="border-primary/20" />
        <DetailedPanel stats={statsB} accentColor="text-yellow-500" borderAccent="border-yellow-500/20" />
      </div>
    </div>
  );
}

function DetailedPanel({ stats, accentColor, borderAccent }: { stats: TankStats; accentColor: string; borderAccent: string }) {
  return (
    <div className={`glass p-6 rounded-2xl border ${borderAccent} flex flex-col gap-6`}>
      <h3 className={`text-2xl font-bold ${accentColor} border-b border-card-border pb-3`}>
        {stats.entity.name} Detailed Profile
      </h3>

      {/* Legislation Breakdown */}
      <div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4" /> Targeted Legislation (Top 5)
        </h4>
        {stats.detailedLegislation.length === 0 ? (
          <p className="text-xs text-muted italic">No specific legislation targets tracked yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {stats.detailedLegislation.map((leg: any, idx) => (
              <div key={leg.id || idx} className="bg-card-border/20 p-4 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <Link href={`/legislation/${leg.id}`} className="font-semibold text-white hover:text-primary transition-colors leading-tight">
                    {leg.title}
                  </Link>
                  <span className="text-[10px] bg-card-border px-2 py-0.5 rounded font-mono shrink-0">{leg.bill_id}</span>
                </div>
                {leg.summary && (
                  <p className="text-xs text-muted/90 italic leading-relaxed line-clamp-3 bg-black/20 p-2 rounded border border-card-border/50">
                    "{leg.summary}"
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted uppercase font-bold bg-white/5 px-2 py-0.5 rounded">Action: {leg.link_type?.replace("_", " ")}</span>
                  <span className="text-[10px] text-muted truncate">via "{leg.paper_title}"</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Donors Breakdown */}
      <div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2 mt-4">
          <FileText className="w-4 h-4" /> Principal Funding Sources (Top 5)
        </h4>
        {stats.detailedDonors.length === 0 ? (
          <p className="text-xs text-muted italic">No specific donors tracked yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.detailedDonors.map((d: any, idx: number) => (
              <div key={d.id || idx} className="bg-card-border/20 p-3 rounded-lg flex flex-col gap-1.5 border-l-2 border-l-green-500/50">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-white">{d.donor_name}</span>
                  <span className="font-bold text-green-400 font-mono text-sm">{formatDollar(d.amount)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {d.industry && <span className="text-[10px] text-muted bg-white/5 px-2 py-0.5 rounded border border-card-border/50">Industry: {d.industry}</span>}
                  <span className="text-[10px] text-muted bg-white/5 px-2 py-0.5 rounded border border-card-border/50">Source: {d.source || 'Unknown'}</span>
                  {d.is_foreign_govt === 1 && <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded font-bold uppercase tracking-wide">Foreign Govt</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
