import { KitsCockpit } from '@/features/materiel/components/kits/KitsCockpit';
import { getKits } from '@/features/materiel/services/getKits';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getPublicKits } from '@/features/materiel/services/getPublicKits';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';

/**
 * H4.2 — Section kits du hub (composition des composants canoniques kits).
 * Le cockpit est verrouillé viewport : wrapper hauteur cockpit dans la
 * colonne hub (h-full desktop, min-hauteur + scroll interne mobile).
 * /materiel/kits redirige 307 ici (H-AUTO-42).
 */
export async function HubKitSection() {
  const [kits, inventory, publicKits, products] = await Promise.all([
    getKits(),
    getInventory(),
    getPublicKits(),
    getProductSuggestions(undefined, 24),
  ]);

  return (
    <div className="md:h-full min-h-[70dvh] flex flex-col min-h-0">
      <KitsCockpit
        kits={kits}
        inventory={inventory}
        publicKits={publicKits}
        products={products}
      />
    </div>
  );
}

export default HubKitSection;
