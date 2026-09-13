import { getDb } from "@/lib/db";
import { StatList } from "@/components/ui";
import type { GrantRow, ContractRow, DonorAggregateRow } from "@/lib/rows";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import Link from "next/link";
import { Landmark, Briefcase } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null || isNaN(val)) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

export default async function GrantsPage() {
  const db = getDb();

  // ── Foundation Grants (from IRS 990 financials) ────────────────────
  const grantData = db.prepare(`
    SELECT f.entity_id, f.fiscal_year, f.contributions_and_grants, f.total_revenue, f.total_expenses,
           e.name as tank_name, e.slug as tank_slug
    FROM financials f
    JOIN entities e ON f.entity_id = e.id
    WHERE f.contributions_and_grants IS NOT NULL AND f.contributions_and_grants > 0
    ORDER BY f.contributions_and_grants DESC
  `).all() as GrantRow[];

  // Get latest year per tank for grant ranking
  const latestGrantByTank = new Map<string, GrantRow>();
  for (const g of grantData) {
    if (!g.tank_slug) continue;
    const existing = latestGrantByTank.get(g.tank_slug);
    if (!existing || (g.fiscal_year ?? 0) > (existing.fiscal_year ?? 0)) {
      latestGrantByTank.set(g.tank_slug, g);
    }
  }
  const grantRankings = [...latestGrantByTank.values()].sort((a, b) => (b.contributions_and_grants || 0) - (a.contributions_and_grants || 0));

  const totalGrants = grantRankings.reduce((s: number, g: GrantRow) => s + (g.contributions_and_grants || 0), 0);
  const totalRevenue = grantRankings.reduce((s: number, g: GrantRow) => s + (g.total_revenue || 0), 0);
  const avgDependency = totalRevenue > 0 ? Math.round((totalGrants / totalRevenue) * 100) : 0;

  // ── Government Contracts ───────────────────────────────────────────
  let contracts: ContractRow[] = [];
  let totalContractValue = 0;
  try {
    contracts = db.prepare(`
      SELECT gc.*, e.name as tank_name, e.slug as tank_slug
      FROM govt_contracts gc
      LEFT JOIN entities e ON gc.recipient_entity_id = e.id
      ORDER BY gc.amount DESC
    `).all() as ContractRow[];
    totalContractValue = contracts.reduce((s: number, c) => s + (c.amount || 0), 0);
  } catch { /* table may be empty */ }

  // ── Top Donors by source=irs_990 ───────────────────────────────────
  const topFoundationDonors = db.prepare(`
    SELECT d.donor_name, SUM(d.amount) as total_given, COUNT(DISTINCT d.entity_id) as tanks_funded,
           d.industry, MAX(d.year) as latest_year
    FROM donors d
    GROUP BY d.donor_name
    ORDER BY total_given DESC
    LIMIT 15
  `).all() as DonorAggregateRow[];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="bg-surface border border-border rounded-md p-5">
        <div className="flex items-center gap-3 mb-2">
          <Landmark className="w-8 h-8 text-accent" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Grants and contracts
          </h1>
        </div>
        <p className="text-muted text-lg max-w-3xl">
          Foundation and grant revenue reported on IRS Form 990 filings — the primary funding pipeline for think tanks. Track grant dependency, top donors, and government contracts across all tracked organizations.
        </p>
      </div>

      {/* Stats Overview */}
      <StatList
        items={[
          { label: "Total grant revenue", value: formatDollar(totalGrants) },
          { label: "Organizations tracked", value: grantRankings.length },
          { label: "Avg grant dependency", value: `${avgDependency}%` },
          { label: "Top donors identified", value: topFoundationDonors.length },
        ]}
      />

      {/* ── Foundation Grants (from 990s) ─────────────────────────────── */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          Foundation & Grant Revenue
          <span className="px-2 py-0.5 text-xs bg-accent-wash text-accent rounded-md font-bold uppercase tracking-wider">IRS 990</span>
        </h2>
        <p className="text-sm text-muted mb-5">
          Contributions and grants reported on IRS Form 990 — the primary revenue source for most think tanks. Larger grant reliance may indicate stronger donor influence over research priorities.
        </p>
        {grantRankings.length === 0 ? (
          <div className="text-muted italic flex items-center justify-center h-32 border border-dashed border-border rounded-sm">
            No IRS 990 financial data available yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {grantRankings.map((g, i) => {
              const revenue = g.total_revenue ?? 0;
              const grants = g.contributions_and_grants ?? 0;
              // Clamped: the value is used directly as a CSS width below.
              const grantPct = revenue > 0 ? Math.min(100, Math.round((grants / revenue) * 100)) : 0;
              return (
                <div key={g.tank_slug ?? i} className="p-4 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <Link href={`/think-tanks/${g.tank_slug}`} className="font-bold text-foreground hover:text-accent transition-colors">
                        {g.tank_name}
                      </Link>
                      <span className="text-xs text-muted">FY {g.fiscal_year}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-accent text-lg">{formatDollar(g.contributions_and_grants)}</div>
                      <div className="text-2xs text-muted">of {formatDollar(g.total_revenue)} total revenue</div>
                    </div>
                  </div>
                  {/* Grant dependency bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-surface-sunken overflow-hidden">
                      <div
                        className={`h-full rounded-full ${grantPct >= 80 ? 'bg-failed-wash' : grantPct >= 50 ? 'bg-progress-wash' : 'bg-enacted-wash'}`}
                        style={{ width: `${grantPct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${grantPct >= 80 ? 'text-failed' : grantPct >= 50 ? 'text-progress' : 'text-enacted'}`}>
                      {grantPct}% grant-dependent
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Top Foundation Donors ─────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Top Foundation &amp; Corporate Donors
          <ProvenanceBadge provenance="seeded_demo" />
        </h2>
        {topFoundationDonors.length === 0 ? (
          <div className="text-muted italic text-sm">No donor data available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topFoundationDonors.map((d, i: number) => (
              <div key={d.donor_name} className="p-4 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <span className="font-semibold text-foreground text-sm truncate">{d.donor_name}</span>
                    </div>
                    <div className="text-xs text-muted mt-1">{d.industry}</div>
                  </div>
                  <span className="font-bold text-enacted">{formatDollar(d.total_given)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted mt-2">
                  <span>Funds <strong className="text-foreground">{d.tanks_funded}</strong> think tank(s)</span>
                  <span>Latest: {d.latest_year}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Government Contracts ──────────────────────────────────────── */}
      {contracts.length > 0 && (
        <div className="bg-surface border border-border rounded-md p-5">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-muted" />
            Government Contracts
          </h2>
          <p className="text-sm text-muted mb-5">
            Federal contracts awarded to tracked entities — a potential conflict of interest when the same organizations influence the policies they receive contracts under.
          </p>
          <div className="flex flex-col gap-2">
            {contracts.slice(0, 20).map((c, i: number) => (
              <div key={String(c.id ?? i)} className="flex items-center justify-between p-3 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors text-sm">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono text-muted w-5 text-right">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">{c.tank_name || c.recipient_name}</span>
                    {c.description && <span className="text-xs text-muted ml-2 truncate">— {c.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                  {c.agency && <span className="text-muted max-w-[200px] truncate">{c.agency}</span>}
                  <span className="text-muted">FY{c.fiscal_year}</span>
                  <span className="font-bold text-accent w-20 text-right">{formatDollar(c.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          {contracts.length > 20 && (
            <div className="text-xs text-muted text-center mt-3">
              Showing top 20 of {contracts.length} contracts ({formatDollar(totalContractValue)} total)
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted text-center">
        Financial data from IRS Form 990 via ProPublica Nonprofit Explorer.
        Government contracts from USAspending.gov.
      </div>
    </div>
  );
}
