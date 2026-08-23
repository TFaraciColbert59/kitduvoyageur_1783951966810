import { Suspense } from 'react';
import Link from 'next/link';
import { DepartDataLoader } from '@/features/materiel/components/depart/DepartDataLoader';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export const dynamic = 'force-dynamic';

/**
 * DepartPage — shell HTML rendu IMMÉDIATEMENT, données streamées via React Suspense.
 *
 * Architecture :
 *  1. Le shell (header titre + bouton retour) est envoyé en premier — 0ms d'attente.
 *  2. DepartDataLoader résout getDepartDetail + getWeather + getKits côté serveur.
 *  3. Suspense remplace le skeleton dès que les données arrivent (streaming SSR).
 */
export default async function DepartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ route?: string }>;
}) {
  const { id } = await params;
  const { route } = await searchParams;

  return (
    <div className="h-[calc(100dvh-64px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] md:h-[calc(100dvh-88px)] overflow-hidden flex flex-col justify-between">
      {/* Shell instantané — pas de fetch, rendu en quelques ms */}
      <header className="shrink-0 w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 pt-1 pb-1 flex items-center justify-between gap-2">
        <h1 className="min-w-0 font-display font-semibold text-[14px] leading-tight tracking-tight text-[#17402C] truncate">
          Prochain départ
        </h1>
        <Link
          href="/materiel"
          className="glass interactive h-7.5 px-3 rounded-full flex items-center text-xs font-semibold text-[#17402C] shrink-0 border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]"
        >
          ← Retour
        </Link>
      </header>

      {/* Données streamées — skeleton visible pendant le chargement */}
      <Suspense
        fallback={
          <div className="flex-1 min-h-0 w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 pb-2">
            <DepartCockpitSkeleton />
          </div>
        }
      >
        <DepartDataLoader id={id} route={route} />
      </Suspense>
    </div>
  );
}
