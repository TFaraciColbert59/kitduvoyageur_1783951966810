import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export const dynamic = 'force-dynamic';

/**
 * /materiel/depart/[id] — Shell SSR avec identifiant de kit explicite.
 * Securise : l ID est verifie en base avec le user_id de l utilisateur connecte.
 */
export default async function DepartIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ route?: string }>;
}) {
  const [{ id }, { route }] = await Promise.all([params, searchParams]);

  const [depart, kits, weather] = await Promise.all([
    getDepartDetail(id, route),
    getKits(),
    getDepartDetail(id, route).then((d) =>
      getWeather(d.trail?.lat, d.trail?.lng, d.trail?.name)
    ),
  ]);

  const kitList = kits
    .filter((k) => !k.is_trashed)
    .map((k) => ({ id: k.id, name: k.name }));

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto">
      <Suspense fallback={<DepartCockpitSkeleton />}>
        <DepartCockpit depart={depart} weather={weather} kits={kitList} />
      </Suspense>
    </div>
  );
}