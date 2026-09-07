/**
 * tripOfflineSyncQueue.ts — Gestionnaire de file d'attente hors-ligne & synchronisation LKDV
 *
 * Implémente :
 * 1. File d'attente locale pour les actions effectuées en zone blanche (dépenses, notes, étapes).
 * 2. Arbitrage des conflits par Dernier Écrivain Gagne (Last-Write-Wins - LWW).
 * 3. Journal d'audit immuable des arbitrages pour transparence totale.
 * 4. Dépilement automatique avec reprise sur erreur réseau.
 */

export type TripActionType =
  | 'add_expense'
  | 'update_expense'
  | 'delete_expense'
  | 'add_note'
  | 'update_step_status'
  | 'custom';

export interface TripOfflineAction {
  id: string;
  tripSlug: string;
  type: TripActionType;
  payload: any;
  clientTimestamp: number;
}

export interface TripSyncJournalEntry {
  id: string;
  tripSlug: string;
  entityType: string;
  entityId: string;
  winner: 'local' | 'remote';
  resolvedAt: string;
  localTimestamp: string;
  remoteTimestamp: string;
  details?: Record<string, unknown>;
}

const QUEUE_STORAGE_KEY = 'lkdv_trip_offline_queue_v1';
const JOURNAL_STORAGE_KEY = 'lkdv_trip_sync_journal_v1';

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
 * Récupère les actions en attente de synchronisation
 */
export function getTripOfflineQueue(tripSlug?: string): TripOfflineAction[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as TripOfflineAction[];
    if (tripSlug) {
      return all.filter(a => a.tripSlug === tripSlug);
    }
    return all;
  } catch (err) {
    console.error('[LKDV SyncQueue] Erreur lecture file:', err);
    return [];
  }
}

/**
 * Sauvegarde la file d'attente
 */
function saveTripOfflineQueue(queue: TripOfflineAction[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[LKDV SyncQueue] Erreur écriture file:', err);
  }
}

/**
 * Ajoute une action à la file d'attente hors-ligne
 */
export function enqueueTripOfflineAction(
  action: Omit<TripOfflineAction, 'id' | 'clientTimestamp'>
): TripOfflineAction {
  const all = getTripOfflineQueue();
  const queuedAction: TripOfflineAction = {
    ...action,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientTimestamp: Date.now(),
  };

  all.push(queuedAction);
  saveTripOfflineQueue(all);
  return queuedAction;
}

/**
 * Efface la file d'attente (globalement ou pour un voyage)
 */
export function clearTripOfflineQueue(tripSlug?: string): void {
  const storage = getStorage();
  if (!storage) return;

  if (!tripSlug) {
    storage.removeItem(QUEUE_STORAGE_KEY);
  } else {
    const all = getTripOfflineQueue();
    const filtered = all.filter(a => a.tripSlug !== tripSlug);
    saveTripOfflineQueue(filtered);
  }
}

/**
 * Récupère le journal des arbitrages de conflits
 */
export function getTripSyncJournal(tripSlug?: string): TripSyncJournalEntry[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as TripSyncJournalEntry[];
    if (tripSlug) {
      return all.filter(j => j.tripSlug === tripSlug);
    }
    return all;
  } catch {
    return [];
  }
}

/**
 * Consigne un arbitrage dans le journal
 */
function logConflictToJournal(entry: Omit<TripSyncJournalEntry, 'id' | 'resolvedAt'>): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const all = getTripSyncJournal();
    const newEntry: TripSyncJournalEntry = {
      ...entry,
      id: `jrn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      resolvedAt: new Date().toISOString(),
    };
    all.unshift(newEntry);
    // Conserver max 200 entrées pour limiter l'espace local
    storage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(all.slice(0, 200)));
  } catch (err) {
    console.error('[LKDV SyncJournal] Erreur enregistrement:', err);
  }
}

/**
 * Arbitrage des conflits de synchronisation : Règle du Dernier Écrivain Gagne (LWW)
 */
export function resolveTripConflict<T extends { id?: string; updatedAt?: string }>(
  tripSlug: string,
  entityType: string,
  localEntity: T,
  remoteEntity: T
): { winner: 'local' | 'remote'; resolvedEntity: T } {
  const localTime = localEntity.updatedAt ? new Date(localEntity.updatedAt).getTime() : 0;
  const remoteTime = remoteEntity.updatedAt ? new Date(remoteEntity.updatedAt).getTime() : 0;

  const winner: 'local' | 'remote' = localTime >= remoteTime ? 'local' : 'remote';
  const resolvedEntity = winner === 'local' ? localEntity : remoteEntity;

  logConflictToJournal({
    tripSlug,
    entityType,
    entityId: localEntity.id || remoteEntity.id || 'unknown',
    winner,
    localTimestamp: localEntity.updatedAt || new Date().toISOString(),
    remoteTimestamp: remoteEntity.updatedAt || new Date().toISOString(),
  });

  return { winner, resolvedEntity };
}

/**
 * Dépile la file d'attente pour un voyage donné via un handler d'envoi
 */
export async function flushTripOfflineQueue(
  tripSlug: string,
  dispatcher: (action: TripOfflineAction) => Promise<{ success: boolean; error?: string }>
): Promise<{ processed: number; failed: number }> {
  const all = getTripOfflineQueue();
  const tripActions = all.filter(a => a.tripSlug === tripSlug);

  if (tripActions.length === 0) {
    return { processed: 0, failed: 0 };
  }

  const remaining: TripOfflineAction[] = [];
  let processed = 0;
  let failed = 0;

  for (const act of tripActions) {
    try {
      const res = await dispatcher(act);
      if (res.success) {
        processed++;
      } else {
        failed++;
        remaining.push(act);
      }
    } catch {
      failed++;
      remaining.push(act);
    }
  }

  // Remettre les actions échouées + les actions des autres voyages
  const otherTripsActions = all.filter(a => a.tripSlug !== tripSlug);
  saveTripOfflineQueue([...otherTripsActions, ...remaining]);

  return { processed, failed };
}
