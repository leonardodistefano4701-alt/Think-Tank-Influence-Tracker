import { Calendar } from "lucide-react";

export default function PolicyTimeline({ items }: { items: any[] }) {
  if (!items?.length) return (
    <div className="flex items-center justify-center p-12 text-center glass rounded-xl border-dashed border-2 border-card-border/50">
       <span className="text-muted flex items-center gap-2"><Calendar className="w-5 h-5"/> No policy or legislative items recorded in system yet.</span>
    </div>
  );
  
  return (
    <div className="flex flex-col gap-6 pl-2">
      <div className="border-l-2 border-primary/50 ml-4 relative flex flex-col gap-8 pb-4">
        {items.map((item, i) => (
          <div key={i} className="relative group hover:-translate-y-1 transition-transform">
            {/* Timeline dot */}
            <div className="absolute -left-[30px] top-4 h-4 w-4 rounded-full bg-primary/20 ring-4 ring-background flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary group-hover:scale-150 transition-transform" />
            </div>
            
            <div className="glass p-6 rounded-xl ml-8 border border-card-border group-hover:border-primary/30 transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                 <span className="text-xs font-bold font-mono text-primary/70">{item.congress ? 'LEGISLATION' : 'POLICY PAPER'}</span>
              </div>
              <h4 className="font-bold text-lg text-white mb-2 max-w-[85%]">{item.title}</h4>
              <div className="text-sm font-semibold tracking-wider text-muted mb-4 uppercase">
                  {item.published_date || item.introduced_date || "Unknown Date"}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                  {item.summary || "No summary trace derived."}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
