import { getDb } from "@/lib/db";
import { Entity } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";

export const dynamic = 'force-dynamic';

export default async function AmplifiersPage() {
  const db = getDb();
  const amplifiers = db.prepare("SELECT * FROM entities WHERE type = 'media_amplifier'").all() as Entity[];
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Media Amplifiers</h1>
        <p className="text-muted">Commentators and outlets that echo structural think tank narratives.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {amplifiers.map(amp => (
          <ProfileCard key={amp.id} entity={amp} />
        ))}
      </div>
    </div>
  );
}
