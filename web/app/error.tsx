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
               <ShieldAlert className="w-20 h-20 text-failed mb-6 " />
               <div aria-hidden="true" className="absolute inset-0 motion-safe:animate-ping opacity-20"><ShieldAlert className="w-20 h-20 text-failed" /></div>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mb-3">Something went wrong</h2>
            <p className="text-muted leading-relaxed mb-8">This page failed to render. That is usually a problem reading the local database, but it can be any error while building the page.</p>
            <button 
                onClick={() => reset()}
                className="px-8 py-4 bg-accent-wash hover:bg-accent-wash  border border-accent/25 text-accent rounded-md font-bold uppercase text-xs tracking-widest transition-all "
            >
                Try again
            </button>
        </div>
    )
}
