import { getDb } from "@/lib/db";
import type { LegislationLinkRow, DonationRow } from "@/lib/rows";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { notFound } from "next/navigation";
import { Entity, InfluenceLink } from "@/lib/types";
import Link from "next/link";
import CompareSelector from "@/components/CompareSelector";
import { FileText, Scale } from "lucide-react";

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
  lobbyingCount: number;
  lobbyingAmount: number;
  latestRevenue: number | null;
  topDonor: string;
  topDonorAmount: number;
  detailedLegislation: LegislationLinkRow[];
  detailedDonors: DonationRow[];
}

function getStats(db: ReturnType<typeof getDb>, entity: Entity): TankStats {
  const donors = db.prepare("SELECT * FROM donors WHERE entity_id = ? AND (provenance IS NULL OR provenance != 'seeded_demo') ORDER BY amount DESC").all(entity.id) as DonationRow[];
  const links = db.prepare("SELECT * FROM influence_links WHERE source_id = ? AND source_type = 'think_tank' AND (provenance IS NULL OR provenance NOT IN ('seeded_demo', 'ai_generated'))").all(entity.id) as InfluenceLink[];
  const paperCount = db.prepare("SELECT COUNT(*) as cnt FROM policy_papers WHERE entity_id = ?").get(entity.id) as { cnt: number };
  const lobbyRow = db.prepare("SELECT COUNT(*) as cnt, SUM(amount) as total FROM lobbying WHERE client_entity_id = ? AND (provenance IS NULL OR provenance != 'seeded_demo')").get(entity.id) as { cnt: number; total: number | null };
  const latestFinancial = db.prepare("SELECT total_revenue FROM financials WHERE entity_id = ? ORDER BY fiscal_year DESC LIMIT 1").get(entity.id) as { total_revenue: number } | undefined;

  // Complex query to get actual legislation targeted by this think tank via its papers
  const legTargets = db.prepare(`
    SELECT l.id, l.title, l.bill_id, l.summary, il.link_type, pp.title as paper_title
    FROM influence_links il
    JOIN legislation l ON il.target_id = l.id
    JOIN policy_papers pp ON il.source_id = pp.id AND il.source_type = 'policy_paper'
    WHERE pp.entity_id = ? AND il.target_type = 'legislation' AND (il.provenance IS NULL OR il.provenance != 'seeded_demo')
    GROUP BY l.id
    ORDER BY il.strength DESC LIMIT 5
  `).all(entity.id) as LegislationLinkRow[];

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
    lobbyingCount: lobbyRow.cnt,
    lobbyingAmount: lobbyRow.total || 0,
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
    <div className={`grid grid-cols-3 gap-4 py-3 border-b border-border ${highlight ? 'bg-failed-wash' : ''}`}>
      <span className="text-muted text-sm">{label}</span>
      <span className="text-foreground font-semibold text-center">{typeof valueA === 'number' && format === 'dollar' ? formatDollar(valueA) : valueA}</span>
      <span className="text-foreground font-semibold text-center">{typeof valueB === 'number' && format === 'dollar' ? formatDollar(valueB) : valueB}</span>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const resolvedParams = await searchParams;
  const db = getDb();
  const allTanks = db.prepare("SELECT * FROM entities WHERE type = 'think_tank' ORDER BY name").all() as Entity[];

  const slugA = resolvedParams.a || allTanks[0]?.slug;
  const slugB = resolvedParams.b || allTanks[1]?.slug;

  const tankA = allTanks.find(t => t.slug === slugA);
  const tankB = allTanks.find(t => t.slug === slugB);

  // An explicitly requested slug that doesn't resolve is a genuine 404, not a 200.
  if ((resolvedParams.a && !tankA) || (resolvedParams.b && !tankB)) {
    notFound();
  }

  if (!tankA || !tankB) {
    return (
      <div className="p-12 text-center text-muted">
        At least two think tanks are needed to run a comparison.
      </div>
    );
  }

  const statsA = getStats(db, tankA);
  const statsB = getStats(db, tankB);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Compare think tanks
        </h1>
        <p className="text-muted text-lg max-w-2xl">
          Two organizations side by side: funding, policy output and legislative links.
        </p>
      </div>

      {/* Tank Selector */}
      <CompareSelector 
        tanks={allTanks.map(t => ({ slug: t.slug, name: t.name }))}
        currentA={slugA}
        currentB={slugB}
      />

      {/* Comparison Table */}
      <div className="bg-surface border border-border rounded-md p-5">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 pb-4 border-b-2 border-border mb-2">
          <span className="text-sm text-muted uppercase tracking-wider font-bold">Metric</span>
          <div className="text-center">
            <Link href={`/think-tanks/${statsA.entity.slug}`} className="font-bold text-accent hover:underline text-lg">{statsA.entity.name}</Link>
            <div className="text-xs text-muted">{statsA.entity.lean}</div>
          </div>
          <div className="text-center">
            <Link href={`/think-tanks/${statsB.entity.slug}`} className="font-bold text-progress hover:underline text-lg">{statsB.entity.name}</Link>
            <div className="text-xs text-muted">{statsB.entity.lean}</div>
          </div>
        </div>

        {/* Stats Rows */}
        <StatRow label="Tracked donations" valueA={statsA.totalDonations} valueB={statsB.totalDonations} format="dollar" />
        <StatRow label="Number of Donors" valueA={statsA.donorCount} valueB={statsB.donorCount} />
        <StatRow label="Biggest Donor" valueA={`${statsA.topDonor} (${formatDollar(statsA.topDonorAmount)})`} valueB={`${statsB.topDonor} (${formatDollar(statsB.topDonorAmount)})`} />
        <StatRow label="Foreign Gov't Donors" valueA={statsA.foreignDonorCount} valueB={statsB.foreignDonorCount} highlight={statsA.foreignDonorCount > 0 || statsB.foreignDonorCount > 0} />
        <StatRow label="Foreign Gov't Funding" valueA={statsA.foreignAmount} valueB={statsB.foreignAmount} format="dollar" highlight={statsA.foreignAmount > 0 || statsB.foreignAmount > 0} />
        <StatRow label="Legislative Influence links" valueA={statsA.influenceCount} valueB={statsB.influenceCount} />
        <StatRow label="Policy papers" valueA={statsA.policyPaperCount} valueB={statsB.policyPaperCount} />
        <StatRow label="Lobbying Spend" valueA={statsA.lobbyingCount === 0 ? "No LDA filings" : formatDollar(statsA.lobbyingAmount)} valueB={statsB.lobbyingCount === 0 ? "No LDA filings" : formatDollar(statsB.lobbyingAmount)} />
        <StatRow label="Latest Annual Revenue" valueA={statsA.latestRevenue ?? 0} valueB={statsB.latestRevenue ?? 0} format="dollar" />
      </div>

      {/* Capture Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[statsA, statsB].map((stats, idx) => {
          // A hand-composed heuristic over demonstration data. The weights below
          // were chosen by hand and never fitted or validated against anything,
          // so this is labelled in the UI as a demo construct, not a rating.
          const captureScore = (
            (stats.foreignDonorCount > 0 ? 30 : 0) +
            (stats.avgStrength > 0.8 ? 25 : stats.avgStrength > 0.5 ? 15 : 5) +
            (stats.lobbyingAmount > 500000 ? 20 : stats.lobbyingAmount > 0 ? 10 : 0) +
            (stats.totalDonations > 10_000_000 ? 25 : stats.totalDonations > 5_000_000 ? 15 : 5)
          );
          const captureLevel = captureScore >= 70 ? "HIGH" : captureScore >= 40 ? "MODERATE" : "LOW";
          const captureColor = captureScore >= 70 ? "text-failed border-failed/25 bg-failed-wash" : captureScore >= 40 ? "text-progress border-border bg-progress-wash" : "text-enacted border-enacted/25 bg-enacted-wash";
          const accentColor = idx === 0 ? "text-accent" : "text-progress";

          return (
            <div key={stats.entity.id} className={`rounded-md border p-6 ${captureColor}`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className={`text-lg font-bold ${accentColor}`}>{stats.entity.name}</h3>
                <ProvenanceBadge provenance="seeded_demo" />
              </div>
              <div className="text-3xl font-semibold mb-1">{captureLevel}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Illustrative capture index
              </div>
              <div className="text-sm text-muted">
                Composite score: {captureScore}/100, combining foreign funding exposure, donor
                concentration, and lobbying spend.
              </div>
              <p className="text-xs text-muted/80 mt-3 leading-relaxed">
                Not a risk rating. The four weights were chosen by hand and never validated, and
                the inputs are demonstration data. See{" "}
                <Link href="/methodology" className="underline hover:text-foreground">methodology</Link>.
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Deep Dive Explicit Breakdowns ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
        <DetailedPanel stats={statsA} accentColor="text-accent" borderAccent="border-accent/25" />
        <DetailedPanel stats={statsB} accentColor="text-progress" borderAccent="border-border" />
      </div>
    </div>
  );
}

function DetailedPanel({ stats, accentColor, borderAccent }: { stats: TankStats; accentColor: string; borderAccent: string }) {
  return (
    <div className={`bg-surface border border-border rounded-md p-5 border ${borderAccent} flex flex-col gap-6`}>
      <h3 className={`text-2xl font-bold ${accentColor} border-b border-border pb-3`}>
        {stats.entity.name} Detail
      </h3>

      {/* Legislation Breakdown */}
      <div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4" /> Linked bills
        </h4>
        {stats.detailedLegislation.length === 0 ? (
          <p className="text-xs text-muted italic">No specific legislation targets tracked yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {stats.detailedLegislation.map((leg, idx) => (
              <div key={leg.id || idx} className="bg-surface-sunken p-4 rounded-sm flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <Link href={`/legislation/${leg.id}`} className="font-semibold text-foreground hover:text-accent transition-colors leading-tight">
                    {leg.title}
                  </Link>
                  <span className="text-2xs bg-surface-sunken px-2 py-0.5 rounded font-mono shrink-0">{leg.bill_id}</span>
                </div>
                {leg.summary && (
                  <p className="text-xs text-muted/90 italic leading-relaxed line-clamp-3 bg-black/20 p-2 rounded border border-border">
                    &quot;{leg.summary}&quot;
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xs text-muted uppercase font-bold bg-surface-sunken px-2 py-0.5 rounded">Action: {leg.link_type?.replace("_", " ")}</span>
                  <span className="text-2xs text-muted truncate">via &quot;{leg.paper_title}&quot;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Donors Breakdown */}
      <div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2 mt-4">
          <FileText className="w-4 h-4" /> Largest donors
        </h4>
        {stats.detailedDonors.length === 0 ? (
          <p className="text-xs text-muted italic">No specific donors tracked yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.detailedDonors.map((d, idx: number) => (
              <div key={d.id || idx} className="bg-surface-sunken p-3 rounded-sm flex flex-col gap-1.5 border-l-2 border-l-green-500/50">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-foreground">{d.donor_name}</span>
                  <span className="font-bold text-enacted font-mono text-sm">{formatDollar(d.amount)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {d.industry && <span className="text-2xs text-muted bg-surface-sunken px-2 py-0.5 rounded border border-border">Industry: {d.industry}</span>}
                  <span className="text-2xs text-muted bg-surface-sunken px-2 py-0.5 rounded border border-border">Source: {d.source || 'Unknown'}</span>
                  {d.is_foreign_govt === 1 && <span className="text-2xs text-failed bg-failed-wash px-2 py-0.5 rounded font-bold uppercase tracking-wide">Foreign Govt</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
