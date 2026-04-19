import { getDb } from "@/lib/db";
import Link from "next/link";
import { Building2, DollarSign, Landmark, Briefcase, Users } from "lucide-react";

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
  `).all() as any[];

  // Get latest year per tank for grant ranking
  const latestGrantByTank = new Map<string, any>();
  for (const g of grantData) {
    const existing = latestGrantByTank.get(g.tank_slug);
    if (!existing || g.fiscal_year > existing.fiscal_year) {
      latestGrantByTank.set(g.tank_slug, g);
    }
  }
  const grantRankings = [...latestGrantByTank.values()].sort((a, b) => (b.contributions_and_grants || 0) - (a.contributions_and_grants || 0));

  const totalGrants = grantRankings.reduce((s: number, g: any) => s + (g.contributions_and_grants || 0), 0);
  const totalRevenue = grantRankings.reduce((s: number, g: any) => s + (g.total_revenue || 0), 0);
  const avgDependency = totalRevenue > 0 ? Math.round((totalGrants / totalRevenue) * 100) : 0;

  // ── Government Contracts ───────────────────────────────────────────
  let contracts: any[] = [];
  let totalContractValue = 0;
  try {
    contracts = db.prepare(`
      SELECT gc.*, e.name as tank_name, e.slug as tank_slug
      FROM govt_contracts gc
      LEFT JOIN entities e ON gc.recipient_entity_id = e.id
      ORDER BY gc.amount DESC
    `).all() as any[];
    totalContractValue = contracts.reduce((s: number, c: any) => s + (c.amount || 0), 0);
  } catch { /* table may be empty */ }

  // ── Top Donors by source=irs_990 ───────────────────────────────────
  const topFoundationDonors = db.prepare(`
    SELECT d.donor_name, SUM(d.amount) as total_given, COUNT(DISTINCT d.entity_id) as tanks_funded,
           d.industry, MAX(d.year) as latest_year
    FROM donors d
    WHERE d.source = 'irs_990'
    GROUP BY d.donor_name
    ORDER BY total_given DESC
    LIMIT 15
  `).all() as any[];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="glass p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-primary to-emerald-500" />
        <div className="flex items-center gap-3 mb-2">
          <Landmark className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-extrabold tracking-tight">
            Foundation <span className="text-primary">Grants</span>
          </h1>
        </div>
        <p className="text-muted text-lg max-w-3xl">
          Foundation and grant revenue reported on IRS Form 990 filings — the primary funding pipeline for think tanks. Track grant dependency, top donors, and government contracts across all tracked organizations.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-xl text-center">
          <Landmark className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{formatDollar(totalGrants)}</div>
          <div className="text-xs text-muted mt-1">Total Grant Revenue</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <Building2 className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{grantRankings.length}</div>
          <div className="text-xs text-muted mt-1">Organizations Tracked</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{avgDependency}%</div>
          <div className="text-xs text-muted mt-1">Avg Grant Dependency</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <Users className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{topFoundationDonors.length}</div>
          <div className="text-xs text-muted mt-1">Top Donors Identified</div>
        </div>
      </div>

      {/* ── Foundation Grants (from 990s) ─────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Landmark className="w-6 h-6 text-primary" />
          Foundation & Grant Revenue
          <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-md font-bold uppercase tracking-wider">IRS 990</span>
        </h2>
        <p className="text-sm text-muted mb-5">
          Contributions and grants reported on IRS Form 990 — the primary revenue source for most think tanks. Larger grant reliance may indicate stronger donor influence over research priorities.
        </p>
        {grantRankings.length === 0 ? (
          <div className="text-muted italic flex items-center justify-center h-32 border border-dashed border-card-border rounded-lg">
            No IRS 990 financial data available yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {grantRankings.map((g, i) => {
              const grantPct = g.total_revenue > 0 ? Math.round((g.contributions_and_grants / g.total_revenue) * 100) : 0;
              return (
                <div key={g.tank_slug} className="p-4 rounded-lg bg-card-border/20 hover:bg-card-border/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <Link href={`/think-tanks/${g.tank_slug}`} className="font-bold text-white hover:text-primary transition-colors">
                        {g.tank_name}
                      </Link>
                      <span className="text-xs text-muted">FY {g.fiscal_year}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary text-lg">{formatDollar(g.contributions_and_grants)}</div>
                      <div className="text-[10px] text-muted">of {formatDollar(g.total_revenue)} total revenue</div>
                    </div>
                  </div>
                  {/* Grant dependency bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-card-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${grantPct >= 80 ? 'bg-red-500' : grantPct >= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${grantPct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${grantPct >= 80 ? 'text-red-400' : grantPct >= 50 ? 'text-yellow-400' : 'text-green-400'}`}>
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
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Top Foundation & Corporate Donors
          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-md font-bold uppercase tracking-wider">Cross-Tank</span>
        </h2>
        {topFoundationDonors.length === 0 ? (
          <div className="text-muted italic text-sm">No donor data from IRS 990 sources available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topFoundationDonors.map((d: any, i: number) => (
              <div key={d.donor_name} className="p-4 rounded-lg bg-card-border/20 hover:bg-card-border/40 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <span className="font-semibold text-white text-sm truncate">{d.donor_name}</span>
                    </div>
                    <div className="text-xs text-muted mt-1">{d.industry}</div>
                  </div>
                  <span className="font-bold text-green-400">{formatDollar(d.total_given)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted mt-2">
                  <span>Funds <strong className="text-white">{d.tanks_funded}</strong> think tank(s)</span>
                  <span>Latest: {d.latest_year}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Government Contracts ──────────────────────────────────────── */}
      {contracts.length > 0 && (
        <div className="glass p-6 rounded-2xl">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-400" />
            Government Contracts
          </h2>
          <p className="text-sm text-muted mb-5">
            Federal contracts awarded to tracked entities — a potential conflict of interest when the same organizations influence the policies they receive contracts under.
          </p>
          <div className="flex flex-col gap-2">
            {contracts.slice(0, 20).map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-card-border/20 hover:bg-card-border/30 transition-colors text-sm">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono text-muted w-5 text-right">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-white">{c.tank_name || c.recipient_name}</span>
                    {c.description && <span className="text-xs text-muted ml-2 truncate">— {c.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                  {c.agency && <span className="text-muted max-w-[200px] truncate">{c.agency}</span>}
                  <span className="text-muted">FY{c.fiscal_year}</span>
                  <span className="font-bold text-blue-400 w-20 text-right">{formatDollar(c.amount)}</span>
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
