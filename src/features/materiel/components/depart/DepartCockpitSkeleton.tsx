import { Card, Skeleton } from '@/components/ui';

/** DepartCockpitSkeleton — skeleton 3-colonnes ultra-fidèle au Cockpit Fullscreen */
export function DepartCockpitSkeleton() {
  return (
    <div className="w-full h-full max-h-full overflow-hidden max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 gap-6 hidden md:flex items-stretch select-none" aria-busy="true" aria-label="Chargement du Cockpit Matériel...">
      {/* Colonne 1 : Skeleton Sidebar Gauche */}
      <Card className="flex h-full max-h-full w-[280px] shrink-0 flex-col justify-between p-3.5">
        <div className="space-y-3">
          <Card variant="compact" className="space-y-2 p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </Card>
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
      </Card>

      {/* Colonne 2 : Skeleton Flux Central (Matériel & Poids) */}
      <div className="flex-1 min-w-0 h-full max-h-full flex flex-col gap-4 overflow-hidden">
        {/* Accordéon Poids */}
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        </Card>

        {/* Grille Cartes */}
        <Card className="flex-1 space-y-4 overflow-hidden p-5">
          <div className="flex items-center justify-between pb-3 border-b border-black/5">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 2xl:grid-cols-3 gap-4">
            <Skeleton className="h-44 rounded-lg" />
            <Skeleton className="h-44 rounded-lg" />
            <Skeleton className="h-44 rounded-lg" />
          </div>
        </Card>
      </div>

      {/* Colonne 3 : Skeleton Sidebar Droite (Statut & Alertes) */}
      <div className="w-[300px] xl:w-[320px] shrink-0 h-full max-h-full flex flex-col gap-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-8 w-full rounded-xl" />
          <Skeleton className="h-8 w-full rounded-xl" />
        </Card>
        <Card className="flex-1 space-y-2 p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </Card>
      </div>
    </div>
  );
}

export default DepartCockpitSkeleton;
