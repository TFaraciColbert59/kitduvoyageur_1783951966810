import { describe, expect, it, vi } from 'vitest';

const mockGetAllResult: unknown[] = [];

vi.mock('../../../offline/db', () => ({
  SESSIONS_STORE: 'sessions',
  SESSION_META_STORE: 'sessionMeta',
  SESSION_POINTS_STORE: 'sessionPoints',
  SESSION_ROUTES_STORE: 'sessionRoutes',
  transactionDone: vi.fn().mockResolvedValue(undefined),
  openExplorerDb: vi.fn(async () => ({
    transaction: () => ({
      objectStore: () => ({
        getAll: () => {
          const req: { result?: unknown[]; onsuccess?: () => void; onerror?: () => void } = {};
          queueMicrotask(() => {
            req.result = mockGetAllResult;
            req.onsuccess?.();
          });
          return req;
        },
      }),
      onabort: null,
    }),
  })),
}));

import { LOCAL_SESSION_VERSION, readAllFinishedSessions } from '../../../activity/localSession';

describe('localSession.readAllFinishedSessions', () => {
  it('filtre les séances corrompues ou actives, trie par endedAt décroissant et respecte limit', async () => {
    mockGetAllResult.length = 0;
    mockGetAllResult.push(
      // Corrupt entry (must be ignored)
      { version: 999, clientSessionId: 'bad' },
      // Active session (must be ignored)
      {
        version: LOCAL_SESSION_VERSION,
        clientSessionId: '11111111-1111-4111-8111-111111111111',
        serverSessionId: null,
        sport: 'rando',
        startedAt: 1_700_000_000_000,
        endedAt: null,
        paused: false,
        distanceM: 1200,
        elevGainM: 50,
        movingS: 600,
        lastPointSeq: 10,
        syncedThroughSeq: 0,
        status: 'active',
        updatedAt: 1_700_000_600_000,
      },
      // Older finished session
      {
        version: LOCAL_SESSION_VERSION,
        clientSessionId: '22222222-2222-4222-8222-222222222222',
        serverSessionId: null,
        sport: 'trail',
        startedAt: 1_700_010_000_000,
        endedAt: 1_700_013_600_000,
        paused: false,
        distanceM: 10_000,
        elevGainM: 450,
        movingS: 3600,
        lastPointSeq: 120,
        syncedThroughSeq: 120,
        status: 'finished',
        updatedAt: 1_700_013_600_000,
      },
      // Newer finished session
      {
        version: LOCAL_SESSION_VERSION,
        clientSessionId: '33333333-3333-4333-8333-333333333333',
        serverSessionId: null,
        sport: 'velo',
        startedAt: 1_700_090_000_000,
        endedAt: 1_700_095_000_000,
        paused: false,
        distanceM: 35_000,
        elevGainM: 620,
        movingS: 5000,
        lastPointSeq: 300,
        syncedThroughSeq: 300,
        status: 'finished',
        updatedAt: 1_700_095_000_000,
      },
    );

    const all = await readAllFinishedSessions(90);
    expect(all).toHaveLength(2);
    expect(all[0].clientSessionId).toBe('33333333-3333-4333-8333-333333333333');
    expect(all[1].clientSessionId).toBe('22222222-2222-4222-8222-222222222222');

    const limited = await readAllFinishedSessions(1);
    expect(limited).toHaveLength(1);
    expect(limited[0].sport).toBe('velo');
  });
});
