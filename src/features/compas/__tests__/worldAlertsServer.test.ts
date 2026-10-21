import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', () => ({
  cached: async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('../server/locationIq', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/locationIq')>();
  return {
    ...actual,
    nominatimJson: (url: string, o: Parameters<typeof actual.nominatimJson>[1]) =>
      actual.nominatimJson(url, { ...o, sleep: async () => undefined }),
  };
});

import julian from './fixtures/nws-us-julian.json';
import boulder from './fixtures/nws-us-boulder-calm.json';
import calgary from './fixtures/eccc-ca-calgary.json';
import labrador from './fixtures/eccc-ca-labrador-calm.json';
import { getOfficialAlerts, resetOfficialAlertsCache } from '../server/officialAlerts';
import {
  WORLD_RETRY_AFTER_FAILURE_MS,
  WORLD_TTL_MS,
  resetWorldAlertsCache,
  worldAlertsEnabled,
} from '../server/worldAlerts';

/**
 * Alertes officielles hors Europe côté serveur (plan 4.9) : carte et services
 * simulés à la frontière `fetch` avec les réponses réelles du 17 oct. 2026 ;
 * aucun réseau réel. Interrupteur `COMPAS_ALERTS_WORLD`, éteint par défaut.
 */

const NOW = new Date('2026-10-17T19:20:00Z');
const TRIP = { from: '2026-10-17', to: '2026-10-18' };

const ADDRESSES: Record<string, Record<string, string>> = {
  julian: { county: 'San Diego County', state: 'California', country_code: 'us' },
  boulder: { county: 'Boulder County', state: 'Colorado', country_code: 'us' },
  calgary: { city: 'Calgary', state: 'Alberta', country_code: 'ca' },
  labrador: { state: 'Newfoundland and Labrador', country_code: 'ca' },
  tokyo: { city: 'Tokyo', country_code: 'jp' },
};
const POINTS = {
  julian: { lat: 33.08, lon: -116.6 },
  boulder: { lat: 40.01, lon: -105.27 },
  calgary: { lat: 51.045, lon: -114.06 },
  labrador: { lat: 53.25, lon: -60.45 },
  tokyo: { lat: 35.68, lon: 139.76 },
} as const;

type Reply = unknown | number | (() => Response | Promise<Response>);

function mockNetwork(place: keyof typeof ADDRESSES, reply?: Reply) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://nominatim.openstreetmap.org/reverse'))
      return new Response(JSON.stringify({ address: ADDRESSES[place] }), { status: 200 });
    if (
      !url.startsWith('https://api.weather.gov/') &&
      !url.startsWith('https://api.weather.gc.ca/')
    )
      throw new Error(`appel inattendu : ${url}`);
    if (reply === undefined) throw new Error(`service non prévu : ${url}`);
    if (typeof reply === 'number') return new Response('{"status":500}', { status: reply });
    if (typeof reply === 'function') return (reply as () => Response)();
    return new Response(JSON.stringify(reply), { status: 200 });
  });
  const serviceCalls = () => calls.filter((c) => !c.url.includes('nominatim'));
  return { calls, serviceCalls };
}

