import { describe, expect, it } from 'vitest';
import julian from './fixtures/nws-us-julian.json';
import boulder from './fixtures/nws-us-boulder-calm.json';
import calgary from './fixtures/eccc-ca-calgary.json';
import labrador from './fixtures/eccc-ca-labrador-calm.json';
import { assessDanger } from '../engine/danger';
import {
  ECCC_ATTRIBUTION,
  ECCC_SOURCE,
  nwsSource,
  WORLD_ALERT_SERVICES,
  ecccUrl,
  geoJsonCovers,
  nwsUrl,
  readEcccAlerts,
  readNwsAlerts,
  worldAlertServiceOf,
} from '../engine/worldAlerts';

/**
 * Alertes officielles hors Europe (plan 4.9) : National Weather Service (États-Unis,
 * api.weather.gov) et Environnement et Changement climatique Canada (MSC GeoMet,
 * api.weather.gc.ca, collection `weather-alerts`). Fixtures = RÉPONSES RÉELLES
 * enregistrées le 17 oct. 2026 vers 19 h 15 UTC :
 * - `nws-us-julian.json` : /alerts/active?point=33.08,-116.6 (monts de San Diego) ;
 * - `nws-us-boulder-calm.json` : /alerts/active?point=40.01,-105.27 (aucune alerte) ;
 * - `eccc-ca-calgary.json` : /collections/weather-alerts/items?f=json&limit=100&bbox=-114.07,51.04,-114.05,51.05 ;
 * - `eccc-ca-labrador-calm.json` : même requête, bbox=-60.5,53.2,-60.4,53.3 (aucune alerte).
 */

const NOW = new Date('2026-10-17T19:20:00Z');
const FETCHED = '2026-10-17T19:15:00.000Z';
const TRIP = { from: '2026-10-17', to: '2026-10-18', now: NOW, fetchedAt: FETCHED };
const CALGARY = { lat: 51.045, lon: -114.06 };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('table des services hors Europe', () => {
  it('États-Unis = NWS, Canada = ECCC, rien d’autre', () => {
    expect(WORLD_ALERT_SERVICES).toEqual({ us: 'nws', ca: 'eccc' });
  });

  it('adresses : point arrondi à 4 décimales (NWS), petite boîte autour du point (ECCC)', () => {
    expect(nwsUrl({ lat: 33.080001, lon: -116.6 })).toBe(
      'https://api.weather.gov/alerts/active?point=33.08,-116.6'
    );
    const url = new URL(ecccUrl(CALGARY));
    expect(url.origin + url.pathname).toBe(
      'https://api.weather.gc.ca/collections/weather-alerts/items'
    );
    expect(url.searchParams.get('f')).toBe('json');
    const [w, s, e, n] = url.searchParams.get('bbox')!.split(',').map(Number);
    expect(w).toBeLessThan(CALGARY.lon);
    expect(e).toBeGreaterThan(CALGARY.lon);
    expect(s).toBeLessThan(CALGARY.lat);
    expect(n).toBeGreaterThan(CALGARY.lat);
  });
});

