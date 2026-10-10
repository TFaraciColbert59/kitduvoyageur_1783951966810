import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, DataSources } from '../DataSources';

/**
 * Sources des données et licences (plan 5.3), dans le style du contrôle
 * d'OurAirports : pour chaque crédit, la source, la licence LUE sur la page
 * officielle (le 10 octobre 2026) et son lien sont vérifiés mot pour mot, et le
 * code est relu pour prouver que le service est réellement utilisé — on ne
 * crédite pas ce qu'on n'emploie pas.
 */

const ROOT = path.resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

type Part = string | { text: string; href: string };
const sourceOf = (label: string) => {
  const found = DATA_SOURCES.find((s) => s.label === label);
  if (!found) throw new Error(`Crédit introuvable : ${label}`);
  return found;
};
const textOf = (parts: Part[]) => parts.map((p) => (typeof p === 'string' ? p : p.text)).join('');
const linksOf = (parts: Part[]) =>
  parts.filter((p): p is { text: string; href: string } => typeof p !== 'string');

interface Expected {
  label: string;
  /** Texte qui doit figurer, tel que lu à la source. */
  says: string[];
  /** Liens (texte du lien → adresse exacte). */
  links: Record<string, string>;
  /** Le code emploie bien ce service : fichier relu et motif attendu. */
  uses: Array<{ file: string; pattern: RegExp }>;
}

const EXPECTED: Expected[] = [
  {
    // https://meteoalarm.org/en/live/page/terms-and-conditions, § 5 (relu le 2026-10-10)
    label: 'Alertes météo officielles',
    says: [
      'EUMETNET – MeteoAlarm',
      'termes équivalents',
      'Creative Commons Attribution 4.0 (CC BY 4.0)',
      'chaque alerte nomme son service national, son heure d’émission',
    ],
    links: {
      'EUMETNET – MeteoAlarm': 'https://meteoalarm.org/en/live/',
      'Creative Commons Attribution 4.0 (CC BY 4.0)': 'https://creativecommons.org/licenses/by/4.0/',
      'conditions d’utilisation de Meteoalarm': 'https://meteoalarm.org/en/live/page/terms-and-conditions',
    },
    uses: [
      { file: 'src/features/compas/engine/meteoalarmFeeds.ts', pattern: /feeds\.meteoalarm\.org\/api\/v1\/warnings\/feeds-/ },
      { file: 'src/features/compas/server/officialAlerts.ts', pattern: /feedUrl\(feed\)/ },
    ],
  },
  {
    // https://github.com/tilezen/joerd/blob/master/docs/attribution.md, « Required attribution » (relu le 2026-10-10)
    label: 'Altitudes',
    says: [
      'Terrain Tiles',
      'Mapzen / AWS Open Data',
      'ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736',
      'Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017',
      'Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich',
      'Canada terrain data contains information licensed under the Open Government Licence – Canada',
      'Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers',
      'Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration',
      'Mexico terrain data source: INEGI, Continental relief, 2016',
      'New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved)',
      'Norway terrain data © Kartverket',
      'United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved',
      'United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey',
    ],
    links: {
      'Terrain Tiles': 'https://registry.opendata.aws/terrain-tiles/',
      'attributions exigées par la licence': 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    },
    uses: [{ file: 'src/lib/geo/terrainElevation.ts', pattern: /elevation-tiles-prod\/terrarium/ }],
  },
  {
    // https://www.geonames.org/export/ et https://download.geonames.org/export/dump/readme.txt (relus le 2026-10-10)
    label: 'Lieux habités, régions et pays',
    says: [
      'GeoNames',
      'This work is licensed under a Creative Commons Attribution 4.0 License',
      'usage commercial permis',
      'crédit à GeoNames demandé',
    ],
    links: {
      GeoNames: 'https://www.geonames.org/',
      'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
      'licence des données': 'https://download.geonames.org/export/dump/readme.txt',
    },
    uses: [
      { file: 'src/features/compas/engine/geoPlaces.ts', pattern: /GeoNames/ },
      { file: 'src/lib/geodata.ts', pattern: /GeoNames/ },
    ],
  },
  {
    // https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html (relu le 2026-10-10)
    label: 'Taux de change',
    says: [
      'Frankfurter',
      'Source: ECB statistics.',
      'sans les modifier',
      'currency-api',
      'CC0',
    ],
    links: {
      Frankfurter: 'https://frankfurter.dev/',
      BCE: 'https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html',
      'currency-api': 'https://github.com/fawazahmed0/exchange-api',
    },
    uses: [
      { file: 'src/features/compas/server/rates.ts', pattern: /api\.frankfurter\.dev\/v2\/rates/ },
      { file: 'src/features/compas/server/rates.ts', pattern: /fawazahmed0\/currency-api/ },
    ],
  },
];

