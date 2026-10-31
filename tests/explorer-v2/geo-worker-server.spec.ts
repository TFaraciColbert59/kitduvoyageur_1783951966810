import { describe, expect, it, vi } from 'vitest';
import { attachGeoWorkerServer, type WorkerScopeLike } from '@/features/explorer-v2/workers/workerServer';
import { GEO_PROTOCOL_VERSION } from '@/features/explorer-v2/workers/protocol';
import type { ProfileResult } from '@/features/explorer-v2/geo/profile';

/**
 * Serveur de messages du worker géo : aucune erreur ne doit s'échapper en rejet
 * non géré, et une requête identifiable reçoit toujours une réponse corrélée.
 */

const RESULT: ProfileResult = {
  id: 0,
  points: [],
  distance_m: 0,
  gain_m: 0,
  loss_m: 0,
  min_m: null,
  max_m: null,
  source: 'aws-terrarium',
};

function fakeScope(options: { postMessageThrows?: boolean } = {}) {
  const listeners: Array<(event: { data: unknown }) => void> = [];
  const posted: unknown[] = [];
  const scope: WorkerScopeLike = {
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    postMessage(message) {
      if (options.postMessageThrows) throw new Error('worker closing');
      posted.push(message);
    },
  };
  return {
    scope,
    posted,
    emit(data: unknown) {
      for (const listener of [...listeners]) listener({ data });
    },
  };
}

describe('worker géo · serveur de messages', () => {
  it('répond avec le même id pour une requête valide', async () => {
    const harness = fakeScope();
    attachGeoWorkerServer(harness.scope, async (request) => ({ ...RESULT, id: request.id }));
    harness.emit({
      protocolVersion: GEO_PROTOCOL_VERSION,
      id: 5,
      op: 'profile',
      positions: [
        [2.35, 48.85],
        [2.36, 48.86],
      ],
    });
    await vi.waitFor(() => expect(harness.posted).toHaveLength(1));
    expect(harness.posted[0]).toMatchObject({ id: 5, ok: true, result: { id: 5 } });
  });

  it('ignore un message hors protocole sans répondre ni lever', async () => {
    const harness = fakeScope();
    const compute = vi.fn(async () => RESULT);
    attachGeoWorkerServer(harness.scope, compute);
    harness.emit({ hello: 'world' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(compute).not.toHaveBeenCalled();
    expect(harness.posted).toHaveLength(0);
  });

  it('transforme une erreur de calcul en réponse ok:false', async () => {
    const harness = fakeScope();
    attachGeoWorkerServer(harness.scope, async () => {
      throw new Error('DEM indisponible');
    });
    harness.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 9, op: 'profile', positions: [] });
    await vi.waitFor(() => expect(harness.posted).toHaveLength(1));
    expect(harness.posted[0]).toMatchObject({ id: 9, ok: false, error: 'DEM indisponible' });
  });

  it('ne rejette pas quand postMessage échoue (worker en fermeture)', async () => {
    const harness = fakeScope({ postMessageThrows: true });
    attachGeoWorkerServer(harness.scope, async () => RESULT);
    expect(() =>
      harness.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 3, op: 'profile', positions: [] }),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.posted).toHaveLength(0);
  });

  it('ne produit aucun rejet non géré si le handler échoue de façon inattendue', async () => {
    const harness = fakeScope();
    attachGeoWorkerServer(harness.scope, async () => {
      throw new Error('boom');
    });
    harness.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 11, op: 'profile', positions: [] });
    await vi.waitFor(() => expect(harness.posted).toHaveLength(1));
    expect(harness.posted[0]).toMatchObject({ id: 11, ok: false });
  });
});
