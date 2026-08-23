import { KitsCockpit } from '@/features/materiel/components/kits/KitsCockpit';
import { getKits } from '@/features/materiel/services/getKits';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getPublicKits } from '@/features/materiel/services/getPublicKits';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';

export const dynamic = 'force-dynamic';

export default async function KitsPage() {
  const [kits, inventory, publicKits, products] = await Promise.all([
    getKits(),
    getInventory(),
    getPublicKits(),
    getProductSuggestions(undefined, 24),
  ]);

  return (
    <div className="h-[calc(100dvh-64px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] md:h-[calc(100dvh-88px)] overflow-hidden flex flex-col justify-center items-center w-full">
      {/* Grille Cockpit des Kits parfaitement centrée */}
      <div className="flex-1 min-h-0 w-full max-w-[var(--page-max-w)] mx-auto px-2.5 sm:px-4 pt-1 pb-2 flex flex-col justify-center">
        <KitsCockpit
          kits={kits}
          inventory={inventory}
          publicKits={publicKits}
          products={products}
        />
      </div>
    </div>
  );
}
