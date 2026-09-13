import { getDb } from "@/lib/db";
import { ProvenanceBanner } from "@/components/ProvenanceBadge";
import { Entity, Donor, InfluenceLink } from "@/lib/types";
import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await searchParams;
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

  // Paginated. This was previously an unbounded SELECT * over 20,428 rows,
  // all of which were rendered on every request under force-dynamic - roughly
  // 44 MB of HTML per page view.
  const PAGE_SIZE = 25;
  const page = Math.max(1, Number.parseInt(resolvedParams.page ?? "1", 10) || 1);

  const { total } = db
    .prepare("SELECT COUNT(*) as total FROM legislation")
    .get() as { total: number };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const legislation = db
    .prepare(
      `SELECT id, bill_id, title, congress, chamber, status, summary, introduced_date
         FROM legislation
        ORDER BY introduced_date DESC, bill_id DESC
        LIMIT ? OFFSET ?`
    )
    .all(PAGE_SIZE, (currentPage - 1) * PAGE_SIZE) as {
    id: string; bill_id: string; title: string; congress: number; chamber: string; status: string; summary: string; introduced_date: string
  }[];

  const statsMap = new Map(donorStats.map(s => [s.entity_id, s]));

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Explore</h1>
        <p className="mt-2 text-base text-muted max-w-2xl leading-relaxed">Which donors fund which organizations, and which bills those organizations&apos; papers are linked to.</p>
        <div className="mt-4"><ProvenanceBanner kinds={["seeded_demo", "ai_generated"]}>
          Influence links shown here are either hand-authored or asserted by a language model, and their strength values mix three incompatible scales. Bill records are from GovInfo.
        </ProvenanceBanner></div>
      </header>

      {/* ── Flow Visualization ──────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Donors, organizations and bills
        </h2>

        <div className="flex flex-col gap-6">
          {entities.map(entity => {
            const stats = statsMap.get(entity.id);
            const entityLinks = influenceLinks.filter(l => l.source_id === entity.id);

            return (
              <div key={entity.id} className="rounded-md border border-border overflow-hidden">
                {/* Tank Header */}
                <div className="flex items-center gap-4 p-4 bg-surface-sunken">
                  <Link prefetch={false} href={`/think-tanks/${entity.slug}`} className="font-bold text-lg text-foreground hover:text-accent transition-colors">
                    {entity.name}
                  </Link>
                  {entity.lean && <span className="px-2 py-0.5 text-xs bg-surface-sunken rounded-full text-muted">{entity.lean}</span>}
                  <div className="ml-auto flex items-center gap-4 text-sm text-muted">
                    <span>{stats?.donor_count || 0} donors</span>
                    <span className="font-semibold text-accent">{formatDollar(stats?.total_amount || 0)}</span>
                    {(stats?.foreign_count || 0) > 0 && (
                      <span className="flex items-center gap-1 text-failed">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {stats?.foreign_count} foreign
                      </span>
                    )}
                  </div>
                </div>

                {/* Influence links */}
                {entityLinks.length > 0 && (
                  <div className="p-4 flex flex-col gap-2">
                    {entityLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <ArrowRight className="w-4 h-4 text-progress flex-shrink-0" />
                        <span className={`px-1.5 py-0.5 text-2xs font-bold rounded uppercase tracking-wider ${
                          link.link_type === 'advocates_for' ? 'bg-enacted-wash text-enacted' :
                          link.link_type === 'opposes' ? 'bg-failed-wash text-failed' :
                          'bg-surface-sunken text-muted'
                        }`}>{link.link_type?.replace("_", " ")}</span>
                        <span className="text-foreground font-medium">{link.leg_title}</span>
                        {link.bill_id && <span className="text-muted font-mono text-xs">{link.bill_id}</span>}
                        <div className="ml-auto flex items-center gap-2">
                          {link.leg_status && <span className="px-1.5 py-0.5 text-2xs bg-surface-sunken rounded text-muted">{link.leg_status}</span>}
                          <div className="w-16 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                            <div className={`h-full rounded-full bg-accent`}
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
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Largest donors overall
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topDonors.map((d, i) => (
            <div key={i} className="p-4 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted">#{i + 1}</span>
                    <span className="font-semibold text-foreground text-sm truncate">{d.donor_name}</span>
                    {d.is_foreign_govt === 1 && (
                      <span className="px-1 py-0.5 bg-failed-wash text-failed text-2xs font-bold rounded uppercase">Foreign</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    → <Link prefetch={false} href={`/think-tanks/${d.tank_slug}`} className="text-accent hover:underline">{d.tank_name}</Link>
                  </div>
                  <div className="text-2xs text-muted/60 mt-0.5">{d.industry}</div>
                </div>
                <span className="font-bold text-accent">{formatDollar(d.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tracked Legislation ─────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Tracked Legislation
          <span className="text-sm font-normal text-muted">
            ({total.toLocaleString()} bills)
          </span>
        </h2>
        <div className="flex flex-col gap-3">
          {legislation.map(leg => (
            <div key={leg.id} className="p-4 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted">{leg.bill_id}</span>
                    <h4 className="font-semibold text-foreground">{leg.title}</h4>
                  </div>
                  <p className="text-sm text-muted line-clamp-2">{leg.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted whitespace-nowrap">
                  <span className="px-2 py-0.5 bg-surface-sunken rounded text-muted">{leg.status}</span>
                  <span>{leg.chamber} • {leg.congress}th</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <nav
          aria-label="Legislation pagination"
          className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-border"
        >
          {currentPage > 1 ? (
            <Link
              href={`/explore?page=${currentPage - 1}`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              &larr; Previous
            </Link>
          ) : (
            <span className="text-sm text-muted/50">&larr; Previous</span>
          )}
          <span className="text-sm text-muted tabular-nums">
            Page {currentPage.toLocaleString()} of {pageCount.toLocaleString()}
          </span>
          {currentPage < pageCount ? (
            <Link
              href={`/explore?page=${currentPage + 1}`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Next &rarr;
            </Link>
          ) : (
            <span className="text-sm text-muted/50">Next &rarr;</span>
          )}
        </nav>
      </div>
    </div>
  );
}
