'use client';
import { Route, Map as MapIcon, Database } from "lucide-react";

export default function DonorFlowChart({ data }: { data: any[] }) {
   if (!data || data.length === 0) {
       return (
           <div className="p-24 text-center text-muted flex flex-col items-center justify-center min-h-[500px]">
               <MapIcon className="w-16 h-16 text-card-border mb-4" />
               <p className="text-lg">Network visualization requires aggregate influence links.</p>
           </div>
       );
   }

   return (
       <div className="w-full flex items-center justify-center min-h-[600px] p-8">
           <div className="w-full max-w-5xl flex flex-col lg:flex-row justify-between items-stretch gap-4 relative">
               
               {/* Donor Node Column */}
               <div className="flex-1 flex flex-col gap-4 z-10">
                   <h3 className="uppercase tracking-widest text-xs font-bold text-muted mb-4 text-center">Capital Sources</h3>
                   <div className="glass p-6 rounded-xl border border-card-border text-center flex-1 hover:border-primary/50 transition-colors">
                       <Database className="w-8 h-8 text-primary mx-auto mb-2" />
                       <h4 className="font-bold text-lg text-white">Donor SuperPACs</h4>
                       <span className="text-xs text-muted block mt-2">Aggregate Influx: $450.2M</span>
                   </div>
               </div>

               {/* Connector Line Simulated */}
               <div className="hidden lg:flex flex-col items-center justify-center px-4 relative z-0">
                    <div className="h-[2px] w-full absolute bg-primary/30 top-1/2 -translate-y-1/2"></div>
                    <Route className="w-8 h-8 text-primary animate-pulse bg-background p-1 rounded-full relative z-10" />
               </div>

               {/* Think Tank Node Column */}
               <div className="flex-1 flex flex-col gap-4 z-10">
                   <h3 className="uppercase tracking-widest text-xs font-bold text-muted mb-4 text-center">Amplifiers & Tanks</h3>
                   <div className="bg-primary/10 p-6 rounded-xl border-2 border-primary/30 text-center flex-1 backdrop-blur-md">
                       <h4 className="font-bold text-lg text-primary">Ideological Think Tanks</h4>
                       <span className="text-xs text-muted block mt-2">Structural Vectors</span>
                   </div>
               </div>

               {/* Connector Line Simulated */}
               <div className="hidden lg:flex flex-col items-center justify-center px-4 relative z-0">
                    <div className="h-[2px] w-full absolute bg-yellow-500/30 top-1/2 -translate-y-1/2"></div>
                    <Route className="w-8 h-8 text-yellow-500 animate-pulse bg-background p-1 rounded-full relative z-10" />
               </div>

               {/* Legislation Node Column */}
               <div className="flex-1 flex flex-col gap-4 z-10">
                   <h3 className="uppercase tracking-widest text-xs font-bold text-muted mb-4 text-center">Congressional Policy</h3>
                   <div className="glass p-6 rounded-xl border border-card-border text-center flex-1 hover:border-yellow-500/50 transition-colors">
                       <h4 className="font-bold text-lg text-white">Captured Legislation</h4>
                       <span className="text-xs text-muted block mt-2">Verified Echoed Output</span>
                   </div>
               </div>

           </div>
       </div>
   );
}
