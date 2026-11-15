/**
 * Lot D03-UI — registre serveur en mémoire, isolé par utilisateur.
 *
 * Pourquoi en mémoire ? Le lot D03 porte sur la synchronisation montre et la
 * surface de diagnostic ; aucune migration de base n'est livrée avec ce lot.
 * Le registre est donc un adaptateur de démonstration explicite, jamais
 * présenté comme une persistance durable. Il est conservé sur `globalThis`
 * pour survivre au rechargement des modules en développement, et il est
 * remis à zéro par les tests.
 */

import {
  WatchLiveSyncEngine,
  WatchOfflinePackManager,
  WatchSessionReconciler,
} from '@/features/watches';
import type { UserWatchState } from './types';

const REGISTRY_KEY = Symbol.for('lkdv.d03.watches.registry');
const STORAGE_BYTES = 512 * 1024 * 1024;

type Registry = Map<string, UserWatchState>;

function registry(): Registry {
  const holder = globalThis as typeof globalThis & { [REGISTRY_KEY]?: Registry };
  if (!holder[REGISTRY_KEY]) {
    holder[REGISTRY_KEY] = new Map<string, UserWatchState>();
  }
  return holder[REGISTRY_KEY];
}

export function createUserWatchState(): UserWatchState {
  return {
    devices: new Map(),
    packs: new WatchOfflinePackManager(STORAGE_BYTES),
    reconciler: new WatchSessionReconciler(),
    processedBatches: new Map(),
    liveEngines: new Map(),
    fieldLayout: null,
    updatedAtUtcMs: Date.now(),
  };
}

export function getUserWatchState(userId: string): UserWatchState {
  const key = userId.trim();
  if (key.length === 0) {
    throw new Error('userId requis pour lire l’état montre.');
  }
  const current = registry().get(key);
  if (current) return current;
  const created = createUserWatchState();
  registry().set(key, created);
  return created;
}

export const LAYOUT_ENGINE_KEY = '__layout__';

export function getLiveSyncEngine(
  state: UserWatchState,
  sessionId: string,
): WatchLiveSyncEngine {
  const existing = state.liveEngines.get(sessionId);
  if (existing) return existing as WatchLiveSyncEngine;
  const created = new WatchLiveSyncEngine();
  state.liveEngines.set(sessionId, created);
  return created;
}

export function getLayoutEngine(state: UserWatchState): WatchLiveSyncEngine {
  return getLiveSyncEngine(state, LAYOUT_ENGINE_KEY);
}

/** Utilisé par les tests et les aperçus ; jamais appelé par une route HTTP. */
export function resetWatchStore(): void {
  registry().clear();
}

export function watchStoreSize(): number {
  return registry().size;
}
