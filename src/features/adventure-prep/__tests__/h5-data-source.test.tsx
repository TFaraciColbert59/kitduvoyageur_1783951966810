/**
 * H5 — la provenance REELLE d une mesure, affichee dans l UI.
 *
 * Rappel du constat : avant ce lot, `rg "Open-Meteo|OpenStreetMap|Esri|NERC"
 * src/features/adventure-prep` ne trouvait RIEN dans l ecran. La seule ligne
 * de source presente — `resolveSourceLine` — nomme une RESERVATION
 * (« Confirmé par toi »), pas une DONNEE. Un utilisateur pouvait donc lire
 * « 14,5 km » sans savoir d ou il sortait.
 *
 * Ces tests echouent tant que l ecran ne nomme pas le fournisseur reellement
 * interroge, et tant qu une mesure sans source reste silencieuse.
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { A_VERIFIER } from '../engine/trust';
import {
  DATA_SOURCE_LABELS,
  SOURCE_INCONNUE,
  dataSourceLabel,
  describeDataSource,
  type DataSourceEntry,
} from '../engine/provenance';
import { PrepDataSource, PrepDataSourceLine } from '../components/PrepDataSource';
import {
  normalizeBrouterLegDetailed,
  normalizeOsrmRouteDetailed,
  normalizeValhallaRouteDetailed,
} from '../routingService';
import {
  browserMeasurementRunners,
  browserRoutingDeps,
} from '../browserMeasurements';
import type { RoutePoint } from '../routingService';

const srcDir = join(__dirname, '..', '..', '..');

/** Les deux points d un trajet, et la reponse que leur rendrait le serveur. */
const DEUX_POINTS: readonly RoutePoint[] = [
  { lat: 45.923, lon: 6.869 },
  { lat: 45.923, lon: 6.899 },
];

/** Reponse OSRM reelle : deux points, un troncon. */
const OSRM_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 2398.2,
      duration: 341.9,
      geometry: { type: 'LineString', coordinates: [[6.869, 45.923], [6.899, 45.923]] },
      legs: [{ distance: 2398.2, duration: 341.9 }],
    },
  ],
};

/** Reponse Valhalla reelle : `shape` encode, `summary` en metres/secondes. */
const VALHALLA_OK = {
  trip: {
    status: 0,
    legs: [
      {
        summary: { time: 200, length: 2.4 },
        shape: 'oj|qvAo_gbL?_ry@',
      },
    ],
  },
};

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function entry(overrides: Partial<DataSourceEntry> = {}): DataSourceEntry {
  return {
    metric: 'distance',
    value: 12.4,
    unit: 'km',
    source: 'osrm',
    ...overrides,
  };
}

describe('H5-1 — le vocabulaire des fournisseurs, verifie dans le code', () => {
  it('H5-1a : OSRM et Valhalla sont nommes comme des services OpenStreetMap', () => {
    // Les deux serveurs sont des services OpenStreetMap : les nommer
    // autrement laisserait croire a une source qui n existe pas.
    expect(DATA_SOURCE_LABELS.osrm).toContain('OpenStreetMap');
    expect(DATA_SOURCE_LABELS.valhalla).toContain('OpenStreetMap');
  });

  it('H5-1b : Open-Meteo est nomme, altitude et previsions separees', () => {
    expect(DATA_SOURCE_LABELS['open-meteo-elevation']).toContain('Open-Meteo');
    expect(DATA_SOURCE_LABELS['open-meteo']).toContain('Open-Meteo');
    expect(DATA_SOURCE_LABELS['open-meteo-elevation']).not.toBe(
      DATA_SOURCE_LABELS['open-meteo'],
    );
  });

  it('H5-1c : sans source identifiee, l ecran le dit', () => {
    expect(dataSourceLabel(null)).toBe(SOURCE_INCONNUE);
    expect(dataSourceLabel(undefined)).toBe(SOURCE_INCONNUE);
  });

  it('H5-1d : une source inconnue ne se confond avec aucun fournisseur', () => {
    for (const label of Object.values(DATA_SOURCE_LABELS)) {
      expect(label).not.toContain('inconnue');
    }
  });
});

