import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

export default function InfluenceScore({ verdict, confidence, evidence }: { verdict: string, confidence: number, evidence: string }) {
  // Rough textual sentiment thresholds
  const isCaptured = verdict.toLowerCase().includes('capture') || verdict.toLowerCase().includes('align') || confidence > 0.8;
  const isPartial = verdict.toLowerCase().includes('partial') || confidence > 0.5;
  
  const color = isCaptured ? "text-red-500" : (isPartial ? "text-yellow-500" : "text-green-500");
  const bg = isCaptured ? "bg-red-500/10" : (isPartial ? "bg-yellow-500/10" : "bg-green-500/10");
  const border = isCaptured ? "border-red-500/20" : (isPartial ? "border-yellow-500/20" : "border-green-500/20");
  
  return (
    <div className={`p-6 rounded-xl border relative overflow-hidden backdrop-blur-xl ${bg} ${border} shadow-lg transition-transform hover:-translate-y-1`}>
      <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4">
         {isCaptured ? <ShieldAlert className={`w-32 h-32 ${color}`} /> : <ShieldCheck className={`w-32 h-32 ${color}`} />}
      </div>
      
      <div className="flex items-center gap-4 mb-4 relative z-10">
        <div className={`p-3 rounded-full bg-background border ${border}`}>
          {isCaptured ? <ShieldAlert className={`w-6 h-6 ${color}`} /> : (isPartial ? <Shield className={`w-6 h-6 ${color}`} /> : <ShieldCheck className={`w-6 h-6 ${color}`} />)}
        </div>
        <div>
           <h4 className={`text-xl font-bold ${color}`}>LLM Verdict: {verdict.toUpperCase()}</h4>
           <div className="text-sm font-semibold tracking-wide text-foreground/50">Confidence: {(confidence * 100).toFixed(1)}%</div>
        </div>
      </div>
      <p className="text-foreground/80 leading-relaxed text-sm relative z-10 p-4 bg-background/50 rounded-lg border border-card-border">
        {evidence || 'Forensic analysis pending. No evidence traces mapped.'}
      </p>
    </div>
  );
}
