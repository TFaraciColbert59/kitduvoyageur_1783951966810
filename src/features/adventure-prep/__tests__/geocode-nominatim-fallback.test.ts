/**
 * Le repli Nominatim, verifie().
 *
 * La correction qui a rendu `/api/geocode` de nouveau fiable a ete ecrite
 * AVANT ses tests : c est le seul moyen honnete de la faire tenir ensuite.
 * Chacun de ces tests rejoue une panne REELLEMENT observee le 2026-09-28
 * sur le corridor de Chamonix, et echouerait si la parade etait retiree.
 *
 *   Photon  503 text/html  112 ms   (page de limitation)
 *   Photon  503 text/html   96 ms
 *   Photon  AbortError   6 006 ms
 *
 *   pendant ce temps, en parallele :
 *   nominatim  200  172 ms      nominatim reverse  200  106 ms
 *
 * Sans repli, le point de depart de la personne s effacait d un coup, et le
 * parcours entier tombait en « a verifier » : 20 appels `/api/route` en
 * `503 off_network`. C est ce que ces tests verrouillent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  geocodePlace,
  reverseGeocodePlace,
  __resetGeoCache,
  __resetNominatimCadence,
} from '../geocodeService';

let fetchMock: ReturnType<typeof vi.fn>;

/** Une reponse JSON, comme la rend un fournisseur qui coopere. */
const json = (payload: unknown) =>
  ({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(payload),
  }) as unknown as Response;

/** La page de limitation de Photon : `200`, mais du HTML. Mesure reelle. */
const htmlLimitation = () =>
  ({
    ok: true,
    headers: { get: () => 'text/html; charset=utf-8' },
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
  }) as unknown as Response;

const isPhoton = (url: string) => url.includes('photon.komoot.io');
const isNominatim = (url: string) => url.includes('nominatim.openstreetmap.org');

/** Reponse Nominatim en ALLER, relevee sur `search?q=Chamonix`. */
const NOMINATIM_SEARCH = [
  {
    lat: '45.9237',
    lon: '6.8694',
    name: 'Chamonix-Mont-Blanc',
    type: 'city',
    addresstype: 'city',
    address: {
      city: 'Chamonix-Mont-Blanc',
      county: 'Haute-Savoie',
      state: 'Auvergne-Rhone-Alpes',
      country: 'France',
    },
  },
];

/** Reponse Nominatim en INVERSE, relevee sur le point de Chamonix. */
const NOMINATIM_REVERSE = {
  lat: '45.9237',
  lon: '6.8694',
  display_name: 'Archives municipales, Chamonix-Mont-Blanc, France',
  name: 'Archives municipales de Chamonix-Mont-Blanc',
  type: 'amenity',
  addresstype: 'library',
  address: {
    city: 'Chamonix-Mont-Blanc',
    county: 'Haute-Savoie',
    state: 'Auvergne-Rhone-Alpes',
    country: 'France',
  },
};

beforeEach(() => {
  __resetGeoCache();
  __resetNominatimCadence();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('NOM-01 : le repli existe vraiment', () => {
  it('NOM-01: Photon tombe, Nominatim repond, le statut est ok et le fournisseur est nominatim', async () => {
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url)
        ? Promise.reject(new Error('503 Service Unavailable'))
        : Promise.resolve(json(isNominatim(url) ? NOMINATIM_SEARCH : { results: [] })),
    );

    const res = await geocodePlace('Chamonix');

    // Sans ce test, la cascade pourrait rendre `unavailable` en repondant
    // « personne ne sait » alors qu un fournisseur repondait.
    expect(res.status).toBe('ok');
    expect(res.provider).toBe('nominatim');
    expect(res.matches[0]).toMatchObject({
      name: 'Chamonix-Mont-Blanc',
      country: 'France',
      provider: 'nominatim',
      // OSM classe une commune : c est une ancre de voyage fiable.
      precision: 'commune',
    });
    // La position vient du fournisseur, telle qu il la rend.
    expect(res.matches[0].lat).toBeCloseTo(45.9237, 4);
    expect(res.matches[0].lon).toBeCloseTo(6.8694, 4);
  });

  it('NOM-01b: Nominatim est reellement interroge apres Photon', async () => {
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url)
        ? Promise.reject(new Error('503'))
        : Promise.resolve(json(NOMINATIM_SEARCH)),
    );

    await geocodePlace('Chamonix');

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some(isNominatim)).toBe(true);
    // L ordre compte : on interroge le fournisseur rapide avant le lent.
    expect(urls.findIndex(isPhoton)).toBeLessThan(urls.findIndex(isNominatim));
  });
});

