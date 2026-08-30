/**
 * departOfflineQueue.ts — Gestionnaire de file d'attente hors-ligne pour le Cockpit Départ LKDV
 *
 * Enregistre les actions effectuées hors-ligne (cochage, modification de quantité, ajout)
 * et les synchronise automatiquement dès la restauration du réseau.
 */

import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import { updateItemQuantity } from '@/features/materiel/actions/updateItemQuantity';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
import { deleteDepartItem } from '@/features/materiel/actions/deleteDepartItem';

export interface QueuedDepartAction {
  id: string;
  type: 'toggle' | 'quantity' | 'add' | 'delete';
  timestamp: number;
  payload: any;
}

const STORAGE_KEY = 'lkdv_depart_offline_queue_v1';

export function getOfflineQueue(): QueuedDepartAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedDepartAction[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[saveOfflineQueue]', err);
  }
}

export function queueOfflineAction(action: Omit<QueuedDepartAction, 'id' | 'timestamp'>): void {
  const queue = getOfflineQueue();
  const newAction: QueuedDepartAction = {
    ...action,
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  queue.push(newAction);
  saveOfflineQueue(queue);
}

export async function flushOfflineQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  const remaining: QueuedDepartAction[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'toggle') {
        const res = await toggleKitItem(item.payload.itemId, item.payload.currentChecked);
        if (res.success) processed++;
        else {
          failed++;
          remaining.push(item);
        }
      } else if (item.type === 'quantity') {
        const res = await updateItemQuantity(item.payload.itemId, item.payload.quantity, item.payload.kitId);
        if (res.success) processed++;
        else {
          failed++;
          remaining.push(item);
        }
      } else if (item.type === 'add') {
        const res = await addDepartItem(item.payload);
        if (res.success) processed++;
        else {
          failed++;
          remaining.push(item);
        }
      } else if (item.type === 'delete') {
        const res = await deleteDepartItem(item.payload.itemId, item.payload.kitId);
        if (res.success) processed++;
        else {
          failed++;
          remaining.push(item);
        }
      }
    } catch {
      failed++;
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  return { processed, failed };
}
