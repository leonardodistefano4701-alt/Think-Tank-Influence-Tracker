import { getDb } from "@/lib/db";
import { Entity, Donor, InfluenceLink } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import Link from "next/link";
import { Search, DollarSign, FileText, Scale, AlertTriangle, Building2, Link2, Megaphone } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

function highlightMatch(text: string, query: string) {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-primary/30 text-white rounded px-0.5">{part}</mark>
      : part
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
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
  let donors: (Donor & { tank_name: string; tank_slug: string })[] = [];
  if (q) {
    donors = db.prepare(`
      SELECT d.*, e.name as tank_name, e.slug as tank_slug
      FROM donors d
      JOIN entities e ON d.entity_id = e.id
      WHERE d.donor_name LIKE ? OR d.industry LIKE ? OR d.source LIKE ?
      ORDER BY d.amount DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as any[];
  }

  // ── Legislation search (FTS5 powered) ─────────────────────────────
  let legislation: any[] = [];
  if (q) {
    if (hasFts) {
      try {
        legislation = db.prepare(`
          SELECT l.* FROM legislation l
          INNER JOIN search_legislation sl ON l.rowid = sl.rowid
          WHERE search_legislation MATCH ?
          ORDER BY sl.rank
          LIMIT 30
        `).all(ftsQuery) as any[];
      } catch {
        legislation = db.prepare(`SELECT * FROM legislation WHERE title LIKE ? OR bill_id LIKE ? LIMIT 30`).all(`%${q}%`, `%${q}%`) as any[];
      }
    } else {
      legislation = db.prepare(`SELECT * FROM legislation WHERE title LIKE ? OR bill_id LIKE ? LIMIT 30`).all(`%${q}%`, `%${q}%`) as any[];
    }
  }

  // ── Policy Paper search ──────────────────────────────────────────
  let papers: any[] = [];
  if (q) {
    papers = db.prepare(`
      SELECT pp.*, e.name as tank_name, e.slug as tank_slug
      FROM policy_papers pp
      JOIN entities e ON pp.entity_id = e.id
      WHERE pp.title LIKE ? OR pp.summary LIKE ? OR pp.topic_tags LIKE ?
      ORDER BY pp.published_date DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as any[];
  }

  // ── Lobbying search ──────────────────────────────────────────────
  let lobbying: any[] = [];
  if (q) {
    lobbying = db.prepare(`
      SELECT lb.*, e.name as tank_name, e.slug as tank_slug
      FROM lobbying lb
      JOIN entities e ON lb.client_entity_id = e.id
      WHERE lb.registrant_name LIKE ? OR lb.issue_description LIKE ? OR lb.client_name LIKE ?
      ORDER BY lb.amount DESC
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as any[];
  }

  // ── Influence links search ───────────────────────────────────────
  let influenceLinks: any[] = [];
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
    `).all(`%${q}%`, `%${q}%`) as any[];
  }

  const totalResults = entities.length + donors.length + legislation.length + papers.length + lobbying.length + influenceLinks.length;

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Search Header */}
      <div className="glass p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-2">
          <Search className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            Results for &ldquo;<span className="text-primary">{q}</span>&rdquo;
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
            {entities.length > 0 && <a href="#entities" className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm hover:bg-primary/30 transition-colors">Entities ({entities.length})</a>}
            {donors.length > 0 && <a href="#donors" className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors">Donors ({donors.length})</a>}
            {legislation.length > 0 && <a href="#legislation" className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm hover:bg-yellow-500/30 transition-colors">Legislation ({legislation.length})</a>}
            {papers.length > 0 && <a href="#papers" className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 transition-colors">Policy Papers ({papers.length})</a>}
            {lobbying.length > 0 && <a href="#lobbying" className="px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-colors">Lobbying ({lobbying.length})</a>}
            {influenceLinks.length > 0 && <a href="#links" className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors">Influence Links ({influenceLinks.length})</a>}
          </div>
        )}
      </div>

      {/* ── Entities ─────────────────────────────────────────────────── */}
      {entities.length > 0 && (
        <section id="entities">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
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
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Donors
          </h2>
          <div className="flex flex-col gap-2">
            {donors.map((d, i) => (
              <div key={d.id} className="glass p-4 rounded-xl flex items-center justify-between hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono text-muted">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{highlightMatch(d.donor_name, q)}</span>
                      {d.is_foreign_govt === 1 && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-md uppercase flex-shrink-0">Foreign</span>
                      )}
                    </div>
                    <div className="text-xs text-muted flex gap-3 mt-0.5">
                      <span>{highlightMatch(d.industry || '', q)}</span>
                      <span>→ <Link href={`/think-tanks/${d.tank_slug}`} className="text-primary hover:underline">{d.tank_name}</Link></span>
                      {d.year && <span>({d.year})</span>}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-primary text-lg">{formatDollar(d.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Legislation ──────────────────────────────────────────────── */}
      {legislation.length > 0 && (
        <section id="legislation">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-yellow-400" />
            Legislation
          </h2>
          <div className="flex flex-col gap-2">
            {legislation.map(leg => (
              <div key={leg.id} className="glass p-4 rounded-xl hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-muted">{highlightMatch(leg.bill_id, q)}</span>
                      <span className="font-bold text-white">{highlightMatch(leg.title, q)}</span>
                    </div>
                    <p className="text-sm text-muted line-clamp-2">{highlightMatch(leg.summary || '', q)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-md whitespace-nowrap ${
                    leg.status === 'Signed into Law' ? 'bg-green-500/20 text-green-400' :
                    leg.status === 'Passed House' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{leg.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Policy Papers ────────────────────────────────────────────── */}
      {papers.length > 0 && (
        <section id="papers">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Policy Papers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {papers.map(p => (
              <div key={p.id} className="glass p-4 rounded-xl hover:border-primary/30 transition-colors">
                <div className="font-bold text-white mb-1">{highlightMatch(p.title, q)}</div>
                <p className="text-sm text-muted line-clamp-2 mb-2">{highlightMatch(p.summary || '', q)}</p>
                <div className="flex items-center justify-between">
                  <Link href={`/think-tanks/${p.tank_slug}`} className="text-xs text-primary hover:underline">{p.tank_name}</Link>
                  <div className="flex gap-1">
                    {(p.topic_tags || '').split(',').map((tag: string) => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-card-border rounded-md text-muted">{highlightMatch(tag.trim(), q)}</span>
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
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-orange-400" />
            Lobbying Disclosures
          </h2>
          <div className="flex flex-col gap-2">
            {lobbying.map(lb => (
              <div key={lb.id} className="glass p-4 rounded-xl hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{highlightMatch(lb.registrant_name, q)}</span>
                    <span className="text-muted text-sm ml-2">→ <Link href={`/think-tanks/${lb.tank_slug}`} className="text-primary hover:underline">{lb.tank_name}</Link></span>
                    <p className="text-sm text-muted mt-1">{highlightMatch(lb.issue_description || '', q)}</p>
                  </div>
                  <span className="font-bold text-orange-400">{formatDollar(lb.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Influence Links ──────────────────────────────────────────── */}
      {influenceLinks.length > 0 && (
        <section id="links">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-400" />
            Influence Links
          </h2>
          <div className="flex flex-col gap-2">
            {influenceLinks.map((link, i) => (
              <div key={i} className="glass p-4 rounded-xl hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-white font-semibold">{link.source_name || 'Unknown'}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                    link.link_type === 'advocates_for' ? 'bg-green-500/20 text-green-400' :
                    link.link_type === 'opposes' ? 'bg-red-500/20 text-red-400' :
                    link.link_type === 'informs' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{link.link_type?.replace("_", " ")}</span>
                  <span className="text-sm text-white font-semibold">{link.target_name || 'Unknown'}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-card-border overflow-hidden">
                      <div className={`h-full rounded-full ${(link.strength || 0) >= 0.85 ? 'bg-red-500' : (link.strength || 0) >= 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
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
        <Link href="/" className="text-primary hover:underline flex items-center gap-1">
          ← Back home
        </Link>
      </div>
    </div>
  );
}
