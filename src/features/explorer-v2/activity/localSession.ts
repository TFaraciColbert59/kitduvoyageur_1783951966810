'use client';

/**
 * Persistance locale d'une séance de l'Explorer v2.
 *
 * Le serveur ne peut pas être la seule mémoire d'une séance : un rafraîchissement,
 * un verrouillage ou une coupure réseau ne doivent ni perdre la trace déjà
 * capturée, ni changer l'identité de séance. Ce module écrit donc **avant**
 * toute synchronisation :
 *
 *   • une fiche de séance (identité stable, métriques, curseurs) ;
 *   • chaque point GPS réellement accepté par le tracker, avec une séquence
 *     monotone ; c'est cette séquence qui rend le renvoi idempotent côté SQL ;
 *   • la copie figée de l'itinéraire, dans un magasin séparé, pour que le
 *     hors-trace survive à un rechargement même hors ligne.
 *
 * Aucun point n'est fabriqué ici : `appendSessionPoint` n'est appelé que pour
 * un fix que `ActivityTracker` a accepté. IndexedDB indisponible ⇒ aucune
 * promesse de persistance n'est faite, les fonctions renvoient `null`.
 */

import type {
  ActivityState,
  Sport,
  SportSelection,
  TrailRouteSnapshot,
} from '../state/types';
import type { SummarySavedState } from './finishOutcome';
import {
  SESSIONS_STORE,
  SESSION_META_STORE,
  SESSION_POINTS_STORE,
  SESSION_ROUTES_STORE,
  openExplorerDb,
  transactionDone,
} from '../offline/db';

export const LOCAL_SESSION_VERSION = 1;
export const ACTIVE_SESSION_KEY = 'activeId';
export const LATEST_SESSION_KEY = 'latestId';

export type LocalSessionStatus = 'active' | 'finished';

export interface LocalSessionRecord {
  version: typeof LOCAL_SESSION_VERSION;
  clientSessionId: string;
  serverSessionId: string | null;
  sport: Sport;
  selection?: SportSelection;
  startedAt: number;
  endedAt: number | null;
  paused: boolean;
  distanceM: number;
  elevGainM: number;
  movingS: number;
  /** Dernière séquence écrite localement (0 = aucun point). */
  lastPointSeq: number;
  /** Dernière séquence acquittée par le serveur. */
  syncedThroughSeq: number;
  status: LocalSessionStatus;
  summarySaved?: SummarySavedState;
  updatedAt: number;
}

export interface LocalSessionPoint {
  /** Clé IndexedDB stable : `clientSessionId:seq`. */
  key: string;
  clientSessionId: string;
  seq: number;
  t: number;
  lat: number;
  lng: number;
  ele?: number | null;
  acc?: number | null;
  speed?: number | null;
  /**
   * Faux pour un point reçu pendant une pause automatique : le tracker le
   * rejoue pour retrouver ses métriques, mais il ne doit pas être dessiné.
   * Absent sur les anciens points, qui restent dessinés.
   */
  drawn?: boolean;
  /**
   * Vrai quand ce point ouvre un nouveau segment de tracé (pause manuelle,
   * pause automatique, trou GPS ou premier point après un rejet). Absent sur
   * les anciens points : leur tracé reste continu, faute d'information.
   */
  breakBefore?: boolean;
}

/** Version locale de la copie d'itinéraire, indépendante de la fiche. */
export const LOCAL_SESSION_ROUTE_VERSION = 1;

interface StoredSessionRoute {
  version: typeof LOCAL_SESSION_ROUTE_VERSION;
  clientSessionId: string;
  route: TrailRouteSnapshot;
  updatedAt: number;
}

