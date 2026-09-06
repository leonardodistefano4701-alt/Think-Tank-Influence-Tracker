import { Entity } from "@/lib/types";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export default function ProfileCard({ entity }: { entity: Entity }) {
  // Only these two entity types have profile routes. Anything else renders as a
  // non-navigable card rather than linking to a page that would 404.
  const getHref = (): string | null => {
    switch (entity.type) {
      case 'think_tank': return `/think-tanks/${entity.slug}`;
      case 'media_amplifier': return `/amplifiers/${entity.slug}`;
      default: return null;
    }
  };

  const href = getHref();

  return (
    <CardWrapper
      href={href}
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

      {href && (
        <div className="mt-auto pt-4 flex items-center justify-between text-sm font-medium text-muted group-hover:text-white transition-colors">
          <span>View Profile</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      )}
    </CardWrapper>
  );
}

function CardWrapper({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return <Link href={href} className={className}>{children}</Link>;
}
