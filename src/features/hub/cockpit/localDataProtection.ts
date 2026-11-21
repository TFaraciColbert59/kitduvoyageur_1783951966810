'use client';

import { clearOfflineOps } from './offlineQueue';
import { deleteOfflineMapPack } from './offlineMapPack';
import { clearCarnetDraft } from './CarnetDraftStore';

/**
 * Purge atomique des données locales sensibles du cockpit à la déconnexion
 * ou au changement de compte (P05-10, P05-13).
 */
export async function wipeAllCockpitLocalData(knownTripIds: string[] = []): Promise<void> {
  await clearOfflineOps();
  await Promise.all(knownTripIds.map((id) => deleteOfflineMapPack(id)));
  for (const id of knownTripIds) {
    clearCarnetDraft(id);
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('lkdv_hub_carnet_draft_v1:')) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  }
}
