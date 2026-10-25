import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueTripOfflineAction,
  getTripOfflineQueue,
  clearTripOfflineQueue,
  flushTripOfflineQueue,
  getTripSyncJournal,
  resolveTripConflict,
  TripOfflineAction,
} from '@/features/trips/offline/tripOfflineSyncQueue';

describe('Phase 10.4 — File d’Attente Hors-Ligne & Synchronisation LKDV', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStore[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    };
    vi.stubGlobal('localStorage', localStorageMock);
    vi.restoreAllMocks();
  });

  it('TEST-P10-OFFLINE-01: enqueueTripOfflineAction ajoute des actions dans la file locale avec horodatage et id unique', () => {
    const action: Omit<TripOfflineAction, 'id' | 'clientTimestamp'> = {
      tripSlug: 'alpes-2026',
      type: 'add_expense',
      payload: { amount: 35.5, label: 'Refuge du Goûter', paidBy: 'user-1' },
    };

    const queued = enqueueTripOfflineAction(action);

    expect(queued.id).toBeDefined();
    expect(queued.clientTimestamp).toBeGreaterThan(0);
    expect(queued.tripSlug).toBe('alpes-2026');

    const queue = getTripOfflineQueue('alpes-2026');
    expect(queue.length).toBe(1);
    expect(queue[0].payload.label).toBe('Refuge du Goûter');
  });

  it('TEST-P10-OFFLINE-02: filtre la file par voyage ou retourne tout si aucun slug spécifié', () => {
    enqueueTripOfflineAction({
      tripSlug: 'trip-a',
      type: 'add_note',
      payload: { content: 'Note A' },
    });
    enqueueTripOfflineAction({
      tripSlug: 'trip-b',
      type: 'add_note',
      payload: { content: 'Note B' },
    });

    expect(getTripOfflineQueue('trip-a').length).toBe(1);
    expect(getTripOfflineQueue('trip-b').length).toBe(1);
    expect(getTripOfflineQueue().length).toBe(2);
  });

  it('TEST-P10-OFFLINE-03: resolveTripConflict applique la règle du Dernier Écrivain Gagne (LWW) et consigne au journal', () => {
    const localEntity = {
      id: 'step-1',
      title: 'Étape locale modifiée hors-ligne',
      updatedAt: '2026-09-07T14:30:00.000Z', // Plus récent
    };
    const remoteEntity = {
      id: 'step-1',
      title: 'Étape serveur plus ancienne',
      updatedAt: '2026-09-07T12:00:00.000Z',
    };

    const conflictRes = resolveTripConflict('trip-test', 'step', localEntity, remoteEntity);

    // Le local plus récent gagne
    expect(conflictRes.winner).toBe('local');
    expect(conflictRes.resolvedEntity.title).toBe('Étape locale modifiée hors-ligne');

    // Vérifie la consignation dans le journal d'audit
    const journal = getTripSyncJournal('trip-test');
    expect(journal.length).toBe(1);
    expect(journal[0].winner).toBe('local');
    expect(journal[0].entityId).toBe('step-1');
  });

  it('TEST-P10-OFFLINE-04: resolveTripConflict fait gagner le serveur si la version serveur est plus récente', () => {
    const localEntity = {
      id: 'note-1',
      content: 'Note locale ancienne',
      updatedAt: '2026-09-07T10:00:00.000Z',
    };
    const remoteEntity = {
      id: 'note-1',
      content: 'Note serveur récente',
      updatedAt: '2026-09-07T15:00:00.000Z', // Plus récent
    };

    const conflictRes = resolveTripConflict('trip-test', 'note', localEntity, remoteEntity);

    expect(conflictRes.winner).toBe('remote');
    expect(conflictRes.resolvedEntity.content).toBe('Note serveur récente');
  });

  it('TEST-P10-OFFLINE-05: flushTripOfflineQueue dépile les actions et retourne le bilan de synchronisation', async () => {
    enqueueTripOfflineAction({
      tripSlug: 'trip-sync',
      type: 'add_expense',
      payload: { amount: 15, label: 'Pain' },
    });

    // Mock handler d'envoi vers le serveur
    const mockDispatcher = vi.fn().mockResolvedValue({ success: true });

    const result = await flushTripOfflineQueue('trip-sync', mockDispatcher);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(getTripOfflineQueue('trip-sync').length).toBe(0);
    expect(mockDispatcher).toHaveBeenCalledTimes(1);
  });
});
