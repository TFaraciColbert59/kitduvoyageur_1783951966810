'use client';
// Handler de synchronisation serveur du studio (production uniquement).
//
// Installé par `KitStudioClient` quand la page a fourni des données serveur. Le store appelle ce
// handler après la sauvegarde locale : on pousse uniquement les différences calculées par
// `domain/syncDiff.ts`, via les Server Actions validées par zod. La moindre erreur (réseau, RLS,
// total refusé) remonte : le store annule l'état optimiste et affiche « Non enregistré · réessaie ».
import { diffStudioWrites } from '../domain/syncDiff';
import { studioData } from '../domain/studioData';
import { placePreorder, saveBagConfig, saveKitItemPlacement } from '../server/actions';
import type { StudioSyncHandler } from '../services/studioSync';

/** Construit le handler à partir du contexte serveur présent dans le registre. */
export function createStudioSyncHandler(): StudioSyncHandler | null {
  const sync = studioData().sync;
  if (!sync) return null;

  return async (prev, next): Promise<void> => {
    const writes = diffStudioWrites(prev, next);
    // Cible : kit courant. Un kit absent du contexte serveur n'est pas persistable (kit de démo
    // local) : on saute ses écritures de sac, mais la précommande reste valable (compte).
    const target = sync.kits?.[String(next.kitId)] ?? (String(next.kitId) === sync.kitId ? sync : null);

    for (const write of writes) {
      if (write.kind === 'bagConfig') {
        if (!target) continue;
        const r = await saveBagConfig({
          kitId: String(next.kitId),
          corpsId: write.corpsId,
          modules: [...write.modules],
          colors: { ...write.colors },
        });
        if (!r.ok) throw new Error(r.error);
      } else if (write.kind === 'placement') {
        if (!target) continue;
        const kitItemId = target.kitItemByItemId[write.itemId] ?? write.itemId;
        const r = await saveKitItemPlacement({
          kitId: String(next.kitId),
          itemId: kitItemId,
          zone: write.zone,
          slot: write.slot,
          loadOrder: write.loadOrder,
        });
        if (!r.ok) throw new Error(r.error);
      } else {
        const r = await placePreorder({ items: write.items.map((i) => ({ ...i })), notify: true });
        if (!r.ok) throw new Error(r.error);
      }
    }
  };
}