describe('NWS — réponse réelle /alerts/active?point=', () => {
  it('l’avertissement de vent des monts de San Diego, dans la forme Meteoalarm', () => {
    const r = readNwsAlerts(julian, TRIP);
    expect(r?.knowledge).toBe('complete');
    expect(r?.alerts).toHaveLength(1);
    const a = r!.alerts[0];
    expect(a).toMatchObject({
      id: 'urn:oid:2.49.0.1.840.0.71de59e0119014674c11c4fd55baacf3380c4f86.006.1',
      source: 'National Weather Service (NWS San Diego CA)',
      sent: '2026-10-17T18:53:00.000Z',
      updatedSince: null,
      hazard: 'High Wind Warning',
      level: 'orange', // CAP « Severe »
      area: 'San Diego County Mountains',
      onset: '2026-10-17T11:53:00-07:00',
      // Fin de l'événement (`ends`), pas l'expiration du message (22 h 15).
      expires: '2026-10-18T00:00:00-07:00',
      fetchedAt: FETCHED,
      headline:
        'High Wind Warning issued October 17 at 11:53AM PDT until October 18 at 12:00AM PDT by NWS San Diego CA',
      // `web` vaut « http://www.weather.gov » : l'hôte officiel est repris en https.
      web: 'https://www.weather.gov/',
    });
    expect(a.texts).toHaveLength(1);
    expect(a.texts![0].lang).toBe('en-US');
    expect(a.texts![0].description).toContain(
      '* WHAT...East winds 15 to 25 mph with gusts up to 55 mph.'
    );
    expect(a.texts![0].instruction).toContain('People are urged to secure loose objects');
    expect(worldAlertServiceOf(a.source)).toBe('nws');
  });

  it('point sans alerte : zone lue, aucune alerte (la requête par point est la zone du lieu)', () => {
    expect(readNwsAlerts(boulder, TRIP)).toEqual({ alerts: [], knowledge: 'complete' });
  });

  it('sévérité CAP → couleur : Extreme rouge, Severe orange, le reste jaune', () => {
    const level = (severity: string) => {
      const j = clone(julian);
      j.features[0].properties.severity = severity;
      return readNwsAlerts(j, TRIP)!.alerts[0].level;
    };
    expect(level('Extreme')).toBe('rouge');
    expect(level('Severe')).toBe('orange');
    expect(level('Moderate')).toBe('jaune');
    expect(level('Minor')).toBe('jaune');
    expect(level('Unknown')).toBe('jaune');
  });

  it('message de test, d’exercice ou d’annulation : pas une alerte', () => {
    for (const patch of [{ status: 'Test' }, { status: 'Exercise' }, { messageType: 'Cancel' }]) {
      const j = clone(julian);
      Object.assign(j.features[0].properties, patch);
      expect(readNwsAlerts(j, TRIP)?.alerts, JSON.stringify(patch)).toEqual([]);
    }
  });

  it('alerte finie, ou hors des dates du voyage : écartée', () => {
    expect(
      readNwsAlerts(julian, { ...TRIP, now: new Date('2026-10-18T08:00:00Z') })?.alerts
    ).toEqual([]);
    expect(
      readNwsAlerts(julian, { ...TRIP, from: '2026-10-19', to: '2026-10-20' })?.alerts
    ).toEqual([]);
  });

  it('message illisible (sans heure d’émission) : compté, la zone n’est plus prouvée calme', () => {
    const j = clone(julian);
    (j.features[0].properties as Record<string, unknown>).sent = 'hier';
    expect(readNwsAlerts(j, TRIP)).toEqual({ alerts: [], knowledge: 'aucune' });
  });

  it('corps qui n’est pas une collection d’alertes : null (jamais « aucune alerte »)', () => {
    expect(readNwsAlerts({ title: 'Invalid Parameter', status: 400 }, TRIP)).toBeNull();
    expect(readNwsAlerts(null, TRIP)).toBeNull();
    expect(readNwsAlerts('<html>', TRIP)).toBeNull();
  });

  it('texte d’un tiers nettoyé ; adresse non https d’un autre hôte jamais reprise', () => {
    const j = clone(julian);
    const p = j.features[0].properties as Record<string, unknown>;
    p.headline = 'Alerte\u0007 ‮piégée';
    p.web = 'http://evil.example.com/';
    const a = readNwsAlerts(j, TRIP)!.alerts[0];
    expect(a.headline).toBe('Alerte piégée');
    expect(a.web).toBeUndefined();
  });
});

