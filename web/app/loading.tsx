export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-6 text-primary">
                {/* Advanced aesthetic glowing spinner */}
                <div className="w-16 h-16 border-4 border-card-border border-t-primary rounded-full animate-spin shadow-[0_0_20px_rgba(16,185,129,0.3)] shadow-primary/20" />
                <h3 className="font-bold tracking-[0.2em] text-xs uppercase animate-pulse">Syncing Structural Nodes...</h3>
            </div>
        </div>
    )
}
