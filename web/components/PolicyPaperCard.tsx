"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import ProvenanceBadge, { type Provenance } from "@/components/ProvenanceBadge";

interface PolicyPaperCardProps {
  title: string;
  summary: string | null;
  publishedDate: string | null;
  topicTags: string | null;
  url: string | null;
  provenance?: Provenance;
}

export default function PolicyPaperCard({
  title,
  summary,
  publishedDate,
  topicTags,
  url,
  provenance,
}: PolicyPaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Tags repeat within a row, so dedupe before using them as keys.
  const tags = Array.from(
    new Set(
      (topicTags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );

  return (
    <li className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full text-left py-3 flex items-start gap-2.5 group"
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-muted group-hover:text-accent">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-foreground leading-snug group-hover:text-accent">
            {title}
          </span>
          <span className="mt-1 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <ProvenanceBadge provenance={provenance ?? "ai_generated"} />
            {publishedDate && <span className="tnum">{publishedDate}</span>}
            {tags.length > 0 && <span>{tags.join(" · ")}</span>}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="pb-4 pl-7 text-sm text-muted leading-relaxed">
          {summary ? <p>{summary}</p> : <p>No summary recorded for this paper.</p>}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-accent underline underline-offset-2"
            >
              Open source <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </li>
  );
}
