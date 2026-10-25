/**
 * Petit cache mémoire serveur, strictement par utilisateur.
 * Objectif : éviter de recalculer le bootstrap, la carte et l'activité quand
 * la page et un overlay les demandent à quelques secondes d'intervalle.
 * TTL court et taille bornée ; aucune donnée n'est partagée entre utilisateurs.
 */
interface Entry {
  expiresAt: number;
  value: unknown;
}

const MAX_ENTRIES = 80;
const store = new Map<string, Entry>();

function prune() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached(key: string, value: unknown, ttlMs: number): void {
  prune();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateUserCache(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function userCacheKey(userId: string, resource: string): string {
  return `${userId}:${resource}`;
}
