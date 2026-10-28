import { describe, expect, it, vi } from 'vitest';
import type { LonLat } from '../geometry';
import { MAX_APPUI, mergeLegs, searchAddress, snapDrawnLine, snapWaypoints } from '../snapTrace';

const ok = (body: unknown) => ({ ok: true, json: async () => body });

describe('mergeLegs', () => {
  it('retire le point de jonction répété entre deux tronçons', () => {
    const merged = mergeLegs([
      { geometry: [[0, 0], [1, 1]] },
      { geometry: [[1, 1], [2, 2]] },
    ]);
    expect(merged).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
});

describe('snapWaypoints', () => {
  const a: LonLat = [6.0, 45.0];
  const b: LonLat = [6.05, 45.02];

  it('renvoie le tracé du routeur, accroché, avec sa distance et son fournisseur', async () => {
    const fetcher = vi.fn(async () =>
      ok({ status: 'ok', provider: 'geoapify', legs: [{ distanceKm: 4.26, geometry: [[6.0, 45.0], [6.02, 45.01], [6.05, 45.02]] }] }),
    );
    const result = await snapWaypoints([a, b], fetcher);
    expect(result.snapped).toBe(true);
    expect(result.coords).toHaveLength(3);
    expect(result.distanceKm).toBe(4.3);
    expect(result.provider).toBe('geoapify');
    const url = (fetcher.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain('/api/route?points=');
    expect(url).toContain('mode=pieton');
    expect(decodeURIComponent(url)).toContain('6.000000,45.000000;6.050000,45.020000');
  });

  it('garde la ligne et dit « non accroché » quand le routeur est indisponible', async () => {
    const result = await snapWaypoints([a, b], async () => ({ ok: false, json: async () => ({}) }));
    expect(result.snapped).toBe(false);
    expect(result.coords).toEqual([a, b]);
    expect(result.distanceKm).toBeGreaterThan(0);
  });

  it('garde la ligne sur réponse « unavailable » ou réseau en échec', async () => {
    expect((await snapWaypoints([a, b], async () => ok({ status: 'unavailable', legs: [] }))).snapped).toBe(false);
    expect((await snapWaypoints([a, b], async () => { throw new Error('réseau'); })).snapped).toBe(false);
  });

  it('n’appelle pas le routeur avec moins de 2 points', async () => {
    const fetcher = vi.fn();
    const result = await snapWaypoints([a], fetcher as never);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.snapped).toBe(false);
  });
});

describe('snapDrawnLine', () => {
  it('envoie au routeur au plus 12 points d’appui, extrémités gardées', async () => {
    const drawn: LonLat[] = Array.from({ length: 400 }, (_, i) => [6 + i * 0.0003, 45 + Math.sin(i / 9) * 0.004] as LonLat);
    const fetcher = vi.fn(async () => ok({ status: 'ok', legs: [{ distanceKm: 3, geometry: [[6, 45], [6.1, 45.0]] }] }));
    await snapDrawnLine(drawn, fetcher);
    const url = decodeURIComponent((fetcher.mock.calls[0] as unknown as [string])[0]);
    const points = url.split('points=')[1]?.split('&')[0]?.split(';') ?? [];
    expect(points.length).toBeLessThanOrEqual(MAX_APPUI);
    expect(points[0]).toBe('6.000000,45.000000');
  });

  it('ignore un simple appui (un seul point)', async () => {
    const fetcher = vi.fn();
    const result = await snapDrawnLine([[6, 45], [6, 45]], fetcher as never);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.snapped).toBe(false);
  });
});

describe('searchAddress', () => {
  it('ne cherche pas en dessous de 3 caractères', async () => {
    const fetcher = vi.fn();
    expect(await searchAddress('ab', fetcher as never)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('renvoie jusqu’à 5 adresses valides', async () => {
    const matches = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `Lieu ${i}`, context: 'Isère', lat: 45 + i / 100, lon: 6 }));
    matches.push({ id: 'x', name: 'Cassé', context: '', lat: Number.NaN, lon: 6 });
    const out = await searchAddress('Saint-Pierre', async () => ok({ status: 'ok', matches }));
    expect(out).toHaveLength(5);
    expect(out[0]).toMatchObject({ id: '0', name: 'Lieu 0', lon: 6 });
  });

  it('liste vide en cas de panne', async () => {
    expect(await searchAddress('Chamonix', async () => ({ ok: false, json: async () => ({}) }))).toEqual([]);
    expect(await searchAddress('Chamonix', async () => { throw new Error('x'); })).toEqual([]);
  });
});
