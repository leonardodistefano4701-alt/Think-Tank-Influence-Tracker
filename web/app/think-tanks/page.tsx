import { getDb } from "@/lib/db";
import { Entity } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";

export const dynamic = 'force-dynamic';

export default async function ThinkTanksPage() {
  const db = getDb();
  const thinkTanks = db.prepare("SELECT * FROM entities WHERE type = 'think_tank'").all() as Entity[];
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Think Tanks</h1>
        <p className="text-muted">The primary drivers of structural policy influence.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {thinkTanks.map(tt => (
          <ProfileCard key={tt.id} entity={tt} />
        ))}
      </div>
    </div>
  );
}
