'use client';

/**
 * File d'écritures hors ligne (05_DONNEES §7, P7-21).
 *
 * Les écritures faites sans réseau (signalement, confirmation) sont stockées
 * dans IndexedDB avec une **clé d'idempotence** : un renvoi ne crée jamais de
 * doublon, et la synchronisation se fait au retour du réseau.
 */

import { OUTBOX_STORE, openExplorerDb } from './db';

const STORE = OUTBOX_STORE;

export interface QueuedOperation {
  key: string;
  kind: 'report' | 'report-confirm' | 'activity.finish';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return openExplorerDb();
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

/** Support de stockage minimal : injectable pour tester le flush sans IndexedDB. */
export interface QueueBackend {
  list(): Promise<QueuedOperation[]>;
  remove(key: string): Promise<void>;
}

const indexedDbBackend: QueueBackend = {
  list: listQueue,
  remove: removeKey,
};

/**
 * Synchronise la file. `send` renvoie true quand la réponse est définitive et
 * que l'opération peut être retirée (idempotence garantie par la clé). Un
 * `false` — ou une exception — CONSERVE l'opération : c'est la règle qui
 * empêche de perdre un bilan sur 401/403/404/5xx.
 */
export async function flushQueue(
  send: (operation: QueuedOperation) => Promise<boolean>,
  backend: QueueBackend = indexedDbBackend,
): Promise<{ sent: number; failed: number }> {
  const operations = await backend.list();
  let sent = 0;
  let failed = 0;
  for (const operation of operations) {
    try {
      const ok = await send(operation);
      if (ok) {
        await backend.remove(operation.key);
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
