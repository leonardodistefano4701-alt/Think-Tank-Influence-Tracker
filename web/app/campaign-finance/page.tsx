import { getDb } from "@/lib/db";
import Link from "next/link";
import { DollarSign, Building2, Users, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";

export const dynamic = 'force-dynamic';

function formatDollar(val: number | null) {
  if (val == null || isNaN(val)) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
}

function formatFullDollar(val: number | null) {
  if (val == null || isNaN(val)) return "—";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

export default async function CampaignFinancePage() {
  const db = getDb();

  // Check if FEC tables exist
  let tableExists = false;
  try {
    db.prepare("SELECT 1 FROM fec_committees LIMIT 1").get();
    tableExists = true;
  } catch { }

  if (!tableExists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h1 className="text-2xl font-bold">FEC Data Not Collected Yet</h1>
        <p className="text-muted text-center max-w-md">
          Run <code className="bg-card-border px-2 py-0.5 rounded">python3 scripts/collect_fec.py</code> to pull real campaign finance data from the FEC API.
        </p>
      </div>
    );
  }

  // Get PACs
  const pacs = db.prepare(`
    SELECT fc.*, e.name as tank_name, e.slug as tank_slug
    FROM fec_committees fc
    LEFT JOIN entities e ON fc.linked_entity_id = e.id
    WHERE fc.total_receipts > 0
    ORDER BY fc.total_receipts DESC
  `).all() as any[];

  // Get contributions
  const contributions = db.prepare(`
    SELECT * FROM fec_contributions
    ORDER BY contribution_amount DESC
  `).all() as any[];

  // Aggregate stats
  const totalPACs = pacs.length;
  const totalReceipts = pacs.reduce((s: number, p: any) => s + (p.total_receipts || 0), 0);
  const totalContribs = contributions.length;
  const totalContribAmount = contributions.reduce((s: number, c: any) => s + (c.contribution_amount || 0), 0);

  // Top recipients of contributions
  const recipientMap = new Map<string, { name: string; total: number; count: number }>();
  for (const c of contributions) {
    const name = c.recipient_committee || c.recipient_name || 'Unknown';
    const existing = recipientMap.get(name) || { name, total: 0, count: 0 };
    recipientMap.set(name, { name, total: existing.total + (c.contribution_amount || 0), count: existing.count + 1 });
  }
  const topRecipients = [...recipientMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);

  // Contributions by employer
  const employerMap = new Map<string, { total: number; count: number; topRecipient: string; topAmount: number }>();
  for (const c of contributions) {
    const employer = c.contributor_employer || c.linked_donor || 'Unknown';
    const existing = employerMap.get(employer) || { total: 0, count: 0, topRecipient: '', topAmount: 0 };
    existing.total += c.contribution_amount || 0;
    existing.count += 1;
    if ((c.contribution_amount || 0) > existing.topAmount) {
      existing.topRecipient = c.recipient_committee || c.recipient_name || '?';
      existing.topAmount = c.contribution_amount || 0;
    }
    employerMap.set(employer, existing);
  }
  const byEmployer = [...employerMap.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="glass p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-primary to-blue-500" />
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-extrabold tracking-tight">
            Campaign <span className="text-primary">Finance</span>
          </h1>
          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-md font-bold uppercase tracking-wider">Live FEC Data</span>
        </div>
        <p className="text-muted text-lg max-w-3xl">
          Real political action committee (PAC) data and individual campaign contributions from FEC filings — connecting think tank donors to political campaigns.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-xl text-center">
          <Building2 className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{totalPACs}</div>
          <div className="text-xs text-muted mt-1">PACs Tracked</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{formatDollar(totalReceipts)}</div>
          <div className="text-xs text-muted mt-1">Total PAC Receipts</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{totalContribs}</div>
          <div className="text-xs text-muted mt-1">Individual Contributions</div>
        </div>
        <div className="glass p-5 rounded-xl text-center">
          <TrendingUp className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-extrabold">{formatDollar(totalContribAmount)}</div>
          <div className="text-xs text-muted mt-1">Total Contributed</div>
        </div>
      </div>

      {/* ── PACs/Committees ──────────────────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          Donor-Linked PACs (by receipts)
        </h2>
        <div className="flex flex-col gap-2">
          {pacs.map((pac: any, i: number) => (
            <div key={pac.id} className="p-4 rounded-lg bg-card-border/20 hover:bg-card-border/40 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted">#{i + 1}</span>
                    <span className="font-bold text-white">{pac.name}</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-card-border rounded text-muted">{pac.committee_type}</span>
                    <a href={`https://www.fec.gov/data/committee/${pac.fec_id}/`} target="_blank" rel="noopener noreferrer"
                       className="text-primary hover:underline text-xs flex items-center gap-0.5">
                      {pac.fec_id} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-xs text-muted mt-1 flex gap-3">
                    <span>Linked donor: <strong className="text-white">{pac.linked_donor}</strong></span>
                    {pac.tank_name && (
                      <span>→ <Link href={`/think-tanks/${pac.tank_slug}`} className="text-primary hover:underline">{pac.tank_name}</Link></span>
                    )}
                    {pac.party && <span className="text-muted">{pac.party}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-primary">{formatDollar(pac.total_receipts)}</div>
                  <div className="text-[10px] text-muted">receipts</div>
                  <div className="text-xs text-muted">{formatDollar(pac.total_disbursements)} spent</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contributions by Employer ────────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-400" />
          Campaign Contributions by Donor Employer
        </h2>
        <div className="flex flex-col gap-3">
          {byEmployer.map(([employer, stats]) => (
            <div key={employer} className="p-4 rounded-lg bg-card-border/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">{employer}</span>
                <span className="font-bold text-primary text-lg">{formatDollar(stats.total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{stats.count} contributions</span>
                <span>Top: {formatFullDollar(stats.topAmount)} → {stats.topRecipient}</span>
              </div>
              {/* Bar visualization */}
              <div className="mt-2 w-full h-1.5 rounded-full bg-card-border overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (stats.total / (byEmployer[0]?.[1]?.total || 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top Individual Contributions ─────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-yellow-500" />
          Top Individual Contributions (2024 cycle)
        </h2>
        <div className="flex flex-col gap-1">
          {contributions.slice(0, 25).map((c: any, i: number) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-card-border/20 transition-colors text-sm">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-mono text-muted w-5 text-right">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">{c.contributor_name}</span>
                  <span className="text-muted ml-2 text-xs">({c.contributor_employer})</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs flex-shrink-0">
                <span className="text-muted max-w-[200px] truncate">→ {c.recipient_committee}</span>
                <span className="text-muted">{c.contribution_date}</span>
                <span className="font-bold text-primary w-20 text-right">{formatFullDollar(c.contribution_amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top Political Recipients ─────────────────────────────────── */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-400" />
          Top Political Recipients
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topRecipients.map((r, i) => (
            <div key={i} className="p-4 rounded-lg bg-card-border/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-muted mr-2">#{i + 1}</span>
                <span className="font-semibold text-white text-sm">{r.name}</span>
                <div className="text-xs text-muted mt-0.5">{r.count} contribution(s)</div>
              </div>
              <span className="font-bold text-primary">{formatDollar(r.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted text-center">
        Data sourced from the Federal Election Commission via the FEC API (api.open.fec.gov). 
        Updated by running <code className="bg-card-border px-1 rounded">python3 scripts/collect_fec.py</code>
      </div>
    </div>
  );
}
