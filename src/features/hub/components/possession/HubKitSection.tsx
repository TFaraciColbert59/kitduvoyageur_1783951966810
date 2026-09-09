import { KitsCockpit } from '@/features/materiel/components/kits/KitsCockpit';
import { KitManager } from '@/features/materiel/components/kits/KitManager';
import { KitComparator } from '@/features/materiel/components/kits/KitComparator';
import { KitOptimizer } from '@/features/materiel/components/kits/KitOptimizer';
import { KitHistoryTimeline } from '@/features/materiel/components/kits/KitHistoryTimeline';
import { getKits } from '@/features/materiel/services/getKits';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getPublicKits } from '@/features/materiel/services/getPublicKits';
import { getProductSuggestions } from '@/features/materiel/services/getProductSuggestions';
import { getKitHistory } from '@/features/materiel/services/getKitHistory';

/**
 * H4.2 — Section kits du hub (composition des composants canoniques kits).
 * Le cockpit est verrouillé viewport : wrapper hauteur cockpit dans la
 * colonne hub (h-full desktop, min-hauteur + scroll interne mobile).
 * Sous le cockpit : l'atelier kits réintégré (CRUD, comparateur,
 * optimiseur IA, historique) — composants legacy W-K déjà écrits.
 * /materiel/kits redirige 307 ici (H-AUTO-42).
 */
export async function HubKitSection() {
  const [kits, inventory, publicKits, products] = await Promise.all([
    getKits(),
    getInventory(),
    getPublicKits(),
    getProductSuggestions(undefined, 24),
  ]);
  const primaryKit = kits.find((k) => !k.is_trashed && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k.id)) ?? null;
  const history = primaryKit ? await getKitHistory(primaryKit.id) : [];

  return (
    <div className="md:h-full min-h-[70dvh] flex flex-col min-h-0 md:overflow-y-auto no-scrollbar">
      <div className="md:h-full md:min-h-[70dvh] flex flex-col min-h-0 shrink-0">
        <KitsCockpit
          kits={kits}
          inventory={inventory}
          publicKits={publicKits}
          products={products}
        />
      </div>

      {/* Atelier kits (legacy réintégré) */}
      <section aria-label="Atelier kits" className="shrink-0 space-y-3 px-1 py-4">
        <h2 className="sr-only">Atelier kits</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <KitManager kits={kits} inventory={inventory} />
          <KitComparator kits={kits} />
          <KitOptimizer kits={kits} />
          {history.length > 0 && (
            <KitHistoryTimeline history={history} />
          )}
        </div>
      </section>
    </div>
  );
}

export default HubKitSection;
