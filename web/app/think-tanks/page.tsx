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
        <h1 className="text-2xl font-bold tracking-tight mb-2">Think tanks</h1>
        <p className="text-muted">The six organizations tracked in this project.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {thinkTanks.map(tt => (
          <ProfileCard key={tt.id} entity={tt} />
        ))}
      </div>
    </div>
  );
}
