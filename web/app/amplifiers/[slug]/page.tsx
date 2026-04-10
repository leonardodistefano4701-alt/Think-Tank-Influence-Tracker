import { getDb } from "@/lib/db";
import { Entity } from "@/lib/types";
import { Mic2 } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AmplifierProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const db = getDb();
  
  const entity = db.prepare("SELECT * FROM entities WHERE slug = ? AND type = 'media_amplifier'").get(resolvedParams.slug) as Entity | undefined;
  
  if (!entity) return notFound();
  
  return (
    <div className="flex flex-col gap-8">
      <div className="glass p-8 rounded-2xl flex flex-col md:flex-row gap-8 items-start md:items-center">
        <div className="p-6 bg-card-border/50 rounded-xl">
          <Mic2 className="w-16 h-16 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-extrabold">{entity.name}</h1>
            {entity.lean && (
              <span className="px-3 py-1 bg-card-border rounded-full text-sm font-medium">{entity.lean}</span>
            )}
          </div>
          <p className="text-xl text-muted max-w-3xl">{entity.description || 'No description assigned.'}</p>
          <div className="mt-4 text-sm text-muted">
             <span className="font-bold text-white">Entity Type:</span> Media Amplifier
          </div>
        </div>
      </div>
      
      <div className="glass p-6 rounded-xl">
         <h3 className="text-xl font-bold mb-4">Content Echo Analysis</h3>
         <div className="text-muted italic flex items-center justify-center h-48 border border-dashed border-card-border rounded-lg">
             Run semantic trace collectors to analyze coverage mapping.
         </div>
      </div>
    </div>
  );
}
