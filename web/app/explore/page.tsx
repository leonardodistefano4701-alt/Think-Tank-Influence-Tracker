import { getDb } from "@/lib/db";
import { Entity, Donor, InfluenceLink } from "@/lib/types";
import Link from "next/link";
import { Building2, DollarSign, Scale, ArrowRight, AlertTriangle } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

export default async function ExplorePage() {
  const db = getDb();

  const entities = db.prepare("SELECT * FROM entities WHERE type = 'think_tank'").all() as Entity[];

  // Get aggregated donor data per entity
  const donorStats = db.prepare(`
    SELECT entity_id, 
           COUNT(*) as donor_count, 
           SUM(amount) as total_amount,
           SUM(CASE WHEN is_foreign_govt = 1 THEN amount ELSE 0 END) as foreign_amount,
           SUM(CASE WHEN is_foreign_govt = 1 THEN 1 ELSE 0 END) as foreign_count
    FROM donors 
    GROUP BY entity_id
  `).all() as { entity_id: string; donor_count: number; total_amount: number; foreign_amount: number; foreign_count: number }[];

  const influenceLinks = db.prepare(`
    SELECT il.source_id, il.target_id, il.link_type, il.strength, il.evidence,
           l.title as leg_title, l.bill_id, l.status as leg_status
    FROM influence_links il
    LEFT JOIN legislation l ON il.target_id = l.id
    WHERE il.source_type = 'think_tank' AND il.target_type = 'legislation'
    ORDER BY il.strength DESC
  `).all() as (InfluenceLink & { leg_title?: string; bill_id?: string; leg_status?: string })[];

  // Top donors across all think tanks
  const topDonors = db.prepare(`
    SELECT d.donor_name, d.amount, d.industry, d.is_foreign_govt, e.name as tank_name, e.slug as tank_slug
    FROM donors d
    JOIN entities e ON d.entity_id = e.id
    ORDER BY d.amount DESC
    LIMIT 15
  `).all() as (Donor & { tank_name: string; tank_slug: string })[];

  const legislation = db.prepare("SELECT * FROM legislation ORDER BY introduced_date DESC").all() as {
    id: string; bill_id: string; title: string; congress: number; chamber: string; status: string; summary: string; introduced_date: string
  }[];

  const statsMap = new Map(donorStats.map(s => [s.entity_id, s]));

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="glass p-8 rounded-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Explore the <span className="text-primary">Network</span></h1>
        <p className="text-xl text-muted max-w-3xl">Trace the full pipeline: from donors to think tanks to policy advocacy to Congressional legislation.</p>
      </div>

      {/* ── Flow Visualization ──────────────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Scale className="w-6 h-6 text-yellow-500" />
          Donor → Think Tank → Legislation Pipeline
        </h2>

        <div className="flex flex-col gap-6">
          {entities.map(entity => {
            const stats = statsMap.get(entity.id);
            const entityLinks = influenceLinks.filter(l => l.source_id === entity.id);

            return (
              <div key={entity.id} className="rounded-xl border border-card-border overflow-hidden">
                {/* Tank Header */}
                <div className="flex items-center gap-4 p-4 bg-card-border/20">
                  <Building2 className="w-6 h-6 text-primary" />
                  <Link href={`/think-tanks/${entity.slug}`} className="font-bold text-lg text-white hover:text-primary transition-colors">
                    {entity.name}
                  </Link>
                  {entity.lean && <span className="px-2 py-0.5 text-xs bg-card-border rounded-full text-muted">{entity.lean}</span>}
                  <div className="ml-auto flex items-center gap-4 text-sm text-muted">
                    <span>{stats?.donor_count || 0} donors</span>
                    <span className="font-semibold text-primary">{formatDollar(stats?.total_amount || 0)}</span>
                    {(stats?.foreign_count || 0) > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {stats?.foreign_count} foreign
                      </span>
                    )}
                  </div>
                </div>

                {/* Influence Links */}
                {entityLinks.length > 0 && (
                  <div className="p-4 flex flex-col gap-2">
                    {entityLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <ArrowRight className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                          link.link_type === 'advocates_for' ? 'bg-green-500/20 text-green-400' :
                          link.link_type === 'opposes' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{link.link_type?.replace("_", " ")}</span>
                        <span className="text-white font-medium">{link.leg_title}</span>
                        {link.bill_id && <span className="text-muted font-mono text-xs">{link.bill_id}</span>}
                        <div className="ml-auto flex items-center gap-2">
                          {link.leg_status && <span className="px-1.5 py-0.5 text-[10px] bg-card-border rounded text-muted">{link.leg_status}</span>}
                          <div className="w-16 h-1.5 rounded-full bg-card-border overflow-hidden">
                            <div className={`h-full rounded-full ${(link.strength || 0) >= 0.85 ? 'bg-red-500' : (link.strength || 0) >= 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.round((link.strength || 0) * 100)}%` }} />
                          </div>
                          <span className="text-muted text-xs">{Math.round((link.strength || 0) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top Donors Across All Tanks ─────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-primary" />
          Biggest Donors Across All Think Tanks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topDonors.map((d, i) => (
            <div key={i} className="p-4 rounded-lg bg-card-border/30 hover:bg-card-border/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted">#{i + 1}</span>
                    <span className="font-semibold text-white text-sm truncate">{d.donor_name}</span>
                    {d.is_foreign_govt === 1 && (
                      <span className="px-1 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-bold rounded uppercase">Foreign</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    → <Link href={`/think-tanks/${(d as any).tank_slug}`} className="text-primary hover:underline">{(d as any).tank_name}</Link>
                  </div>
                  <div className="text-[10px] text-muted/60 mt-0.5">{d.industry}</div>
                </div>
                <span className="font-bold text-primary">{formatDollar(d.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tracked Legislation ─────────────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Scale className="w-6 h-6 text-blue-400" />
          Tracked Legislation
        </h2>
        <div className="flex flex-col gap-3">
          {legislation.map(leg => (
            <div key={leg.id} className="p-4 rounded-lg bg-card-border/30 hover:bg-card-border/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted">{leg.bill_id}</span>
                    <h4 className="font-semibold text-white">{leg.title}</h4>
                  </div>
                  <p className="text-sm text-muted line-clamp-2">{leg.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted whitespace-nowrap">
                  <span className="px-2 py-0.5 bg-card-border rounded text-muted">{leg.status}</span>
                  <span>{leg.chamber} • {leg.congress}th</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
