import { getDb } from "@/lib/db";
import { Donor } from "@/lib/types";
import Link from "next/link";
import { DollarSign, AlertTriangle, Building2 } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

export default async function DonorsPage() {
  const db = getDb();

  const donors = db.prepare(`
    SELECT d.*, e.name as tank_name, e.slug as tank_slug
    FROM donors d
    JOIN entities e ON d.entity_id = e.id
    ORDER BY d.amount DESC
  `).all() as (Donor & { tank_name: string; tank_slug: string })[];

  const totalAmount = donors.reduce((s, d) => s + (d.amount || 0), 0);
  const foreignDonors = donors.filter(d => d.is_foreign_govt === 1);
  const foreignTotal = foreignDonors.reduce((s, d) => s + (d.amount || 0), 0);

  // Group by industry
  const industryMap = new Map<string, { count: number; total: number }>();
  for (const d of donors) {
    const ind = d.industry || "Unknown";
    const existing = industryMap.get(ind) || { count: 0, total: 0 };
    industryMap.set(ind, { count: existing.count + 1, total: existing.total + (d.amount || 0) });
  }
  const industries = [...industryMap.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Donor <span className="text-primary">Database</span></h1>
        <p className="text-muted text-lg max-w-2xl">All tracked donors across every think tank, ranked by contribution amount.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-xl text-center">
          <DollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">{formatDollar(totalAmount)}</div>
          <div className="text-xs text-muted mt-1">Total Tracked</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <Building2 className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-bold">{donors.length}</div>
          <div className="text-xs text-muted mt-1">Donor Records</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{foreignDonors.length}</div>
          <div className="text-xs text-muted mt-1">Foreign Gov't Sources</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <DollarSign className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <div className="text-2xl font-bold">{formatDollar(foreignTotal)}</div>
          <div className="text-xs text-muted mt-1">Foreign Gov't Total</div>
        </div>
      </div>

      {/* Industry Breakdown */}
      <div className="glass p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">Donor Industry Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {industries.map(([industry, stats]) => (
            <div key={industry} className="p-3 rounded-lg bg-card-border/30 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white">{industry}</span>
                <span className="text-xs text-muted ml-2">({stats.count} donors)</span>
              </div>
              <span className="font-bold text-primary text-sm">{formatDollar(stats.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full Donor List */}
      <div className="glass p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">All Donors (by amount)</h2>
        <div className="flex flex-col gap-2">
          {donors.map((d, i) => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-card-border/20 hover:bg-card-border/40 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-mono text-muted w-6 text-right">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">{d.donor_name}</span>
                    {d.is_foreign_govt === 1 && (
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-md uppercase tracking-wider flex-shrink-0">Foreign</span>
                    )}
                  </div>
                  <div className="text-xs text-muted flex gap-3 mt-0.5">
                    <span>{d.industry}</span>
                    <span>→ <Link href={`/think-tanks/${d.tank_slug}`} className="text-primary hover:underline">{d.tank_name}</Link></span>
                    {d.year && <span>({d.year})</span>}
                    <span className="text-primary/50">{d.source}</span>
                  </div>
                </div>
              </div>
              <span className="font-bold text-primary text-lg ml-4">{formatDollar(d.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
