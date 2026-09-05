import type { TripFull } from '@/features/trips/types/trip.types';

const PREFIX = 'lkdv:offline:trip:';
const MANIFEST_KEY = 'lkdv:offline:manifest';

export interface OfflineTripManifestEntry {
  slug: string;
  title: string;
  countryCode: string | null;
  savedAt: string;
  stepsCount: number;
  itemsCount: number;
}

interface StoredTripPayload {
  version: number;
  savedAt: string;
  trip: TripFull;
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Sauvegarde localement l'intégralité d'un voyage pour consultation hors-ligne
 */
export function saveTripOffline(trip: TripFull): boolean {
  const storage = getStorage();
  if (!storage || !trip?.slug) return false;

  try {
    const payload: StoredTripPayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      trip,
    };

    storage.setItem(`${PREFIX}${trip.slug}`, JSON.stringify(payload));

    // Mettre à jour le manifeste
    const manifest = listOfflineTrips();
    const filtered = manifest.filter(m => m.slug !== trip.slug);
    filtered.unshift({
      slug: trip.slug,
      title: trip.title,
      countryCode: trip.destination_country_code || null,
      savedAt: payload.savedAt,
      stepsCount: trip.steps?.length || 0,
      itemsCount: trip.items?.length || 0,
    });

    storage.setItem(MANIFEST_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('[LKDV Offline] Échec sauvegarde voyage:', error);
    return false;
  }
}

/**
 * Récupère un voyage sauvegardé hors-ligne
 */
export function getOfflineTrip(slug: string): TripFull | null {
  const storage = getStorage();
  if (!storage || !slug) return null;

  try {
    const raw = storage.getItem(`${PREFIX}${slug}`);
    if (!raw) return null;

    const parsed: StoredTripPayload = JSON.parse(raw);
    return parsed.trip || null;
  } catch (error) {
    console.error('[LKDV Offline] Échec lecture voyage:', error);
    return null;
  }
}

/**
 * Vérifie si un voyage est déjà disponible hors-ligne
 */
export function isTripAvailableOffline(slug: string): boolean {
  const storage = getStorage();
  if (!storage || !slug) return false;
  return Boolean(storage.getItem(`${PREFIX}${slug}`));
}

/**
 * Supprime un voyage du stockage hors-ligne
 */
export function removeOfflineTrip(slug: string): void {
  const storage = getStorage();
  if (!storage || !slug) return;

  try {
    storage.removeItem(`${PREFIX}${slug}`);

    const manifest = listOfflineTrips();
    const updated = manifest.filter(m => m.slug !== slug);
    storage.setItem(MANIFEST_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[LKDV Offline] Échec suppression voyage:', error);
  }
}

/**
 * Liste l'ensemble des voyages disponibles hors-ligne
 */
export function listOfflineTrips(): OfflineTripManifestEntry[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineTripManifestEntry[];
  } catch {
    return [];
  }
}
