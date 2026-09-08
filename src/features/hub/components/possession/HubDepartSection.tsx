import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getLoans } from '@/features/materiel/services/getLoans';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

/**
 * H4.2 — Section départ du hub (composition materiel/depart/page, départ
 * actif par défaut). Cockpit viewport-locked : wrapper hauteur cockpit.
 */
export async function HubDepartSection() {
  const [depart, kits, inventory, loans, products] = await Promise.all([
    getDepartDetail(undefined, undefined),
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
    <div className="md:h-full min-h-[70dvh] flex flex-col min-h-0">
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

export default HubDepartSection;
