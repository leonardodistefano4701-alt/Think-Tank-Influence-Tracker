import { getDb } from "@/lib/db";
import type { PaperLinkRow, VerdictRow, LegislationMeta } from "@/lib/rows";

type ActionRecord = { date?: string; text?: string; type?: string; action_code?: string };
type RawAction = ActionRecord | string;
import { Legislation } from "@/lib/types";
import { Scale, Users, FileText, CheckCircle, Clock, XCircle, TrendingUp, Calendar, ExternalLink, Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import AIVerdictCard from "@/components/AIVerdictCard";
import React from 'react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const searchId = decodeURIComponent(id);
  const row = getDb()
    .prepare("SELECT bill_id, title, status FROM legislation WHERE id = ? OR bill_id = ?")
    .get(searchId, searchId) as
    | { bill_id: string | null; title: string | null; status: string | null }
    | undefined;
  if (!row) return { title: "Not found" };
  return {
    title: row.bill_id ? `${row.bill_id} — ${row.title ?? "Untitled bill"}` : row.title,
    description: `Status: ${row.status ?? "unknown"}. Policy papers and influence links tracked against this bill.`,
  };
}

function statusIcon(status: string) {
  if (status === 'Signed into Law') return <CheckCircle className="w-5 h-5 text-muted" />;
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return <TrendingUp className="w-5 h-5 text-muted" />;
  if (status === 'Failed') return <XCircle className="w-5 h-5 text-muted" />;
  return <Clock className="w-5 h-5 text-muted" />;
}

function statusColor(status: string) {
  if (status === 'Signed into Law') return 'bg-enacted-wash text-enacted border border-enacted/25';
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return 'bg-progress-wash text-progress border border-border';
  if (status === 'Failed') return 'bg-failed-wash text-failed border border-failed/25';
  return 'bg-surface-sunken text-muted border border-gray-500/30';
}

