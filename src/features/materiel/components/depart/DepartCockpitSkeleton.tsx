import { Skeleton } from '@/components/ui/Skeleton';

/** DepartCockpitSkeleton — skeleton 3-colonnes ultra-fidèle au Cockpit Fullscreen */
export function DepartCockpitSkeleton() {
  return (
    <div className="w-full h-full max-h-full overflow-hidden max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 gap-6 hidden md:flex items-stretch select-none" aria-busy="true" aria-label="Chargement du Cockpit Matériel...">
      {/* Colonne 1 : Skeleton Sidebar Gauche */}
      <div className="w-[280px] shrink-0 h-full max-h-full flex flex-col justify-between glass rounded-[1.5rem] p-3.5 border border-white/40 shadow-sm">
        <div className="space-y-3">
          <div className="p-3 rounded-2xl glass-sub-card space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Skeleton className="h-8 rounded-xl" />
            <Skeleton className="h-8 rounded-xl" />
          </div>
          <div className="space-y-1.5 pt-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Colonne 2 : Skeleton Flux Central (Matériel & Poids) */}
      <div className="flex-1 min-w-0 h-full max-h-full flex flex-col gap-4 overflow-hidden">
        {/* Accordéon Poids */}
        <div className="glass rounded-[28px] p-4 space-y-3 border border-white/80">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        </div>

        {/* Grille Cartes */}
        <div className="glass rounded-[28px] p-5 flex-1 space-y-4 border border-white/80 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-black/5">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 2xl:grid-cols-3 gap-4">
            <Skeleton className="h-44 rounded-[20px]" />
            <Skeleton className="h-44 rounded-[20px]" />
            <Skeleton className="h-44 rounded-[20px]" />
          </div>
        </div>
      </div>

      {/* Colonne 3 : Skeleton Sidebar Droite (Statut & Alertes) */}
      <div className="w-[300px] xl:w-[320px] shrink-0 h-full max-h-full flex flex-col gap-3">
        <div className="glass rounded-2xl p-4 space-y-3 border border-white/40">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-8 w-full rounded-xl" />
          <Skeleton className="h-8 w-full rounded-xl" />
        </div>
        <div className="glass rounded-2xl p-4 flex-1 space-y-2 border border-white/40">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default DepartCockpitSkeleton;
