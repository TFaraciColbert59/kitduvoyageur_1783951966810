import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', () => ({
  readShared: async () => undefined,
  cached: async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  coordKey: (lat: number, lon: number) => `${lat},${lon}`,
}));
import { lookupStagePois, OVERPASS_ENDPOINTS } from '../server/stagePoiLookup';

/**
 * Plan 1.4 (8 octobre) : un seul serveur Overpass, celui dont les conditions
 * autorisent l'usage commercial. overpass-api.de et ses miroirs (kumi, .ru,
 * mail.ru) renvoient les usages commerciaux vers leurs propres serveurs.
 */
describe('Overpass du Compas', () => {
  afterEach(() => vi.restoreAllMocks());

  it('interroge private.coffee seulement', () => {
    expect([...OVERPASS_ENDPOINTS]).toEqual(['https://overpass.private.coffee/api/interpreter']);
  });

  it('une requête à la fois, même pour deux lieux cherchés ensemble (revue Codex)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const hosts: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      hosts.push(new URL(String(input)).host);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return new Response(JSON.stringify({ elements: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await lookupStagePois([
      { lat: 45.92, lon: 6.87 },
      { lat: 46.2, lon: 7.1 },
    ]);
    expect(hosts).toEqual(['overpass.private.coffee', 'overpass.private.coffee']);
    expect(maxInFlight).toBe(1);
  });
});
