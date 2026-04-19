'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CompareSelector({
  tanks,
  currentA,
  currentB
}: {
  tanks: { slug: string; name: string }[];
  currentA: string;
  currentB: string;
}) {
  const router = useRouter();
  const [a, setA] = useState(currentA);
  const [b, setB] = useState(currentB);

  const handleUpdate = (newA: string, newB: string) => {
    setA(newA);
    setB(newB);
    router.push(`/compare?a=${newA}&b=${newB}`);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full bg-space-900 border border-card-border p-4 rounded-xl items-center">
      <div className="flex-1 w-full">
        <label className="text-xs text-primary uppercase font-bold tracking-widest mb-1 block">Left Subject</label>
        <select 
          value={a} 
          onChange={(e) => handleUpdate(e.target.value, b)}
          className="w-full bg-black border border-primary/30 rounded-lg p-2 text-white focus:outline-none focus:border-primary"
        >
          {tanks.map(t => (
            <option key={t.slug} value={t.slug} disabled={t.slug === b}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-card-border w-12 h-px md:w-px md:h-12 flex-shrink-0" />

      <div className="flex-1 w-full">
        <label className="text-xs text-yellow-500 uppercase font-bold tracking-widest mb-1 block">Right Subject</label>
        <select 
          value={b} 
          onChange={(e) => handleUpdate(a, e.target.value)}
          className="w-full bg-black border border-yellow-500/30 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500"
        >
          {tanks.map(t => (
            <option key={t.slug} value={t.slug} disabled={t.slug === a}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
