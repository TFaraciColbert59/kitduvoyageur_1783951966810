import type { StyleSpecification } from 'maplibre-gl';
import { MAP_COLORS } from './mapTheme';

/**
 * CHANTIER ATLAS — style MapLibre construit depuis la palette Liquid Glass.
 * Projection globe + atmosphère sage. Aucune ressource externe de glyphs/fonts.
 */

export type AtlasTileMode = 'topo' | 'osm' | 'satellite';

interface AtlasTileSource {
  tiles: string[];
  /** Mention complète (attribution MapLibre). */
  attribution: string;
  /** Mention courte de la pastille visible sur la carte. */
  short: string;
  maxzoom: number;
  tileSize: 256 | 512;
}

/**
 * Fonds autorisés en usage commercial (plan 1.6, vérifié le 8 octobre,
 * `docs/compas/SERVICES-GRATUITS.md`) : ArcGIS Location Platform, offre
 * gratuite (2 M tuiles et 1 000 sessions par mois), avec la clé publique
 * `NEXT_PUBLIC_ARCGIS_API_KEY` restreinte aux domaines du site. « Powered by
 * Esri » et la mention des données sont obligatoires.
 */
const ARCGIS_STATIC = 'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1';
const ARCGIS_IMAGERY = 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile';
const POWERED_BY_ESRI = 'Powered by <a href="https://www.esri.com/">Esri</a>';
const OSM_COPYRIGHT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function arcgisTiles(key: string): Record<AtlasTileMode, AtlasTileSource> {
  const token = `?token=${encodeURIComponent(key)}`;
  return {
    topo: {
      tiles: [`${ARCGIS_STATIC}/arcgis/outdoor/static/tile/{z}/{y}/{x}${token}`],
      attribution: `${POWERED_BY_ESRI} | Esri, TomTom, Garmin, FAO, NOAA, USGS, ${OSM_COPYRIGHT} contributors, GIS User Community`,
      short: 'Powered by Esri · © OpenStreetMap',
      maxzoom: 19,
      tileSize: 512,
    },
    osm: {
      tiles: [`${ARCGIS_STATIC}/open/osm-style/static/tile/{z}/{y}/{x}${token}`],
      attribution: `${POWERED_BY_ESRI} | ${OSM_COPYRIGHT} contributors, Microsoft, Esri Community Maps contributors`,
      short: 'Powered by Esri · © OpenStreetMap',
      maxzoom: 19,
      tileSize: 512,
    },
    satellite: {
      tiles: [`${ARCGIS_IMAGERY}/{z}/{y}/{x}${token}`],
      attribution: `${POWERED_BY_ESRI} | Esri, Maxar, Earthstar Geographics, GIS User Community`,
      short: 'Powered by Esri · Maxar, Earthstar',
      maxzoom: 19,
      tileSize: 256,
    },
  };
}

/**
 * Sans clé (développement local, tests) : les anciens fonds publics, qui ne
 * couvrent pas un usage commercial. La production a sa clé (8 octobre).
 */
const KEYLESS_TILES: Record<AtlasTileMode, AtlasTileSource> = {
  topo: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
    attribution: '&copy; Esri, USGS, NOAA',
    short: '© Esri',
    maxzoom: 19,
    tileSize: 256,
  },
  osm: {
    tiles: [
      'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    ],
    attribution: '&copy; OpenStreetMap contributors | OSM France',
    short: '© OpenStreetMap France',
    maxzoom: 19,
    tileSize: 256,
  },
  satellite: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: '&copy; Esri, Earthstar Geographics',
    short: '© Esri',
    maxzoom: 19,
    tileSize: 256,
  },
};

/** Les fonds du site : ArcGIS avec la clé du déploiement, sinon les fonds publics. */
export function atlasTiles(key: string | undefined = process.env.NEXT_PUBLIC_ARCGIS_API_KEY): Record<AtlasTileMode, AtlasTileSource> {
  const k = key?.trim();
  return k ? arcgisTiles(k) : KEYLESS_TILES;
}

export const ATLAS_TILES = atlasTiles();

export interface CreateMapStyleOptions {
  /** Inclure les tuiles raster (défaut true). */
  withTiles?: boolean;
  /** Fond transparent (globe pays posé sur la vidéo de fond). */
  transparentBackground?: boolean;
}

export function createMapStyle(
  mode: AtlasTileMode = 'topo',
  options: CreateMapStyleOptions = {}
): StyleSpecification {
  // ⚠️ MapLibre v6.4.1 : un `sky` déclaré à la racine du style bloque tout le
  // pipeline de style (aucun style.load/load, sources jamais chargées).
  // L'atmosphère est donc appliquée via `map.setSky()` APRÈS le load
  // (voir UnifiedExplorerMap). Écart v6 documenté dans MISSION_LOG.
  const { withTiles = true, transparentBackground = false } = options;
  const sources: StyleSpecification['sources'] = {};
  const layers: StyleSpecification['layers'] = [];

  if (!transparentBackground) {
    layers.push({
      id: 'atlas-background',
      type: 'background',
      paint: { 'background-color': MAP_COLORS.paper },
    });
  }

  if (withTiles) {
    sources['atlas-topo'] = {
      type: 'raster',
      tiles: ATLAS_TILES.topo.tiles,
      tileSize: ATLAS_TILES.topo.tileSize,
      maxzoom: ATLAS_TILES.topo.maxzoom,
      attribution: ATLAS_TILES.topo.attribution,
    };
    sources['atlas-osm'] = {
      type: 'raster',
      tiles: ATLAS_TILES.osm.tiles,
      tileSize: ATLAS_TILES.osm.tileSize,
      maxzoom: ATLAS_TILES.osm.maxzoom,
      attribution: ATLAS_TILES.osm.attribution,
    };
    sources['atlas-satellite'] = {
      type: 'raster',
      tiles: ATLAS_TILES.satellite.tiles,
      tileSize: ATLAS_TILES.satellite.tileSize,
      maxzoom: ATLAS_TILES.satellite.maxzoom,
      attribution: ATLAS_TILES.satellite.attribution,
    };
    layers.push(
      {
        id: 'atlas-tile-topo',
        type: 'raster',
        source: 'atlas-topo',
        layout: { visibility: mode === 'topo' ? 'visible' : 'none' },
        // FLUIDITÉ F3 : fondu explicitement épinglé (défaut MapLibre 300 ms,
        // vérifié runtime sur 6.4.1 via scripts/atlas/verify-camera-f0.mjs).
        paint: { 'raster-opacity': 0.92, 'raster-fade-duration': 300 },
      },
      {
        id: 'atlas-tile-osm',
        type: 'raster',
        source: 'atlas-osm',
        layout: { visibility: mode === 'osm' ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.92, 'raster-fade-duration': 300 },
      },
      {
        id: 'atlas-tile-satellite',
        type: 'raster',
        source: 'atlas-satellite',
        layout: { visibility: mode === 'satellite' ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 300 },
      }
    );
  }

  return {
    version: 8,
    projection: { type: 'globe' },
    sources,
    layers,
  };
}
