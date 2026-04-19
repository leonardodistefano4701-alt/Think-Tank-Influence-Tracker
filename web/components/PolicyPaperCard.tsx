"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface PolicyPaperCardProps {
  title: string;
  summary: string | null;
  publishedDate: string | null;
  topicTags: string | null;
  url: string | null;
}

export default function PolicyPaperCard({ title, summary, publishedDate, topicTags, url }: PolicyPaperCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-card-border/30 hover:bg-card-border/50 transition-colors overflow-hidden">
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3 cursor-pointer group"
      >
        <span className="mt-0.5 flex-shrink-0 text-primary/60 group-hover:text-primary transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white leading-tight group-hover:text-primary transition-colors">
            {title}
          </h4>
          <div className="flex items-center justify-between mt-2 text-xs text-muted">
            <span>{publishedDate}</span>
            <div className="flex gap-1 flex-wrap">
              {topicTags?.split(",").map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md">{tag.trim()}</span>
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Expandable summary */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 ml-7 border-t border-card-border/30">
          {summary ? (
            <p className="text-sm text-muted leading-relaxed mt-3 whitespace-pre-line">{summary}</p>
          ) : (
            <p className="text-sm text-muted italic mt-3">No summary available for this paper.</p>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
            >
              View full paper <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