beforeEach(() => {
  resetOfficialAlertsCache();
  resetWorldAlertsCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.stubEnv('COMPAS_ALERTS_WORLD', '1');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('interrupteur COMPAS_ALERTS_WORLD', () => {
  it('éteint par défaut : États-Unis et Canada restent « non couverts », sans appel', async () => {
    for (const v of ['', '0', 'off', 'false']) {
      vi.stubEnv('COMPAS_ALERTS_WORLD', v);
      expect(worldAlertsEnabled(), v).toBe(false);
      for (const place of ['julian', 'calgary'] as const) {
        vi.restoreAllMocks();
        const net = mockNetwork(place, julian);
        const r = await getOfficialAlerts({ point: POINTS[place], ...TRIP });
        expect(r, `${v} ${place}`).toEqual({
          status: 'non_couvert',
          alerts: [],
          area: null,
          readAt: null,
        });
        expect(net.serviceCalls()).toHaveLength(0);
      }
    }
    for (const v of ['1', 'on', 'true', ' ON ']) {
      vi.stubEnv('COMPAS_ALERTS_WORLD', v);
      expect(worldAlertsEnabled(), v).toBe(true);
    }
  });

  it('allumé, hors Europe, États-Unis et Canada : toujours « non couvert »', async () => {
    const net = mockNetwork('tokyo', julian);
    expect(await getOfficialAlerts({ point: POINTS.tokyo, ...TRIP })).toEqual({
      status: 'non_couvert',
      alerts: [],
      area: null,
      readAt: null,
    });
    expect(net.serviceCalls()).toHaveLength(0);
  });
});

describe('États-Unis — NWS', () => {
  it('alerte lue au point, User-Agent de l’application, service nommé', async () => {
    const net = mockNetwork('julian', julian);
    const r = await getOfficialAlerts({
      point: POINTS.julian,
      ...TRIP,
      timeZone: 'America/Los_Angeles',
    });
    expect(r.status).toBe('lues');
    expect(r.service).toBe('nws');
    expect(r.readAt).toBe(NOW.toISOString());
    expect(r.area).toBe('San Diego County Mountains');
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]).toMatchObject({
      level: 'orange',
      source: 'National Weather Service (NWS San Diego CA)',
    });
    const call = net.serviceCalls()[0];
    expect(call.url).toBe('https://api.weather.gov/alerts/active?point=33.08,-116.6');
    const headers = call.init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^kitduvoyageur\/1\.0 \(/);
    expect(headers.Accept).toBe('application/geo+json');
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('point calme : « lues », aucune alerte', async () => {
    mockNetwork('boulder', boulder);
    expect(await getOfficialAlerts({ point: POINTS.boulder, ...TRIP })).toMatchObject({
      status: 'lues',
      alerts: [],
      service: 'nws',
    });
  });

  it('CONTRE-EXEMPLE — panne, erreur 4xx/5xx, corps illisible ou délai dépassé : « indisponibles », jamais « aucune alerte »', async () => {
    const replies: Reply[] = [
      503,
      400,
      () => new Response('<html>Bad gateway</html>', { status: 200 }),
      () => Promise.reject(new TypeError('fetch failed')),
      () => Promise.reject(new DOMException('timeout', 'TimeoutError')),
      { title: 'Invalid Parameter' },
    ];
    for (const reply of replies) {
      resetWorldAlertsCache();
      vi.restoreAllMocks();
      mockNetwork('julian', reply);
      const r = await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
      expect(r).toMatchObject({ status: 'indisponibles', alerts: [], readAt: null });
    }
  });

  it('départ au-delà du lendemain : « pas encore publiées », sans appel au service', async () => {
    const net = mockNetwork('julian', julian);
    const r = await getOfficialAlerts({
      point: POINTS.julian,
      from: '2026-10-25',
      to: '2026-10-27',
    });
    expect(r.status).toBe('pas_encore_publiees');
    expect(net.serviceCalls()).toHaveLength(0);
  });

  it('cache : relu après 5 minutes, et un échec n’est pas rappelé avant une minute', async () => {
    const net = mockNetwork('julian', julian);
    await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
    await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
    expect(net.serviceCalls()).toHaveLength(1);
    vi.setSystemTime(NOW.getTime() + WORLD_TTL_MS + 1000);
    await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
    expect(net.serviceCalls()).toHaveLength(2);

    resetWorldAlertsCache();
    vi.restoreAllMocks();
    vi.setSystemTime(NOW);
    const failing = mockNetwork('julian', 503);
    await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
    await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
    expect(failing.serviceCalls()).toHaveLength(1);
    vi.setSystemTime(NOW.getTime() + WORLD_RETRY_AFTER_FAILURE_MS + 1000);
    await getOfficialAlerts({ point: POINTS.julian, ...TRIP });
    expect(failing.serviceCalls()).toHaveLength(2);
  });
});

describe('Canada — ECCC', () => {
  it('avertissement de Calgary lu dans la boîte du point, service nommé', async () => {
    const net = mockNetwork('calgary', calgary);
    const r = await getOfficialAlerts({
      point: POINTS.calgary,
      ...TRIP,
      timeZone: 'America/Edmonton',
    });
    expect(r).toMatchObject({ status: 'lues', service: 'eccc', area: 'City of Calgary' });
    expect(r.alerts[0]).toMatchObject({
      source: 'Environment and Climate Change Canada (ECCC)',
      level: 'jaune',
    });
    expect(net.serviceCalls()[0].url).toMatch(
      /^https:\/\/api\.weather\.gc\.ca\/collections\/weather-alerts\/items\?f=json/
    );
  });

  it('point calme : « lues », aucune alerte', async () => {
    mockNetwork('labrador', labrador);
    expect(await getOfficialAlerts({ point: POINTS.labrador, ...TRIP })).toMatchObject({
      status: 'lues',
      alerts: [],
      service: 'eccc',
    });
  });

  it('réponse tronquée sans alerte au lieu : « indisponibles », pas un calme', async () => {
    mockNetwork('labrador', { ...labrador, numberMatched: 250 });
    expect(await getOfficialAlerts({ point: POINTS.labrador, ...TRIP })).toMatchObject({
      status: 'indisponibles',
      alerts: [],
    });
  });

  it('panne : « indisponibles »', async () => {
    mockNetwork('calgary', 502);
    expect(await getOfficialAlerts({ point: POINTS.calgary, ...TRIP })).toMatchObject({
      status: 'indisponibles',
    });
  });
});
