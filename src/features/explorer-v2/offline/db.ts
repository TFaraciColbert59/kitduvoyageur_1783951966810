'use client';

/**
 * Base IndexedDB unique de l'Explorer v2.
 *
 * La file d'écritures (`outbox`) existait déjà en version 1. La continuité de
 * séance ajoute trois magasins sans toucher aux données existantes :
 *   • `sessions` : métadonnées d'une séance locale (identité, métriques,
 *     curseurs de synchronisation) ;
 *   • `session_points` : points GPS réellement reçus, indexés par séquence ;
 *   • `session_routes` : copie locale de l'itinéraire figé de la séance, pour
 *     que le hors-trace survive à un rechargement même hors ligne ;
 *   • `session_meta` : pointeurs `activeId` / `latestId`.
 *
 * Les magasins sont créés de façon additive : une base v2 existante est migrée
 * en v3 sans perdre ses séances ni ses points.
 *
 * L'ouverture est centralisée : deux modules qui ouvriraient la base avec des
 * versions différentes déclencheraient un blocage ou une perte de magasin.
 */

export const EXPLORER_DB_NAME = 'lkdv-explorer-v2';
export const EXPLORER_DB_VERSION = 3;

export const OUTBOX_STORE = 'outbox';
export const ZONES_STORE = 'zones';
export const SESSIONS_STORE = 'sessions';
export const SESSION_POINTS_STORE = 'session_points';
export const SESSION_ROUTES_STORE = 'session_routes';
export const SESSION_META_STORE = 'session_meta';

let databasePromise: Promise<IDBDatabase | null> | null = null;

/** Ouvre la base partagée ; `null` signifie IndexedDB indisponible. */
export function openExplorerDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    const request = indexedDB.open(EXPLORER_DB_NAME, EXPLORER_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ZONES_STORE)) db.createObjectStore(ZONES_STORE);
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'clientSessionId' });
      }
      if (!db.objectStoreNames.contains(SESSION_POINTS_STORE)) {
        db.createObjectStore(SESSION_POINTS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(SESSION_ROUTES_STORE)) {
        db.createObjectStore(SESSION_ROUTES_STORE, { keyPath: 'clientSessionId' });
      }
      if (!db.objectStoreNames.contains(SESSION_META_STORE)) {
        db.createObjectStore(SESSION_META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Une autre fenêtre peut demander une montée de version : on libère la
      // connexion au lieu de bloquer la mise à jour.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = null;
      resolve(null);
    };
    request.onblocked = () => {
      databasePromise = null;
      resolve(null);
    };
  });

  return databasePromise;
}

/** Attend la fin d'une transaction (commit ou annulation). */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}