describe('NOM-02 : le HTML de limitation n est pas une reponse', () => {
  it('NOM-02: Photon rend du HTML, on tente quand meme Nominatim', async () => {
    // Mesure relevee : `503 text/html` puis `HTML 112 ms`. Un corps HTML
    // passe dans `json()` leve un SyntaxError ; sans parade, la cascade
    // s arreterait la en croyant a une panne du reseau entier.
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.resolve(htmlLimitation()) : Promise.resolve(json(NOMINATIM_SEARCH)),
    );

    const res = await geocodePlace('Chamonix');

    expect(res.status).toBe('ok');
    expect(res.provider).toBe('nominatim');
    expect(fetchMock.mock.calls.some((c) => isNominatim(c[0] as string))).toBe(true);
  });

  it('NOM-02b: un HTML suivi d une panne totale reste `unavailable`, jamais `no_result`', async () => {
    // Les deux statuts ne se confondent jamais : l un rassure, l autre previent.
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.resolve(htmlLimitation()) : Promise.reject(new Error('down')),
    );

    const res = await geocodePlace('Chamonix');

    expect(res.status).toBe('unavailable');
    expect(res.matches).toHaveLength(0);
  });
});

describe('NOM-03 : l inverse rend la commune, pas le batiment', () => {
  it('NOM-03: Photon tombe, Nominatim inverse resout la commune et garde la position demandee', async () => {
    // Le `name` de Nominatim en inverse est le BATIMENT le plus proche, ici la
    // bibliotheque municipale. Ecrire ce nom afficherait un monument public
    // comme point de depart du parcours.
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.reject(new Error('503')) : Promise.resolve(json(NOMINATIM_REVERSE)),
    );

    const res = await reverseGeocodePlace(45.9237, 6.8694);

    expect(res.status).toBe('ok');
    expect(res.provider).toBe('nominatim');
    expect(res.matches[0].name).toBe('Chamonix-Mont-Blanc');
    expect(res.matches[0].name).not.toContain('Archives');
    expect(res.matches[0].context).toBe('Haute-Savoie');
    expect(res.matches[0].country).toBe('France');
    expect(res.matches[0].precision).toBe('commune');
  });

  it('NOM-03b: la position rendue est celle demandee, pas celle du batiment', async () => {
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.reject(new Error('503')) : Promise.resolve(json(NOMINATIM_REVERSE)),
    );

    const res = await reverseGeocodePlace(45.9301, 6.8802);

    // C est la position de la personne qui fait foi : le fournisseur donne un
    // nom, pas une position.
    expect(res.matches[0].lat).toBe(45.9301);
    expect(res.matches[0].lon).toBe(6.8802);
  });

  it('NOM-03c: sans commune dans l adresse, on ne renvoie rien plutot qu un batiment', async () => {
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url)
        ? Promise.reject(new Error('503'))
        : Promise.resolve(
            json({
              lat: '45.9237',
              lon: '6.8694',
              name: 'Archives municipales',
              address: { country: 'France' },
            }),
          ),
    );

    const res = await reverseGeocodePlace(45.9237, 6.8694);

    // Photon etant tombe, aucun fournisseur n a designe de commune : mieux vaut
    // `no_result` qu un nom qui ne designe pas un lieu de voyage.
    expect(res.status).toBe('no_result');
    expect(res.matches).toHaveLength(0);
  });
});

describe('NOM-04 : la politique d usage OSM est respectee', () => {
  it('NOM-04: chaque appel Nominatim porte un User-Agent identifiant l application', async () => {
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.reject(new Error('503')) : Promise.resolve(json(NOMINATIM_SEARCH)),
    );

    await geocodePlace('Chamonix');

    const nominatimCalls = fetchMock.mock.calls.filter((c) => isNominatim(c[0] as string));
    expect(nominatimCalls.length).toBeGreaterThan(0);
    for (const call of nominatimCalls) {
      const init = call[1] as RequestInit;
      const headers = (init.headers ?? {}) as Record<string, string>;
      // Sans User-Agent identifiant, OSM bloque l IP : on perdrait le
      // fournisseur de repli precisement quand Photon tombe.
      expect(headers['User-Agent']).toBeTruthy();
      expect(headers['User-Agent']).toContain('kitduvoyageur');
      expect(headers.Accept).toBe('application/json');
    }
  });

  it('NOM-04b: l inverse porte le meme User-Agent que l aller', async () => {
    // Deux chemins de code distincts vers Nominatim. Si seul l aller
    // l portes, l inverse partirait sans identifiant — et se ferait
    // bloquer au moment precis ou l on a besoin de lui.
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.reject(new Error('503')) : Promise.resolve(json(NOMINATIM_REVERSE)),
    );

    await reverseGeocodePlace(45.9237, 6.8694);

    const nominatimCalls = fetchMock.mock.calls.filter((c) => isNominatim(c[0] as string));
    expect(nominatimCalls.length).toBeGreaterThan(0);
    for (const call of nominatimCalls) {
      const init = call[1] as RequestInit;
      const headers = (init.headers ?? {}) as Record<string, string>;
      expect(headers['User-Agent']).toContain('kitduvoyageur');
    }
  });

  it('NOM-04c: un fournisseur qui n est pas Nominatim ne recoit pas notre User-Agent OSM', async () => {
    fetchMock.mockResolvedValue(json({ features: [] }));

    await reverseGeocodePlace(45.9237, 6.8694);

    const photonCall = fetchMock.mock.calls.find((c) => isPhoton(c[0] as string));
    const init = photonCall?.[1] as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    // Notre identifiant OSM n a rien a faire chez un tiers : le porter
    // partout revele notre application a des services qui n en ont pas besoin.
    expect(headers['User-Agent']).toBeUndefined();
  });
});

