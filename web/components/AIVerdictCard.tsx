import React from 'react';
import { Bot, AlertCircle } from 'lucide-react';

interface AIAnalysisProps {
  verdict?: string;
  reasoning?: string;
  evidenceSummary?: string;
  confidence?: number;
  modelUsed?: string;
}

export default function AIVerdictCard({ info }: { info: AIAnalysisProps | null }) {
  if (!info) return null;

  const confidencePct = Math.round((info.confidence || 0) * 100);
  let auraColor = 'from-primary/20 via-primary/5 to-transparent border-primary/30';
  let badgeColor = 'bg-primary/20 text-primary border-primary/30';
  let iconColor = 'text-primary';

  if (confidencePct > 85) {
    auraColor = 'from-purple-500/20 via-purple-500/5 to-transparent border-purple-500/30';
    badgeColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    iconColor = 'text-purple-400';
  } else if (confidencePct < 40) {
    auraColor = 'from-yellow-500/20 via-yellow-500/5 to-transparent border-yellow-500/30';
    badgeColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    iconColor = 'text-yellow-400';
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${auraColor} bg-card-border/10 mb-8 backdrop-blur-md`}>
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${auraColor.replace('border', 'from').replace('30', '50')}`} />
      <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b ${auraColor.split(' ')[0]} pointer-events-none opacity-50`} />
      
      <div className="relative p-6 z-10 flex flex-col md:flex-row gap-6">
        {/* Core Verdict Area */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${badgeColor}`}>
              <Bot className="w-3.5 h-3.5" />
              AI Intelligence Synthesis
            </div>
            {info.modelUsed && (
              <div className="text-[10px] text-muted font-mono uppercase">
                Generated via {info.modelUsed}
              </div>
            )}
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
              <AlertCircle className="w-4 h-4" /> Supporting Context
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
              <span className="text-muted font-semibold">Synthesis Confidence</span>
              <span className={`font-bold ${iconColor}`}>{confidencePct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
