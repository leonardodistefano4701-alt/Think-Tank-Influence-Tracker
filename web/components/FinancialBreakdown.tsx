'use client';

import { Financial } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function FinancialBreakdown({ financials }: { financials: Financial[] }) {
  if (!financials || financials.length === 0) {
    return <div className="p-8 text-center glass rounded-xl text-muted">No financial data available. Submit collectors to populate.</div>;
  }

  const data = [...financials].sort((a, b) => a.fiscal_year - b.fiscal_year).map(f => ({
    name: f.fiscal_year,
    Revenue: f.total_revenue || 0,
    Expenses: f.total_expenses || 0,
  }));

  const formatDollar = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
    }).format(val);
  };

  return (
    <div className="glass p-6 rounded-xl w-full">
      <h3 className="text-xl font-bold mb-6">Financial Overview</h3>
      <div className="w-full" style={{ height: 320, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="name" stroke="#737373" />
            <YAxis stroke="#737373" tickFormatter={formatDollar} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626' }}
              formatter={(value: any) => formatDollar(value as number)}
            />
            <Legend />
            <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
