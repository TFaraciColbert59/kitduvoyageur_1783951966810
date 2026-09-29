/**
 * H5 — la meteo et l altitude nomment LEUR fournisseur, de la route a l ecran.
 *
 * Ce que la checklist laissait ouvert, et ce fichier ferme : `/api/weather`
 * et `/api/elevation` rendent bien un champ `provider` (commit 161560af),
 * mais PERSONNE ne le lisait. La chaine etait coupee au milieu :
 *
 *     /api/weather  ──provider──▶  (rien)  ──▶  « source inconnue »
 *
 * Le routage, lui, etait entier parce que `readRouteProvider` lit le corps
 * de la reponse et le callback remonte jusqu a `buildProvenance`. Ce fichier
 * pose le maillon manquant — la LECTURE cote moteur, dans
 * `engine/provenance.ts` — et verrouille les trois regles qui rendent cette
 * lecture honnete :
 *
 *   1. le nom vient du CORPS de la reponse, jamais du fait qu on ait appele
 *      une route donnee ;
 *   2. une reponse qui ne nomme personne (503, corps bricole, cle inconnue)
 *      ne nomme personne a l ecran non plus ;
 *   3. l'identifiant `open-meteo` designe DEUX series. C'est la route qui a
 *      repondu qui dit laquelle, donc un denivele ne peut pas afficher
 *      « Open-Meteo (previsions) ».
 *
 * La regle 3 est la plus fragile et la moins visible : `METEO_PROVIDER` et
 * `ELEVATION_PROVIDER` sont litteralement le meme objet dans
 * `dataProviders.ts`. Lire `provider.id` sans savoir quelle route a repondu
 * afficherait un credit vrai en apparence et faux dans sa precision.
 *
 * CE QUE CE FICHIER NE PROUVE PAS, et qui reste ouvert : le RACCORDEMENT
 * navigateur. `browserMeasurements.ts` ne lit toujours pas le `provider`
 * des reponses meteo et altitude, et `buildProvenance` (`ItineraryStep.tsx`)
 * laisse encore `source: null` sur le denivele. Ces deux fichiers
 * n'appartiennent pas a ce lot ; le raccordement restant est decrit ligne par
 * ligne dans le rapport, et les tests H5-S*-0x ci-dessous沉降ent la
 * fonction d affichage pour qu il n'y ait plus rien a ecrire quand le
 * raccordement sera fait.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  DATA_SOURCE_LABELS,
  SOURCE_INCONNUE,
  describeDataSource,
  elevationDataSource,
  metricDataSource,
  readMeasureProvider,
  weatherDataSource,
  type DataSourceEntry,
} from '../engine/provenance';
import { PrepDataSource } from '../components/PrepDataSource';

const mocks = vi.hoisted(() => ({
  fetchDayWeather: vi.fn(),
  elevationsAt: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/features/adventure-prep/weatherService', () => ({
  fetchDayWeather: mocks.fetchDayWeather,
}));
vi.mock('@/features/adventure-prep/routingService', () => ({
  elevationsAt: mocks.elevationsAt,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET as weatherGet } from '@/app/api/weather/route';
import { GET as elevationGet } from '@/app/api/elevation/route';

const WEATHER_OK = '?lat=45.923&lon=6.869&from=2026-09-28&to=2026-09-28';
const ELEVATION_OK = '?points=6.869,45.923;6.870,45.924';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.fetchDayWeather.mockResolvedValue([
    {
      date: '2026-09-28',
      tMaxC: 22.5,
      tMinC: 13,
      precipMm: 0,
      precipProbPct: 3,
      windMaxKmh: 7.7,
      code: 3,
      label: 'Partiellement nuageux',
    },
  ]);
  mocks.elevationsAt.mockResolvedValue([1035, 1042]);
});

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('H5-S1 — le fournisseur vient du CORPS de la reponse', () => {
  it('H5-S1a : la reponse meteo reelle nomme un identifiant connu', async () => {
    const res = await weatherGet(new NextRequest(`http://localhost/api/weather${WEATHER_OK}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(readMeasureProvider(body), 'la route ne nomme personne').toBe('open-meteo');
  });

  it('H5-S1b : la reponse altitude reelle nomme un identifiant connu', async () => {
    const res = await elevationGet(new NextRequest(`http://localhost/api/elevation${ELEVATION_OK}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(readMeasureProvider(body), 'la route ne nomme personne').toBe('open-meteo');
  });

  it('H5-S1c : une REPONSE SANS provider ne nomme personne, meme nommee par la route', () => {
    // Le corps est valide, la route est bien celle de la meteo — seule la
    // mention manque. Un `?? 'open-meteo'` passerait ce test si la route
    // n etait pas mise en cause explicitement.
    const body = { status: 'ok', days: [{ date: '2026-09-28' }] };
    expect(readMeasureProvider(body)).toBeNull();
    expect(weatherDataSource(readMeasureProvider(body))).toBeNull();
  });

  it('H5-S1d : un 503 ne nomme personne — il n y a rien a crediter', async () => {
    mocks.fetchDayWeather.mockResolvedValue(null);
    mocks.elevationsAt.mockResolvedValue(null);
    const w = await weatherGet(new NextRequest(`http://localhost/api/weather${WEATHER_OK}`));
    const e = await elevationGet(new NextRequest(`http://localhost/api/elevation${ELEVATION_OK}`));
    expect(w.status).toBe(503);
    expect(e.status).toBe(503);
    expect(readMeasureProvider(await w.json())).toBeNull();
    expect(readMeasureProvider(await e.json())).toBeNull();
  });

  it('H5-S1e : une cle inconnue ne rejoint aucun fournisseur', () => {
    expect(readMeasureProvider({ provider: { id: 'meteo-france' } })).toBeNull();
    expect(readMeasureProvider({ provider: { id: '' } })).toBeNull();
    expect(readMeasureProvider({ provider: 'open-meteo' })).toBeNull();
    expect(readMeasureProvider(null)).toBeNull();
    expect(readMeasureProvider({})).toBeNull();
  });
});

describe('H5-S2 — la route qui a repondu dit la SERIE mesuree', () => {
  it('H5-S2a : une altitude ne s affiche pas comme une prevision', () => {
    // Le piege exact : `METEO_PROVIDER` et `ELEVATION_PROVIDER` sont le
    // meme objet, donc l identifiant brut ne distingue pas les deux series.
    expect(elevationDataSource('open-meteo')).toBe('open-meteo-elevation');
    expect(weatherDataSource('open-meteo')).toBe('open-meteo');
    expect(DATA_SOURCE_LABELS[elevationDataSource('open-meteo')!]).toBe(
      'Open-Meteo (altitudes)',
    );
  });

  it('H5-S2b : sans fournisseur repondu, les deux series restent inconnues', () => {
    expect(elevationDataSource(null)).toBeNull();
    expect(weatherDataSource(null)).toBeNull();
    expect(elevationDataSource(undefined)).toBeNull();
  });

  it('H5-S2c : la distance ne recoit JAMAIS le credit des series de mesure', () => {
    // OSRM et Open-Meteo sont deux services distincts. Attribuer le second au
    // premier serait une fausse attribution, juste parce que les deux sont
    // des API publiques sans cle.
    expect(metricDataSource('distance', 'open-meteo')).toBeNull();
    expect(metricDataSource('denivele', 'open-meteo')).toBe('open-meteo-elevation');
    expect(metricDataSource('meteo', 'open-meteo')).toBe('open-meteo');
  });
});

describe('H5-S3 — une mesure absente ne recoit AUCUNE source', () => {
  it('H5-S3a : un denivele non releve ne credite pas Open-Meteo', () => {
    const line = describeDataSource({
      metric: 'denivele',
      value: null,
      unit: 'm',
      source: 'open-meteo-elevation',
    });
    expect(line).toContain('Dénivelé');
    expect(line).toContain(SOURCE_INCONNUE);
    expect(line).not.toContain('Open-Meteo');
  });

  it('H5-S3b : une meteo absente ne credite pas non plus', () => {
    const line = describeDataSource({
      metric: 'meteo',
      value: null,
      unit: '°C',
      source: 'open-meteo',
    });
    expect(line).not.toContain('Open-Meteo');
    expect(line).toContain(SOURCE_INCONNUE);
  });

  it('H5-S3c : une mesure REELLE garde son fournisseur', () => {
    const entry: DataSourceEntry = {
      metric: 'denivele',
      value: 812,
      unit: 'm',
      source: elevationDataSource(readMeasureProvider({ provider: { id: 'open-meteo' } })),
    };
    const line = describeDataSource(entry);
    expect(line).toContain('812 m');
    expect(line).toContain('Open-Meteo (altitudes)');
  });
});

describe('H5-S4 — l affichage sait nommer la serie (fonction, pas raccordement)', () => {
  it('H5-S4a : le composant rend la ligne altitude avec son vrai nom', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepDataSource, {
        entry: {
          metric: 'denivele',
          value: 812,
          unit: 'm',
          source: 'open-meteo-elevation',
        },
      }),
    );
    const text = visible(html);
    expect(text).toContain('Dénivelé');
    expect(text).toContain('812 m');
    expect(text).toContain('Open-Meteo (altitudes)');
    expect(text).not.toContain('prévisions');
  });

  it('H5-S4b : le composant rend la ligne meteo avec SA source', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepDataSource, {
        entry: { metric: 'meteo', value: 14, unit: '°C', source: 'open-meteo' },
      }),
    );
    const text = visible(html);
    expect(text).toContain('Météo');
    expect(text).toContain('Open-Meteo (prévisions)');
  });
});
