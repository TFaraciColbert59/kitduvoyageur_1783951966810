import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export const dynamic = 'force-dynamic';

/**
 * /materiel/depart — Shell SSR ultra-rapide.
 * Charge toutes les donnees en parallele puis stream vers le client.
 */
export default async function DepartPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  const { route } = await searchParams;

  const [depart, kits, weather] = await Promise.all([
    getDepartDetail(undefined, route),
    getKits(),
    getDepartDetail(undefined, route).then((d) =>
      getWeather(d.trail?.lat, d.trail?.lng, d.trail?.name)
    ),
  ]);

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