describe('sources des données : chaque crédit dit ce que la source exige', () => {
  for (const exp of EXPECTED) {
    describe(exp.label, () => {
      const source = sourceOf(exp.label);
      const text = textOf(source.parts);

      it('reprend les mots exacts lus à la source', () => {
        for (const phrase of exp.says) expect(text).toContain(phrase);
      });

      it('chaque lien est cliquable et mène à la page officielle', () => {
        const links = linksOf(source.parts);
        for (const [label, href] of Object.entries(exp.links)) {
          expect(links.find((l) => l.text === label)?.href, `lien « ${label} »`).toBe(href);
        }
      });

      it('le code emploie réellement ce service (relu avant de créditer)', () => {
        for (const { file, pattern } of exp.uses) expect(read(file), file).toMatch(pattern);
      });
    });
  }
});

describe('« Powered by Geoapify »', () => {
  it('le crédit est un lien suivi vers geoapify.com dans la recherche de lieux ET le calcul d’itinéraires', () => {
    for (const label of ['Recherche de lieux', 'Calcul d’itinéraires']) {
      const link = linksOf(sourceOf(label).parts).find((l) => l.text === 'Powered by Geoapify');
      expect(link?.href, label).toBe('https://www.geoapify.com/');
    }
    const html = renderToStaticMarkup(<DataSources linkClass="lien" />);
    expect(html).not.toContain('nofollow');
    expect(html.match(/Powered by Geoapify/g)?.length).toBe(2);
  });

  it('Geoapify alimente bien les lieux et l’itinéraire', () => {
    expect(read('src/features/compas/server/geoapify.ts')).toMatch(/api\.geoapify\.com/);
    expect(read('src/features/compas/server/geoapify.ts')).toMatch(/\/v1\/geocode\/search/);
    expect(read('src/features/compas/server/geoapify.ts')).toMatch(/\/v2\/places/);
    expect(read('src/features/adventure-prep/routingService.ts')).toMatch(/api\.geoapify\.com\/v1\/routing/);
  });
});

describe('page des mentions légales', () => {
  it('toutes les adresses sont en https et lisibles', () => {
    for (const s of DATA_SOURCES) {
      for (const l of linksOf(s.parts)) {
        expect(() => new URL(l.href), `${s.label} : ${l.href}`).not.toThrow();
        expect(l.href.startsWith('https://'), `${s.label} : ${l.href}`).toBe(true);
      }
    }
  });

  it('les liens s’ouvrent dans un nouvel onglet sans fuite de référent, avec la classe de la page', () => {
    const html = renderToStaticMarkup(<DataSources linkClass="lien" />);
    expect(html).toContain('<strong>Alertes météo officielles :</strong>');
    const anchors = html.match(/<a [^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThan(20);
    for (const a of anchors) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
      expect(a).toContain('class="lien"');
    }
  });

  it('la page affiche cette section, sans la redéfinir', () => {
    const page = read('src/app/mentions-legales/page.tsx');
    expect(page).toMatch(/import \{ DataSources \} from '\.\/DataSources'/);
    expect(page).not.toMatch(/const DATA_SOURCES/);
    expect(page).toContain('<DataSources linkClass=');
  });
});
