import { getDb } from "@/lib/db";
import type { DonationRow, PaperLinkRow, VerdictRow } from "@/lib/rows";
import { Donor } from "@/lib/types";
import { AlertTriangle, Building2, Award } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import AIVerdictCard from "@/components/AIVerdictCard";
import React from 'react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare("SELECT donor_name FROM donors WHERE id = ?")
    .get(id) as { donor_name: string | null } | undefined;
  const name = row?.donor_name;
  if (!name) return { title: "Not found" };
  return {
    title: name,
    description: `Demonstration donor record for ${name}. Not drawn from any filing.`,
  };
}

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

export default async function DonorProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const db = getDb();
  
  // Find the specific donor row to get the donor name
  const searchedDonor = db.prepare("SELECT * FROM donors WHERE id = ? AND (provenance IS NULL OR provenance != 'seeded_demo')").get(resolvedParams.id) as Donor | undefined;
  
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
    WHERE d.donor_name = ? AND (d.provenance IS NULL OR d.provenance != 'seeded_demo')
    ORDER BY d.amount DESC
  `).all(donorNameMatch) as DonationRow[];

  if (donations.length === 0) return notFound();

  // Aggregate info
  let totalAmount = 0;
  let isForeign = false;
  const industries = new Set<string>();

  for (const d of donations) {
    totalAmount += (d.amount || 0);
    if (d.is_foreign_govt) isForeign = true;
    if (d.industry) industries.add(d.industry);
  }

  const industryListing = Array.from(industries).join(', ');

  // Find influence links specifically from this donor to policy papers
  // "What did this donor's money influence?"
  // We need to match ANY donor row ID for this donor to influence_links source_id.
  // Bind the ids as parameters rather than concatenating them into the SQL.
  // Note the old guard tested the length of the *joined string*, not the array.
  const donorIds = donations.map(d => d.id);
  const donorIdPlaceholders = donorIds.map(() => '?').join(',');

  let influenceLinks: PaperLinkRow[] = [];
  if (donorIds.length > 0) {
    influenceLinks = db.prepare(`
      SELECT il.*, 
             pp.title as paper_title, pp.published_date, pp.url as paper_url, pp.summary as paper_summary,
             e.name as tank_name, e.slug as tank_slug
      FROM influence_links il
      JOIN policy_papers pp ON il.target_id = pp.id
      JOIN entities e ON pp.entity_id = e.id
      WHERE il.source_id IN (${donorIdPlaceholders}) AND il.source_type = 'donor' AND il.target_type = 'policy_paper'
      ORDER BY il.strength DESC, pp.published_date DESC
    `).all(...donorIds) as PaperLinkRow[];
  }
  
  // Prefer a verdict for the row actually requested. Falling straight to
  // donations[0] (the largest donation) meant a donor with several rows showed
  // the wrong row's verdict - or none at all, when only a smaller row had one.
  const verdictRow = (db
    .prepare("SELECT * FROM analysis_verdicts WHERE target_id = ?")
    .get(resolvedParams.id) ??
    db
      .prepare(
        `SELECT * FROM analysis_verdicts
          WHERE target_id IN (${donorIdPlaceholders})
          ORDER BY confidence DESC LIMIT 1`
      )
      .get(...donorIds)) as VerdictRow | undefined;
  
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
      <div className="bg-surface border border-border rounded-md p-5">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-surface-sunken font-mono text-sm font-bold text-enacted">
                Source
              </span>
              {isForeign && (
                <span className="px-3 py-1 rounded-full bg-failed-wash text-failed border border-failed/25 text-sm font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Foreign Entity
                </span>
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-foreground mb-4">
              {donorNameMatch}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              {industryListing && (
                <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-sm border border-border">
                  <Building2 className="w-4 h-4" />
                  Industry: <span className="font-semibold text-foreground">{industryListing}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-sm border border-border">
                <Award className="w-4 h-4" />
                Organizations funded: <span className="font-semibold text-foreground">{donations.length}</span>
              </div>
            </div>
          </div>
          <div className="text-right bg-surface-sunken p-6 rounded-md border border-border flex-shrink-0">
            <div className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Total tracked funding</div>
            <div className="text-2xl font-semibold text-enacted flex items-center justify-end">
              {formatDollar(totalAmount)}
            </div>
          </div>
        </div>
      </div>
      
      {aiInfo && <AIVerdictCard info={aiInfo} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── Sidebar: Organizations funded ───────────────────────────── */}
        <div className="flex flex-col gap-8">
          <div className="bg-surface border border-border rounded-md p-5">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              Organizations funded
            </h2>
            <div className="space-y-4">
              {donations.map((d, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-surface-sunken rounded-md border border-border transition-colors hover:bg-surface-sunken">
                  <div className="flex justify-between items-start">
                    <Link href={`/think-tanks/${d.tank_slug}`} className="font-bold text-foreground hover:text-accent transition-colors">
                      {d.tank_name}
                    </Link>
                    <span className="font-bold text-enacted">{formatDollar(d.amount)}</span>
                  </div>
                  <div className="flex flex-col gap-1 items-start text-xs text-muted">
                    <span className="px-2 py-0.5 rounded-sm bg-surface-sunken uppercase font-bold text-2xs tracking-wider text-muted">{d.lean}</span>
                    <span className="opacity-80">
                      {d.year ? `Year: ${d.year}` : 'Year: Unknown'}
                      {d.source ? <> &bull; Source: {d.source}</> : null}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Column: Policy Influence Traces ────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="bg-surface border border-border rounded-md p-5">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              Linked policy papers
            </h2>
            
            {influenceLinks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-md">
                <p className="text-muted">No explicit textual evidence traces tie this exact donor to specific policy papers yet.</p>
                <p className="text-xs text-muted mt-2">However, their funding supports the general operations of the think tanks listed left.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {influenceLinks.map((il, i) => (
                  <div key={i} className="rounded-md border border-border bg-surface-sunken overflow-hidden ">
                    {/* Tank Context */}
                    <div className="px-5 py-3 border-b border-border bg-surface-sunken flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 text-muted">
                        Targeting paper authored by: 
                        <Link href={`/think-tanks/${il.tank_slug}`} className="font-bold text-foreground hover:text-accent transition-colors">
                          {il.tank_name}
                        </Link>
                      </div>
                      <span className="flex items-center gap-1 font-semibold text-accent">
                        Confidence: {Math.round((il.strength || 0) * 100)}%
                      </span>
                    </div>
                    
                    {/* Paper Details */}
                    <div className="p-5">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-10 h-10 rounded-md bg-accent-wash flex items-center justify-center flex-shrink-0 mt-1">
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-muted">{il.paper_title}</h3>
                          <div className="text-xs text-muted mt-1">Published: {il.published_date || 'Unknown'}</div>
                        </div>
                      </div>
                      
                      {il.paper_summary && (
                        <div className="mb-4 text-sm text-muted italic border-l-2 border-accent/25 pl-3 leading-relaxed">
                          &quot;{il.paper_summary.length > 300 ? il.paper_summary.slice(0, 300) + '...' : il.paper_summary}&quot;
                        </div>
                      )}
                      
                      {/* Generative Narrative / Evidence */}
                      <div className="bg-surface-sunken rounded-sm p-4 border border-border relative">
                        <div className="absolute -top-3 left-4 bg-accent px-2 py-0.5 rounded text-2xs font-bold text-foreground uppercase tracking-wider">
                          Recorded evidence
                        </div>
                        <div className="text-sm text-muted leading-relaxed mt-2 italic">
                          &quot;{il.evidence}&quot;
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
