import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import lausanne from './fixtures/meteoalarm-ch-lausanne.json';
import {
  FEED_MAX_BYTES,
  FEED_MAX_STALE_MS,
  FEED_RETRY_AFTER_FAILURE_MS,
  FEED_TTL_MS,
  getOfficialAlerts,
  placeAreasOf,
  readBodyBounded,
  resetOfficialAlertsCache,
} from '../server/officialAlerts';

/**
 * Alertes officielles côté serveur : la carte (Nominatim) et les flux Meteoalarm
 * sont simulés à la frontière `fetch` ; aucun réseau réel.
 */

const NOW = new Date('2026-10-11T07:00:00+02:00');
const TRIP = { from: '2026-10-11', to: '2026-10-12', timeZone: 'Europe/Paris' };

type Address = Record<string, string>;
const ADDRESSES: Record<string, Address> = {
  // Valeurs relevées sur Nominatim le 2026-10-10 (zoom 8, sans langue demandée).
  lyon: { county: 'Métropole de Lyon', state_district: 'Rhône', state: 'Auvergne-Rhône-Alpes', country_code: 'fr' },
  chamonix: { county: 'Haute-Savoie', state: 'Auvergne-Rhône-Alpes', country_code: 'fr' },
  lausanne: { county: 'District de Lausanne', state: 'Vaud', country_code: 'ch' },
  garmisch: { county: 'Landkreis Garmisch-Partenkirchen', state: 'Bayern', country_code: 'de' },
  yosemite: { county: 'Mariposa County', state: 'California', country_code: 'us' },
};
const POINTS = {
  lyon: { lat: 45.76, lon: 4.83 },
  chamonix: { lat: 45.92, lon: 6.87 },
  lausanne: { lat: 46.5197, lon: 6.6323 },
  garmisch: { lat: 47.49, lon: 11.1 },
  yosemite: { lat: 37.75, lon: -119.59 },
} as const;

const cap = (id: string, area: string, level: string, type: string, lang = 'fr-FR') => ({
  alert: {
    identifier: id,
    msgType: 'Alert',
    sent: '2026-10-10T18:00:00+02:00',
    info: [
      {
        language: lang,
        senderName: 'Service',
        onset: '2026-10-11T06:00:00+02:00',
        expires: '2026-10-11T21:00:00+02:00',
        area: [{ areaDesc: area, geocode: [{ valueName: 'EMMA_ID', value: 'XX001' }] }],
        parameter: [
          { valueName: 'awareness_level', value: level },
          { valueName: 'awareness_type', value: type },
        ],
      },
    ],
  },
});

interface Mock {
  calls: Array<{ url: string; init?: RequestInit }>;
  feedCalls: () => number;
}

/** `place` : adresse rendue par la carte ; `feeds` : corps (ou statut) rendu pour chaque slug. */
function mockNetwork(opts: {
  place?: keyof typeof ADDRESSES | null;
  feeds?: Record<string, unknown | number>;
  delayMs?: number;
}): Mock {
  const calls: Mock['calls'] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://nominatim.openstreetmap.org/reverse')) {
      if (!opts.place) return new Response('{}', { status: 200 });
      return new Response(JSON.stringify({ address: ADDRESSES[opts.place] }), { status: 200 });
    }
    const slug = /feeds-([a-z-]+)$/.exec(url)?.[1];
    if (!slug || !opts.feeds || !(slug in opts.feeds)) throw new Error(`appel inattendu : ${url}`);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const body = opts.feeds[slug];
    if (typeof body === 'number') return new Response('boom', { status: body });
    // Une réponse toute faite (corps trop gros, mal formé…) ou une panne réseau.
    if (typeof body === 'function') return (body as () => Response)();
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return { calls, feedCalls: () => calls.filter((c) => c.url.includes('feeds.meteoalarm.org')).length };
}

