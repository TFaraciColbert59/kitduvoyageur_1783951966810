/** DepartCockpitSkeleton — grille 3-1-2 skeleton animate-pulse.
 *  Reproduit exactement le layout du DepartCockpit pour zéro CLS. */
export function DepartCockpitSkeleton() {
  const base = 'rounded-[var(--r-lg)] bg-white/20 backdrop-blur-sm animate-pulse';
  return (
    <div
      aria-busy="true"
      aria-label="Chargement du cockpit départ…"
      className="h-full w-full grid grid-cols-12 gap-2 items-stretch [grid-template-rows:auto_minmax(0,1fr)_auto] md:[grid-template-rows:repeat(3,minmax(0,1fr))]"
    >
      {/* Ligne 1 — 3 cartes carrées */}
      <div className={`${base} [grid-column:1/5] [grid-row:1/2] aspect-square md:aspect-auto md:h-full`} />
      <div className={`${base} [grid-column:5/9] [grid-row:1/2] aspect-square md:aspect-auto md:h-full`} />
      <div className={`${base} [grid-column:9/13] [grid-row:1/2] aspect-square md:aspect-auto md:h-full`} />

      {/* Ligne 2 — carte centrale pleine largeur */}
      <div className={`${base} [grid-column:1/13] [grid-row:2/3] min-h-0 h-full`}>
        {/* Réticule carte simulé */}
        <div className="h-full w-full rounded-[var(--r-lg)] bg-[#1a3a28]/10 flex items-center justify-center">
          <svg
            aria-hidden="true"
            className="text-white/10 animate-pulse"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </div>
      </div>

      {/* Ligne 3 — 2 cartes carrées */}
      <div className={`${base} [grid-column:1/7] [grid-row:3/4] aspect-square md:aspect-auto md:h-full`} />
      <div className={`${base} [grid-column:7/13] [grid-row:3/4] aspect-square md:aspect-auto md:h-full`} />
    </div>
  );
}