interface MetaRecord {
  key: string;
  value: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** UUID v4 stable pour l'identité de séance, sans dépendance au DOM. */
export function newClientSessionId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export function sessionPointKey(clientSessionId: string, seq: number): string {
  return `${clientSessionId}:${String(seq).padStart(12, '0')}`;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegative(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

const TERMINAL_SUMMARY_STATES: ReadonlySet<SummarySavedState> = new Set([
  'saved',
  'already_finished',
  'already_finished_without_summary',
  'conflict',
  'local',
]);

/**
 * Une écriture tardive ne doit pas rétrograder un bilan déjà terminal
 * (`saved` → `pending`). Les états d'attente peuvent en revanche évoluer.
 */
function mergeSummarySaved(
  current: SummarySavedState | undefined,
  incoming: SummarySavedState | undefined,
): SummarySavedState | undefined {
  if (current && TERMINAL_SUMMARY_STATES.has(current)) {
    if (!incoming || !TERMINAL_SUMMARY_STATES.has(incoming)) return current;
  }
  return incoming ?? current;
}

/**
 * Lecture défensive d'une fiche IndexedDB. Une fiche corrompue ou d'une
 * version inconnue est ignorée plutôt que réhydratée de travers.
 */
export function parseLocalSessionRecord(value: unknown): LocalSessionRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const clientSessionId = record.clientSessionId;
  const serverSessionId = record.serverSessionId;
  const sport = record.sport;
  const status = record.status;
  const startedAt = record.startedAt;
  const endedAt = record.endedAt;
  const distanceM = record.distanceM;
  const elevGainM = record.elevGainM;
  const movingS = record.movingS;
  const lastPointSeq = record.lastPointSeq;
  const syncedThroughSeq = record.syncedThroughSeq;
  const updatedAt = record.updatedAt;
  if (record.version !== LOCAL_SESSION_VERSION) return null;
  if (!isUuid(clientSessionId)) return null;
  if (typeof sport !== 'string' || sport.length === 0) return null;
  if (!finiteNumber(startedAt) || startedAt <= 0) return null;
  if (!nonNegative(distanceM) || !nonNegative(elevGainM) || !nonNegative(movingS)) {
    return null;
  }
  if (!nonNegative(lastPointSeq) || !nonNegative(syncedThroughSeq)) return null;
  if (status !== 'active' && status !== 'finished') return null;
  if (endedAt !== null && !finiteNumber(endedAt)) return null;
  if (serverSessionId !== null && !isUuid(serverSessionId)) return null;

  return {
    version: LOCAL_SESSION_VERSION,
    clientSessionId,
    serverSessionId: (serverSessionId as string | null) ?? null,
    sport: sport as Sport,
    ...(record.selection && typeof record.selection === 'object'
      ? { selection: record.selection as SportSelection }
      : {}),
    startedAt,
    endedAt: (endedAt as number | null) ?? null,
    paused: record.paused === true,
    distanceM,
    elevGainM,
    movingS,
    lastPointSeq: Math.floor(lastPointSeq),
    syncedThroughSeq: Math.floor(syncedThroughSeq),
    status: status as LocalSessionStatus,
    ...(typeof record.summarySaved === 'string'
      ? { summarySaved: record.summarySaved as SummarySavedState }
      : {}),
    updatedAt: finiteNumber(updatedAt) ? updatedAt : Date.now(),
  };
}

/**
 * Lecture défensive de la copie d'itinéraire. Le GeoJSON reste opaque : il est
 * relu par `routeLines`, qui sait déjà ignorer une géométrie inexploitable.
 * Une copie d'une version inconnue est ignorée, jamais convertie à l'aveugle.
 */
function parseSessionRoute(value: unknown): TrailRouteSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const stored = value as Record<string, unknown>;
  if (stored.version !== LOCAL_SESSION_ROUTE_VERSION) return null;
  if (!isUuid(stored.clientSessionId)) return null;
  const route = stored.route;
  if (!route || typeof route !== 'object' || Array.isArray(route)) return null;
  const snapshot = route as Record<string, unknown>;
  if (typeof snapshot.id !== 'string' || snapshot.id.length === 0) return null;
  const status = snapshot.status;
  if (status !== 'loading' && status !== 'ready' && status !== 'unavailable') {
    return null;
  }
  if (snapshot.name !== null && typeof snapshot.name !== 'string') return null;
  const geojson = snapshot.geojson;
  if (geojson !== null && typeof geojson !== 'object') return null;
  return {
    id: snapshot.id,
    name: (snapshot.name as string | null) ?? null,
    geojson: (geojson as unknown | null) ?? null,
    status,
  };
}

export function activityFromRecord(
  record: LocalSessionRecord,
  route?: TrailRouteSnapshot | null,
): (ActivityState & { endedAt: number }) | null {
  if (record.endedAt === null) return null;
  return {
    sport: record.sport,
    ...(record.selection ? { selection: record.selection } : {}),
    ...(route ? { route } : {}),
    sessionId: record.serverSessionId,
    clientSessionId: record.clientSessionId,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    paused: record.paused,
    offRoute: false,
    distanceM: record.distanceM,
    elevGainM: record.elevGainM,
    movingS: record.movingS,
  };
}

export function recordFromActivity(
  activity: ActivityState & { endedAt?: number },
  previous?: LocalSessionRecord | null,
): LocalSessionRecord {
  return {
    version: LOCAL_SESSION_VERSION,
    clientSessionId: activity.clientSessionId ?? previous?.clientSessionId ?? newClientSessionId(),
    serverSessionId: isUuid(activity.sessionId)
      ? activity.sessionId
      : (previous?.serverSessionId ?? null),
    sport: activity.sport,
    ...(activity.selection ? { selection: activity.selection } : {}),
    startedAt: activity.startedAt,
    endedAt: typeof activity.endedAt === 'number' ? activity.endedAt : (previous?.endedAt ?? null),
    paused: activity.paused === true,
    distanceM: activity.distanceM,
    elevGainM: activity.elevGainM,
    movingS: activity.movingS,
    lastPointSeq: previous?.lastPointSeq ?? 0,
    syncedThroughSeq: previous?.syncedThroughSeq ?? 0,
    status: typeof activity.endedAt === 'number' ? 'finished' : 'active',
    ...(previous?.summarySaved ? { summarySaved: previous.summarySaved } : {}),
    updatedAt: Date.now(),
  };
}

// Les écritures passent par une chaîne unique : deux transactions IndexedDB
// lancées en parallèle pourraient se terminer dans l'ordre inverse et faire
// reculer `lastPointSeq`.
let writeChain: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = writeChain.then(work, work);
  writeChain = next.catch(() => undefined);
  return next;
}

