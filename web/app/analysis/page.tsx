import { getDb } from "@/lib/db";
import type { UnknownRow, PolicyPaperRow, LegislationLinkRow, DonationRow } from "@/lib/rows";
import { ProvenanceBanner } from "@/components/ProvenanceBadge";
import Link from "next/link";
import { TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, FileText, Scale, ChevronRight } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

function statusIcon(status: string) {
  if (status === 'Signed into Law') return <CheckCircle className="w-4 h-4 text-enacted" />;
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return <TrendingUp className="w-4 h-4 text-progress" />;
  if (status === 'Failed') return <XCircle className="w-4 h-4 text-failed" />;
  return <Clock className="w-4 h-4 text-muted" />;
}

function statusColor(status: string) {
  if (status === 'Signed into Law') return 'bg-enacted-wash text-enacted';
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return 'bg-progress-wash text-progress';
  if (status === 'Failed') return 'bg-failed-wash text-failed';
  return 'bg-surface-sunken text-muted';
}

// Nullable to match the schema. These columns really are nullable, and the
// previous non-null declarations were assertions the database never honoured.
interface DonorChain {
  donor_id: string;
  donor_name: string | null;
  donor_amount: number | null;
  donor_industry: string | null;
  is_foreign_govt: number | null;
  donor_to_paper_strength: number | null;
  donor_to_paper_evidence: string | null;
  paper_title: string | null;
  paper_summary?: string | null;
  paper_to_leg_strength: number | null;
  paper_to_leg_evidence: string | null;
  leg_id: string | null;
  leg_title: string | null;
  leg_bill_id: string | null;
  leg_status: string | null;
  tank_name: string | null;
  tank_slug: string | null;
}

interface TankAnalysis {
  name: string;
  slug: string;
  lean: string | null;
  totalPapers: number;
  papersWithLegislation: number;
  signedIntoLaw: number;
  passedChamber: number;
  inCommittee: number;
  failed: number;
  opposed: number;
  successRate: number;
  advancementRate: number;
  discoveryCoverage: number;
  totalDonorInfluence: number;
  foreignDonorLinks: number;
  avgInfluenceStrength: number;
  chains: DonorChain[];
}

type DonorPaperLinkRow = DonationRow & {
  paper_id: string;
  tank_id: string;
  strength: number | null;
  evidence: string | null;
  donor_id: string;
};

/** Group rows into a Map, preserving the order the query returned them in. */
function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k == null) continue;
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

const THINK_TANK_IDS = "SELECT id FROM entities WHERE type = 'think_tank'";