beforeEach(() => {
  resetOfficialAlertsCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('carte : pays et unités administratives', () => {
  it('noms du pays, du plus fin au plus large, sans langue demandée ; code pays en minuscules', async () => {
    const net = mockNetwork({ place: 'lyon' });
    await expect(placeAreasOf(45.76, 4.83)).resolves.toEqual({
      country: 'fr',
      names: ['Métropole de Lyon', 'Rhône', 'Auvergne-Rhône-Alpes'],
    });
    const url = net.calls[0].url;
    expect(url).toContain('lat=45.76&lon=4.83');
    expect(url).not.toContain('accept-language');
    expect((net.calls[0].init?.headers as Record<string, string>)['User-Agent']).toMatch(/^kitduvoyageur\/1\.0 \(/);
  });

  it('carte muette : null', async () => {
    mockNetwork({ place: null });
    await expect(placeAreasOf(45.76, 4.83)).resolves.toBeNull();
  });
});

describe('getOfficialAlerts', () => {
  it('pays absent de la table : « non couvert », et aucun appel au flux', async () => {
    const net = mockNetwork({ place: 'yosemite' });
    const r = await getOfficialAlerts({ point: POINTS.yosemite, ...TRIP });
    expect(r).toEqual({ status: 'non_couvert', alerts: [], area: null, readAt: null });
    expect(net.feedCalls()).toBe(0);
  });

  it('sans position ou sans dates : indisponible, sans appel', async () => {
    const net = mockNetwork({ place: 'lyon' });
    expect(await getOfficialAlerts({ point: null, ...TRIP })).toMatchObject({ status: 'indisponibles' });
    expect(await getOfficialAlerts({ point: POINTS.lyon, from: null, to: null })).toMatchObject({ status: 'indisponibles' });
    expect(net.calls).toHaveLength(0);
  });

  it('Lyon : le département Rhône (2e nom de la carte) porte l’alerte', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: { warnings: [cap('fr-69', 'Rhône', '3; orange; Severe', '3; Thunderstorm')] } } });
    const r = await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(r.status).toBe('lues');
    expect(r.alerts).toMatchObject([{ id: 'fr-69', level: 'orange', hazard: 'orages', area: 'Rhône' }]);
    expect(r.alerts[0].source).toBe('Météo-France via Meteoalarm');
    // L'heure de lecture du flux date l'information.
    expect(r.alerts[0].fetchedAt).toBe(NOW.toISOString());
  });

  it('France, département calme : « lues », liste vide', async () => {
    mockNetwork({ place: 'chamonix', feeds: { france: { warnings: [cap('fr-69', 'Rhône', '3; orange; Severe', '3; Thunderstorm')] } } });
    expect(await getOfficialAlerts({ point: POINTS.chamonix, ...TRIP })).toMatchObject({ status: 'lues', alerts: [] });
  });

  it('Suisse : le contour du flux couvre Lausanne, la zone est reconnue', async () => {
    mockNetwork({ place: 'lausanne', feeds: { switzerland: lausanne } });
    vi.setSystemTime(new Date('2026-10-08T08:00:00+02:00'));
    const r = await getOfficialAlerts({ point: POINTS.lausanne, from: '2026-10-08', to: '2026-10-08', timeZone: 'Europe/Zurich' });
    // Le message réel est de niveau vert : aucune vigilance, mais le lieu est dans un contour du flux.
    expect(r).toMatchObject({ status: 'lues', alerts: [] });
  });

  it('CONTRE-EXEMPLE — Allemagne : « Landkreis X » n’est pas « Kreis X », la zone n’est pas rapprochée et rien n’est affirmé', async () => {
    mockNetwork({ place: 'garmisch', feeds: { germany: { warnings: [cap('de-1', 'Kreis Garmisch-Partenkirchen', '3; orange; Severe', '1; Wind', 'de-DE')] } } });
    const r = await getOfficialAlerts({ point: POINTS.garmisch, ...TRIP });
    expect(r).toMatchObject({ status: 'zone_non_rapprochee', alerts: [] });
  });

  it('nom exact trouvé hors France : l’alerte est montrée, la liste est dite partielle', async () => {
    mockNetwork({ place: 'garmisch', feeds: { germany: { warnings: [cap('de-2', 'Bayern', '2; yellow; Moderate', '10; Rain', 'de-DE')] } } });
    const r = await getOfficialAlerts({ point: POINTS.garmisch, ...TRIP });
    expect(r.status).toBe('partielles');
    expect(r.alerts).toMatchObject([{ id: 'de-2', level: 'jaune', area: 'Bayern' }]);
    expect(r.alerts[0].source).toBe('Deutscher Wetterdienst (DWD) via Meteoalarm');
  });

  it('départ au-delà du lendemain : « pas encore publiées », sans appel au flux ; voyage passé : indisponible', async () => {
    const net = mockNetwork({ place: 'lyon' });
    expect(await getOfficialAlerts({ point: POINTS.lyon, from: '2026-10-20', to: '2026-10-22', timeZone: 'Europe/Paris' })).toMatchObject({
      status: 'pas_encore_publiees',
    });
    expect(await getOfficialAlerts({ point: POINTS.lyon, from: '2026-10-01', to: '2026-10-03', timeZone: 'Europe/Paris' })).toMatchObject({
      status: 'indisponibles',
    });
    expect(net.feedCalls()).toBe(0);
  });

  it('« aujourd’hui » est celui de la destination, pas celui de Paris', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: { warnings: [cap('fr-13', 'Bouches-du-Rhône', '3; orange; Severe', '3; Thunderstorm')] } } });
    // 11 oct. 0 h 30 à Paris = 10 oct. 15 h 30 à Los Angeles : un voyage du 12 oct. n'est pas encore publié là-bas.
    vi.setSystemTime(new Date('2026-10-10T22:30:00Z'));
    expect(await getOfficialAlerts({ point: POINTS.lyon, from: '2026-10-12', to: '2026-10-12', timeZone: 'America/Los_Angeles' })).toMatchObject({
      status: 'pas_encore_publiees',
    });
    // À Paris, c'est déjà le 11 : le 12 est demain, publié.
    expect(await getOfficialAlerts({ point: POINTS.lyon, from: '2026-10-12', to: '2026-10-12', timeZone: 'Europe/Paris' })).toMatchObject({
      status: 'lues',
    });
  });

  it('flux en panne, illisible ou qui n’est pas un flux : indisponible, jamais « aucune alerte »', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: 503 } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [] });
    resetOfficialAlertsCache();
    vi.restoreAllMocks();
    mockNetwork({ place: 'lyon', feeds: { france: { surprise: true } } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles' });
    resetOfficialAlertsCache();
    vi.restoreAllMocks();
    // Un flux non vide dont aucun message n'est lisible (format changé) n'est pas un pays calme.
    mockNetwork({ place: 'lyon', feeds: { france: { warnings: [{ alert: { identifier: 'x', sent: '2026-10-10T10:00:00Z', info: [] } }] } } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles' });
  });
});

