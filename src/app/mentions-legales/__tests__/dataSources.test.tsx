import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, DataSources } from '../DataSources';

/**
 * Sources des données et licences (plan 5.3), dans le style du contrôle
 * d'OurAirports : pour chaque crédit, la source, la licence LUE sur la page
 * officielle (le 10 octobre 2026, relue le 11) et son lien sont vérifiés mot pour mot, et le
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
    // https://openfreemap.org/ (« Attribution is required », lue le 2026-10-13) : « OpenFreeMap © OpenMapTiles Data from
    // OpenStreetMap » ; Esri : « Powered by Esri » et les données (plan 1.6, `docs/compas/SERVICES-GRATUITS.md`).
    label: 'Cartes',
    says: [
      'Powered by Esri',
      'ArcGIS Location Platform',
      'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      'fond « Plan » des cartes de l’Explorer et du Compas',
    ],
    links: {
      'contributeurs OpenStreetMap': 'https://www.openstreetmap.org/copyright',
      'Powered by Esri': 'https://www.esri.com/',
      OpenFreeMap: 'https://openfreemap.org/',
      '© OpenMapTiles': 'https://www.openmaptiles.org/',
      OpenStreetMap: 'https://www.openstreetmap.org/copyright',
    },
    uses: [
      { file: 'src/components/map/engine/createMapStyle.ts', pattern: /static-map-tiles-api\.arcgis\.com/ },
      { file: 'src/components/map/engine/openFreeMap.ts', pattern: /tiles\.openfreemap\.org\/styles\/liberty/ },
      // Le texte exigé est celui que la carte affiche.
      { file: 'src/components/map/engine/openFreeMap.ts', pattern: /'OpenFreeMap © OpenMapTiles Data from OpenStreetMap'/ },
      { file: 'src/components/map/UnifiedExplorerMap.tsx', pattern: /createOpenFreeMapBasemap\(/ },
    ],
  },
  {
    // https://meteoalarm.org/en/live/page/terms-and-conditions, § 5 (relu le 2026-10-11)
    label: 'Alertes météo officielles',
    says: [
      'EUMETNET – MeteoAlarm',
      'termes équivalents',
      'Creative Commons Attribution 4.0 (CC BY 4.0)',
      'chaque alerte nomme son service national, son heure d’émission, sa période de validité et reprend son texte officiel',
      '(version du 15/03/2024)',
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
    // https://github.com/tilezen/joerd/blob/master/docs/attribution.md, « Required attribution » (relu le 2026-10-11)
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
    // https://www.geonames.org/export/ et https://download.geonames.org/export/dump/readme.txt (relus le 2026-10-11)
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
    // https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html (relu le 2026-10-11)
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
  {
    // Pages officielles lues le 2026-10-12 : chaque tarif de `engine/tolls.ts` porte la sienne.
    label: 'Péages et vignettes',
    says: [
      'Tarifs officiels des vignettes (voiture) et des péages au kilomètre (barème moyen)',
      'à vérifier avant de partir',
      'Suisse : ',
      'Autriche : ',
      'Tchéquie : ',
      'Slovaquie : ',
      'Slovénie : ',
      'Hongrie : ',
      'France : ',
      'Italie : ',
      '(lu le 12 octobre 2026)',
      'Un pays dont aucune source officielle n’a pu être lue reste « non chiffré », dit comme tel.',
    ],
    links: {
      'ch.ch, portail des autorités suisses': 'https://www.ch.ch/en/vehicles-and-traffic/how-to-behave-in-road-traffic/motorway-vignette/',
      'Office fédéral de la douane et de la sécurité des frontières (OFDF), portail Via':
        'https://www.bazg.admin.ch/fr/vignette-electronique-achat-portal-via',
      'oesterreich.gv.at, portail officiel de l’Autriche (ASFINAG), page mise à jour le 1er janvier 2026':
        'https://www.oesterreich.gv.at/en/themen/mobilitaet/kfz/10/Vignette-und-Maut/Vignette-fuer-Fahrzeuge-bis-3,5-t',
      'eDalnice, e-shop officiel de l’État tchèque': 'https://edalnice.gov.cz/en/price-list',
      'Národná diaľničná spoločnosť, eznamka.sk (vignette électronique slovaque)': 'https://eznamka.sk/sk/dialnicne-znamky/typy-a-ceny',
      'Uradni list RS n° 46/2025 (décret sur les routes à péage et le péage), Journal officiel de la Slovénie':
        'https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/2025-01-1893',
      'Nemzeti Útdíjfizetési Szolgáltató Zrt. (opérateur public), « E-matrica rendszerben alkalmazott díjak »':
        'https://nemzetiutdij.hu/api/uploads/e_matrica_arak_2026_pdf_611db0ecc1.pdf',
      'Autorité de régulation des transports, synthèse des comptes des sociétés concessionnaires d’autoroutes, exercice 2024':
        'https://www.autorite-transports.fr/wp-content/uploads/2025/12/synthese_des_comptes_sca_2024.pdf',
      'Autostrade per l’Italia, « Come si calcola il pedaggio »':
        'https://www.autostrade.it/en/servizi-al-cliente/pedaggio/come-si-calcola-il-pedaggio',
    },
    uses: [
      { file: 'src/features/compas/server/autofillActions.ts', pattern: /tripTolls\(\{/ },
      { file: 'src/features/compas/engine/travel.ts', pattern: /tollsBasis\(destination\.countryCode\)/ },
    ],
  },
  {
    // https://datacatalog.worldbank.org/public-licenses (CC BY 4.0 par défaut) et https://data.worldbank.org/summary-terms-of-use
    // (attribution « The World Bank: Nom du jeu : Source »), lus le 2026-10-12.
    label: 'Niveaux de prix des repas',
    says: [
      'The World Bank: ICP 2021',
      '(International Comparison Program)',
      'indice de niveau de prix (Monde = 100)',
      'série « Produits alimentaires et boissons non alcoolisées »',
      'année 2021',
      'mis à jour le 4 août 2024',
      'lu le 12 octobre 2026',
      'CC BY 4.0',
      'Ramené à la France = 100 et arrondi par le Compas',
    ],
    links: {
      'The World Bank: ICP 2021': 'https://api.worldbank.org/v2/sources/90',
      'CC BY 4.0': 'https://datacatalog.worldbank.org/public-licenses',
    },
    uses: [{ file: 'src/features/compas/server/autofillActions.ts', pattern: /icpFoodLevel\(anchor\.countryCode/ }],
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

describe('« Powered by Geoapify » à l’écran (plan 5.3 : seulement là où ses résultats s’affichent)', () => {
  // https://www.geoapify.com/pricing, relu le 2026-10-11 : un lien suivi « near the map or information provided by the service ».
  it('le crédit est lié aux distances mesurées par Geoapify, pas aux points d’Overpass', () => {
    const flows = read('src/features/compas/components/CompasOuFlows.tsx');
    expect(flows).toMatch(/distanceSource === 'geoapify'[\s\S]{0,300}<GeoapifyCredit \/>/);
    // « Sur place » (restos, commerces, eau…) vient d'Overpass et du catalogue OpenStreetMap.
    expect(read('src/features/compas/components/CompasSheets.tsx')).not.toContain('GeoapifyCredit');
    expect(read('src/features/compas/server/stagePoiLookup.ts')).toMatch(/poisAround[\s\S]{0,800}overpass\(buildOverpassQuery/);
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
