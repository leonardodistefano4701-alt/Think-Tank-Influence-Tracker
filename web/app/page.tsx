import { getDb } from "@/lib/db";
import { Entity } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import SearchBar from "@/components/SearchBar";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = getDb();
  const thinkTanks = db.prepare("SELECT * FROM entities WHERE type = 'think_tank'").all() as Entity[];
  
  return (
    <div className="flex flex-col items-center gap-12 py-12">
      <div className="text-center max-w-3xl flex flex-col gap-4">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
          Trace the <span className="text-primary">Pipeline</span>.
        </h1>
        <p className="text-xl text-muted">
          Follow the money. Track the policy. Expose the structural capture of political decisions.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <SearchBar />
      </div>

      <div className="w-full mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Tracked Think Tanks</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {thinkTanks.map(tt => (
            <ProfileCard key={tt.id} entity={tt} />
          ))}
        </div>
      </div>
    </div>
  );
}
