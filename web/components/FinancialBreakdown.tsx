'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Financial } from '@/lib/types';

// Chart colours come from the theme rather than hardcoded hex. The previous
// values (#262626 grid, #737373 axes, #0a0a0a tooltip) were picked for a dark
// background and are invisible on paper.
const GRID = '#e0dbd2';
const AXIS = '#5f5c56';
const SURFACE = '#ffffff';
const REVENUE = '#14614a';
const EXPENSES = '#9b2c2c';

export default function FinancialBreakdown({ financials }: { financials: Financial[] }) {
  if (!financials || financials.length === 0) {
    return <p className="text-sm text-muted py-6">No 990 filings recorded for this organization.</p>;
  }

  const data = [...financials]
    .sort((a, b) => a.fiscal_year - b.fiscal_year)
    .map((f) => ({
      name: String(f.fiscal_year),
      Revenue: f.total_revenue ?? 0,
      Expenses: f.total_expenses ?? 0,
    }));

  const formatDollar = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
          <XAxis dataKey="name" stroke={AXIS} fontSize={12} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis stroke={AXIS} fontSize={12} tickFormatter={formatDollar} tickLine={false} axisLine={false} width={64} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            contentStyle={{ backgroundColor: SURFACE, border: `1px solid ${GRID}`, borderRadius: 6, fontSize: 13 }}
            formatter={(value) => formatDollar(Number(value ?? 0))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Revenue" fill={REVENUE} radius={[2, 2, 0, 0]} />
          <Bar dataKey="Expenses" fill={EXPENSES} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
