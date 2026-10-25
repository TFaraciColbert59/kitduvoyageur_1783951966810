import Dexie, { type Table } from 'dexie';
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

export interface OfflineTripRecord {
  slug: string;
  id: string;
  title: string;
  countryCode: string | null;
  savedAt: string;
  stepsCount: number;
  itemsCount: number;
  tripData: TripFull;
}

/**
 * Y7.4 — Base Dexie (IndexedDB) pour le stockage persistant des voyages hors-ligne.
 * Capacité étendue (centaines de Mo), requêtes asynchrones, typage strict.
 */
export class TripDexieDatabase extends Dexie {
  trips!: Table<OfflineTripRecord, string>;

  constructor() {
    super('lkdv-trips');
    this.version(1).stores({
      trips: 'slug, id, title, savedAt',
    });
  }
}

export const tripDexieDB = new TripDexieDatabase();

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
 * Assainit le voyage pour le stockage local (RGPD / audit Y0.7 / risque R7) :
 * Aucun document (pièces d'identité, billets), aucun share_token, aucune dépense financière.
 */
export function sanitizeTripForOffline(trip: TripFull): TripFull {
  return {
    ...trip,
    documents: [],
    share_token: null,
    expenses: [],
  };
}

/**
 * Sauvegarde localement un voyage pour consultation hors-ligne.
 * Écrit de manière synchrone dans le cache local (UI instantanée) et
 * persiste de manière asynchrone dans Dexie IndexedDB.
 */
export function saveTripOffline(trip: TripFull): boolean {
  const storage = getStorage();
  if (!storage || !trip?.slug) return false;

  try {
    const safeTrip = sanitizeTripForOffline(trip);
    const savedAt = new Date().toISOString();

    const payload: StoredTripPayload = {
      version: 1,
      savedAt,
      trip: safeTrip,
    };

    storage.setItem(`${PREFIX}${trip.slug}`, JSON.stringify(payload));

    // Mettre à jour le manifeste synchrone
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

    // Persistance asynchrone Dexie en tâche de fond
    if (typeof indexedDB !== 'undefined') {
      tripDexieDB.trips.put({
        slug: trip.slug,
        id: trip.id,
        title: trip.title,
        countryCode: trip.destination_country_code || null,
        savedAt,
        stepsCount: trip.steps?.length || 0,
        itemsCount: trip.items?.length || 0,
        tripData: safeTrip,
      }).catch(err => {
        console.warn('[LKDV Offline] Avertissement Dexie put:', err);
      });
    }

    return true;
  } catch (error) {
    console.error('[LKDV Offline] Échec sauvegarde voyage:', error);
    return false;
  }
}

/**
 * Récupère un voyage sauvegardé hors-ligne (synchrone via cache local)
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
 * Supprime un voyage du stockage hors-ligne (local + Dexie)
 */
export function removeOfflineTrip(slug: string): void {
  const storage = getStorage();
  if (!storage || !slug) return;

  try {
    storage.removeItem(`${PREFIX}${slug}`);

    const manifest = listOfflineTrips();
    const updated = manifest.filter(m => m.slug !== slug);
    storage.setItem(MANIFEST_KEY, JSON.stringify(updated));

    if (typeof indexedDB !== 'undefined') {
      tripDexieDB.trips.delete(slug).catch(err => {
        console.warn('[LKDV Offline] Avertissement Dexie delete:', err);
      });
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers Dexie asynchrones (Y7.4)
// ─────────────────────────────────────────────────────────────────────────────

/** Sauvegarde asynchrone garantie dans Dexie */
export async function saveTripOfflineDexie(trip: TripFull): Promise<boolean> {
  const safeTrip = sanitizeTripForOffline(trip);
  const savedAt = new Date().toISOString();

  // Écriture synchrone pour le fallback
  saveTripOffline(trip);

  if (typeof indexedDB === 'undefined') return true;

  try {
    await tripDexieDB.trips.put({
      slug: trip.slug,
      id: trip.id,
      title: trip.title,
      countryCode: trip.destination_country_code || null,
      savedAt,
      stepsCount: trip.steps?.length || 0,
      itemsCount: trip.items?.length || 0,
      tripData: safeTrip,
    });
    return true;
  } catch (err) {
    console.error('[LKDV Offline] Erreur saveTripOfflineDexie:', err);
    return false;
  }
}

/** Lecture asynchrone directe depuis Dexie */
export async function getOfflineTripDexie(slug: string): Promise<TripFull | null> {
  if (typeof indexedDB === 'undefined') {
    return getOfflineTrip(slug);
  }

  try {
    const record = await tripDexieDB.trips.get(slug);
    if (record?.tripData) return record.tripData;
    return getOfflineTrip(slug);
  } catch (err) {
    console.warn('[LKDV Offline] Fallback getOfflineTrip:', err);
    return getOfflineTrip(slug);
  }
}

/** Suppression asynchrone dans Dexie */
export async function removeOfflineTripDexie(slug: string): Promise<void> {
  removeOfflineTrip(slug);
  if (typeof indexedDB !== 'undefined') {
    try {
      await tripDexieDB.trips.delete(slug);
    } catch (err) {
      console.warn('[LKDV Offline] Erreur delete Dexie:', err);
    }
  }
}

/** Liste asynchrone des voyages depuis Dexie */
export async function listOfflineTripsDexie(): Promise<OfflineTripManifestEntry[]> {
  if (typeof indexedDB === 'undefined') {
    return listOfflineTrips();
  }

  try {
    const records = await tripDexieDB.trips.toArray();
    if (records.length > 0) {
      return records.map(r => ({
        slug: r.slug,
        title: r.title,
        countryCode: r.countryCode,
        savedAt: r.savedAt,
        stepsCount: r.stepsCount,
        itemsCount: r.itemsCount,
      }));
    }
    return listOfflineTrips();
  } catch {
    return listOfflineTrips();
  }
}
