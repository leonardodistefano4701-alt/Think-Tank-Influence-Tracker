import { Entity } from "@/lib/types";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export default function ProfileCard({ entity }: { entity: Entity }) {
  const getHref = () => {
    switch(entity.type) {
      case 'think_tank': return `/think-tanks/${entity.slug}`;
      case 'media_amplifier': return `/amplifiers/${entity.slug}`;
      case 'politician': return `/politicians/${entity.slug}`;
      default: return `/entities/${entity.slug}`;
    }
  };

  return (
    <Link 
      href={getHref()}
      className="group glass rounded-xl p-6 flex flex-col gap-4 hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex justify-between items-start">
        <div className="p-3 bg-card-border/50 rounded-lg">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        {entity.lean && (
          <span className="text-xs font-medium px-2.5 py-1 bg-card-border rounded-full text-muted">
            {entity.lean}
          </span>
        )}
      </div>

      <div>
        <h3 className="font-bold text-lg text-white mb-1 group-hover:text-primary transition-colors">
          {entity.name}
        </h3>
        <p className="text-sm text-muted line-clamp-2">
          {entity.description || "No description provided."}
        </p>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between text-sm font-medium text-muted group-hover:text-white transition-colors">
        <span>View Profile</span>
        <ArrowRight className="w-4 h-4" />
      </div>
    </Link>
  );
}
