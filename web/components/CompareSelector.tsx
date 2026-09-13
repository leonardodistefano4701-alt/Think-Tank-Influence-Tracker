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
  // navigation, and so desynchronised from the URL on Back/Forward.
  const handleUpdate = (newA: string, newB: string) => {
    router.push(`/compare?a=${newA}&b=${newB}`);
  };

  const selectClass =
    'w-full bg-surface border border-border-strong rounded-sm px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <label htmlFor={idA} className="block text-xs text-muted mb-1">
          First organization
        </label>
        <select
          id={idA}
          value={currentA}
          onChange={(e) => handleUpdate(e.target.value, currentB)}
          className={selectClass}
        >
          {tanks.map((t) => (
            <option key={t.slug} value={t.slug} disabled={t.slug === currentB}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor={idB} className="block text-xs text-muted mb-1">
          Second organization
        </label>
        <select
          id={idB}
          value={currentB}
          onChange={(e) => handleUpdate(currentA, e.target.value)}
          className={selectClass}
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
