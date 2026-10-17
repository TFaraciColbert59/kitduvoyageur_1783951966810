import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  OFM_PREFIX,
  OPENFREEMAP_CREDIT,
  OPENFREEMAP_STYLE_URL,
  baseCredits,
  createFallbackCounter,
  isOpenFreeMapError,
  markOpenFreeMapFailed,
  openFreeMapFailed,
  prepareVectorBase,
  resetOpenFreeMapFailure,
  standardProvider,
  tileVisibility,
} from '@/components/map/engine/standardBase';
import { atlasTiles } from '@/components/map/engine/createMapStyle';

/**
 * Plan 1.6 : le fond STANDARD (« Clair ») peut passer sur OpenFreeMap (vecteur, sans clé ni limite,
 * commercial autorisé), derrière l'interrupteur NEXT_PUBLIC_MAP_STANDARD, avec un repli automatique
 * et unique sur le fond ArcGIS standard. Relief et satellite ne changent pas.
 */

/** Extrait réduit du style Positron officiel (tiles.openfreemap.org/styles/positron, lu le 17 oct. 2026). */
const POSITRON = {
  version: 8,
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': 'rgb(194,200,202)' } },
    {
      id: 'airport',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'aerodrome_label',
      layout: { 'icon-image': 'airport_11', visibility: 'visible' },
    },
  ],
};

