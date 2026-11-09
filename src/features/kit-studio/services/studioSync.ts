// Point d'injection de la persistance serveur (côté client).
//
// Le store (`store/kitStore.ts`) sauvegarde toujours localement (hors-ligne, tests) puis appelle
// le handler injecté s'il existe. Au bootstrap du studio en production, `ui/studioSyncClient.ts`
// installe un handler qui pousse les différences vers les actions serveur. En démo, hors-ligne,
// ou en test, aucun handler n'est installé : aucun appel réseau.
import type { KitState } from '../domain/types';

export interface StudioSyncHandler {
  /** `prev` : dernier état enregistré avec succès ; `next` : état optimiste à pousser. */
  (prev: KitState, next: KitState): Promise<void>;
}

let handler: StudioSyncHandler | null = null;

/** Installe (ou retire avec `null`) le handler de synchronisation serveur. */
export function setStudioSyncHandler(next: StudioSyncHandler | null): void {
  handler = next;
}

/** Handler actif, s'il y en a un. */
export function getStudioSyncHandler(): StudioSyncHandler | null {
  return handler;
}
