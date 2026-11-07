// Cache client de la dernière donnée serveur RÉELLE du studio (catalogue + kits).
//
// Sert uniquement au repli hors-ligne : si la base est indisponible pour un utilisateur
// connecté, on peut réafficher la dernière donnée réellement synchronisée. Jamais de jeu de
// démonstration : sans cache valide, l'écran affiche « indisponible ».
import type { StudioData } from '../domain/studioData';

export const STUDIO_CACHE_KEY = 'lkdv-kit-studio:server-data:v1';

export interface CachedStudioData {
  readonly savedAt: string;
  readonly data: StudioData;
}

/** Validation structurelle minimale : un cache corrompu est ignoré, jamais utilisé à moitié. */
function isStudioData(value: unknown): value is StudioData {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    Array.isArray(o.items) &&
    Array.isArray(o.kits) &&
    o.kits.length > 0 &&
    typeof o.one === 'object' &&
    o.one !== null &&
    typeof o.colorways === 'object' &&
    o.colorways !== null &&
    typeof o.config === 'object' &&
    o.config !== null
  );
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Enregistre la donnée serveur reçue (appelé au bootstrap serveur du studio). */
export function saveStudioCache(data: StudioData): void {
  const store = storage();
  if (!store) return;
  try {
    const payload: CachedStudioData = { savedAt: new Date().toISOString(), data };
    store.setItem(STUDIO_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota plein / stockage indisponible : l'écran serveur reste la source */
  }
}

/** Dernière donnée serveur réellement synchronisée, ou null (pas de démo). */
export function loadStudioCache(): CachedStudioData | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STUDIO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { savedAt, data } = parsed as Record<string, unknown>;
    if (typeof savedAt !== 'string' || !isStudioData(data)) return null;
    return { savedAt, data };
  } catch {
    return null;
  }
}

/** Efface le cache (déconnexion, données corrompues). */
export function clearStudioCache(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STUDIO_CACHE_KEY);
  } catch {
    /* rien à faire */
  }
}
