import { Entity } from "@/lib/types";
import Link from "next/link";
import { Badge } from "@/components/ui";

export default function ProfileCard({ entity }: { entity: Entity }) {
  // Only these two entity types have profile routes. Anything else renders as a
  // non-navigable card rather than linking to a page that would 404.
  const href =
    entity.type === "think_tank"
      ? `/think-tanks/${entity.slug}`
      : entity.type === "media_amplifier"
        ? `/amplifiers/${entity.slug}`
        : null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-foreground leading-snug">{entity.name}</h3>
        {entity.lean && <Badge>{entity.lean}</Badge>}
      </div>
      {entity.description && (
        <p className="mt-1.5 text-sm text-muted line-clamp-2 leading-relaxed">
          {entity.description}
        </p>
      )}
    </>
  );

  const className = "block bg-surface border border-border rounded-md p-4";
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={`${className} hover:border-accent/40`}>
      {body}
    </Link>
  );
}
