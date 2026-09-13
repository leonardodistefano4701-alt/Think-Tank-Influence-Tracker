import { getDb } from "@/lib/db";
import { StatList } from "@/components/ui";
import { ProvenanceBanner } from "@/components/ProvenanceBadge";
import { Donor } from "@/lib/types";
import Link from "next/link";

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
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Donors</h1>
        <p className="mt-2 text-base text-muted max-w-2xl leading-relaxed">Every donor in the database, ranked by amount.</p>
        <div className="mt-4">
          <ProvenanceBanner kinds={["seeded_demo"]}>
            Every donor row on this page is hand-authored demonstration data. No donor collector is
            implemented in this project, so these amounts are illustrative and are not drawn from
            any filing.
          </ProvenanceBanner>
        </div>
      </header>

      <StatList
        items={[
          { label: "Tracked total", value: formatDollar(totalAmount) },
          { label: "Donor records", value: donors.length },
          { label: "Foreign gov't sources", value: foreignDonors.length },
          { label: "Foreign gov't total", value: formatDollar(foreignTotal) },
        ]}
      />

      {/* Industry Breakdown */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-xl font-bold mb-4">Donors by industry</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {industries.map(([industry, stats]) => (
            <div key={industry} className="p-3 rounded-sm bg-surface-sunken flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-foreground">{industry}</span>
                <span className="text-xs text-muted ml-2">({stats.count} donors)</span>
              </div>
              <span className="font-bold text-accent text-sm">{formatDollar(stats.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full Donor List */}
      <div className="bg-surface border border-border rounded-md p-5">
        <h2 className="text-xl font-bold mb-4">All Donors (by amount)</h2>
        <div className="flex flex-col gap-2">
          {donors.map((d, i) => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-sm bg-surface-sunken hover:bg-surface-sunken transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-mono text-muted w-6 text-right">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{d.donor_name}</span>
                    {d.is_foreign_govt === 1 && (
                      <span className="px-1.5 py-0.5 bg-failed-wash text-failed text-2xs font-bold rounded-md uppercase tracking-wider flex-shrink-0">Foreign</span>
                    )}
                  </div>
                  <div className="text-xs text-muted flex gap-3 mt-0.5">
                    <span>{d.industry}</span>
                    <span>→ <Link href={`/think-tanks/${d.tank_slug}`} className="text-accent hover:underline">{d.tank_name}</Link></span>
                    {d.year && <span>({d.year})</span>}
                    <span className="text-muted">{d.source}</span>
                  </div>
                </div>
              </div>
              <span className="font-bold text-accent text-lg ml-4">{formatDollar(d.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
