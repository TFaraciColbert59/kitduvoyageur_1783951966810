import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupWaterSources } from '@/features/trips/connectors/realDataConnectors';
import { resetOverpassQueue } from '@/lib/overpass';
import { OVERPASS_WATER_NODES, overpassWaterFetch } from './overpassWaterStub';

/**
 * Plan 1.4, lot AA : les points d'eau des voyages interrogent le seul serveur
 * Overpass autorisé (private.coffee), en POST, une requête à la fois.
 * Overpass simulé : aucun réseau réel.
 */
describe('lookupWaterSources : un serveur Overpass, une requête à la fois', () => {
  beforeEach(() => resetOverpassQueue());
  afterEach(() => vi.unstubAllGlobals());

  it('POST sur private.coffee avec la requête dans data et le User-Agent de l’application', async () => {
    const fetchMock = overpassWaterFetch();
    vi.stubGlobal('fetch', fetchMock);
    const found = await lookupWaterSources({ minLat: 45.9, maxLat: 45.95, minLon: 6.83, maxLon: 6.92 });
    expect(found.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(input)).toBe('https://overpass.private.coffee/api/interpreter');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('data=');
    expect(decodeURIComponent(String(init.body))).toContain('amenity"="drinking_water');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^kitduvoyageur\/1\.0 \(/);
  });

  it('deux zones demandées ensemble : les requêtes partent l’une après l’autre', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight -= 1;
        return new Response(JSON.stringify({ elements: OVERPASS_WATER_NODES }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    await Promise.all([
      lookupWaterSources({ minLat: 45.901, maxLat: 45.951, minLon: 6.831, maxLon: 6.921 }),
      lookupWaterSources({ minLat: 45.902, maxLat: 45.952, minLon: 6.832, maxLon: 6.922 }),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('serveur muet : repli sur les nœuds réels connus, jamais un point inventé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    const found = await lookupWaterSources({ minLat: 45.903, maxLat: 45.953, minLon: 6.833, maxLon: 6.923 });
    expect(found.every((s) => s.provenance.sourceRef?.startsWith('OpenStreetMap ODbL'))).toBe(true);
  });
});