describe('fraîcheur : retard moyen < 5 min, jamais > 10 min (conditions Meteoalarm, § 5)', () => {
  const feeds = { france: { warnings: [cap('fr-69', 'Rhône', '3; orange; Severe', '3; Thunderstorm')] } };

  it('les constantes sont celles des conditions', () => {
    expect(FEED_TTL_MS).toBe(5 * 60_000);
    expect(FEED_MAX_STALE_MS).toBe(10 * 60_000);
  });

  it('le flux est lu sans cache de Next (pas de service d’une entrée périmée), avec l’identité du site', async () => {
    const net = mockNetwork({ place: 'lyon', feeds });
    await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    const feed = net.calls.find((c) => c.url.includes('feeds.meteoalarm.org'))!;
    expect(feed.url).toBe('https://feeds.meteoalarm.org/api/v1/warnings/feeds-france');
    expect(feed.init?.cache).toBe('no-store');
    expect(JSON.stringify(feed.init)).not.toContain('revalidate');
    expect((feed.init?.headers as Record<string, string>)['User-Agent']).toMatch(/Compas, alertes/);
  });

  it('deux voyageurs dans les 5 minutes : un seul appel au flux ; au-delà, un nouvel appel', async () => {
    const net = mockNetwork({ place: 'lyon', feeds });
    await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    vi.setSystemTime(new Date(NOW.getTime() + 4 * 60_000 + 59_000));
    await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(net.feedCalls()).toBe(1);
    vi.setSystemTime(new Date(NOW.getTime() + 5 * 60_000 + 1_000));
    const again = await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(net.feedCalls()).toBe(2);
    // La lecture date de ce nouvel appel.
    expect(again.alerts[0].fetchedAt).toBe(new Date(NOW.getTime() + 5 * 60_000 + 1_000).toISOString());
  });

  it('appels simultanés : une seule requête partagée', async () => {
    const net = mockNetwork({ place: 'lyon', feeds, delayMs: 30 });
    const [a, b, c] = await Promise.all([
      getOfficialAlerts({ point: POINTS.lyon, ...TRIP }),
      getOfficialAlerts({ point: POINTS.lyon, ...TRIP }),
      getOfficialAlerts({ point: POINTS.lyon, ...TRIP }),
    ]);
    expect(net.feedCalls()).toBe(1);
    expect([a.status, b.status, c.status]).toEqual(['lues', 'lues', 'lues']);
  });

  it('flux en panne : la dernière lecture sert jusqu’à 10 minutes, jamais au-delà', async () => {
    mockNetwork({ place: 'lyon', feeds });
    await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    vi.restoreAllMocks();
    const net = mockNetwork({ place: 'lyon', feeds: { france: 500 } });
    vi.setSystemTime(new Date(NOW.getTime() + 8 * 60_000));
    const stale = await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(net.feedCalls()).toBe(1);
    expect(stale.status).toBe('lues');
    expect(stale.alerts).toHaveLength(1);
    vi.setSystemTime(new Date(NOW.getTime() + 10 * 60_000 + 1_000));
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [] });
  });
});

