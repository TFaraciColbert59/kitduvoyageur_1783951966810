import type { StyleSpecification } from 'maplibre-gl';
import { MAP_COLORS } from './mapTheme';

/**
 * CHANTIER ATLAS — style MapLibre construit depuis la palette Liquid Glass.
 * Projection globe + atmosphère sage. Aucune ressource externe de glyphs/fonts.
 */

export type AtlasTileMode = 'topo' | 'osm' | 'satellite';

export const ATLAS_TILES: Record<AtlasTileMode, { tiles: string[]; attribution: string; maxzoom: number }> = {
  topo: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
    attribution: '&copy; Esri, USGS, NOAA',
    maxzoom: 19,
  },
  osm: {
    tiles: [
      'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    ],
    attribution: '&copy; OpenStreetMap contributors | OSM France',
    maxzoom: 19,
  },
  satellite: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: '&copy; Esri, Earthstar Geographics',
    maxzoom: 19,
  },
};

export function createMapStyle(mode: AtlasTileMode = 'topo'): StyleSpecification {
  // ⚠️ MapLibre v6.4.1 : un `sky` déclaré à la racine du style bloque tout le
  // pipeline de style (aucun style.load/load, sources jamais chargées).
  // L'atmosphère est donc appliquée via `map.setSky()` APRÈS le load
  // (voir UnifiedExplorerMap). Écart v6 documenté dans MISSION_LOG.
  return {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      'atlas-topo': {
        type: 'raster',
        tiles: ATLAS_TILES.topo.tiles,
        tileSize: 256,
        maxzoom: ATLAS_TILES.topo.maxzoom,
        attribution: ATLAS_TILES.topo.attribution,
      },
      'atlas-osm': {
        type: 'raster',
        tiles: ATLAS_TILES.osm.tiles,
        tileSize: 256,
        maxzoom: ATLAS_TILES.osm.maxzoom,
        attribution: ATLAS_TILES.osm.attribution,
      },
      'atlas-satellite': {
        type: 'raster',
        tiles: ATLAS_TILES.satellite.tiles,
        tileSize: 256,
        maxzoom: ATLAS_TILES.satellite.maxzoom,
        attribution: ATLAS_TILES.satellite.attribution,
      },
    },
    layers: [
      {
        id: 'atlas-background',
        type: 'background',
        paint: { 'background-color': MAP_COLORS.paper },
      },
      {
        id: 'atlas-tile-topo',
        type: 'raster',
        source: 'atlas-topo',
        layout: { visibility: mode === 'topo' ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.92 },
      },
      {
        id: 'atlas-tile-osm',
        type: 'raster',
        source: 'atlas-osm',
        layout: { visibility: mode === 'osm' ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.92 },
      },
      {
        id: 'atlas-tile-satellite',
        type: 'raster',
        source: 'atlas-satellite',
        layout: { visibility: mode === 'satellite' ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.9 },
      },
    ],
  };
}
