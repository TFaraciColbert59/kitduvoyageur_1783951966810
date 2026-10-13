import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { fn: string; args: { p_west: number; p_south: number; p_east: number; p_north: number; p_limit: number } };
const db = vi.hoisted(() => ({ calls: [] as unknown[], rows: [] as Array<Record<string, unknown>> }));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () => ({
    rpc: async (fn: string, args: Call['args']) => {
      db.calls.push({ fn, args });
      // Le `box` de Postgres range ses coins : ouest > est lirait ce qui est ENTRE les deux.
      // Ici la base ne rend que les lieux dans la boîte valide demandée.
      const data = db.rows.filter(
        (r) => (r.lon as number) >= args.p_west && (r.lon as number) <= args.p_east && (r.lat as number) >= args.p_south && (r.lat as number) <= args.p_north
      );
      return { data, error: null };
    },
  }),
}));

import { referentialAreaPlaces } from '../server/geoPlaces';

const row = (id: number, name: string, lat: number, lon: number, population: number) => ({
  geoname_id: id,
  name,
  kind: 'village',
  country_code: 'FJ',
  lat,
  lon,
  ele_m: null,
  population,
});

describe('référentiel des lieux : une zone à cheval sur l’antiméridien (plan 4.5, Fidji)', () => {
  beforeEach(() => {
    db.calls = [];
    db.rows = [
      row(1, 'Levuka', -17.68, 179.83, 900),
      row(2, 'Waiyevo', -16.82, -179.98, 1500),
      row(3, 'Matei', -16.69, -179.88, 300),
      row(4, 'Nadi', -17.8, 177.42, 30000),
      // Même latitude, de l’autre côté du globe : ne doit JAMAIS sortir.
      row(5, 'Lieu africain', -17.7, 25, 99999),
    ];
  });

  const q = { center: { lat: -17.5, lon: 179.9 }, radiusKm: 100, activity: 'hiking' };

  it('interroge deux boîtes valides et rend les lieux des deux côtés, une seule fois chacun', async () => {
    const places = await referentialAreaPlaces(q);
    const calls = db.calls as Call[];
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.args.p_west).toBeGreaterThanOrEqual(-180);
      expect(c.args.p_east).toBeLessThanOrEqual(180);
      expect(c.args.p_west).toBeLessThanOrEqual(c.args.p_east);
    }
    const names = (places ?? []).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Levuka', 'Waiyevo', 'Matei']));
    expect(names).not.toContain('Lieu africain');
    expect(new Set(names).size).toBe(names.length);
  });

  it('garde l’ordre du référentiel (les plus peuplés d’abord) et la limite demandée', async () => {
    const places = await referentialAreaPlaces(q, 2);
    expect((places ?? []).map((p) => p.name)).toEqual(['Waiyevo', 'Levuka']);
  });

  it('CONTRE-EXEMPLE — loin de la coupure : une seule requête, comme avant', async () => {
    db.rows = [row(10, 'Villard', 45.07, 5.55, 4287)];
    const places = await referentialAreaPlaces({ center: { lat: 45, lon: 5.5 }, radiusKm: 30, extent: [5.2, 45.3, 5.9, 44.8], activity: 'rando' });
    expect(db.calls).toHaveLength(1);
    expect(places?.map((p) => p.name)).toEqual(['Villard']);
  });
});
