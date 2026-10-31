import { describe, expect, it, vi } from 'vitest';
import {
  GEO_PROTOCOL_VERSION,
  createGeoMessageHandler,
  isGeoWorkerRequest,
} from '@/features/explorer-v2/workers/protocol';
import type { ProfileResult } from '@/features/explorer-v2/geo/profile';

/**
 * Protocole du worker géo : chaque réponse porte l'`id` de sa requête, une
 * erreur de calcul devient une réponse typée (jamais une promesse pendante), et
 * un message inconnu est ignoré sans casser le worker.
 */

const result: ProfileResult = {
  id: 7,
  points: [{ d: 0, ele: 1000 }],
  distance_m: 0,
  gain_m: 0,
  loss_m: 0,
  min_m: 1000,
  max_m: 1000,
  source: 'aws-terrarium',
};

describe('worker géo · protocole', () => {
  it('accepte une requête profile versionnée', () => {
    expect(
      isGeoWorkerRequest({
        protocolVersion: GEO_PROTOCOL_VERSION,
        id: 7,
        op: 'profile',
        positions: [
          [2.35, 48.85],
          [2.36, 48.86],
        ],
      }),
    ).toBe(true);
  });

  it('refuse une version, un op ou un id invalides', () => {
    expect(isGeoWorkerRequest({ protocolVersion: 999, id: 1, op: 'profile', positions: [] })).toBe(false);
    expect(isGeoWorkerRequest({ protocolVersion: GEO_PROTOCOL_VERSION, id: 1, op: 'simplify', positions: [] })).toBe(false);
    expect(isGeoWorkerRequest({ protocolVersion: GEO_PROTOCOL_VERSION, id: Number.NaN, op: 'profile', positions: [] })).toBe(false);
    expect(isGeoWorkerRequest(null)).toBe(false);
    expect(isGeoWorkerRequest('profile')).toBe(false);
  });

  it('répond avec le même id et le résultat du calcul', async () => {
    const compute = vi.fn(async () => result);
    const handler = createGeoMessageHandler(compute);
    const response = await handler({
      protocolVersion: GEO_PROTOCOL_VERSION,
      id: 7,
      op: 'profile',
      positions: [
        [2.35, 48.85],
        [2.36, 48.86],
      ],
      stepM: 80,
      demZoom: 11,
    });
    expect(compute).toHaveBeenCalledWith({
      id: 7,
      positions: [
        [2.35, 48.85],
        [2.36, 48.86],
      ],
      stepM: 80,
      demZoom: 11,
    });
    expect(response).toEqual({ protocolVersion: GEO_PROTOCOL_VERSION, id: 7, ok: true, result });
  });

  it('transforme une erreur de calcul en réponse typée corrélée', async () => {
    const handler = createGeoMessageHandler(async () => {
      throw new Error('DEM indisponible');
    });
    const response = await handler({
      protocolVersion: GEO_PROTOCOL_VERSION,
      id: 12,
      op: 'profile',
      positions: [
        [2.35, 48.85],
        [NaN, 48.86],
      ],
    });
    expect(response).toEqual({
      protocolVersion: GEO_PROTOCOL_VERSION,
      id: 12,
      ok: false,
      error: 'DEM indisponible',
    });
  });

  it('ignore un message hors protocole sans répondre', async () => {
    const compute = vi.fn(async () => result);
    const handler = createGeoMessageHandler(compute);
    expect(await handler({ hello: 'world' })).toBeNull();
    expect(compute).not.toHaveBeenCalled();
  });
});
