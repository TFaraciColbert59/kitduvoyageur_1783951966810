import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { locationIqKey, locationIqSlot, locationIqUrl, normalizeLocationIq } from '../server/locationIq';
import { parseNominatim } from '../engine/places';

/**
 * Plan 1.3 (8 octobre) : le Nominatim public interdit le trafic régulier d'une
 * application ; avec sa clé, le Compas passe par LocationIQ (même moteur, mêmes
 * données OpenStreetMap, usage commercial autorisé).
 */
describe('LocationIQ à la place du Nominatim public', () => {
  it('même requête, même chemin, format json et clé en plus', () => {
    const url = locationIqUrl(
      'https://nominatim.openstreetmap.org/search?q=Aguas%20Calientes&format=jsonv2&addressdetails=1&namedetails=1&limit=5&accept-language=fr&countrycodes=pe',
      'cle-test'
    );
    expect(url).not.toBeNull();
    const u = new URL(url!);
    expect(`${u.origin}${u.pathname}`).toBe('https://eu1.locationiq.com/v1/search');
    expect(u.searchParams.get('q')).toBe('Aguas Calientes');
    expect(u.searchParams.get('format')).toBe('json');
    expect(u.searchParams.get('countrycodes')).toBe('pe');
    expect(u.searchParams.get('namedetails')).toBe('1');
    expect(u.searchParams.get('key')).toBe('cle-test');

    const rev = new URL(
      locationIqUrl('https://nominatim.openstreetmap.org/reverse?lat=45.9&lon=6.87&format=jsonv2&zoom=14&accept-language=fr', 'k')!
    );
    expect(rev.pathname).toBe('/v1/reverse');
    expect(rev.searchParams.get('zoom')).toBe('14');
  });

  it('rien d’autre que Nominatim n’est réécrit', () => {
    expect(locationIqUrl('https://photon.komoot.io/api/?q=x', 'k')).toBeNull();
    expect(locationIqUrl('https://nominatim.openstreetmap.org/lookup?osm_ids=R1', 'k')).toBeNull();
  });

  it('sans clé, rien ne change', () => {
    expect(locationIqKey({})).toBeNull();
    expect(locationIqKey({ LOCATIONIQ_API_KEY: '  ' })).toBeNull();
    expect(locationIqKey({ LOCATIONIQ_API_KEY: 'k' })).toBe('k');
  });

  it('les lignes LocationIQ se lisent comme celles de Nominatim (nom, catégorie, type)', () => {
    const rows = normalizeLocationIq([
      {
        lat: '-13.1547',
        lon: '-72.5254',
        display_name: 'Aguas Calientes, Machupicchu, Urubamba, Cusco, Pérou',
        class: 'place',
        type: 'town',
        namedetails: { name: 'Machu Picchu Pueblo', 'name:en': 'Aguas Calientes' },
        address: { country: 'Pérou', country_code: 'pe' },
        boundingbox: ['-13.17', '-13.14', '-72.54', '-72.51'],
      },
      { lat: '45.92', lon: '6.87', display_name: 'Chamonix-Mont-Blanc, Haute-Savoie, France', class: 'boundary', type: 'administrative', address: { country_code: 'fr' } },
    ]);
    const places = parseNominatim(rows);
    expect(places.map((p) => [p.name, p.countryCode, p.settlement])).toEqual([
      ['Machu Picchu Pueblo', 'PE', true],
      ['Chamonix-Mont-Blanc', 'FR', false],
    ]);
    expect(places[0].aliases).toContain('Aguas Calientes');
    // Géocodage inverse : un seul objet, pas une liste.
    expect(normalizeLocationIq({ lat: '1', lon: '2', display_name: 'Annecy, France', class: 'place', type: 'city' })).toHaveLength(1);
  });
  it('2 requêtes par seconde pour tout le site : créneau partagé, attente, puis abandon (revue Codex)', async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    // Seconde pleine, puis créneau libre : on attend une fois et on passe.
    const answers = [
      { allowed: false, retryAfterSeconds: 1 },
      { allowed: true, retryAfterSeconds: 0 },
    ];
    expect(await locationIqSlot({ consume: async () => answers.shift()!, sleep })).toBe(true);
    expect(waits).toEqual([1000]);
    // Toujours plein : quatre essais, puis le service suivant.
    waits.length = 0;
    let calls = 0;
    const full = async () => {
      calls += 1;
      return { allowed: false, retryAfterSeconds: 1 };
    };
    expect(await locationIqSlot({ consume: full, sleep })).toBe(false);
    expect(calls).toBe(4);
  });
});
