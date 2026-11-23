import { describe, expect, it } from 'vitest';
import { fetchPlaces, placesKey, routePlacePoints, stagePlacePoints, type PlacesFetch } from '../placesClient';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';

const poi = (id: number, category = 'refuge') => ({ id, name: `L${id}`, category, lat: 45.9, lon: 6.1, distanceM: 0, elevationM: null });

const seq = (responses: Array<{ ok?: boolean; body?: unknown; throws?: boolean }>): { fetchFn: PlacesFetch; calls: number } => {
  const state = { calls: 0 };
  const fetchFn: PlacesFetch = async () => {
    const r = responses[Math.min(state.calls, responses.length - 1)];
    state.calls += 1;
    if (r.throws) throw new Error('réseau');
    return { ok: r.ok ?? true, json: async () => r.body };
  };
  return { fetchFn, get calls() { return state.calls; } };
};

describe('placesClient', () => {
  it('redemande tant que la réponse est partielle et fusionne sans doublon', async () => {
    const s = seq([
      { body: { pois: [poi(1), poi(2)], partial: true, fetchedAt: 't1' } },
      { body: { pois: [poi(2), poi(3)], partial: false, fetchedAt: 't2' } },
    ]);
    const res = await fetchPlaces([{ lat: 45.9, lon: 6.1 }], s.fetchFn);
    expect(res.status).toBe('ready');
    expect(res.pois.map((p) => p.id).sort()).toEqual([1, 2, 3]);
    expect(res.fetchedAt).toBe('t2');
    expect(s.calls).toBe(2);
  });

  it('s’arrête après quatre tours : partiel, dit comme tel', async () => {
    const s = seq([{ body: { pois: [poi(1)], partial: true } }]);
    const res = await fetchPlaces([{ lat: 45.9, lon: 6.1 }], s.fetchFn);
    expect(res.status).toBe('partial');
    expect(s.calls).toBe(4);
  });

  it('panne dès le premier appel : erreur et aucun lieu ; panne plus tard : ce qui est lu reste, partiel', async () => {
    expect(await fetchPlaces([{ lat: 45.9, lon: 6.1 }], seq([{ ok: false }]).fetchFn)).toEqual({ status: 'error', pois: [], fetchedAt: null });
    expect((await fetchPlaces([{ lat: 45.9, lon: 6.1 }], seq([{ throws: true }]).fetchFn)).status).toBe('error');
    const later = await fetchPlaces([{ lat: 45.9, lon: 6.1 }], seq([{ body: { pois: [poi(1)], partial: true } }, { ok: false }]).fetchFn);
    expect(later.status).toBe('partial');
    expect(later.pois).toHaveLength(1);
  });

  it('jalons : l’arrivée d’abord, huit au plus, clé stable', () => {
    const a = pt('a', 'a', 45.9, 6.0);
    const b = pt('b', 'b', 45.9, 6.13);
    const w = baseWorkspace({ points: [a, b], sections: [section('s1', a, b)], stages: [stage('g1', 1, 'a', 'b')] });
    const pts = stagePlacePoints(w, w.stages[0]);
    expect(pts[0].lon).toBeCloseTo(6.13, 2);
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.length).toBeLessThanOrEqual(8);
    expect(routePlacePoints(w).length).toBe(8);
    expect(placesKey(pts)).toBe(placesKey(stagePlacePoints(w, w.stages[0])));
  });
});
