import Link from "next/link";
import { Badge } from "@/components/ui";

interface AIAnalysisProps {
  verdict?: string | null;
  reasoning?: string | null;
  evidenceSummary?: string | null;
  confidence?: number | null;
  modelUsed?: string | null;
}

/**
 * Deliberately plain. This is unverified model output, and the previous
 * treatment — an "AI Intelligence Synthesis" banner, a gradient aura, and a
 * confidence percentage colour-graded purple above 85% — gave it the visual
 * grammar of a verified intelligence product.
 *
 * The gradient it used was also broken: the classes were derived at runtime with
 * .replace(), so Tailwind never generated them and the bar had no colour.
 */
export default function AIVerdictCard({ info }: { info: AIAnalysisProps | null }) {
  if (!info) return null;

  return (
    <aside className="border border-ai/25 bg-ai-wash/40 rounded-md">
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="ai">AI-generated</Badge>
          <span className="text-xs text-muted">Model summary, not a finding</span>
        </div>

        <h2 className="text-base font-semibold leading-snug text-foreground">{info.verdict}</h2>

        {info.reasoning && (
          <p className="text-sm text-muted leading-relaxed">{info.reasoning}</p>
        )}

        {info.evidenceSummary && (
          <div className="border-t border-ai/15 pt-3">
            <h3 className="text-xs font-medium text-muted mb-1.5">Points raised by the model</h3>
            <ul className="space-y-1 text-sm text-muted">
              {info.evidenceSummary
                .split("\n")
                .filter(Boolean)
                .map((bullet, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span aria-hidden="true" className="text-ai">·</span>
                    <span>{bullet.replace(/^-\s*/, "").trim()}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted leading-relaxed border-t border-ai/15 pt-3">
          Unverified language-model output{info.modelUsed ? ` (${info.modelUsed})` : ""}. Not
          checked against any filing. Model self-reported confidence scores are excluded in favor of checkable primary-source citations. This is not a statement of fact about any named organization or person.{" "}
          <Link href="/methodology" className="text-accent underline underline-offset-2">
            How to read this
          </Link>
          .
        </p>
      </div>
    </aside>
  );
}
