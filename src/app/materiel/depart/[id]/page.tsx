import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getLoans } from '@/features/materiel/services/getLoans';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export const dynamic = 'force-dynamic';

/**
 * /materiel/depart/[id] — Shell SSR avec identifiant de kit explicite.
 */
export default async function DepartIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ route?: string }>;
}) {
  const [{ id }, { route }] = await Promise.all([params, searchParams]);

  const [depart, kits, inventory, loans, products] = await Promise.all([
    getDepartDetail(id, route),
    getKits(),
    getInventory(),
    getLoans(),
    getProductSuggestions(undefined, 8),
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
        <DepartCockpit
          depart={depart}
          weather={weather}
          kits={kitList}
          inventory={inventory}
          loans={loans}
          products={products}
        />
      </Suspense>
    </div>
  );
}
