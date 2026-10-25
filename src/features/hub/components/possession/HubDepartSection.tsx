import { Suspense } from 'react';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getKits } from '@/features/materiel/services/getKits';
import { getWeather } from '@/features/materiel/services/getWeather';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getLoans } from '@/features/materiel/services/getLoans';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';
import { DepartDesktopView } from '@/features/materiel/components/depart/DepartDesktopView';
import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';
import { DepartMobileExperience } from '@/features/hub/components/mobile/depart/DepartMobileExperience';

/**
 * H4.2 — Section départ du hub (composition materiel/depart/page).
 * Bascule lg : vue desktop en flux ≥ lg, expérience mobile canonique < lg.
 * H-AUTO-42 : les deep-links hérités sont préservés — /materiel/depart/[id]
 * et ?route= redirigent 307 vers /hub/depart?id=…&route=… (aucune perte).
 */
export async function HubDepartSection({
  departId,
  route,
}: {
  departId?: string;
  route?: string;
}) {
  const [depart, kits, inventory, loans, products] = await Promise.all([
    getDepartDetail(departId, route),
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
        <div className="hidden lg:block">
          <DepartDesktopView
            depart={depart}
            weather={weather}
            kits={kitList}
            inventory={inventory}
            loans={loans}
            products={products}
          />
        </div>
        <div className="lg:hidden">
          <DepartMobileExperience
            depart={depart}
            weather={weather}
            kits={kitList}
            inventory={inventory}
            loans={loans}
            products={products}
          />
        </div>
      </Suspense>
    </div>
  );
}

export default HubDepartSection;
