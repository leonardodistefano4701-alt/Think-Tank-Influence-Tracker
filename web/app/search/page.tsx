import { getDb } from "@/lib/db";
import { Entity } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  // In Next.js 15, searchParams is a Promise, so we must await it.
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || "";

  const db = getDb();
  let results: Entity[] = [];

  if (q) {
    results = db.prepare(`
      SELECT * FROM entities 
      WHERE name LIKE ? OR type LIKE ? OR slug LIKE ?
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as Entity[];
  }

  return (
    <div className="flex flex-col items-center gap-12 py-12 px-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold tracking-tight mb-8">
          Search Results for "{q}"
        </h1>

        {results.length === 0 ? (
          <div className="text-xl text-muted">
            No results found. Try a different term.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((entity) => (
              <ProfileCard key={entity.id} entity={entity} />
            ))}
          </div>
        )}
        
        <div className="mt-8">
          <Link href="/" className="text-primary hover:underline">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
