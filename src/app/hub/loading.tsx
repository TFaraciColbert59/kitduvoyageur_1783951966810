/**
 * UX Hub — Squelette de chargement du hub (stabilité de mise en page, zéro
 * CLS) : silhouette du hero d'activité + grille de widgets vitaux.
 */
export default function HubLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement du hub">
      {/* Silhouette hero */}
      <div className="relative h-[190px] sm:h-[230px] rounded-2xl overflow-hidden bg-black/5 animate-pulse">
        <div className="absolute top-4 left-4 h-5 w-24 rounded-full bg-black/10" />
        <div className="absolute top-4 right-4 h-10 w-16 rounded-2xl bg-black/10" />
        <div className="absolute bottom-4 left-4 space-y-2">
          <div className="h-8 w-64 rounded-lg bg-black/10" />
          <div className="h-4 w-40 rounded bg-black/10" />
        </div>
      </div>
      {/* Silhouette widgets vitaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass p-4 rounded-[var(--lkv-radius-card)] h-[92px] animate-pulse">
            <div className="h-3 w-24 rounded-full bg-black/5 mb-3" />
            <div className="h-6 w-2/3 rounded bg-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