export default async function AnalysisPage() {
  const db = getDb();

  // Four set-based queries, then grouped in memory. This previously ran one
  // query per think tank and then one per policy paper — 138 queries per
  // request, growing with the size of the corpus rather than staying fixed.
  const tanks = db
    .prepare("SELECT * FROM entities WHERE type = 'think_tank' ORDER BY name")
    .all() as (UnknownRow & { id: string; name: string; slug: string; lean: string | null })[];

  const allPapers = db
    .prepare(`SELECT * FROM policy_papers WHERE entity_id IN (${THINK_TANK_IDS})`)
    .all() as PolicyPaperRow[];

  // Filtered by the INNER JOIN to legislation, matching the per-paper query
  // this replaces: a link whose target is not a real bill is excluded.
  const allLegLinks = db
    .prepare(
      `SELECT il.*, l.id as leg_id, l.title as leg_title, l.bill_id, l.status as leg_status
         FROM influence_links il
         JOIN legislation l ON il.target_id = l.id
        WHERE il.source_type = 'policy_paper'
          AND (il.provenance IS NULL OR il.provenance NOT IN ('seeded_demo', 'ai_generated'))
          AND il.source_id IN (
                SELECT id FROM policy_papers WHERE entity_id IN (${THINK_TANK_IDS})
              )`
    )
    .all() as LegislationLinkRow[];

  // Joined through policy_papers to recover the owning think tank. That cannot
  // fan out, because policy_papers.id is the primary key.
  const allDonorLinks = db
    .prepare(
      `SELECT il.strength, il.evidence, il.target_id as paper_id,
              d.id as donor_id, d.donor_name, d.amount, d.industry, d.is_foreign_govt,
              p.entity_id as tank_id
         FROM influence_links il
         JOIN donors d ON il.source_id = d.id
         JOIN policy_papers p ON il.target_id = p.id
        WHERE il.source_type = 'donor' AND il.target_type = 'policy_paper'
          AND (il.provenance IS NULL OR il.provenance NOT IN ('seeded_demo', 'ai_generated'))
          AND (d.provenance IS NULL OR d.provenance != 'seeded_demo')
          AND p.entity_id IN (${THINK_TANK_IDS})`
    )
    .all() as DonorPaperLinkRow[];

  const papersByTank = groupBy(allPapers, (p) => p.entity_id);
  const legLinksByPaper = groupBy(allLegLinks, (l) => l.source_id);
  const donorLinksByTank = groupBy(allDonorLinks, (d) => d.tank_id);
  // Replaces a papers.find(...) scan that ran inside the donor-link loop.
  const papersById = new Map(allPapers.map((p) => [p.id, p]));

  const tankAnalyses: TankAnalysis[] = [];

  for (const tank of tanks) {
    const papers = papersByTank.get(tank.id) ?? [];

    let signedIntoLaw = 0;
    let passedChamber = 0;
    let inCommittee = 0;
    let failed = 0;
    let opposed = 0;
    let papersWithLegislation = 0;

    for (const paper of papers) {
      const links = legLinksByPaper.get(paper.id) ?? [];
      if (links.length > 0) papersWithLegislation++;

      for (const link of links) {
        if (link.link_type === 'opposes') {
          opposed++;
        } else {
          if (link.leg_status === 'Signed into Law') signedIntoLaw++;
          else if (link.leg_status?.includes('Passed')) passedChamber++;
          else if (link.leg_status === 'Failed') failed++;
          else inCommittee++;
        }
      }
    }

    // Get full donor → paper → legislation chains
    const chains: DonorChain[] = [];
    const donorPaperLinks = donorLinksByTank.get(tank.id) ?? [];

    let totalDonorInfluence = 0;
    let foreignDonorLinks = 0;
    let strengthSum = 0;

    for (const dpl of donorPaperLinks) {
      totalDonorInfluence += dpl.amount || 0;
      if (dpl.is_foreign_govt) foreignDonorLinks++;
      strengthSum += dpl.strength || 0;

      const paper = papersById.get(dpl.paper_id);
      if (!paper) continue;

      const legLinks = legLinksByPaper.get(paper.id) ?? [];

      if (legLinks.length === 0) {
        chains.push({
          donor_id: dpl.donor_id,
          donor_name: dpl.donor_name,
          donor_amount: dpl.amount,
          donor_industry: dpl.industry,
          is_foreign_govt: dpl.is_foreign_govt,
          donor_to_paper_strength: dpl.strength,
          donor_to_paper_evidence: dpl.evidence,
          paper_title: paper.title,
          paper_summary: paper.summary,
          paper_to_leg_strength: null,
          paper_to_leg_evidence: null,
          leg_id: null,
          leg_title: null,
          leg_bill_id: null,
          leg_status: null,
          tank_name: tank.name,
          tank_slug: tank.slug,
        });
      } else {
        for (const ll of legLinks) {
          chains.push({
            donor_id: dpl.donor_id,
            donor_name: dpl.donor_name,
            donor_amount: dpl.amount,
            donor_industry: dpl.industry,
            is_foreign_govt: dpl.is_foreign_govt,
            donor_to_paper_strength: dpl.strength,
            donor_to_paper_evidence: dpl.evidence,
            paper_title: paper.title,
            paper_summary: paper.summary,
            paper_to_leg_strength: ll.strength,
            paper_to_leg_evidence: ll.evidence,
            leg_id: ll.leg_id,
            leg_title: ll.leg_title,
            leg_bill_id: ll.bill_id,
            leg_status: ll.leg_status,
            tank_name: tank.name,
            tank_slug: tank.slug,
          });
        }
      }
    }

    // Calculate success rates
    const totalAdvocated = signedIntoLaw + passedChamber + inCommittee + failed;
    const successRate = totalAdvocated > 0 ? (signedIntoLaw / totalAdvocated) * 100 : 0;
    const advancementRate = totalAdvocated > 0 ? ((signedIntoLaw + passedChamber) / totalAdvocated) * 100 : 0;
    const discoveryCoverage = papers.length > 0 ? (papersWithLegislation / papers.length) * 100 : 0;

    tankAnalyses.push({
      name: tank.name,
      slug: tank.slug,
      lean: tank.lean,
      totalPapers: papers.length,
      papersWithLegislation,
      signedIntoLaw,
      passedChamber,
      inCommittee,
      failed,
      opposed,
      successRate,
      advancementRate,
      discoveryCoverage,
      totalDonorInfluence,
      foreignDonorLinks,
      avgInfluenceStrength: donorPaperLinks.length > 0 ? strengthSum / donorPaperLinks.length : 0,
      chains,
    });
  }

  // Sort by success rate for the scorecard
  const sortedBySuccess = [...tankAnalyses].sort((a, b) => b.advancementRate - a.advancementRate);

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Influence analysis
        </h1>
        <p className="mt-2 text-base text-muted max-w-2xl leading-relaxed">How often each organization&apos;s policy papers are linked to bills that later became law. A link is a recorded association, not a demonstrated cause.</p>
        <div className="mt-4"><ProvenanceBanner kinds={["seeded_demo", "ai_generated"]}>
          This scorecard is built on hand-authored donor rows and model-asserted influence links.
          Bill statuses are verified against GovInfo, but a &quot;success rate&quot; here only counts
          bills that a link row already connects to a think tank — it is not evidence that any
          organization caused any bill to pass.
        </ProvenanceBanner></div>
      </header>

      {/* ── Policy Success Scorecard ────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Policy success scorecard
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border text-sm text-muted">
                <th className="text-left py-3 px-4">Think Tank</th>
                <th className="text-center py-3 px-2">Lean</th>
                <th className="text-center py-3 px-2">Papers</th>
                <th className="text-center py-3 px-2">With Legislation</th>
                <th className="text-center py-3 px-2">Coverage</th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-enacted"/>Laws</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-progress"/>Passed</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5 text-muted"/>Cmte</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5 text-failed"/>Failed</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-failed"/>Opposed</span>
                </th>
                <th className="text-center py-3 px-2">Advancement Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedBySuccess.map((t) => (
                <tr key={t.slug} className="border-b border-border hover:bg-surface-sunken transition-colors">
                  <td className="py-4 px-4">
                    <Link prefetch={false} href={`/think-tanks/${t.slug}`} className="font-bold text-foreground hover:text-accent transition-colors">
                      {t.name}
                    </Link>
                  </td>
                  <td className="text-center py-4 px-2">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-surface-sunken text-muted">{t.lean}</span>
                  </td>
                  <td className="text-center py-4 px-2 font-semibold">{t.totalPapers}</td>
                  <td className="text-center py-4 px-2 font-semibold">{t.papersWithLegislation}</td>
                  <td className="text-center py-4 px-2">
                    <span className={`font-semibold text-sm ${t.discoveryCoverage >= 50 ? 'text-enacted' : 'text-muted'}`}>
                      {Math.round(t.discoveryCoverage)}%
                    </span>
                  </td>
                  <td className="text-center py-4 px-2 font-bold text-enacted">{t.signedIntoLaw}</td>
                  <td className="text-center py-4 px-2 font-bold text-progress">{t.passedChamber}</td>
                  <td className="text-center py-4 px-2 text-muted">{t.inCommittee}</td>
                  <td className="text-center py-4 px-2 text-failed font-semibold">{t.failed}</td>
                  <td className="text-center py-4 px-2 text-failed">{t.opposed}</td>
                  <td className="text-center py-4 px-2">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-surface-sunken overflow-hidden">
                        <div className={`h-full rounded-full ${t.advancementRate >= 75 ? 'bg-enacted-wash' : t.advancementRate >= 50 ? 'bg-progress-wash' : 'bg-failed-wash'}`}
                          style={{ width: `${Math.round(t.advancementRate)}%` }} />
                      </div>
                      <span className="text-sm font-bold">{Math.round(t.advancementRate)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-muted flex gap-6">
          <span><strong>Coverage</strong> = Papers mapped to bills / Total Papers</span>
          <span><strong>Advancement Rate</strong> = (Laws + Passed) / Total Tracked Bills</span>
        </div>
      </div>

      {/* ── Full Donor → Policy → Legislation Chains ────────────────── */}
      {tankAnalyses.map(tank => (
        <div key={tank.slug} className="bg-surface border border-border rounded-md p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Link prefetch={false} href={`/think-tanks/${tank.slug}`} className="hover:text-accent transition-colors">
                  {tank.name}
                </Link>
                <span className="px-2 py-0.5 text-xs rounded-full bg-surface-sunken text-muted">{tank.lean}</span>
              </h2>
              <div className="text-sm text-muted mt-1 flex gap-4">
                <span>{tank.totalPapers} papers</span>
                <span>{tank.chains.length} traced influence chains</span>
                <span>Avg influence strength: {Math.round(tank.avgInfluenceStrength * 100)}%</span>
                {tank.foreignDonorLinks > 0 && (
                  <span className="text-failed flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {tank.foreignDonorLinks} foreign donor link(s)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold text-accent">{Math.round(tank.advancementRate)}%</div>
              <div className="text-xs text-muted">advancement rate</div>
            </div>
          </div>

          {/* Chains */}
          <div className="flex flex-col gap-4">
            {tank.chains.map((chain, i) => (
              <div key={i} className="rounded-md border border-border overflow-hidden">
                {/* Chain Flow */}
                <div className="p-4 flex flex-col gap-3">
                  {/* Donor */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-accent-wash flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link prefetch={false} href={`/donors/${chain.donor_id}`} className="font-bold text-foreground hover:text-accent transition-colors">{chain.donor_name}</Link>
                        <span className="font-semibold text-accent">{formatDollar(chain.donor_amount)}</span>
                        {chain.is_foreign_govt === 1 && (
                          <span className="px-1.5 py-0.5 bg-failed-wash text-failed text-2xs font-bold rounded-md uppercase">Foreign</span>
                        )}
                      </div>
                      <div className="text-xs text-muted">{chain.donor_industry}</div>
                    </div>
                    <div className="text-xs text-muted">
                      influence: <span className="font-bold text-foreground">{Math.round((chain.donor_to_paper_strength || 0) * 100)}%</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-2 pl-3">
                    <div className="w-0.5 h-4 bg-accent-wash" />
                    <ChevronRight className="w-3 h-3 text-muted" />
                    <span className="text-2xs text-muted uppercase tracking-wider">funds & influences</span>
                  </div>

                  {/* Policy Paper */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-sm bg-accent-wash flex items-center justify-center flex-shrink-0 mt-1">
                      <FileText className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-foreground text-sm">{chain.paper_title}</span>
                      {chain.paper_summary && (
                         <div className="text-xs text-muted/80 italic mt-1 line-clamp-2">&quot;{chain.paper_summary}&quot;</div>
                      )}
                    </div>
                  </div>

                  {/* Arrow to Legislation */}
                  {chain.leg_title && (
                    <>
                      <div className="flex items-center gap-2 pl-3">
                        <div className="w-0.5 h-4 bg-progress-wash" />
                        <ChevronRight className="w-3 h-3 text-progress/50" />
                        <span className="text-2xs text-muted uppercase tracking-wider">
                          shapes legislation • {Math.round((chain.paper_to_leg_strength || 0) * 100)}% confidence
                        </span>
                      </div>

                      {/* Legislation */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-progress-wash flex items-center justify-center flex-shrink-0">
                          <Scale className="w-4 h-4 text-progress" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link prefetch={false} href={`/legislation/${chain.leg_id}`} className="font-semibold text-foreground hover:text-progress transition-colors text-sm">{chain.leg_title}</Link>
                            <span className="font-mono text-xs text-muted">{chain.leg_bill_id}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-md flex items-center gap-1 ${statusColor(chain.leg_status || '')}`}>
                          {statusIcon(chain.leg_status || '')}
                          {chain.leg_status}
                        </span>
                      </div>
                    </>
                  )}

                  {!chain.leg_title && (
                    <div className="flex items-center gap-2 pl-3">
                      <div className="w-0.5 h-4 bg-surface-sunken" />
                      <span className="text-2xs text-muted italic">No direct legislation link traced yet</span>
                    </div>
                  )}
                </div>

                {/* Evidence */}
                <div className="bg-surface-sunken px-4 py-3 border-t border-border">
                  <div className="text-xs text-muted leading-relaxed">
                    <span className="font-bold text-muted">Evidence: </span>
                    {chain.donor_to_paper_evidence}
                    {chain.paper_to_leg_evidence && (
                      <span className="block mt-1">
                        <span className="font-bold text-muted">Legislative chain: </span>
                        {chain.paper_to_leg_evidence}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
