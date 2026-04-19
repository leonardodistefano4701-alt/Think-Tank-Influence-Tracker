import { getDb } from "@/lib/db";
import { Donor, InfluenceLink, Entity } from "@/lib/types";
import { DollarSign, AlertTriangle, FileText, ChevronRight, Building2, Award } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import AIVerdictCard from "@/components/AIVerdictCard";
import React from 'react';

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

export default async function DonorProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const db = getDb();
  
  // Find the specific donor row to get the donor name
  const searchedDonor = db.prepare("SELECT * FROM donors WHERE id = ?").get(resolvedParams.id) as Donor | undefined;
  
  let donorNameMatch = "";
  if (searchedDonor) {
    donorNameMatch = searchedDonor.donor_name;
  } else {
    // Maybe they passed the donor name encoded in the URL instead of an ID
    donorNameMatch = decodeURIComponent(resolvedParams.id);
  }

  // Get all donations by this donor
  const donations = db.prepare(`
    SELECT d.*, e.name as tank_name, e.slug as tank_slug, e.lean
    FROM donors d
    JOIN entities e ON d.entity_id = e.id
    WHERE d.donor_name = ?
    ORDER BY d.amount DESC
  `).all(donorNameMatch) as any[];

  if (donations.length === 0) return notFound();

  // Aggregate info
  let totalAmount = 0;
  let isForeign = false;
  let industries = new Set<string>();

  for (const d of donations) {
    totalAmount += (d.amount || 0);
    if (d.is_foreign_govt) isForeign = true;
    if (d.industry) industries.add(d.industry);
  }

  const industryListing = Array.from(industries).join(', ');

  // Find influence links specifically from this donor to policy papers
  // "What did this donor's money influence?"
  // We need to match ANY donor row ID for this donor to influence_links source_id.
  const donorIds = donations.map(d => `'${d.id}'`).join(',');
  
  let influenceLinks: any[] = [];
  if (donorIds.length > 0) {
    influenceLinks = db.prepare(`
      SELECT il.*, 
             pp.title as paper_title, pp.published_date, pp.url as paper_url, pp.summary as paper_summary,
             e.name as tank_name, e.slug as tank_slug
      FROM influence_links il
      JOIN policy_papers pp ON il.target_id = pp.id
      JOIN entities e ON pp.entity_id = e.id
      WHERE il.source_id IN (${donorIds}) AND il.source_type = 'donor' AND il.target_type = 'policy_paper'
      ORDER BY il.strength DESC, pp.published_date DESC
    `).all() as any[];
  }
  
  const targetIdStr = donations.length > 0 ? donations[0].id : resolvedParams.id;
  const verdictRow = db.prepare("SELECT * FROM analysis_verdicts WHERE target_id = ?")
    .get(targetIdStr) as any | undefined;
  
  const aiInfo = verdictRow ? {
    verdict: verdictRow.verdict,
    reasoning: verdictRow.reasoning,
    evidenceSummary: verdictRow.evidence_summary,
    confidence: verdictRow.confidence,
    modelUsed: verdictRow.model_used
  } : null;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="glass p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-primary to-yellow-500" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-card-border/50 font-mono text-sm font-bold text-green-400">
                Funding Source
              </span>
              {isForeign && (
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 text-sm font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Foreign Entity
                </span>
              )}
            </div>
            
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-white mb-4">
              {donorNameMatch}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              {industryListing && (
                <div className="flex items-center gap-1.5 bg-card-border/30 px-3 py-1.5 rounded-lg border border-card-border">
                  <Building2 className="w-4 h-4" />
                  Industry: <span className="font-semibold text-white">{industryListing}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-card-border/30 px-3 py-1.5 rounded-lg border border-card-border">
                <Award className="w-4 h-4" />
                Think Tanks Funded: <span className="font-semibold text-white">{donations.length}</span>
              </div>
            </div>
          </div>
          <div className="text-right bg-card-border/20 p-6 rounded-2xl border border-card-border/50 flex-shrink-0">
            <div className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Total Lifetime Funding</div>
            <div className="text-5xl font-extrabold text-green-400 flex items-center justify-end">
              {formatDollar(totalAmount)}
            </div>
          </div>
        </div>
      </div>
      
      {aiInfo && <AIVerdictCard info={aiInfo} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── Sidebar: Think Tanks Funded ───────────────────────────── */}
        <div className="flex flex-col gap-8">
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Think Tanks Funded
            </h2>
            <div className="space-y-4">
              {donations.map((d, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-card-border/20 rounded-xl border border-card-border/50 transition-colors hover:bg-card-border/40">
                  <div className="flex justify-between items-start">
                    <Link href={`/think-tanks/${d.tank_slug}`} className="font-bold text-white hover:text-primary transition-colors">
                      {d.tank_name}
                    </Link>
                    <span className="font-bold text-green-400">{formatDollar(d.amount)}</span>
                  </div>
                  <div className="flex flex-col gap-1 items-start text-xs text-muted">
                    <span className="px-2 py-0.5 rounded-sm bg-card-border/50 uppercase font-bold text-[10px] tracking-wider text-white/80">{d.lean}</span>
                    <span className="opacity-80">
                      {d.year ? `Year: ${d.year}` : 'Year: Unknown'} &bull; Source: {d.source || 'Tax Filings'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Column: Policy Influence Traces ────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6 text-yellow-500" />
              Direct Policy Influence Traces
            </h2>
            
            {influenceLinks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-card-border rounded-xl">
                <p className="text-muted">No explicit textual evidence traces tie this exact donor to specific policy papers yet.</p>
                <p className="text-xs text-muted mt-2">However, their funding supports the general operations of the think tanks listed left.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {influenceLinks.map((il, i) => (
                  <div key={i} className="rounded-xl border border-card-border/50 bg-card-border/10 overflow-hidden shadow-lg">
                    {/* Tank Context */}
                    <div className="px-5 py-3 border-b border-card-border/50 bg-card-border/20 flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 text-muted">
                        Targeting paper authored by: 
                        <Link href={`/think-tanks/${il.tank_slug}`} className="font-bold text-white hover:text-primary transition-colors">
                          {il.tank_name}
                        </Link>
                      </div>
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        Confidence: {Math.round((il.strength || 0) * 100)}%
                      </span>
                    </div>
                    
                    {/* Paper Details */}
                    <div className="p-5">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-white/90">{il.paper_title}</h3>
                          <div className="text-xs text-muted mt-1">Published: {il.published_date || 'Unknown'}</div>
                        </div>
                      </div>
                      
                      {il.paper_summary && (
                        <div className="mb-4 text-sm text-white/70 italic border-l-2 border-primary/30 pl-3 leading-relaxed">
                          "{il.paper_summary.length > 300 ? il.paper_summary.slice(0, 300) + '...' : il.paper_summary}"
                        </div>
                      )}
                      
                      {/* Generative Narrative / Evidence */}
                      <div className="bg-space-900 rounded-lg p-4 border border-card-border relative">
                        <div className="absolute -top-3 left-4 bg-primary px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                          Influence Link Evidence
                        </div>
                        <div className="text-sm text-white/80 leading-relaxed mt-2 italic">
                          "{il.evidence}"
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