describe('NOM-05 : un appel a la fois, espace d au moins 1,1 s', () => {
  it('NOM-05: deux requetes Nominatim ne partent jamais en rafale', async () => {
    const stamps: number[] = [];
    fetchMock.mockImplementation((url: string) => {
      if (isPhoton(url)) return Promise.reject(new Error('503'));
      if (isNominatim(url)) stamps.push(Date.now());
      return Promise.resolve(json(NOMINATIM_SEARCH));
    });

    await geocodePlace('Chamonix');
    await geocodePlace('Les Houches');

    expect(stamps.length).toBe(2);
    const gap = stamps[1] - stamps[0];
    // La politique OSM impose UN appel par seconde au maximum. En dessous, le
    // service rend 429 puis bloque l IP — et l on perd le seul repli.
    expect(gap).toBeGreaterThanOrEqual(1000);
  });

  it('NOM-05b: deux requetes Nominatim ne se chevauchent jamais', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    fetchMock.mockImplementation((url: string) => {
      if (isPhoton(url)) return Promise.reject(new Error('503'));
      if (!isNominatim(url)) return Promise.resolve(json(NOMINATIM_SEARCH));
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return Promise.resolve(json(NOMINATIM_SEARCH)).finally(() => {
        inFlight -= 1;
      });
    });

    await Promise.all([geocodePlace('Chamonix'), geocodePlace('Les Houches')]);

    // La file d attente est une PROMESSE, pas une intention : si deux requetes
    // partaient ensemble, OSM les compte comme de la rafale.
    expect(maxInFlight).toBeLessThanOrEqual(1);
  });

  it('NOM-05c: un echec ne casse pas la chaine, l appel suivant part quand meme', async () => {
    // Les trois doivent echouer : si le moindre repond, le statut final est
    // `no_result` (« personne ne connait ce nom ») et non `unavailable`
    // (« le service est tombe ») — deux messages opposes a la personne.
    fetchMock.mockImplementation((url: string) => {
      if (isNominatim(url)) return Promise.reject(new Error('429 Too Many Requests'));
      return Promise.reject(new Error('503'));
    });

    const first = await geocodePlace('Chamonix');
    expect(first.status).toBe('unavailable');

    // Si la chaine de promesses restait rejetee, cet appel-ci ne tenterait
    // jamais Nominatim et rendrait `unavailable` sans rien demander.
    fetchMock.mockImplementation((url: string) =>
      isPhoton(url) ? Promise.reject(new Error('503')) : Promise.resolve(json(NOMINATIM_SEARCH)),
    );
    const second = await geocodePlace('Argentiere');
    expect(second.status).toBe('ok');
    expect(second.provider).toBe('nominatim');
  });
});

describe('NOM-06 : chaque fournisseur a SON budget de temps', () => {
  it('NOM-06: le minuteur epuise par un fournisseur n annule pas celui du suivant', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];

    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      signals.push(signal);
      if (url.includes('open-meteo')) {
        // Le premier fournisseur ne repond jamais : il consomme son budget.
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }
      return Promise.resolve(json({ features: [{ geometry: { coordinates: [6.869, 45.923] }, properties: { name: 'Chamonix-Mont-Blanc', country: 'France', type: 'city' } }] }));
    });

    const pending = geocodePlace('Chamonix');
    await vi.advanceTimersByTimeAsync(6001);
    const res = await pending;

    // Photon a repondu alors que le minuteur d open-meteo etait epuise.
    expect(res.status).toBe('ok');
    expect(res.provider).toBe('photon');

    // La parade est STRUCTURELLE, pas seulement succes : chaque fournisseur
    // recoit son propre signal. Un `AbortController` partage donnerait
    // `signals[0] === signals[1]`, deja avorte, et le repli ne partirait plus.
    expect(signals.length).toBe(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
