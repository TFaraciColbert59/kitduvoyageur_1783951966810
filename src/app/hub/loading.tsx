/**
 * H3.4 — Squelette de chargement du hub (stabilité de mise en page, zéro CLS).
 */
export default function HubLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement du hub">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-black/5 animate-pulse" />
        <div className="h-7 w-56 rounded-lg bg-black/5 animate-pulse" />
        <div className="h-4 w-40 rounded bg-black/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass p-4 rounded-[var(--lkv-radius-card)] h-[68px] animate-pulse">
            <div className="h-4 w-2/3 rounded bg-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
