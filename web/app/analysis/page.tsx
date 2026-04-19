import { getDb } from "@/lib/db";
import Link from "next/link";
import { TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, FileText, Scale, ArrowRight, ChevronRight } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

function statusIcon(status: string) {
  if (status === 'Signed into Law') return <CheckCircle className="w-4 h-4 text-green-400" />;
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return <TrendingUp className="w-4 h-4 text-yellow-400" />;
  if (status === 'Failed') return <XCircle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-muted" />;
}

function statusColor(status: string) {
  if (status === 'Signed into Law') return 'bg-green-500/20 text-green-400';
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return 'bg-yellow-500/20 text-yellow-400';
  if (status === 'Failed') return 'bg-red-500/20 text-red-500';
  return 'bg-gray-500/20 text-gray-400';
}

interface DonorChain {
  donor_id: string;
  donor_name: string;
  donor_amount: number;
  donor_industry: string;
  is_foreign_govt: number;
  donor_to_paper_strength: number;
  donor_to_paper_evidence: string;
  paper_title: string;
  paper_summary?: string;
  paper_to_leg_strength: number | null;
  paper_to_leg_evidence: string | null;
  leg_id: string | null;
  leg_title: string | null;
  leg_bill_id: string | null;
  leg_status: string | null;
  tank_name: string;
  tank_slug: string;
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

export default async function AnalysisPage() {
  const db = getDb();

  // Get all think tanks
  const tanks = db.prepare("SELECT * FROM entities WHERE type = 'think_tank' ORDER BY name").all() as any[];

  const tankAnalyses: TankAnalysis[] = [];

  for (const tank of tanks) {
    // Get all policy papers for this tank
    const papers = db.prepare("SELECT * FROM policy_papers WHERE entity_id = ?").all(tank.id) as any[];

    // For each paper, find policy → legislation links
    let signedIntoLaw = 0;
    let passedChamber = 0;
    let inCommittee = 0;
    let failed = 0;
    let opposed = 0;
    let papersWithLegislation = 0;

    const paperLegLinks: Map<string, any[]> = new Map();

    for (const paper of papers) {
      const links = db.prepare(`
        SELECT il.*, l.id as leg_id, l.title as leg_title, l.bill_id, l.status as leg_status
        FROM influence_links il
        JOIN legislation l ON il.target_id = l.id
        WHERE il.source_type = 'policy_paper' AND il.source_id = ?
      `).all(paper.id) as any[];

      if (links.length > 0) papersWithLegislation++;
      paperLegLinks.set(paper.id, links);

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
    const donorPaperLinks = db.prepare(`
      SELECT il.strength, il.evidence, il.target_id as paper_id,
             d.id as donor_id, d.donor_name, d.amount, d.industry, d.is_foreign_govt
      FROM influence_links il
      JOIN donors d ON il.source_id = d.id
      WHERE il.source_type = 'donor' AND il.target_type = 'policy_paper'
        AND il.target_id IN (SELECT id FROM policy_papers WHERE entity_id = ?)
    `).all(tank.id) as any[];

    let totalDonorInfluence = 0;
    let foreignDonorLinks = 0;
    let strengthSum = 0;

    for (const dpl of donorPaperLinks) {
      totalDonorInfluence += dpl.amount || 0;
      if (dpl.is_foreign_govt) foreignDonorLinks++;
      strengthSum += dpl.strength || 0;

      // Find the paper
      const paper = papers.find(p => p.id === dpl.paper_id);
      if (!paper) continue;

      // Find legislation links for this paper
      const legLinks = paperLegLinks.get(paper.id) || [];

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
      <div className="glass p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-yellow-500 to-red-500" />
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">
          Influence <span className="text-primary">Analysis</span>
        </h1>
        <p className="text-xl text-muted max-w-3xl">
          Full pipeline breakdown: which donors influenced which policy papers, whether those papers shaped legislation, and how often each think tank successfully converts advocacy into law.
        </p>
      </div>

      {/* ── Policy Success Scorecard ────────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Scale className="w-6 h-6 text-yellow-500" />
          Think Tank Policy Success Scorecard
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-card-border text-sm text-muted">
                <th className="text-left py-3 px-4">Think Tank</th>
                <th className="text-center py-3 px-2">Lean</th>
                <th className="text-center py-3 px-2">Papers</th>
                <th className="text-center py-3 px-2">With Legislation</th>
                <th className="text-center py-3 px-2">Coverage</th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-400"/>Laws</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-yellow-400"/>Passed</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400"/>Cmte</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500"/>Failed</span>
                </th>
                <th className="text-center py-3 px-2">
                  <span className="flex items-center justify-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-400"/>Opposed</span>
                </th>
                <th className="text-center py-3 px-2">Advancement Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedBySuccess.map((t, i) => (
                <tr key={t.slug} className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors">
                  <td className="py-4 px-4">
                    <Link prefetch={false} href={`/think-tanks/${t.slug}`} className="font-bold text-white hover:text-primary transition-colors">
                      {t.name}
                    </Link>
                  </td>
                  <td className="text-center py-4 px-2">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-card-border text-muted">{t.lean}</span>
                  </td>
                  <td className="text-center py-4 px-2 font-semibold">{t.totalPapers}</td>
                  <td className="text-center py-4 px-2 font-semibold">{t.papersWithLegislation}</td>
                  <td className="text-center py-4 px-2">
                    <span className={`font-semibold text-sm ${t.discoveryCoverage >= 50 ? 'text-green-400' : 'text-muted'}`}>
                      {Math.round(t.discoveryCoverage)}%
                    </span>
                  </td>
                  <td className="text-center py-4 px-2 font-bold text-green-400">{t.signedIntoLaw}</td>
                  <td className="text-center py-4 px-2 font-bold text-yellow-400">{t.passedChamber}</td>
                  <td className="text-center py-4 px-2 text-muted">{t.inCommittee}</td>
                  <td className="text-center py-4 px-2 text-red-500 font-semibold">{t.failed}</td>
                  <td className="text-center py-4 px-2 text-red-400">{t.opposed}</td>
                  <td className="text-center py-4 px-2">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-card-border overflow-hidden">
                        <div className={`h-full rounded-full ${t.advancementRate >= 75 ? 'bg-green-500' : t.advancementRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
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
        <div key={tank.slug} className="glass p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Link prefetch={false} href={`/think-tanks/${tank.slug}`} className="hover:text-primary transition-colors">
                  {tank.name}
                </Link>
                <span className="px-2 py-0.5 text-xs rounded-full bg-card-border text-muted">{tank.lean}</span>
              </h2>
              <div className="text-sm text-muted mt-1 flex gap-4">
                <span>{tank.totalPapers} papers</span>
                <span>{tank.chains.length} traced influence chains</span>
                <span>Avg influence strength: {Math.round(tank.avgInfluenceStrength * 100)}%</span>
                {tank.foreignDonorLinks > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {tank.foreignDonorLinks} foreign donor link(s)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-primary">{Math.round(tank.advancementRate)}%</div>
              <div className="text-xs text-muted">advancement rate</div>
            </div>
          </div>

          {/* Chains */}
          <div className="flex flex-col gap-4">
            {tank.chains.map((chain, i) => (
              <div key={i} className="rounded-xl border border-card-border/50 overflow-hidden">
                {/* Chain Flow */}
                <div className="p-4 flex flex-col gap-3">
                  {/* Donor */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link prefetch={false} href={`/donors/${chain.donor_id}`} className="font-bold text-white hover:text-primary transition-colors">{chain.donor_name}</Link>
                        <span className="font-semibold text-primary">{formatDollar(chain.donor_amount)}</span>
                        {chain.is_foreign_govt === 1 && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-md uppercase">Foreign</span>
                        )}
                      </div>
                      <div className="text-xs text-muted">{chain.donor_industry}</div>
                    </div>
                    <div className="text-xs text-muted">
                      influence: <span className="font-bold text-white">{Math.round(chain.donor_to_paper_strength * 100)}%</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-2 pl-3">
                    <div className="w-0.5 h-4 bg-primary/30" />
                    <ChevronRight className="w-3 h-3 text-primary/50" />
                    <span className="text-[10px] text-muted uppercase tracking-wider">funds & influences</span>
                  </div>

                  {/* Policy Paper */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-white text-sm">{chain.paper_title}</span>
                      {chain.paper_summary && (
                         <div className="text-xs text-muted/80 italic mt-1 line-clamp-2">"{chain.paper_summary}"</div>
                      )}
                    </div>
                  </div>

                  {/* Arrow to Legislation */}
                  {chain.leg_title && (
                    <>
                      <div className="flex items-center gap-2 pl-3">
                        <div className="w-0.5 h-4 bg-yellow-500/30" />
                        <ChevronRight className="w-3 h-3 text-yellow-500/50" />
                        <span className="text-[10px] text-muted uppercase tracking-wider">
                          shapes legislation • {Math.round((chain.paper_to_leg_strength || 0) * 100)}% confidence
                        </span>
                      </div>

                      {/* Legislation */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                          <Scale className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link prefetch={false} href={`/legislation/${chain.leg_id}`} className="font-semibold text-white hover:text-yellow-400 transition-colors text-sm">{chain.leg_title}</Link>
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
                      <div className="w-0.5 h-4 bg-card-border" />
                      <span className="text-[10px] text-muted italic">No direct legislation link traced yet</span>
                    </div>
                  )}
                </div>

                {/* Evidence */}
                <div className="bg-card-border/10 px-4 py-3 border-t border-card-border/30">
                  <div className="text-xs text-muted leading-relaxed">
                    <span className="font-bold text-white/60">Evidence: </span>
                    {chain.donor_to_paper_evidence}
                    {chain.paper_to_leg_evidence && (
                      <span className="block mt-1">
                        <span className="font-bold text-white/60">Legislative chain: </span>
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
