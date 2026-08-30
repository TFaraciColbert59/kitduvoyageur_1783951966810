import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export const dynamic = 'force-dynamic';

/**
 * /materiel/depart — Shell SSR optimisé.
 * 0 appel dupliqué : fetch unique agrégé pour le départ et la météo.
 */
export default async function DepartPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  const { route } = await searchParams;

  const [depart, kits] = await Promise.all([
    getDepartDetail(undefined, route),
    getKits(),
  ]);

  const weather = depart.trail?.lat && depart.trail?.lng
    ? await getWeather(depart.trail.lat, depart.trail.lng, depart.trail.name)
    : null;

  const kitList = kits
    .filter((k) => !k.is_trashed)
    .map((k) => ({ id: k.id, name: k.name }));

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-y-auto md:overflow-hidden">
      <Suspense fallback={<DepartCockpitSkeleton />}>
        <DepartCockpit depart={depart} weather={weather} kits={kitList} />
      </Suspense>
    </div>
  );
}
