import { getDb } from "@/lib/db";
import { Legislation, PolicyPaper, Entity } from "@/lib/types";
import { Scale, Users, FileText, CheckCircle, Clock, XCircle, TrendingUp, Calendar, ExternalLink, Link2, Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import AIVerdictCard from "@/components/AIVerdictCard";
import React from 'react';

export const dynamic = 'force-dynamic';

function statusIcon(status: string) {
  if (status === 'Signed into Law') return <CheckCircle className="w-5 h-5 text-green-400" />;
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return <TrendingUp className="w-5 h-5 text-yellow-400" />;
  if (status === 'Failed') return <XCircle className="w-5 h-5 text-red-500" />;
  return <Clock className="w-5 h-5 text-muted" />;
}

function statusColor(status: string) {
  if (status === 'Signed into Law') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (status === 'Passed House' || status === 'Passed Senate' || status === 'Passed Both Chambers') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (status === 'Failed') return 'bg-red-500/20 text-red-500 border border-red-500/30';
  return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
}

export default async function LegislationProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const db = getDb();
  
  const searchId = decodeURIComponent(resolvedParams.id);
  
  // Find bill by UUID or bill_id
  const bill = db.prepare("SELECT * FROM legislation WHERE id = ? OR bill_id = ?").get(searchId, searchId) as Legislation | undefined;
  if (!bill) return notFound();
  
  let meta: any = {};
  if (bill.metadata) {
    try {
      meta = JSON.parse(bill.metadata);
    } catch {}
  }
  
  let actions = [];
  try {
    if (meta.recent_actions && Array.isArray(JSON.parse(meta.recent_actions))) {
      actions = JSON.parse(meta.recent_actions);
    } else if (Array.isArray(meta.recent_actions)) {
      actions = meta.recent_actions;
    }
  } catch {}

  // Find influence links specifically targeting this legislation
  // "Who influenced this bill?"
  const influenceLinks = db.prepare(`
    SELECT il.*, 
           pp.title as paper_title, pp.published_date, pp.url as paper_url, pp.summary as paper_summary,
           e.name as tank_name, e.slug as tank_slug, e.lean as tank_lean
    FROM influence_links il
    JOIN policy_papers pp ON il.source_id = pp.id
    JOIN entities e ON pp.entity_id = e.id
    WHERE il.target_id = ? AND il.target_type = 'legislation' AND il.source_type = 'policy_paper'
    ORDER BY il.strength DESC, pp.published_date DESC
  `).all(bill.id) as any[];

  const verdictRow = db.prepare("SELECT * FROM analysis_verdicts WHERE target_id = ?")
    .get(bill.id) as any | undefined;
  
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
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-purple-500" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-card-border/50 font-mono text-sm font-bold text-primary">
                {bill.bill_id}
              </span>
              <span className={`px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg backdrop-blur-md ${statusColor(bill.status || '')}`}>
                {statusIcon(bill.status || '')}
                {bill.status || 'Unknown Status'}
              </span>
              {bill.policy_area && (
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm font-medium">
                  {bill.policy_area}
                </span>
              )}
            </div>
            
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-white mb-4">
              {bill.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              {bill.chamber && (
                <div className="flex items-center gap-1.5 bg-card-border/30 px-3 py-1.5 rounded-lg border border-card-border">
                  <Building2 className="w-4 h-4" />
                  Chamber: <span className="font-semibold text-white capitalize">{bill.chamber}</span>
                </div>
              )}
              {bill.introduced_date && (
                <div className="flex items-center gap-1.5 bg-card-border/30 px-3 py-1.5 rounded-lg border border-card-border">
                  <Calendar className="w-4 h-4" />
                  Introduced: <span className="font-semibold text-white">{bill.introduced_date}</span>
                </div>
              )}
              {meta.sponsors && (
                <div className="flex items-center gap-1.5 bg-card-border/30 px-3 py-1.5 rounded-lg border border-card-border">
                  <Users className="w-4 h-4" />
                  Primary Sponsor: <span className="font-semibold text-white">{meta.sponsors.split(',')[0]}</span>
                </div>
              )}
              {meta.congress_session && (
                <div className="flex items-center gap-1.5 bg-card-border/30 px-3 py-1.5 rounded-lg border border-card-border">
                  <Scale className="w-4 h-4" />
                  Congress: <span className="font-semibold text-white">{meta.congress_session}</span>
                </div>
              )}
              {meta.govinfo_url && (
                <a href={meta.govinfo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary transition-colors px-3 py-1.5 rounded-lg border border-primary/20">
                  <ExternalLink className="w-4 h-4" />
                  View on GovInfo
                </a>
              )}
            </div>
          </div>
        </div>
        
        {bill.summary && (
          <div className="bg-card-border/20 p-5 rounded-xl border border-card-border/50">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Official Summary
            </h3>
            <p className="text-white/80 leading-relaxed">
              {bill.summary}
            </p>
          </div>
        )}
        
        {bill.topic_tags && (
          <div className="mt-4 flex flex-wrap gap-2">
            {bill.topic_tags.split(',').map((tag, idx) => (
              <span key={idx} className="px-2 py-1 bg-card-border/40 text-muted rounded text-xs">
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
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Link2 className="w-6 h-6 text-primary" />
              Think Tank Influence
            </h2>
            
            {influenceLinks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-card-border rounded-xl">
                <p className="text-muted">No explicit think tank influence links mapped for this legislation yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {influenceLinks.map((il, i) => (
                  <div key={i} className="rounded-xl border border-card-border/50 bg-card-border/10 overflow-hidden shadow-lg">
                    {/* Tank & Action Header */}
                    <div className="px-5 py-4 border-b border-card-border/50 bg-card-border/20 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-muted" />
                        <Link href={`/think-tanks/${il.tank_slug}`} className="font-bold text-white hover:text-primary transition-colors text-lg">
                          {il.tank_name}
                        </Link>
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-card-border text-muted font-bold uppercase tracking-wider">
                          {il.tank_lean}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-md \${il.link_type === 'opposes' ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                          {il.link_type}
                        </span>
                      </div>
                    </div>
                    
                    {/* Paper Details */}
                    <div className="p-5">
                      <h3 className="font-semibold text-lg text-white/90 mb-2">{il.paper_title}</h3>
                      <div className="flex gap-4 text-xs text-muted mb-4">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Published: {il.published_date || 'Unknown'}</span>
                        {il.paper_url && (
                          <a href={il.paper_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                            <ExternalLink className="w-3.5 h-3.5" /> Read Original
                          </a>
                        )}
                        <span className="flex items-center gap-1 ml-auto font-semibold">
                          Confidence Level: {Math.round((il.strength || 0) * 100)}%
                        </span>
                      </div>

                      {il.paper_summary && (
                        <div className="mb-4 text-sm text-white/70 italic border-l-2 border-primary/30 pl-3">
                          "{il.paper_summary.length > 300 ? il.paper_summary.slice(0,300) + '...' : il.paper_summary}"
                        </div>
                      )}
                      
                      {/* Generative Narrative / Evidence */}
                      <div className="bg-space-900 rounded-lg p-4 border border-card-border">
                        <div className="text-xs text-muted leading-relaxed">
                          <span className="font-bold text-white/60 mb-1 block uppercase tracking-wider">Legislative Chain Link Context</span>
                          <span className="text-white/80">{il.evidence}</span>
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
          
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
              <Users className="w-5 h-5 text-yellow-500" />
              Sponsorship
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Primary Sponsors</div>
                <div className="text-sm text-white/90 leading-relaxed font-medium">
                  {meta.sponsors ? meta.sponsors.split(',').map((s: string, i: number) => (
                    <div key={i} className="mb-1">{s.trim()}</div>
                  )) : 'Unknown'}
                </div>
              </div>
              <div className="border-t border-card-border pt-4">
                <div className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Cosponsors</div>
                <div className="text-2xl font-extrabold text-white">
                  {meta.cosponsors_count ?? 0}
                </div>
              </div>
              {meta.committees && (
                <div className="border-t border-card-border pt-4">
                  <div className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Committees</div>
                  <div className="text-sm text-white/80 leading-relaxed">
                    {meta.committees.split(',').map((c: string, i: number) => (
                      <div key={i} className="bg-card-border/50 px-2 py-1 rounded inline-block m-1">{c.trim()}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Recent Actions Timeline
            </h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-card-border before:to-transparent">
              {actions.length === 0 ? (
                <p className="text-sm text-muted">No timeline actions recorded.</p>
              ) : (
                actions.reverse().map((action: any, i: number) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Node */}
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-primary bg-space-900 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow" />
                    {/* Content */}
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg bg-card-border/20 border border-card-border/50 text-sm">
                      <time className="block text-xs font-bold text-primary mb-1">
                        {typeof action === 'string' ? action.split(':')[0] : action.date}
                      </time>
                      <div className="text-white/80">
                        {typeof action === 'string' ? action.split(':').slice(1).join(':') : action.text}
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