describe('entrée non fiable : taille, forme, panne (aucune exception, jamais « aucune alerte »)', () => {
  const MIB = 1024 * 1024;
  const calme = { warnings: [cap('fr-13', 'Bouches-du-Rhône', '3; orange; Severe', '3; Thunderstorm')] };

  it('readBodyBounded : un corps dans la borne est lu en entier, BOM retiré', async () => {
    const text = await readBodyBounded(new Response('\uFEFF{"warnings":[]}'), 1000);
    expect(JSON.parse(text as string)).toEqual({ warnings: [] });
  });

  it('readBodyBounded : un Content-Length au-dessus de la borne refuse avant toute lecture', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(10));
      },
    });
    const res = new Response(body, { headers: { 'content-length': '5000' } });
    expect(await readBodyBounded(res, 1000)).toBeNull();
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it('readBodyBounded : sans Content-Length, la lecture s’arrête dès que la borne est dépassée', async () => {
    let pulled = 0;
    const chunk = new Uint8Array(MIB);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 200) controller.close();
        else controller.enqueue(chunk);
      },
    });
    expect(await readBodyBounded(new Response(body), 4 * MIB)).toBeNull();
    // Arrêté vers le 5e Mio, pas lu jusqu'au bout (200 Mio).
    expect(pulled).toBeLessThan(10);
  });

  it('flux de plus de 12 Mo (annoncé ou non) : indisponible, sans exception', async () => {
    expect(FEED_MAX_BYTES).toBe(12 * MIB);
    mockNetwork({
      place: 'lyon',
      feeds: { france: () => new Response('{"warnings":[]}', { headers: { 'content-length': String(FEED_MAX_BYTES + 1) } }) },
    });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [], readAt: null });
    resetOfficialAlertsCache();
    vi.restoreAllMocks();
    const chunk = new Uint8Array(MIB);
    mockNetwork({
      place: 'lyon',
      feeds: {
        france: () => {
          let n = 0;
          return new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                n += 1;
                if (n > 40) controller.close();
                else controller.enqueue(chunk);
              },
            })
          );
        },
      },
    });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [] });
  });

  it('corps qui n’est pas du JSON (page d’erreur HTML), réseau coupé : indisponible', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: () => new Response('<html><body>Bad gateway</body></html>', { status: 200 }) } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [] });
    resetOfficialAlertsCache();
    vi.restoreAllMocks();
    mockNetwork({
      place: 'lyon',
      feeds: {
        france: () => {
          throw new TypeError('fetch failed');
        },
      },
    });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [] });
  });

  it('flux sans aucun message : pas pris pour un pays calme (le flux garde l’historique, un flux vide ressemble à une panne)', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: { warnings: [] } } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', alerts: [] });
  });

  it('flux lu avec un BOM : lu normalement', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: () => new Response(`\uFEFF${JSON.stringify(calme)}`) } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'lues', alerts: [] });
  });

  it('l’instant de lecture du flux est rendu, et reste celui de la lecture tant que le cache sert', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: calme } });
    const first = await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(first.readAt).toBe(NOW.toISOString());
    vi.setSystemTime(new Date(NOW.getTime() + 3 * 60_000));
    const second = await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(second.readAt).toBe(NOW.toISOString());
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    const third = await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(third.readAt).toBe(new Date(NOW.getTime() + 6 * 60_000).toISOString());
  });

  it('un flux qui échoue n’est pas rappelé à chaque ouverture : une minute de répit, puis un nouvel essai', async () => {
    expect(FEED_RETRY_AFTER_FAILURE_MS).toBe(60_000);
    const net = mockNetwork({ place: 'lyon', feeds: { france: 503 } });
    for (let i = 0; i < 3; i += 1)
      expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles' });
    expect(net.feedCalls()).toBe(1);
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    expect(net.feedCalls()).toBe(2);
  });

  it('le flux revient une fois le répit passé : il est lu normalement', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: 503 } });
    await getOfficialAlerts({ point: POINTS.lyon, ...TRIP });
    vi.restoreAllMocks();
    mockNetwork({ place: 'lyon', feeds: { france: calme } });
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'lues' });
  });

  it('pas de lecture, pas d’heure de lecture', async () => {
    mockNetwork({ place: 'lyon', feeds: { france: 503 } });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles', readAt: null });
  });

  it('la carte qui ne répond pas ou répond n’importe quoi : indisponible, sans exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('<html>', { status: 200 }));
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles' });
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await getOfficialAlerts({ point: POINTS.lyon, ...TRIP })).toMatchObject({ status: 'indisponibles' });
  });
});
