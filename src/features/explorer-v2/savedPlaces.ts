/**
 * K3.11 / K5.15 — Gestion locale persistée de « Mes lieux enregistrés ».
 *
 * Scopée par clé utilisateur (`userId ?? 'anon'`) dans localStorage pour éviter
 * toute fuite entre sessions différentes sur le même appareil (invariant C-PRIV).
 * Aucune coordonnée n'est inventée : un lieu sans coordonnées valides est ignoré.
 */

export interface SavedPlace {
  id: string;
  name: string;
  kind: 'poi' | 'highlight' | 'place' | 'route';
  subtype?: string;
  lat: number;
  lng: number;
  eleM?: number | null;
  areaLabel?: string | null;
  highlightId?: string | null;
  savedAt: string;
}

const STORAGE_PREFIX = 'lkdv.explorer.saved-places:';

function storageKey(scope: string | null | undefined): string {
  const clean = typeof scope === 'string' && scope.trim().length > 0 ? scope.trim() : 'local';
  return `${STORAGE_PREFIX}${clean}`;
}

export function isValidSavedPlace(value: unknown): value is SavedPlace {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.id === 'string' &&
    raw.id.trim().length > 0 &&
    typeof raw.name === 'string' &&
    raw.name.trim().length > 0 &&
    typeof raw.lat === 'number' &&
    Number.isFinite(raw.lat) &&
    raw.lat >= -90 &&
    raw.lat <= 90 &&
    typeof raw.lng === 'number' &&
    Number.isFinite(raw.lng) &&
    raw.lng >= -180 &&
    raw.lng <= 180 &&
    typeof raw.savedAt === 'string'
  );
}

export function loadSavedPlaces(scope?: string | null): SavedPlace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedPlace);
  } catch {
    return [];
  }
}

export function writeSavedPlaces(places: SavedPlace[], scope?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(places.slice(0, 200)));
    return true;
  } catch {
    return false;
  }
}

export function toggleSavedPlaceInList(
  current: SavedPlace[],
  candidate: Omit<SavedPlace, 'savedAt'> & { savedAt?: string },
): { places: SavedPlace[]; saved: boolean } {
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
    return { places: current, saved: false };
  }
  const existing = current.some((item) => item.id === candidate.id);
  if (existing) {
    return {
      places: current.filter((item) => item.id !== candidate.id),
      saved: false,
    };
  }
  const entry: SavedPlace = {
    ...candidate,
    savedAt: candidate.savedAt ?? new Date().toISOString(),
  };
  return {
    places: [entry, ...current].slice(0, 200),
    saved: true,
  };
}

export function isPlaceSavedInList(current: readonly SavedPlace[], id: string | null | undefined): boolean {
  if (!id) return false;
  return current.some((item) => item.id === id);
}
