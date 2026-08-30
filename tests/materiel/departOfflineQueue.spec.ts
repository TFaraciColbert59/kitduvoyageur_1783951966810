import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOfflineQueue,
  saveOfflineQueue,
  queueOfflineAction,
  flushOfflineQueue,
  type QueuedDepartAction,
} from '@/features/materiel/offline/departOfflineQueue';

describe('departOfflineQueue — Mode Hors-Ligne & Synchronisation (Phase 6)', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };

    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = mockLocalStorage;
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
    } catch {}
    vi.restoreAllMocks();
  });

  it('initialise une file vide par défaut', () => {
    expect(getOfflineQueue()).toEqual([]);
  });

  it('ajoute une action à la file locale', () => {
    queueOfflineAction({
      type: 'toggle',
      payload: { itemId: 'item-123', currentChecked: false },
    });

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].type).toBe('toggle');
    expect(queue[0].payload.itemId).toBe('item-123');
  });

  it('gère l accumulation séquentielle d actions diverses (quantité, ajout, suppression)', () => {
    queueOfflineAction({
      type: 'quantity',
      payload: { itemId: 'item-1', quantity: 2, kitId: 'kit-1' },
    });

    queueOfflineAction({
      type: 'add',
      payload: { kitId: 'kit-1', name: 'Lampe', category: 'Électronique', weightG: 80, isVital: true },
    });

    queueOfflineAction({
      type: 'delete',
      payload: { itemId: 'item-2', kitId: 'kit-1' },
    });

    const queue = getOfflineQueue();
    expect(queue.length).toBe(3);
    expect(queue.map((a) => a.type)).toEqual(['quantity', 'add', 'delete']);
  });

  it('ne tente pas de synchroniser si le navigateur est hors-ligne', async () => {
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });
    } catch {}

    queueOfflineAction({
      type: 'toggle',
      payload: { itemId: 'item-offline', currentChecked: true },
    });

    const result = await flushOfflineQueue();
    expect(result.processed).toBe(0);
    expect(getOfflineQueue().length).toBe(1);
  });
});
