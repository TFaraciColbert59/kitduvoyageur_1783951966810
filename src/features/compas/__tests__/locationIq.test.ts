import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  LOCATIONIQ_GAP_MS,
  NOMINATIM_GAP_MS,
  locationIqKey,
  locationIqSlot,
  locationIqUrl,
  nominatimJson,
  normalizeLocationIq,
  resetNominatimClock,
} from '../server/locationIq';
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

/**
 * Plan 1.3, lot AA : UN client pour tout appel Nominatim du site (Compas,
 * alertes officielles, géocodage du préparateur). Fetch simulé, aucun réseau.
 */
describe('nominatimJson — le client commun', () => {
  const SEARCH = 'https://nominatim.openstreetmap.org/search?q=Annecy&format=jsonv2&addressdetails=1&limit=5';
  const REVERSE = 'https://nominatim.openstreetmap.org/reverse?lat=45.9&lon=6.87&format=jsonv2&zoom=14';
  const UA = 'kitduvoyageur/1.0 (test; +https://koosmoweb.fr)';
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const noSleep = async () => undefined;
  const asFetch = (f: unknown) => f as typeof fetch;

  beforeEach(() => {
    resetNominatimClock();
  });

  it('avec la clé : LocationIQ, après un créneau du site ; jamais le serveur public', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    let slots = 0;
    const out = await nominatimJson(SEARCH, {
      userAgent: UA,
      env: { LOCATIONIQ_API_KEY: 'cle-test' },
      slot: async () => {
        slots += 1;
        return true;
      },
      sleep: noSleep,
      fetchImpl: asFetch(async (url: string, init?: RequestInit) => {
        seen.push({ url, headers: init?.headers as Record<string, string> });
        return json([{ lat: '45.9', lon: '6.12', display_name: 'Annecy, Haute-Savoie, France', class: 'boundary', type: 'city' }]);
      }),
    });
    expect(slots).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].url.startsWith('https://eu1.locationiq.com/v1/search?')).toBe(true);
    expect(seen[0].url).not.toContain('nominatim.openstreetmap.org');
    expect(seen[0].headers['User-Agent']).toBe(UA);
    // La liste est rendue dans la forme de Nominatim : nom, catégorie, type d'adresse.
    expect(out).toEqual([expect.objectContaining({ name: 'Annecy', category: 'boundary', addresstype: 'city' })]);
  });

  it('avec la clé, un géocodage inverse rend UN objet, pas une liste', async () => {
    const out = await nominatimJson(REVERSE, {
      userAgent: UA,
      env: { LOCATIONIQ_API_KEY: 'k' },
      slot: async () => true,
      sleep: noSleep,
      fetchImpl: asFetch(async () =>
        json({ lat: '45.9', lon: '6.87', display_name: 'Annecy, France', class: 'place', type: 'city', address: { country_code: 'fr' } })
      ),
    });
    expect(Array.isArray(out)).toBe(false);
    expect(out).toMatchObject({ name: 'Annecy', address: { country_code: 'fr' } });
  });

  it('pas de créneau libre chez LocationIQ : comme une panne (null), sans requête', async () => {
    const fetchImpl = vi.fn();
    const out = await nominatimJson(SEARCH, {
      userAgent: UA,
      env: { LOCATIONIQ_API_KEY: 'k' },
      slot: async () => false,
      sleep: noSleep,
      fetchImpl: asFetch(fetchImpl),
    });
    expect(out).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sans clé : Nominatim public avec le User-Agent de l’application (repli de développement), corps rendu tel quel', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const body = [{ lat: '45.9', lon: '6.12', name: 'Annecy' }];
    const out = await nominatimJson(SEARCH, {
      userAgent: UA,
      env: {},
      sleep: noSleep,
      fetchImpl: asFetch(async (url: string, init?: RequestInit) => {
        seen.push({ url, headers: init?.headers as Record<string, string> });
        return json(body);
      }),
    });
    expect(seen[0].url).toBe(SEARCH);
    expect(seen[0].headers['User-Agent']).toBe(UA);
    expect(out).toEqual(body);
  });

  it('une seule adresse permise : Nominatim ; rien d’autre ne part, même avec la clé', async () => {
    const fetchImpl = vi.fn();
    const urls = ['https://photon.komoot.io/api/?q=x', 'https://example.org/search?q=x', 'https://nominatim.openstreetmap.org.evil.test/search?q=x'];
    for (const url of urls) {
      const out = await nominatimJson(url, {
        userAgent: UA,
        env: { LOCATIONIQ_API_KEY: 'k' },
        slot: async () => true,
        sleep: noSleep,
        fetchImpl: asFetch(fetchImpl),
      });
      expect(out).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('une requête à la fois, quel que soit l’appelant, même lancées ensemble', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = asFetch(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return json([]);
    });
    await Promise.all([1, 2, 3, 4].map(() => nominatimJson(SEARCH, { userAgent: UA, env: {}, sleep: noSleep, fetchImpl })));
    expect(maxInFlight).toBe(1);
  });

  it('même limite pour tous : 1 requête par seconde au plus sans clé, 2 par seconde avec elle', async () => {
    const ok = asFetch(async () => json([]));
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    await nominatimJson(SEARCH, { userAgent: UA, env: {}, sleep, fetchImpl: ok });
    await nominatimJson(SEARCH, { userAgent: UA, env: {}, sleep, fetchImpl: ok });
    // La première part sans attendre ; la seconde attend le reste de l'intervalle.
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(NOMINATIM_GAP_MS - 200);
    expect(waits[0]).toBeLessThanOrEqual(NOMINATIM_GAP_MS);
    expect(NOMINATIM_GAP_MS).toBeGreaterThanOrEqual(1000);

    resetNominatimClock();
    waits.length = 0;
    const withKey = { userAgent: UA, env: { LOCATIONIQ_API_KEY: 'k' }, slot: async () => true, sleep, fetchImpl: ok };
    await nominatimJson(SEARCH, withKey);
    await nominatimJson(SEARCH, withKey);
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(LOCATIONIQ_GAP_MS - 200);
    expect(waits[0]).toBeLessThanOrEqual(LOCATIONIQ_GAP_MS);
    expect(LOCATIONIQ_GAP_MS).toBeGreaterThanOrEqual(500);
  });

  it('un échec (réseau, statut, corps illisible) rend null sans lever, et la file continue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const base = { userAgent: UA, env: { LOCATIONIQ_API_KEY: 'cle-secrete' }, slot: async () => true, sleep: noSleep };
      const offline = asFetch(async () => {
        throw new Error('offline');
      });
      expect(await nominatimJson(SEARCH, { ...base, fetchImpl: offline })).toBeNull();
      expect(await nominatimJson(SEARCH, { ...base, fetchImpl: asFetch(async () => json({ error: 'quota' }, 429)) })).toBeNull();
      expect(await nominatimJson(SEARCH, { ...base, fetchImpl: asFetch(async () => new Response('<html>', { status: 200 })) })).toBeNull();
      // La suite n'est pas bloquée.
      expect(await nominatimJson(SEARCH, { ...base, fetchImpl: asFetch(async () => json([])) })).toEqual([]);
      // Jamais la clé dans un journal (elle voyage dans l'adresse).
      expect(warn).toHaveBeenCalled();
      expect(warn.mock.calls.flat().join(' ')).not.toContain('cle-secrete');
    } finally {
      warn.mockRestore();
    }
  });

  it('le minuteur de l’appelant borne la requête : déjà écoulé, rien ne part', async () => {
    const fetchImpl = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const out = await nominatimJson(SEARCH, { userAgent: UA, env: {}, sleep: noSleep, signal: controller.signal, fetchImpl: asFetch(fetchImpl) });
    expect(out).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