export default async function LegislationProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const db = getDb();
  
  const searchId = decodeURIComponent(resolvedParams.id);
  
  // Find bill by UUID or bill_id
  const bill = db.prepare("SELECT * FROM legislation WHERE id = ? OR bill_id = ?").get(searchId, searchId) as Legislation | undefined;
  if (!bill) return notFound();
  
  let meta: LegislationMeta = {};
  if (bill.metadata) {
    try {
      meta = JSON.parse(bill.metadata);
    } catch {}
  }
  
  // recent_actions is stored double-encoded (a JSON string inside the metadata
  // JSON), but tolerate an already-decoded array. The previous version called
  // JSON.parse inside the `if` condition, so a real array threw straight to
  // catch and the else-if fallback was unreachable.
  let actions: RawAction[] = [];
  const rawActions = meta.recent_actions;
  if (Array.isArray(rawActions)) {
    actions = rawActions;
  } else if (typeof rawActions === "string" && rawActions) {
    try {
      const parsed = JSON.parse(rawActions);
      if (Array.isArray(parsed)) actions = parsed;
    } catch {
      actions = [];
    }
  }

  // Older rows stored each action as a single "date: text" string. Normalize
  // both shapes here so the markup below doesn't have to branch on the type.
  const normalized: ActionRecord[] = actions.map((entry) => {
    if (typeof entry === "string") {
      const [date, ...rest] = entry.split(":");
      return { date, text: rest.join(":").trim() };
    }
    return entry ?? {};
  });

  // Newest first, without mutating the source array. `.reverse()` mutates in
  // place, and the stored order is not guaranteed, so sort explicitly.
  const timeline = [...normalized].sort((a, b) =>
    String(b?.date ?? "").localeCompare(String(a?.date ?? ""))
  );

  // Find influence links specifically targeting this legislation
  // "Who influenced this bill?"
  const influenceLinks = db.prepare(`
    SELECT il.*, 
           pp.title as paper_title, pp.published_date, pp.url as paper_url, pp.summary as paper_summary,
           e.name as tank_name, e.slug as tank_slug, e.lean as tank_lean
    FROM influence_links il
    JOIN policy_papers pp ON il.source_id = pp.id
    JOIN entities e ON pp.entity_id = e.id
    WHERE il.target_id = ? AND il.target_type = 'legislation' AND il.source_type = 'policy_paper' AND (il.provenance IS NULL OR il.provenance != 'seeded_demo')
    ORDER BY il.strength DESC, pp.published_date DESC
  `).all(bill.id) as PaperLinkRow[];

  const verdictRow = db.prepare("SELECT * FROM analysis_verdicts WHERE target_id = ?")
    .get(bill.id) as VerdictRow | undefined;
  
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
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-surface-sunken font-mono text-sm font-bold text-accent">
                {bill.bill_id}
              </span>
              <span className={`px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2   ${statusColor(bill.status || '')}`}>
                {statusIcon(bill.status || '')}
                {bill.status || 'Unknown Status'}
              </span>
              {bill.policy_area && (
                <span className="px-3 py-1 rounded-full bg-accent-wash text-accent border border-blue-500/20 text-sm font-medium">
                  {bill.policy_area}
                </span>
              )}
            </div>
            
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight text-foreground mb-4">
              {bill.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              {bill.chamber && (
                <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-sm border border-border">
                  <Building2 className="w-4 h-4" />
                  Chamber: <span className="font-semibold text-foreground capitalize">{bill.chamber}</span>
                </div>
              )}
              {bill.introduced_date && (
                <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-sm border border-border">
                  <Calendar className="w-4 h-4" />
                  Introduced: <span className="font-semibold text-foreground">{bill.introduced_date}</span>
                </div>
              )}
              {meta.sponsors && (
                <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-sm border border-border">
                  <Users className="w-4 h-4" />
                  Primary Sponsor: <span className="font-semibold text-foreground">{meta.sponsors.split(',')[0]}</span>
                </div>
              )}
              {meta.congress_session && (
                <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-sm border border-border">
                  <Scale className="w-4 h-4" />
                  Congress: <span className="font-semibold text-foreground">{meta.congress_session}</span>
                </div>
              )}
              {meta.govinfo_url && (
                <a href={meta.govinfo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-accent-wash hover:bg-accent-wash text-accent transition-colors px-3 py-1.5 rounded-sm border border-accent/25">
                  <ExternalLink className="w-4 h-4" />
                  View on GovInfo
                </a>
              )}
            </div>
          </div>
        </div>
        
        {bill.summary && (
          <div className="bg-surface-sunken p-5 rounded-md border border-border">
            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Official Summary
            </h3>
            <p className="text-muted leading-relaxed">
              {bill.summary}
            </p>
          </div>
        )}
        
        {bill.topic_tags && (
          <div className="mt-4 flex flex-wrap gap-2">
            {bill.topic_tags.split(',').map((tag, idx) => (
              <span key={idx} className="px-2 py-1 bg-surface-sunken text-muted rounded text-xs">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {aiInfo && <AIVerdictCard info={aiInfo} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ── Main Column: Influence & Analysis ────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="bg-surface border border-border rounded-md p-5">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              Think Tank Influence
            </h2>
            
            {influenceLinks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-md">
                <p className="text-muted">No explicit think tank influence links mapped for this legislation yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {influenceLinks.map((il, i) => (
                  <div key={i} className="rounded-md border border-border bg-surface-sunken overflow-hidden ">
                    {/* Tank & Action Header */}
                    <div className="px-5 py-4 border-b border-border bg-surface-sunken flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Link href={`/think-tanks/${il.tank_slug}`} className="font-bold text-foreground hover:text-accent transition-colors text-lg">
                          {il.tank_name}
                        </Link>
                        <span className="px-2 py-0.5 text-2xs rounded-full bg-surface-sunken text-muted font-bold uppercase tracking-wider">
                          {il.tank_lean}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-md ${il.link_type === 'opposes' ? 'bg-failed-wash text-failed' : 'bg-accent-wash text-accent'}`}>
                          {il.link_type}
                        </span>
                      </div>
                    </div>
                    
                    {/* Paper Details */}
                    <div className="p-5">
                      <h3 className="font-semibold text-lg text-muted mb-2">{il.paper_title}</h3>
                      <div className="flex gap-4 text-xs text-muted mb-4">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Published: {il.published_date || 'Unknown'}</span>
                        {il.paper_url && (
                          <a href={il.paper_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:text-accent">
                            <ExternalLink className="w-3.5 h-3.5" /> Read Original
                          </a>
                        )}
                        <span className="flex items-center gap-1 ml-auto font-semibold">
                          Confidence Level: {Math.round((il.strength || 0) * 100)}%
                        </span>
                      </div>

                      {il.paper_summary && (
                        <div className="mb-4 text-sm text-muted italic border-l-2 border-accent/25 pl-3">
                          &quot;{il.paper_summary.length > 300 ? il.paper_summary.slice(0,300) + '...' : il.paper_summary}&quot;
                        </div>
                      )}
                      
                      {/* Generative Narrative / Evidence */}
                      <div className="bg-surface-sunken rounded-sm p-4 border border-border">
                        <div className="text-xs text-muted leading-relaxed">
                          <span className="font-bold text-muted mb-1 block uppercase tracking-wider">Linked policy papers</span>
                          <span className="text-muted">{il.evidence}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* ── Sidebar: Details & Timeline ──────────────────────────── */}
        <div className="flex flex-col gap-8">
          
          <div className="bg-surface border border-border rounded-md p-5">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              Sponsorship
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Primary Sponsors</div>
                <div className="text-sm text-muted leading-relaxed font-medium">
                  {meta.sponsors ? meta.sponsors.split(',').map((s: string, i: number) => (
                    <div key={i} className="mb-1">{s.trim()}</div>
                  )) : 'Unknown'}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Cosponsors</div>
                <div className="text-2xl font-semibold text-foreground">
                  {meta.cosponsors_count ?? 0}
                </div>
              </div>
              {meta.committees && (
                <div className="border-t border-border pt-4">
                  <div className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Committees</div>
                  <div className="text-sm text-muted leading-relaxed">
                    {meta.committees.split(',').map((c: string, i: number) => (
                      <div key={i} className="bg-surface-sunken px-2 py-1 rounded inline-block m-1">{c.trim()}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-surface border border-border rounded-md p-5">
            <h2 className="text-lg font-semibold tracking-tight mb-4">
              <Clock className="w-5 h-5 text-muted" />
              Recent actions
            </h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted">No timeline actions recorded.</p>
              ) : (
                timeline.map((action, i) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Node */}
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-accent bg-surface-sunken shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow" />
                    {/* Content */}
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-sm bg-surface-sunken border border-border text-sm">
                      <time className="block text-xs font-bold text-accent mb-1">
                        {action.date}
                      </time>
                      <div className="text-muted">
                        {action.text}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
