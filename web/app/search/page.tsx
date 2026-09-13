import { getDb } from "@/lib/db";
import type { LegislationRow, PolicyPaperRow, LobbyingRow, InfluenceLinkRow, DonationRow } from "@/lib/rows";
import { Entity } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import Link from "next/link";
import { Megaphone } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

function highlightMatch(text: string | null | undefined, query: string) {
  if (!query || !text) return text ?? null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  // Compare case-insensitively rather than re-testing with a /g/ regex: a
  // global regex carries lastIndex across .test() calls, so every other match
  // used to report false and silently lose its highlight.
  const needle = query.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === needle
      ? <mark key={i} className="bg-accent-wash text-foreground rounded px-0.5">{part}</mark>
      : part
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || "";
  const db = getDb();

  // Check if FTS5 tables exist
  let hasFts = false;
  try {
    db.prepare("SELECT 1 FROM search_legislation LIMIT 1").get();
    hasFts = true;
  } catch { }

  // Sanitize FTS query: remove special chars, add * for prefix matching
  const ftsQuery = q.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(w => `"${w}"*`).join(' ');

  // ── Entity search ────────────────────────────────────────────────
  let entities: Entity[] = [];
  if (q) {
    if (hasFts) {
      try {
        entities = db.prepare(`
          SELECT e.* FROM entities e
          INNER JOIN search_entities se ON e.rowid = se.rowid
          WHERE search_entities MATCH ?
          ORDER BY se.rank
          LIMIT 20
        `).all(ftsQuery) as Entity[];
      } catch {
        entities = db.prepare(`SELECT * FROM entities WHERE name LIKE ? ORDER BY name`).all(`%${q}%`) as Entity[];
      }
    } else {
      entities = db.prepare(`SELECT * FROM entities WHERE name LIKE ? OR type LIKE ? OR slug LIKE ? ORDER BY name`).all(`%${q}%`, `%${q}%`, `%${q}%`) as Entity[];
    }
  }

  // ── Donor search ─────────────────────────────────────────────────
  let donors: DonationRow[] = [];
  if (q) {
    donors = db.prepare(`
      SELECT d.*, e.name as tank_name, e.slug as tank_slug
      FROM donors d
      JOIN entities e ON d.entity_id = e.id
      WHERE d.donor_name LIKE ? OR d.industry LIKE ? OR d.source LIKE ?
      ORDER BY d.amount DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as DonationRow[];
  }

  // ── Legislation search (FTS5 powered) ─────────────────────────────
  let legislation: LegislationRow[] = [];
  if (q) {
    if (hasFts) {
      try {
        legislation = db.prepare(`
          SELECT l.* FROM legislation l
          INNER JOIN search_legislation sl ON l.rowid = sl.rowid
          WHERE search_legislation MATCH ?
          ORDER BY sl.rank
          LIMIT 30
        `).all(ftsQuery) as LegislationRow[];
      } catch {
        legislation = db.prepare(`SELECT * FROM legislation WHERE title LIKE ? OR bill_id LIKE ? LIMIT 30`).all(`%${q}%`, `%${q}%`) as LegislationRow[];
      }
    } else {
      legislation = db.prepare(`SELECT * FROM legislation WHERE title LIKE ? OR bill_id LIKE ? LIMIT 30`).all(`%${q}%`, `%${q}%`) as LegislationRow[];
    }
  }

  // ── Policy Paper search ──────────────────────────────────────────
  let papers: PolicyPaperRow[] = [];
  if (q) {
    papers = db.prepare(`
      SELECT pp.*, e.name as tank_name, e.slug as tank_slug
      FROM policy_papers pp
      JOIN entities e ON pp.entity_id = e.id
      WHERE pp.title LIKE ? OR pp.summary LIKE ? OR pp.topic_tags LIKE ?
      ORDER BY pp.published_date DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as PolicyPaperRow[];
  }

  // ── Lobbying search ──────────────────────────────────────────────
  let lobbying: LobbyingRow[] = [];
  if (q) {
    lobbying = db.prepare(`
      SELECT lb.*, e.name as tank_name, e.slug as tank_slug
      FROM lobbying lb
      JOIN entities e ON lb.client_entity_id = e.id
      WHERE lb.registrant_name LIKE ? OR lb.issue_description LIKE ? OR lb.client_name LIKE ?
      ORDER BY lb.amount DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as LobbyingRow[];
  }

  // ── Influence links search ───────────────────────────────────────
  let influenceLinks: InfluenceLinkRow[] = [];
  if (q) {
    influenceLinks = db.prepare(`
      SELECT il.*, 
        COALESCE(e_src.name, pp_src.title) as source_name,
        COALESCE(e_tgt.name, l_tgt.title, pp_tgt.title) as target_name
      FROM influence_links il
      LEFT JOIN entities e_src ON il.source_id = e_src.id AND il.source_type IN ('think_tank','media_amplifier')
      LEFT JOIN policy_papers pp_src ON il.source_id = pp_src.id AND il.source_type = 'policy_paper'
      LEFT JOIN entities e_tgt ON il.target_id = e_tgt.id AND il.target_type IN ('think_tank','media_amplifier')
      LEFT JOIN legislation l_tgt ON il.target_id = l_tgt.id AND il.target_type = 'legislation'
      LEFT JOIN policy_papers pp_tgt ON il.target_id = pp_tgt.id AND il.target_type = 'policy_paper'
      WHERE il.evidence LIKE ? OR il.link_type LIKE ?
      ORDER BY il.strength DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`) as InfluenceLinkRow[];
  }

  const totalResults = entities.length + donors.length + legislation.length + papers.length + lobbying.length + influenceLinks.length;

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Search Header */}
      <div className="bg-surface border border-border rounded-md p-5">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Results for &ldquo;<span className="text-accent">{q}</span>&rdquo;
          </h1>
        </div>
        <p className="text-muted">
          {totalResults > 0
            ? `Found ${totalResults} result${totalResults > 1 ? 's' : ''} across ${[
                entities.length > 0 && 'entities',
                donors.length > 0 && 'donors',
                legislation.length > 0 && 'legislation',
                papers.length > 0 && 'policy papers',
                lobbying.length > 0 && 'lobbying',
                influenceLinks.length > 0 && 'influence links',
              ].filter(Boolean).join(', ')}`
            : 'No results found. Try a different search term.'}
        </p>
        {/* Quick nav */}
        {totalResults > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {entities.length > 0 && <a href="#entities" className="px-3 py-1 rounded-sm bg-accent-wash text-accent text-sm hover:bg-accent-wash transition-colors">Entities ({entities.length})</a>}
            {donors.length > 0 && <a href="#donors" className="px-3 py-1 rounded-sm bg-enacted-wash text-enacted text-sm hover:bg-enacted-wash transition-colors">Donors ({donors.length})</a>}
            {legislation.length > 0 && <a href="#legislation" className="px-3 py-1 rounded-sm bg-progress-wash text-progress text-sm hover:bg-progress-wash transition-colors">Legislation ({legislation.length})</a>}
            {papers.length > 0 && <a href="#papers" className="px-3 py-1 rounded-sm bg-accent-wash text-accent text-sm hover:bg-accent-wash transition-colors">Policy papers ({papers.length})</a>}
            {lobbying.length > 0 && <a href="#lobbying" className="px-3 py-1 rounded-sm bg-demo-wash text-demo text-sm hover:bg-demo-wash transition-colors">Lobbying ({lobbying.length})</a>}
            {influenceLinks.length > 0 && <a href="#links" className="px-3 py-1 rounded-sm bg-ai-wash text-ai text-sm hover:bg-ai-wash transition-colors">Influence links ({influenceLinks.length})</a>}
          </div>
        )}
      </div>

      {/* ── Entities ─────────────────────────────────────────────────── */}
      {entities.length > 0 && (
        <section id="entities">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Think Tanks & Entities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map(entity => (
              <ProfileCard key={entity.id} entity={entity} />
            ))}
          </div>
        </section>
      )}

      {/* ── Donors ───────────────────────────────────────────────────── */}
      {donors.length > 0 && (
        <section id="donors">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Donors
          </h2>
          <div className="flex flex-col gap-2">
            {donors.map((d, i) => (
              <div key={d.id} className="bg-surface border border-border p-4 rounded-md flex items-center justify-between hover:border-accent/25 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono text-muted">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link prefetch={false} href={`/donors/${d.id}`} className="font-bold text-foreground hover:text-accent transition-colors">{highlightMatch(d.donor_name, q)}</Link>
                      {d.is_foreign_govt === 1 && (
                        <span className="px-1.5 py-0.5 bg-failed-wash text-failed text-2xs font-bold rounded-md uppercase flex-shrink-0">Foreign</span>
                      )}
                    </div>
                    <div className="text-xs text-muted flex gap-3 mt-0.5">
                      <span>{highlightMatch(d.industry || '', q)}</span>
                      <span>→ <Link prefetch={false} href={`/think-tanks/${d.tank_slug}`} className="text-accent hover:underline">{d.tank_name}</Link></span>
                      {d.year && <span>({d.year})</span>}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-accent text-lg">{formatDollar(d.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Legislation ──────────────────────────────────────────────── */}
      {legislation.length > 0 && (
        <section id="legislation">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Legislation
          </h2>
          <div className="flex flex-col gap-2">
            {legislation.map(leg => (
              <div key={leg.id} className="bg-surface border border-border p-4 rounded-md hover:border-accent/25 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-muted">{highlightMatch(leg.bill_id, q)}</span>
                      <Link prefetch={false} href={`/legislation/${leg.id}`} className="font-bold text-foreground hover:text-progress transition-colors">{highlightMatch(leg.title, q)}</Link>
                    </div>
                    <p className="text-sm text-muted line-clamp-2">{highlightMatch(leg.summary || '', q)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-md whitespace-nowrap ${
                    leg.status === 'Signed into Law' ? 'bg-enacted-wash text-enacted' :
                    leg.status === 'Passed House' ? 'bg-progress-wash text-progress' :
                    'bg-surface-sunken text-muted'
                  }`}>{leg.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Policy papers ────────────────────────────────────────────── */}
      {papers.length > 0 && (
        <section id="papers">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Policy papers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {papers.map(p => (
              <div key={p.id} className="bg-surface border border-border p-4 rounded-md hover:border-accent/25 transition-colors">
                <div className="font-bold text-foreground mb-1">{highlightMatch(p.title, q)}</div>
                <p className="text-sm text-muted line-clamp-2 mb-2">{highlightMatch(p.summary || '', q)}</p>
                <div className="flex items-center justify-between">
                  <Link prefetch={false} href={`/think-tanks/${p.tank_slug}`} className="text-xs text-accent hover:underline">{p.tank_name}</Link>
                  <div className="flex gap-1">
                    {(p.topic_tags || '').split(',').map((tag: string) => (
                      <span key={tag} className="px-1.5 py-0.5 text-2xs bg-surface-sunken rounded-md text-muted">{highlightMatch(tag.trim(), q)}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Lobbying ─────────────────────────────────────────────────── */}
      {lobbying.length > 0 && (
        <section id="lobbying">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            <Megaphone className="w-5 h-5 text-muted" />
            Lobbying Disclosures
          </h2>
          <div className="flex flex-col gap-2">
            {lobbying.map(lb => (
              <div key={lb.id} className="bg-surface border border-border p-4 rounded-md hover:border-accent/25 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground">{highlightMatch(lb.registrant_name, q)}</span>
                    <span className="text-muted text-sm ml-2">→ <Link prefetch={false} href={`/think-tanks/${lb.tank_slug}`} className="text-accent hover:underline">{lb.tank_name}</Link></span>
                    <p className="text-sm text-muted mt-1">{highlightMatch(lb.issue_description || '', q)}</p>
                  </div>
                  <span className="font-bold text-demo">{formatDollar(lb.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Influence links ──────────────────────────────────────────── */}
      {influenceLinks.length > 0 && (
        <section id="links">
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Influence links
          </h2>
          <div className="flex flex-col gap-2">
            {influenceLinks.map((link, i) => (
              <div key={i} className="bg-surface border border-border p-4 rounded-md hover:border-accent/25 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-foreground font-semibold">{link.source_name || 'Unknown'}</span>
                  <span className={`px-1.5 py-0.5 text-2xs font-bold rounded uppercase tracking-wider ${
                    link.link_type === 'advocates_for' ? 'bg-enacted-wash text-enacted' :
                    link.link_type === 'opposes' ? 'bg-failed-wash text-failed' :
                    link.link_type === 'informs' ? 'bg-accent-wash text-accent' :
                    'bg-surface-sunken text-muted'
                  }`}>{link.link_type?.replace("_", " ")}</span>
                  <span className="text-sm text-foreground font-semibold">{link.target_name || 'Unknown'}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                      <div className={`h-full rounded-full bg-accent`}
                        style={{ width: `${Math.round((link.strength || 0) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted">{Math.round((link.strength || 0) * 100)}%</span>
                  </div>
                </div>
                <p className="text-xs text-muted">{highlightMatch(link.evidence || '', q)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Back Link */}
      <div className="mt-4">
        <Link prefetch={false} href="/" className="text-accent hover:underline flex items-center gap-1">
          ← Back home
        </Link>
      </div>
    </div>
  );
}