describe('interrupteur NEXT_PUBLIC_MAP_STANDARD', () => {
  it('par défaut, ArcGIS : aucun changement tant que le fond n’est pas éprouvé en production', () => {
    expect(standardProvider(undefined)).toBe('arcgis');
    expect(standardProvider('')).toBe('arcgis');
    expect(standardProvider('arcgis')).toBe('arcgis');
  });

  it('« openfreemap » l’allume ; toute autre valeur retombe sur ArcGIS', () => {
    expect(standardProvider('openfreemap')).toBe('openfreemap');
    expect(standardProvider(' OpenFreeMap ')).toBe('openfreemap');
    expect(standardProvider('mapbox')).toBe('arcgis');
  });

  it('le style est Positron d’OpenFreeMap (fond « Clair »), sans clé', () => {
    expect(OPENFREEMAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(OPENFREEMAP_STYLE_URL).not.toMatch(/key|token/i);
  });
});

describe('style OpenFreeMap posé sous les couches du site', () => {
  it('sources et couches préfixées, fond retiré (le papier du site reste), source réécrite', () => {
    const plan = prepareVectorBase(POSITRON, true);
    expect(plan).not.toBeNull();
    expect(Object.keys(plan!.sources)).toEqual([`${OFM_PREFIX}openmaptiles`]);
    expect(plan!.layers.map((l) => l.id)).toEqual([`${OFM_PREFIX}water`, `${OFM_PREFIX}airport`]);
    expect(plan!.layers.every((l) => 'source' in l && l.source === `${OFM_PREFIX}openmaptiles`)).toBe(true);
    expect(plan!.glyphs).toBe(POSITRON.glyphs);
    expect(plan!.sprite).toBe(POSITRON.sprite);
  });

  it('la visibilité suit le fond choisi', () => {
    const hidden = prepareVectorBase(POSITRON, false)!;
    expect(hidden.layers.every((l) => l.layout?.visibility === 'none')).toBe(true);
    const shown = prepareVectorBase(POSITRON, true)!;
    expect(shown.layers.every((l) => l.layout?.visibility === 'visible')).toBe(true);
  });

  it('ne modifie pas le style reçu', () => {
    const copy = JSON.parse(JSON.stringify(POSITRON));
    prepareVectorBase(copy, false);
    expect(copy).toEqual(POSITRON);
  });

  it('un style illisible ou vide : rien (le repli prend la main)', () => {
    expect(prepareVectorBase(null, true)).toBeNull();
    expect(prepareVectorBase('<html>', true)).toBeNull();
    expect(prepareVectorBase({ version: 8, sources: {}, layers: [] }, true)).toBeNull();
    expect(prepareVectorBase({ version: 8, sources: POSITRON.sources, layers: [POSITRON.layers[0]] }, true)).toBeNull();
  });

  it('n’accepte que des ressources d’OpenFreeMap (pas d’autre hôte injecté par le style)', () => {
    const other = { ...POSITRON, sources: { openmaptiles: { type: 'vector', url: 'https://evil.example/planet' } } };
    expect(prepareVectorBase(other, true)).toBeNull();
    const glyphs = { ...POSITRON, glyphs: 'https://evil.example/{fontstack}/{range}.pbf' };
    expect(prepareVectorBase(glyphs, true)!.glyphs).toBeNull();
  });
});

describe('quelle couche est visible', () => {
  it('fond « Clair » + OpenFreeMap actif : OpenFreeMap seul (aucune tuile ArcGIS standard consommée)', () => {
    expect(tileVisibility('osm', 'active')).toEqual({ arcgisOsm: false, openfreemap: true });
  });

  it('en attente, éteint ou en repli : le fond ArcGIS standard, jamais une carte blanche', () => {
    for (const state of ['off', 'pending', 'failed'] as const) {
      expect(tileVisibility('osm', state)).toEqual({ arcgisOsm: true, openfreemap: false });
    }
  });

  it('Relief et Satellite ne changent pas', () => {
    expect(tileVisibility('topo', 'active')).toEqual({ arcgisOsm: false, openfreemap: false });
    expect(tileVisibility('satellite', 'active')).toEqual({ arcgisOsm: false, openfreemap: false });
  });
});

describe('repli automatique, une seule fois', () => {
  beforeEach(() => resetOpenFreeMapFailure());

  it('seules les erreurs des sources OpenFreeMap comptent', () => {
    expect(isOpenFreeMapError({ sourceId: `${OFM_PREFIX}openmaptiles` })).toBe(true);
    expect(isOpenFreeMapError({ sourceId: 'atlas-osm' })).toBe(false);
    expect(isOpenFreeMapError({})).toBe(false);
    expect(isOpenFreeMapError(null)).toBe(false);
  });

  it('erreurs répétées : le repli se déclenche exactement une fois, puis plus rien (pas de boucle)', () => {
    const counter = createFallbackCounter(3);
    expect(counter.report()).toBe(false);
    expect(counter.report()).toBe(false);
    expect(counter.report()).toBe(true);
    expect(counter.report()).toBe(false);
    expect(counter.report()).toBe(false);
    expect(counter.tripped()).toBe(true);
  });

  it('une fois en repli, la session ne retente pas OpenFreeMap (même carte remontée)', () => {
    expect(openFreeMapFailed()).toBe(false);
    markOpenFreeMapFailed();
    expect(openFreeMapFailed()).toBe(true);
  });
});

describe('attribution sur la carte', () => {
  const arcgis = atlasTiles('cle');

  it('OpenFreeMap actif sur « Clair » : la mention exigée, complète une fois dépliée', () => {
    const c = baseCredits('osm', 'active', arcgis);
    expect(c.credits).toBe('OpenFreeMap © OpenMapTiles Data from OpenStreetMap');
    expect(c.short).toContain('OpenStreetMap');
    expect(OPENFREEMAP_CREDIT.attribution).toContain('https://openfreemap.org');
    expect(OPENFREEMAP_CREDIT.attribution).toContain('https://www.openmaptiles.org/');
    expect(OPENFREEMAP_CREDIT.attribution).toContain('https://www.openstreetmap.org/copyright');
  });

  it('en repli ou éteint : la mention ArcGIS d’aujourd’hui (« Powered by Esri »)', () => {
    for (const state of ['off', 'pending', 'failed'] as const) {
      expect(baseCredits('osm', state, arcgis).credits).toBe(arcgis.osm.credits);
    }
    expect(baseCredits('topo', 'active', arcgis).credits).toBe(arcgis.topo.credits);
  });
});

describe('branchement', () => {
  const map = readFileSync('src/components/map/UnifiedExplorerMap.tsx', 'utf8');
  it('la carte lit l’interrupteur, pose le style, se replie sur erreur et affiche le bon crédit', () => {
    expect(map).toMatch(/standardProvider\(\)/);
    expect(map).toMatch(/prepareVectorBase\(/);
    expect(map).toMatch(/isOpenFreeMapError\(/);
    expect(map).toMatch(/markOpenFreeMapFailed\(\)/);
    expect(map).toMatch(/baseCredits\(tileMode, vectorBase, ATLAS_TILES\)/);
  });

  it('la variable est lue telle quelle (Next ne l’intègre au paquet client qu’écrite en entier)', () => {
    expect(readFileSync('src/components/map/engine/standardBase.ts', 'utf8')).toContain('process.env.NEXT_PUBLIC_MAP_STANDARD');
  });

  it('hors ligne : le service worker ne met pas en cache les tuiles OpenFreeMap (lot J)', () => {
    expect(readFileSync('public/sw.js', 'utf8')).not.toContain('openfreemap');
  });

  it('la CSP (rapport) autorise tiles.openfreemap.org en connexion', () => {
    expect(readFileSync('next.config.mjs', 'utf8')).toMatch(/connect-src[^"]*https:\/\/tiles\.openfreemap\.org/);
  });
});