/** Attend les écritures locales en cours avant une lecture critique (fin). */
export async function flushLocalSessionWrites(): Promise<void> {
  await writeChain.catch(() => undefined);
}

async function readMeta(key: string): Promise<string | null> {
  const db = await openExplorerDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_META_STORE, 'readonly');
      const request = tx.objectStore(SESSION_META_STORE).get(key);
      request.onsuccess = () => {
        const value = request.result as MetaRecord | undefined;
        resolve(typeof value?.value === 'string' ? value.value : null);
      };
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readRecord(clientSessionId: string): Promise<LocalSessionRecord | null> {
  const db = await openExplorerDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const request = tx.objectStore(SESSIONS_STORE).get(clientSessionId);
      request.onsuccess = () => resolve(parseLocalSessionRecord(request.result));
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readActiveSession(): Promise<LocalSessionRecord | null> {
  const activeId = await readMeta(ACTIVE_SESSION_KEY);
  if (!activeId) return null;
  const record = await readRecord(activeId);
  return record?.status === 'active' ? record : null;
}

export async function readLatestFinishedSession(): Promise<LocalSessionRecord | null> {
  const latestId = await readMeta(LATEST_SESSION_KEY);
  if (!latestId) return null;
  const record = await readRecord(latestId);
  return record?.status === 'finished' ? record : null;
}

export function readLocalSession(clientSessionId: string): Promise<LocalSessionRecord | null> {
  return readRecord(clientSessionId);
}

/**
 * Conserve la copie figée de l'itinéraire hors de la fiche de séance : elle
 * n'est réécrite que lorsque la géométrie change (jamais à chaque point), et
 * reste disponible hors ligne pour le hors-trace après rechargement.
 */
export function saveSessionRoute(
  clientSessionId: string,
  route: TrailRouteSnapshot,
): Promise<void> {
  if (!isUuid(clientSessionId) || !route.id) return Promise.resolve();
  return serial(async () => {
    const db = await openExplorerDb();
    if (!db) return;
    try {
      const stored: StoredSessionRoute = {
        version: LOCAL_SESSION_ROUTE_VERSION,
        clientSessionId,
        route,
        updatedAt: Date.now(),
      };
      const tx = db.transaction(SESSION_ROUTES_STORE, 'readwrite');
      tx.objectStore(SESSION_ROUTES_STORE).put(stored);
      await transactionDone(tx);
    } catch {
      // IndexedDB indisponible : le hors-trace reste en mémoire pour la séance.
    }
  });
}

export async function readSessionRoute(
  clientSessionId: string,
): Promise<TrailRouteSnapshot | null> {
  if (!isUuid(clientSessionId)) return null;
  const db = await openExplorerDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_ROUTES_STORE, 'readonly');
      const request = tx.objectStore(SESSION_ROUTES_STORE).get(clientSessionId);
      request.onsuccess = () => {
        const stored = request.result as { clientSessionId?: unknown } | undefined;
        // Une clé et un contenu qui ne concordent pas ne doivent pas faire
        // hériter une séance de l'itinéraire d'une autre.
        if (!stored || stored.clientSessionId !== clientSessionId) {
          resolve(null);
          return;
        }
        resolve(parseSessionRoute(stored));
      };
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Écrit la fiche active et le pointeur correspondant. */
export function saveActiveSession(record: LocalSessionRecord): Promise<void> {
  return serial(async () => {
    const db = await openExplorerDb();
    if (!db) return;
    try {
      const current = await readRecord(record.clientSessionId);
      const next: LocalSessionRecord = {
        ...(current ?? record),
        ...record,
        serverSessionId: record.serverSessionId ?? current?.serverSessionId ?? null,
        lastPointSeq: Math.max(record.lastPointSeq, current?.lastPointSeq ?? 0),
        syncedThroughSeq: Math.max(record.syncedThroughSeq, current?.syncedThroughSeq ?? 0),
      };
      const tx = db.transaction([SESSIONS_STORE, SESSION_META_STORE], 'readwrite');
      tx.objectStore(SESSIONS_STORE).put(next);
      tx.objectStore(SESSION_META_STORE).put({ key: ACTIVE_SESSION_KEY, value: record.clientSessionId });
      await transactionDone(tx);
    } catch {
      // IndexedDB indisponible : aucune persistance annoncée.
    }
  });
}

/** Écrit le dernier bilan et libère le pointeur actif s'il désigne cette séance. */
export function saveFinishedSession(record: LocalSessionRecord): Promise<void> {
  return serial(async () => {
    const db = await openExplorerDb();
    if (!db) return;
    try {
      const current = await readRecord(record.clientSessionId);
      const summarySaved = mergeSummarySaved(current?.summarySaved, record.summarySaved);
      const next: LocalSessionRecord = {
        ...(current ?? record),
        ...record,
        serverSessionId: record.serverSessionId ?? current?.serverSessionId ?? null,
        lastPointSeq: Math.max(record.lastPointSeq, current?.lastPointSeq ?? 0),
        syncedThroughSeq: Math.max(record.syncedThroughSeq, current?.syncedThroughSeq ?? 0),
        ...(summarySaved ? { summarySaved } : {}),
      };
      const activeId = await readMeta(ACTIVE_SESSION_KEY);
      const tx = db.transaction([SESSIONS_STORE, SESSION_META_STORE], 'readwrite');
      tx.objectStore(SESSIONS_STORE).put(next);
      tx.objectStore(SESSION_META_STORE).put({ key: LATEST_SESSION_KEY, value: record.clientSessionId });
      if (activeId === record.clientSessionId) {
        tx.objectStore(SESSION_META_STORE).delete(ACTIVE_SESSION_KEY);
      }
      await transactionDone(tx);
    } catch {
      // IndexedDB indisponible : aucune persistance annoncée.
    }
  });
}

/**
 * Ajoute un point déjà accepté par le tracker et met à jour les métriques.
 * La fiche complète est réécrite dans la même transaction que le point.
 */
export function appendSessionPoint(
  record: LocalSessionRecord,
  point: Omit<LocalSessionPoint, 'key' | 'clientSessionId'>,
): Promise<void> {
  const storedPoint: LocalSessionPoint = {
    ...point,
    key: sessionPointKey(record.clientSessionId, point.seq),
    clientSessionId: record.clientSessionId,
  };
  return serial(async () => {
    const db = await openExplorerDb();
    if (!db) return;
    try {
      // Une synchro a pu acquitter une séquence et renseigner l'identifiant
      // serveur entre-temps : on ne les écrase jamais avec une fiche plus
      // ancienne.
      const current = await readRecord(record.clientSessionId);
      const next: LocalSessionRecord = {
        ...(current ?? record),
        ...record,
        serverSessionId: record.serverSessionId ?? current?.serverSessionId ?? null,
        lastPointSeq: Math.max(record.lastPointSeq, current?.lastPointSeq ?? 0),
        syncedThroughSeq: Math.max(record.syncedThroughSeq, current?.syncedThroughSeq ?? 0),
      };
      const tx = db.transaction(
        [SESSIONS_STORE, SESSION_POINTS_STORE, SESSION_META_STORE],
        'readwrite',
      );
      tx.objectStore(SESSION_POINTS_STORE).put(storedPoint);
      tx.objectStore(SESSIONS_STORE).put(next);
      tx.objectStore(SESSION_META_STORE).put({
        key: ACTIVE_SESSION_KEY,
        value: record.clientSessionId,
      });
      await transactionDone(tx);
    } catch {
      // IndexedDB indisponible : aucune persistance annoncée.
    }
  });
}

/** Met à jour les champs mutables d'une fiche sans toucher aux curseurs. */
export function updateLocalSession(
  clientSessionId: string,
  patch: Partial<
    Pick<
      LocalSessionRecord,
      | 'serverSessionId'
      | 'endedAt'
      | 'paused'
      | 'distanceM'
      | 'elevGainM'
      | 'movingS'
      | 'syncedThroughSeq'
      | 'status'
      | 'summarySaved'
    >
  >,
): Promise<LocalSessionRecord | null> {
  return serial(async () => {
    const current = await readRecord(clientSessionId);
    if (!current) return null;
    const next: LocalSessionRecord = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    const db = await openExplorerDb();
    if (!db) return next;
    try {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      tx.objectStore(SESSIONS_STORE).put(next);
      await transactionDone(tx);
    } catch {
      // La valeur en mémoire reste cohérente pour l'appelant.
    }
    return next;
  });
}

export async function readSessionPoints(clientSessionId: string): Promise<LocalSessionPoint[]> {
  const db = await openExplorerDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SESSION_POINTS_STORE, 'readonly');
      const store = tx.objectStore(SESSION_POINTS_STORE);
      const range = IDBKeyRange.bound(`${clientSessionId}:`, `${clientSessionId}:\uffff`);
      const request = store.getAll(range);
      request.onsuccess = () => {
        const points = (request.result as LocalSessionPoint[]) ?? [];
        resolve(
          points
            .filter((point) => point.clientSessionId === clientSessionId)
            .sort((left, right) => left.seq - right.seq),
        );
      };
      request.onerror = () => resolve([]);
      tx.onabort = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/** Supprime les points d'un ancien bilan pour borner le stockage local. */
export function forgetFinishedSession(clientSessionId: string): Promise<void> {
  return serial(async () => {
    const db = await openExplorerDb();
    if (!db) return;
    try {
      const latestId = await readMeta(LATEST_SESSION_KEY);
      const tx = db.transaction(
        [SESSIONS_STORE, SESSION_POINTS_STORE, SESSION_ROUTES_STORE, SESSION_META_STORE],
        'readwrite',
      );
      tx.objectStore(SESSIONS_STORE).delete(clientSessionId);
      const range = IDBKeyRange.bound(`${clientSessionId}:`, `${clientSessionId}:\uffff`);
      tx.objectStore(SESSION_POINTS_STORE).delete(range);
      tx.objectStore(SESSION_ROUTES_STORE).delete(clientSessionId);
      if (latestId === clientSessionId) {
        tx.objectStore(SESSION_META_STORE).delete(LATEST_SESSION_KEY);
      }
      await transactionDone(tx);
    } catch {
      // Rien à supprimer ou base indisponible.
    }
  });
}
