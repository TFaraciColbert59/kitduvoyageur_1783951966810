import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

/** loading.tsx — rendu instantané par Next.js App Router lors du changement d'URL.
 *  Reproduit le shell complet + skeleton 3-1-2 pour zéro écran blanc. */
export default function DepartLoading() {
  return (
    <div className="h-[calc(100dvh-64px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] md:h-[calc(100dvh-88px)] overflow-hidden flex flex-col justify-between">
      {/* Header skeleton */}
      <header className="shrink-0 w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 pt-1 pb-1 flex items-center justify-between gap-2">
        <div className="h-4 w-32 rounded-full bg-white/25 animate-pulse" />
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-full bg-white/20 animate-pulse" />
          <div className="h-7 w-16 rounded-full bg-white/20 animate-pulse" />
        </div>
      </header>
      {/* Grille 3-1-2 skeleton */}
      <div className="flex-1 min-h-0 w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 pb-2">
        <DepartCockpitSkeleton />
      </div>
    </div>
  );
}