describe('ECCC — réponse réelle de la collection weather-alerts', () => {
  it('l’avertissement de vent de Calgary, couleur officielle, textes FR et EN', () => {
    const r = readEcccAlerts(calgary, { ...TRIP, point: CALGARY });
    expect(r?.knowledge).toBe('complete');
    expect(r?.alerts).toHaveLength(1);
    const a = r!.alerts[0];
    expect(a).toMatchObject({
      id: '655579151792187898202610170501_fea1-1961',
      source: ECCC_SOURCE,
      sent: '2026-10-17T17:32:04.625Z',
      updatedSince: null,
      hazard: 'avertissement de vent',
      level: 'jaune', // `risk_colour_en: yellow`, donné par ECCC
      area: 'City of Calgary',
      onset: '2026-10-17T17:25:00.000Z',
      expires: '2026-10-18T00:00:00.000Z',
      fetchedAt: FETCHED,
      headline: 'avertissement de vent',
      web: 'https://weather.gc.ca/',
    });
    expect(a.texts?.map((t) => t.lang)).toEqual(['fr-CA', 'en-CA']);
    expect(a.texts![0].description).toMatch(/vent/i);
    expect(a.texts![1].headline).toBe('wind warning');
    expect(worldAlertServiceOf(a.source)).toBe('eccc');
  });

  it('couleur : red → rouge, orange → orange ; bulletin sans couleur → jaune', () => {
    const level = (colour: string | null) => {
      const j = clone(calgary);
      (j.features[0].properties as Record<string, unknown>).risk_colour_en = colour;
      return readEcccAlerts(j, { ...TRIP, point: CALGARY })!.alerts[0].level;
    };
    expect(level('red')).toBe('rouge');
    expect(level('orange')).toBe('orange');
    expect(level('yellow')).toBe('jaune');
    expect(level(null)).toBe('jaune');
  });

  it('alerte « ended » : terminée, pas affichée', () => {
    const j = clone(calgary);
    (j.features[0].properties as Record<string, unknown>).status_en = 'ended';
    expect(readEcccAlerts(j, { ...TRIP, point: CALGARY })).toEqual({
      alerts: [],
      knowledge: 'complete',
    });
  });

  it('zone de la boîte qui ne contient pas le point : écartée', () => {
    const r = readEcccAlerts(calgary, { ...TRIP, point: { lat: 51.3, lon: -114.06 } });
    expect(r).toEqual({ alerts: [], knowledge: 'complete' });
  });

  it('point sans alerte : zone lue, aucune alerte', () => {
    expect(readEcccAlerts(labrador, { ...TRIP, point: { lat: 53.25, lon: -60.45 } })).toEqual({
      alerts: [],
      knowledge: 'complete',
    });
  });

  it('réponse tronquée (numberMatched > numberReturned) : on ne prouve pas le calme', () => {
    const j = clone(labrador);
    j.numberMatched = 3;
    expect(readEcccAlerts(j, { ...TRIP, point: CALGARY })).toEqual({
      alerts: [],
      knowledge: 'aucune',
    });
  });

  it('corps qui n’est pas une collection : null', () => {
    expect(readEcccAlerts({ code: 'ServerError' }, { ...TRIP, point: CALGARY })).toBeNull();
    expect(readEcccAlerts(undefined, { ...TRIP, point: CALGARY })).toBeNull();
  });

  it('attribution exigée par la licence, mot pour mot', () => {
    expect(ECCC_ATTRIBUTION).toBe('Data Source: Environment and Climate Change Canada');
  });
});

describe('contours GeoJSON', () => {
  const square = (x0: number, y0: number, x1: number, y1: number) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
  it('trou exclu, multipolygone accepté, géométrie inconnue refusée', () => {
    const holed = { type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)] };
    expect(geoJsonCovers(holed, 2, 2)).toBe(true);
    expect(geoJsonCovers(holed, 5, 5)).toBe(false);
    const multi = {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 1, 1)], [[...square(20, 20, 21, 21)]]],
    };
    expect(geoJsonCovers(multi, 20.5, 20.5)).toBe(true);
    expect(geoJsonCovers({ type: 'Point', coordinates: [1, 1] }, 1, 1)).toBe(false);
    expect(geoJsonCovers(null, 1, 1)).toBe(false);
  });
});

describe('le danger lit ces alertes comme celles de Meteoalarm', () => {
  it('source, heure d’émission, période et texte officiel voyagent avec le signal', () => {
    const alerts = readNwsAlerts(julian, TRIP)!.alerts;
    const d = assessDanger({ dayPlans: [], forecasts: [], alerts, alertsStatus: 'lues' });
    const s = d.signals.find((x) => x.id.startsWith('alert-'))!;
    expect(s.source).toBe(nwsSource('NWS San Diego CA'));
    expect(s.severity).toBe('warn');
    expect(s.label).toContain('High Wind Warning');
    expect(s.label).toContain('émise le 17 oct. 2026, 18 h 53 UTC');
    expect(s.label).toContain('valable du 17 oct. 2026, 18 h 53 UTC au 18 oct. 2026, 7 h 00 UTC');
    expect(s.official?.texts[0].lang).toBe('en-US');
  });
});
