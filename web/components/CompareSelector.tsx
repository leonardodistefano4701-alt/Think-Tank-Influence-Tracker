'use client';

import { useRouter } from 'next/navigation';
import { useId } from 'react';

export default function CompareSelector({
  tanks,
  currentA,
  currentB,
}: {
  tanks: { slug: string; name: string }[];
  currentA: string;
  currentB: string;
}) {
  const router = useRouter();
  const idA = useId();
  const idB = useId();

  // No local useState mirror of the props. The previous version snapshotted
  // currentA/currentB once, ignored the new props the server sent after a
  // navigation, and so desynchronised from the URL on Back/Forward. The URL is
  // the single source of truth.
  const handleUpdate = (newA: string, newB: string) => {
    router.push(`/compare?a=${newA}&b=${newB}`);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full bg-space-900 border border-card-border p-4 rounded-xl items-center">
      <div className="flex-1 w-full">
        <label
          htmlFor={idA}
          className="text-xs text-primary uppercase font-bold tracking-widest mb-1 block"
        >
          Left Subject
        </label>
        <select
          id={idA}
          value={currentA}
          onChange={(e) => handleUpdate(e.target.value, currentB)}
          className="w-full bg-black border border-primary/30 rounded-lg p-2 text-white focus:outline-none focus:border-primary"
        >
          {tanks.map((t) => (
            <option key={t.slug} value={t.slug} disabled={t.slug === currentB}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div aria-hidden="true" className="bg-card-border w-12 h-px md:w-px md:h-12 flex-shrink-0" />

      <div className="flex-1 w-full">
        <label
          htmlFor={idB}
          className="text-xs text-yellow-500 uppercase font-bold tracking-widest mb-1 block"
        >
          Right Subject
        </label>
        <select
          id={idB}
          value={currentB}
          onChange={(e) => handleUpdate(currentA, e.target.value)}
          className="w-full bg-black border border-yellow-500/30 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500"
        >
          {tanks.map((t) => (
            <option key={t.slug} value={t.slug} disabled={t.slug === currentA}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