describe('H5-2 — une mesure nommee par son fournisseur', () => {
  it('H5-2a : une distance mesuree porte sa valeur ET sa source', () => {
    const line = describeDataSource(entry());
    expect(line).toContain('12,4 km');
    expect(line).toContain('OpenStreetMap');
    expect(line).toContain('OSRM');
  });

  it('H5-2b : une mesure sans source le dit, sans nombre plausible', () => {
    const line = describeDataSource(entry({ source: null }));
    expect(line).toContain('12,4 km');
    expect(line).toContain(SOURCE_INCONNUE);
  });

  it('H5-2c : une mesure absente affiche le vocabulaire de confiance existant', () => {
    const line = describeDataSource(entry({ metric: 'denivele', value: null, unit: 'm', source: null }));
    // Le vocabulaire vient de `engine/trust.ts` : un seul mot pour toute
    // donnee absente, pas un second systeme parallele.
    expect(line).toContain(A_VERIFIER);
    expect(line).toContain(SOURCE_INCONNUE);
    expect(line).not.toMatch(/\d+,\d/);
  });

  it('H5-2d : chaque mesure a son propre libelle', () => {
    expect(describeDataSource(entry())).toContain('Distance');
    expect(describeDataSource(entry({ metric: 'denivele' }))).toContain('Dénivelé');
    expect(describeDataSource(entry({ metric: 'meteo', unit: '°C' }))).toContain('Météo');
  });
});

describe('H5-3 — le composant nomme la source dans l ecran', () => {
  it('H5-3a : une distance affichee nomme le fournisseur qui l a mesuree', () => {
    const html = renderToStaticMarkup(React.createElement(PrepDataSource, { entry: entry() }));
    const text = visible(html);
    expect(text).toContain('12,4 km');
    expect(text).toContain('OSRM');
  });

  it('H5-3b : sans source, le composant affiche « source inconnue »', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepDataSource, { entry: entry({ source: null }) }),
    );
    expect(visible(html)).toContain(SOURCE_INCONNUE);
  });

  it('H5-3c : la ligne se monte seule, sans le composant parent', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepDataSourceLine, {
        entry: entry({ metric: 'meteo', unit: '°C', source: 'open-meteo' }),
      }),
    );
    const text = visible(html);
    expect(text).toContain('Météo');
    expect(text).toContain('Open-Meteo');
  });

  it('H5-3d : le composant ne propose pas de bouton ni de lien', () => {
    const html = renderToStaticMarkup(React.createElement(PrepDataSource, { entry: entry() }));
    expect(html).not.toMatch(/<button/);
    expect(html).not.toMatch(/<a[\s>]/);
  });
});

describe('H5-4 — le fournisseur nomme est celui qui a REALLY repondu', () => {
  it('H5-4a : une reponse OSRM nomme OSRM', () => {
    expect(normalizeOsrmRouteDetailed(OSRM_OK, DEUX_POINTS).provider).toBe('osrm');
  });

  it('H5-4b : une reponse Valhalla nomme Valhalla', () => {
    expect(normalizeValhallaRouteDetailed(VALHALLA_OK, DEUX_POINTS).provider).toBe('valhalla');
  });

  it('H5-4c : une reponse BRouter nomme BRouter', () => {
    const payload = {
      features: [
        {
          geometry: {
            type: 'LineString',
            coordinates: [[6.869, 45.923], [6.899, 45.923]],
          },
          properties: { 'track-length': 2400, 'total-time': 200, 'filtered ascend': 120 },
        },
      ],
    };
    const from = DEUX_POINTS[0];
    const to = DEUX_POINTS[1];
    if (!from || !to) throw new Error('points de test incomplets');
    expect(normalizeBrouterLegDetailed(payload, from, to).provider).toBe('brouter');
  });

  it('H5-4d : un refus ne nomme PERSONNE — personne n a repondu', () => {
    const refuse = normalizeOsrmRouteDetailed({ code: 'NoRoute' }, DEUX_POINTS);
    expect(refuse.legs).toBeNull();
    expect(refuse.provider).toBeUndefined();
  });

  it('H5-4e : le navigateur recoit le nom que le serveur a mesure', async () => {
    const vues: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/route')) {
        return {
          ok: true,
          json: async () => ({
            status: 'ok',
            provider: 'valhalla',
            legs: [
              {
                distanceKm: 2.4,
                durationMin: 3.3,
                geometry: [
                  [6.869, 45.923],
                  [6.899, 45.923],
                ],
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const deps = browserRoutingDeps(
      fetchImpl as unknown as typeof fetch,
      (provider) => vues.push(provider),
    );
    const legs = await deps.route(
      [
        { lat: 45.923, lon: 6.869 },
        { lat: 45.923, lon: 6.899 },
      ],
      'pieton',
    );

    expect(legs).toHaveLength(1);
    expect(vues).toEqual(['valhalla']);
  });
});

describe('H5-5 — le raccordement, de la route Next a l ecran', () => {
  it('H5-5a : /api/route transmet le fournisseur dans sa reponse', () => {
    const source = readFileSync(join(srcDir, 'app', 'api', 'route', 'route.ts'), 'utf8');
    expect(source).toMatch(/provider/);
  });

  it('H5-5b : le navigateur lit le fournisseur de la reponse, il ne le devine pas', () => {
    const source = readFileSync(
      join(srcDir, 'features', 'adventure-prep', 'browserMeasurements.ts'),
      'utf8',
    );
    expect(source).toMatch(/provider/);
  });
});
