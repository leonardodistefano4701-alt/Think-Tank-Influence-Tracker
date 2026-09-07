import React from 'react';
import Link from 'next/link';
import { Bot, AlertCircle } from 'lucide-react';
import ProvenanceBadge from '@/components/ProvenanceBadge';

interface AIAnalysisProps {
  verdict?: string | null;
  reasoning?: string | null;
  evidenceSummary?: string | null;
  confidence?: number | null;
  modelUsed?: string | null;
}

export default function AIVerdictCard({ info }: { info: AIAnalysisProps | null }) {
  if (!info) return null;

  const confidencePct = Math.round((info.confidence || 0) * 100);
  const auraColor = 'from-primary/20 via-primary/5 to-transparent border-primary/30';
  const badgeColor = 'bg-primary/20 text-primary border-primary/30';
  const iconColor = 'text-primary';

  // Deliberately flat. A high model-confidence number is not stronger evidence,
  // and colour-grading it purple above 85% gave unverified output the visual
  // grammar of a verified intelligence product.

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${auraColor} bg-card-border/10 mb-8 backdrop-blur-md`}>
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${auraColor.replace('border', 'from').replace('30', '50')}`} />
      <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b ${auraColor.split(' ')[0]} pointer-events-none opacity-50`} />
      
      <div className="relative p-6 z-10 flex flex-col md:flex-row gap-6">
        {/* Core Verdict Area */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${badgeColor}`}>
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              AI-generated summary
            </div>
            <ProvenanceBadge provenance="ai_generated" size="xs" />
          </div>
          
          <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight mb-3">
            {info.verdict}
          </h2>
          
          <div className="text-sm text-white/80 leading-relaxed mb-4">
            {info.reasoning}
          </div>
        </div>

        {/* Supporting Evidence Column */}
        {info.evidenceSummary && (
          <div className="w-full md:w-1/3 bg-space-900/50 rounded-xl p-4 border border-card-border/50">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              <AlertCircle className="w-4 h-4" aria-hidden="true" /> Points raised by the model
            </div>
            <ul className="space-y-2 text-xs text-white/70">
              {info.evidenceSummary.split('\n').filter(Boolean).map((bullet, idx) => {
                const text = bullet.replace(/^-\s*/, '').trim();
                return (
                  <li key={idx} className="flex gap-2">
                    <span className={`mt-0.5 ${iconColor}`}>&bull;</span>
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 pt-3 border-t border-card-border/50 flex justify-between items-center text-xs">
              <span className="text-muted font-semibold">Model self-rating</span>
              <span className={`font-bold ${iconColor}`}>{confidencePct}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 px-6 pb-5 -mt-2">
        <p className="text-xs text-muted/90 leading-relaxed border-t border-card-border/50 pt-3">
          Unverified language-model output{info.modelUsed ? ` (${info.modelUsed})` : ''}. It has
          not been checked against any filing, the percentage above is the model&apos;s own
          phrasing rather than a measure of evidence, and it is not a statement of fact about any
          named organization or person.{' '}
          <Link href="/methodology" className="underline hover:text-white">How to read this</Link>.
        </p>
      </div>
    </div>
  );
}
