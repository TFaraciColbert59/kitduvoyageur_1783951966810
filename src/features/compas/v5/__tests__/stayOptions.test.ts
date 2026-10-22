import { describe, expect, it } from 'vitest';
import type { RoutePoi } from '../../engine/routePois';
import { lodgingPerNight, priceLevel, refugePerNight } from '../../engine/costs';
import { BAREME_AS_OF, kindOfNotedStay, rankStayOptions, stayPriceHint } from '../engine/stayOptions';

/** Arrivée du jour : Rencurel (Vercors). 0,001° de latitude ≈ 111 m. */
const ARRIVAL = { lat: 45.0, lon: 5.4 };
const at = (metres: number) => ({ lat: ARRIVAL.lat + metres / 111_195, lon: ARRIVAL.lon });

let nextId = 100;
function poi(p: Partial<RoutePoi> & { category: RoutePoi['category']; metres: number }): RoutePoi {
  const { metres, ...rest } = p;
  return { id: nextId++, name: null, distanceM: 0, elevationM: null, ...at(metres), ...rest };
}

const base = { arrival: ARRIVAL, noted: null, party: 4, nights: null, countryCode: 'FR' } as const;

describe('rankStayOptions', () => {
  it('rend un tableau vide sans arrivée ou sans lieu', () => {
    expect(rankStayOptions({ ...base, arrival: null, pois: [] })).toEqual([]);
    expect(rankStayOptions({ ...base, pois: [] })).toEqual([]);
    expect(rankStayOptions({ ...base, pois: [poi({ category: 'resto', metres: 100, name: 'Café' })] })).toEqual([]);
  });

  it('classe d’abord par distance à l’arrivée et la mesure depuis l’arrivée, pas depuis l’étape cherchée', () => {
    const far = poi({ category: 'hebergement', name: 'Hôtel loin', metres: 3000, distanceM: 10 });
    const near = poi({ category: 'hebergement', name: 'Hôtel près', metres: 400, distanceM: 4000 });
    const out = rankStayOptions({ ...base, pois: [far, near] });
    expect(out.map((o) => o.name)).toEqual(['Hôtel près', 'Hôtel loin']);
    expect(out[0].distanceM).toBeGreaterThan(380);
    expect(out[0].distanceM).toBeLessThan(420);
  });

  it('écarte ce qui est au-delà du rayon', () => {
    const out = rankStayOptions({
      ...base,
      pois: [poi({ category: 'refuge', name: 'Refuge lointain', metres: 9000 }), poi({ category: 'refuge', name: 'Refuge proche', metres: 900 })],
    });
    expect(out.map((o) => o.name)).toEqual(['Refuge proche']);
  });

  it('la préférence de nuits réordonne à distances proches', () => {
    const gite = poi({ category: 'hebergement', name: 'Gîte du Royans', metres: 300 });
    const refuge = poi({ category: 'refuge', name: 'Refuge de la Coche', metres: 900 });
    expect(rankStayOptions({ ...base, nights: 'refuge', pois: [gite, refuge] }).map((o) => o.name)).toEqual([
      'Refuge de la Coche',
      'Gîte du Royans',
    ]);
    expect(rankStayOptions({ ...base, nights: 'hebergement', pois: [gite, refuge] }).map((o) => o.name)).toEqual([
      'Gîte du Royans',
      'Refuge de la Coche',
    ]);
    // Sans préférence ou « mixte » : la distance seule décide.
    expect(rankStayOptions({ ...base, nights: 'mixte', pois: [gite, refuge] }).map((o) => o.name)).toEqual([
      'Gîte du Royans',
      'Refuge de la Coche',
    ]);
  });

  it('bivouac : le camping passe devant l’hôtel voisin', () => {
    const hotel = poi({ category: 'hebergement', name: 'Hôtel', metres: 200 });
    const camping = poi({ category: 'camping', name: 'Camping des Pins', metres: 1200 });
    expect(rankStayOptions({ ...base, nights: 'bivouac', pois: [hotel, camping] })[0].name).toBe('Camping des Pins');
  });

  it('un grand groupe pèse sur les petits hébergements, pas sur les campings', () => {
    const hotel = poi({ category: 'hebergement', name: 'Hôtel', metres: 500 });
    const camping = poi({ category: 'camping', name: 'Camping', metres: 1800 });
    expect(rankStayOptions({ ...base, party: 4, pois: [hotel, camping] })[0].name).toBe('Hôtel');
    expect(rankStayOptions({ ...base, party: 14, pois: [hotel, camping] })[0].name).toBe('Camping');
  });

  it('un point sans nom garde sa catégorie pour nom et passe après les nommés', () => {
    const anonymous = poi({ category: 'refuge', metres: 50 });
    const named = poi({ category: 'hebergement', name: 'Chambres d’hôtes', metres: 2500 });
    const out = rankStayOptions({ ...base, pois: [anonymous, named] });
    expect(out.map((o) => o.name)).toEqual(['Chambres d’hôtes', 'Refuge ou abri']);
    expect(out[1].id).toBe(`osm:${anonymous.id}`);
  });

  it('plafonne à cinq options et supprime le doublon d’un même lieu', () => {
    const pois = Array.from({ length: 8 }, (_, i) => poi({ category: 'hebergement', name: `Gîte ${i}`, metres: 100 * (i + 1) }));
    const twin = poi({ category: 'hebergement', name: 'Gîte 0', metres: 110 });
    const out = rankStayOptions({ ...base, pois: [...pois, twin] });
    expect(out).toHaveLength(5);
    expect(out.filter((o) => o.name === 'Gîte 0')).toHaveLength(1);
    expect(rankStayOptions({ ...base, pois, limit: 3 })).toHaveLength(3);
  });

  it('chaque option vient d’OpenStreetMap, sans photo ni lien inventés', () => {
    const [o] = rankStayOptions({ ...base, pois: [poi({ category: 'camping', name: 'Camping', metres: 300, elevationM: 812 })] });
    expect(o).toMatchObject({ kind: 'camping', elevationM: 812, photo: null, url: null, partner: null });
    expect(o.source).toBe('OpenStreetMap');
    expect(o.id).toMatch(/^osm:\d+$/);
  });

  describe('repère de prix', () => {
    it('hébergement et refuge : le barème du pays, par personne, daté', () => {
      const [h] = rankStayOptions({ ...base, pois: [poi({ category: 'hebergement', name: 'Hôtel', metres: 100 })] });
      const [r] = rankStayOptions({ ...base, pois: [poi({ category: 'refuge', name: 'Refuge', metres: 100 })] });
      const level = priceLevel('FR').level;
      expect(h.price).toEqual({ perPerson: lodgingPerNight(level), currency: 'EUR', basis: 'bareme', asOf: BAREME_AS_OF });
      expect(r.price).toEqual({ perPerson: refugePerNight(level), currency: 'EUR', basis: 'bareme', asOf: BAREME_AS_OF });
      expect(h.source).toContain('barème Compas');
    });

    it('suit le niveau de prix du pays', () => {
      expect(stayPriceHint('hebergement', 'CH')!.perPerson).toBeGreaterThan(stayPriceHint('hebergement', 'FR')!.perPerson);
      expect(stayPriceHint('hebergement', 'NP')!.perPerson).toBeLessThan(stayPriceHint('hebergement', 'FR')!.perPerson);
    });

    it('camping et bivouac : le barème n’en a pas, donc null', () => {
      expect(stayPriceHint('camping', 'FR')).toBeNull();
      expect(stayPriceHint('bivouac', 'FR')).toBeNull();
      const [c] = rankStayOptions({ ...base, pois: [poi({ category: 'camping', name: 'Camping', metres: 100 })] });
      expect(c.price).toBeNull();
    });

    it('la date du barème est celle de sa version', () => {
      expect(BAREME_AS_OF).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });

  describe('nuit déjà notée', () => {
    it('passe en premier, avec l’identifiant noted:<nom>', () => {
      const pois = [poi({ category: 'hebergement', name: 'Hôtel', metres: 100 })];
      const out = rankStayOptions({ ...base, noted: 'Gîte du Royans', pois });
      expect(out[0]).toMatchObject({ id: 'noted:Gîte du Royans', name: 'Gîte du Royans', kind: 'hebergement', distanceM: 0, lat: ARRIVAL.lat, lon: ARRIVAL.lon });
      expect(out[0].source).toContain('noté par toi');
      expect(out[1].name).toBe('Hôtel');
    });

    it('retrouve le lieu OpenStreetMap du même nom : sa position, son altitude, sans doublon', () => {
      const refuge = poi({ category: 'refuge', name: 'Refuge de la Coche', metres: 700, elevationM: 1500 });
      const out = rankStayOptions({ ...base, noted: 'refuge de la coche', pois: [refuge, poi({ category: 'camping', name: 'Camping', metres: 300 })] });
      expect(out.map((o) => o.name)).toEqual(['refuge de la coche', 'Camping']);
      expect(out[0]).toMatchObject({ id: 'noted:refuge de la coche', kind: 'refuge', elevationM: 1500, lat: refuge.lat });
      expect(out[0].distanceM).toBeGreaterThan(650);
    });

    it('une note vide ou blanche est ignorée', () => {
      const pois = [poi({ category: 'hebergement', name: 'Hôtel', metres: 100 })];
      expect(rankStayOptions({ ...base, noted: '   ', pois }).map((o) => o.id.startsWith('noted:'))).toEqual([false]);
    });

    it('lit le type dans les mots de la personne', () => {
      expect(kindOfNotedStay('Refuge du Pré')).toBe('refuge');
      expect(kindOfNotedStay('Cabane de Gaillard')).toBe('refuge');
      expect(kindOfNotedStay('Camping Les Pins')).toBe('camping');
      expect(kindOfNotedStay('Bivouac au lac')).toBe('bivouac');
      expect(kindOfNotedStay('Chez Marie')).toBe('hebergement');
    });
  });
});
