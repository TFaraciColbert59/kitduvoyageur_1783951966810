import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export const dynamic = 'force-dynamic';

/**
 * /materiel — Page Centrale de Matériel (Cockpit de Préparation au Départ).
 * Fusionne la vision globale et la préparation active du trek.
 */
export default async function MaterielPage({
  searchParams,
}: {
  searchParams: Promise<{ kit?: string; route?: string }>;
}) {
  const { kit, route } = await searchParams;

  const [depart, kits] = await Promise.all([
    getDepartDetail(kit, route),
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
      <h1 className="sr-only">Cockpit Matériel & Préparation au Départ</h1>
      <Suspense fallback={<DepartCockpitSkeleton />}>
        <DepartCockpit depart={depart} weather={weather} kits={kitList} />
      </Suspense>
    </div>
  );
}
