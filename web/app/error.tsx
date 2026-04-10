'use client';
import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
    useEffect(() => {
        console.error("Layout Exception Caught: ", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-lg mx-auto">
            <div className="relative">
               <ShieldAlert className="w-20 h-20 text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
               <div className="absolute inset-0 animate-ping opacity-20"><ShieldAlert className="w-20 h-20 text-red-500" /></div>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">Network Disruption</h2>
            <p className="text-muted leading-relaxed mb-8">Our connection to the structural influence database encountered an anomaly. The pipeline tracing failed to fetch analytical vectors.</p>
            <button 
                onClick={() => reset()}
                className="px-8 py-4 bg-primary/10 hover:bg-primary/20 hover:scale-105 border border-primary/20 text-primary rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-[0_0_10px_shadow-primary/10]"
            >
                Retrace Connection
            </button>
        </div>
    )
}
