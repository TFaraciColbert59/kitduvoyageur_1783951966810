'use client';

/**
 * File d'écritures hors ligne (05_DONNEES §7, P7-21).
 *
 * Les écritures faites sans réseau (signalement, confirmation) sont stockées
 * dans IndexedDB avec une **clé d'idempotence** : un renvoi ne crée jamais de
 * doublon, et la synchronisation se fait au retour du réseau.
 */

const DB_NAME = 'lkdv-explorer-v2';
const STORE = 'outbox';

export interface QueuedOperation {
  key: string;
  kind: 'report' | 'report-confirm';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('zones')) db.createObjectStore('zones');
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function enqueue(operation: Omit<QueuedOperation, 'createdAt' | 'attempts'>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...operation, createdAt: Date.now(), attempts: 0 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function listQueue(): Promise<QueuedOperation[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueuedOperation[]) ?? []);
    request.onerror = () => resolve([]);
  });
}

async function removeKey(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * Synchronise la file. `send` renvoie true quand l'opération est acceptée ;
 * l'entrée est alors supprimée (idempotence garantie par la clé).
 */
export async function flushQueue(
  send: (operation: QueuedOperation) => Promise<boolean>,
): Promise<{ sent: number; failed: number }> {
  const operations = await listQueue();
  let sent = 0;
  let failed = 0;
  for (const operation of operations) {
    try {
      const ok = await send(operation);
      if (ok) {
        await removeKey(operation.key);
        sent += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

/** Clé d'idempotence stable pour une écriture donnée. */
export function idempotencyKey(kind: string, payload: Record<string, unknown>): string {
  return `${kind}:${JSON.stringify(payload)}`;
}
