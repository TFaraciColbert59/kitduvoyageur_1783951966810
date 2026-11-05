// Persistance étage 1 (local) : @capacitor/preferences en natif, repli localStorage.
// Toute lecture passe par parseKitState ; toute erreur est avalée (null / no-op).
import { parseKitState } from '../domain/schema';
import { createInitialState } from '../domain/state';
import type { KitState } from '../domain/types';

export const KIT_STORAGE_KEY = 'lkdv-kit-studio:v1';

interface Backend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const local: Backend = {
  get: async (k) => globalThis.localStorage?.getItem(k) ?? null,
  set: async (k, v) => { globalThis.localStorage?.setItem(k, v); },
  remove: async (k) => { globalThis.localStorage?.removeItem(k); },
};

async function nativeBackend(): Promise<Backend | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { Preferences } = await import('@capacitor/preferences');
    return {
      get: async (key) => (await Preferences.get({ key })).value,
      set: async (key, value) => { await Preferences.set({ key, value }); },
      remove: async (key) => { await Preferences.remove({ key }); },
    };
  } catch {
    return null;
  }
}

async function backend(): Promise<Backend> {
  return (await nativeBackend()) ?? local;
}

/**
 * Migration de version. v0 hypothétique (sans `version`, ou version 0) : pas encore de own/order/extraItems.
 * Renvoie un objet à valider ensuite par parseKitState ; une version inconnue (future) est rendue telle quelle.
 */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  if (r.version === 1) return raw;
  if (r.version === undefined || r.version === 0) {
    const base = createInitialState();
    return {
      ...r,
      version: 1,
      own: r.own ?? base.own,
      order: r.order ?? base.order,
      extraItems: r.extraItems ?? [],
    };
  }
  return raw;
}

export async function load(): Promise<KitState | null> {
  try {
    const text = await (await backend()).get(KIT_STORAGE_KEY);
    if (!text) return null;
    return parseKitState(migrate(JSON.parse(text) as unknown));
  } catch {
    return null;
  }
}

export async function save(state: KitState): Promise<void> {
  try {
    await (await backend()).set(KIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible ou plein : l'état reste en mémoire */
  }
}

export async function clear(): Promise<void> {
  try {
    await (await backend()).remove(KIT_STORAGE_KEY);
  } catch {
    /* rien à faire */
  }
}
