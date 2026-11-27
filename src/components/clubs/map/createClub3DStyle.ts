import {
  LngLat,
  type LayerSpecification,
  type Map as MapLibreMap,
  type SkySpecification,
  type SourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import SunCalc from 'suncalc';
import { ATLAS_TILES } from '@/components/map/engine/createMapStyle';
import {
  OPENFREEMAP_STYLE_URL,
  OFM_PREFIX,
  createFallbackCounter,
  isOpenFreeMapError,
  prepareVectorBase,
} from '@/components/map/engine/standardBase';
import type {
  Club3DBaseStyle,
  ClubOutdoorOverlayId,
  ClubOutdoorOverlaysState,
} from './clubMapTypes';

export const CLUB_GLOBE_SWITCH_ZOOM = 3.6;
export const CLUB_DEFAULT_TERRAIN_EXAGGERATION = 1.0;
export const CLUB_MAX_PITCH = 56;

export const OPENFREEMAP_LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_PLANET_URL = 'https://tiles.openfreemap.org/planet';
export const OPENFREEMAP_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export const MAPTERHORN_DEM_TILES = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const AWS_TERRAIN_DEM_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export const IGN_ORTHO_TILES =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
export const IGN_PLAN_V2_TILES =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
export const IGN_HYDRO_TILES =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=HYDROGRAPHY.HYDROGRAPHY&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

export const WAYMARKED_HIKING_TILES = 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png';
export const WAYMARKED_CYCLING_TILES = 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png';
export const WAYMARKED_MTB_TILES = 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png';
export const WAYMARKED_SLOPES_TILES = 'https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png';
export const OPENSEAMAP_SEAMARK_TILES = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

export const DEFAULT_CLUB_OUTDOOR_OVERLAYS: ClubOutdoorOverlaysState = {
  hiking: true,
  nautical: true,
  mtb: false,
  cycling: false,
  slopes: false,
};

export const CLUB_OUTDOOR_OVERLAY_OPTIONS: Array<{
  id: ClubOutdoorOverlayId;
  label: string;
  shortLabel: string;
  hint: string;
  accent: string;
}> = [
  {
    id: 'hiking',
    label: 'GR, GRP & Randonnées',
    shortLabel: 'GR & Rando',
    hint: 'Waymarked Trails · GR, GRP, PR, TMB et sentiers balisés (OSM)',
    accent: '#c2410c',
  },
  {
    id: 'nautical',
    label: 'Lacs navigables & Cours d’eau',
    shortLabel: 'Lacs & Nautique',
    hint: 'OpenSeaMap & IGN Hydrographie · lacs navigables, ports, canoë & torrents',
    accent: '#0369a1',
  },
  {
    id: 'mtb',
    label: 'Sentiers VTT',
    shortLabel: 'VTT',
    hint: 'Waymarked Trails MTB · singles et parcours VTT balisés (OSM)',
    accent: '#7c3aed',
  },
  {
    id: 'cycling',
    label: 'Véloroutes & Voies vertes',
    shortLabel: 'Vélo',
    hint: 'Waymarked Trails Cycling · EuroVelo, cols et véloroutes (OSM)',
    accent: '#0f766e',
  },
  {
    id: 'slopes',
    label: 'Ski & Pistes hivernales',
    shortLabel: 'Ski & Pistes',
    hint: 'Waymarked Trails Slopes · pistes alpines, nordiques et ski de rando',
    accent: '#2563eb',
  },
];

export const CLUB_3D_STYLE_OPTIONS: Array<{
  id: Club3DBaseStyle;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  { id: 'topo3d', label: 'Topo 3D', shortLabel: 'Topo 3D', hint: 'OpenFreeMap + Refuges 3D' },
  { id: 'ign-ortho', label: 'IGN Photo', shortLabel: 'Ortho 20cm', hint: 'Orthophotos IGN 20 cm' },
  { id: 'ign-topo', label: 'IGN Plan', shortLabel: 'Plan IGN', hint: 'Plan IGN v2 drapé 3D' },
  { id: 'dusk', label: 'Alpenglow', shortLabel: 'Crépuscule', hint: 'Relief crépusculaire 3D' },
];

export const CLUB_SOURCE_IDS = {
  worldFallback: 'club-world-fallback',
  openMapTiles: 'club-openmaptiles',
  ignOrtho: 'club-ign-ortho',
  ignTopo: 'club-ign-topo',
  ignHydro: 'club-ign-hydro',
  waymarkedHiking: 'club-waymarked-hiking',
  waymarkedCycling: 'club-waymarked-cycling',
  waymarkedMtb: 'club-waymarked-mtb',
  waymarkedSlopes: 'club-waymarked-slopes',
  openSeaMap: 'club-openseamap-seamark',
  demTerrainPrimary: 'club-dem-terrain',
  demHillshadePrimary: 'club-dem-hillshade',
  demTerrainAws: 'club-dem-terrain-aws',
  demHillshadeAws: 'club-dem-hillshade-aws',
} as const;

export const CLUB_OUTDOOR_LAYER_IDS = {
  hiking: 'club-overlay-waymarked-hiking',
  nauticalHydro: 'club-overlay-ign-hydro',
  nauticalSeamark: 'club-overlay-openseamap',
  mtb: 'club-overlay-waymarked-mtb',
  cycling: 'club-overlay-waymarked-cycling',
  slopes: 'club-overlay-waymarked-slopes',
} as const;

export const CLUB_BASE_LAYER_IDS = {
  background: 'club-background',
  worldFallback: 'club-world-fallback-layer',
  ignOrtho: 'club-ign-ortho-layer',
  ignTopo: 'club-ign-topo-layer',
  hillshade: 'club-hillshade-layer',
  buildings3D: 'club-3d-buildings',
  alpinePeaks: 'club-alpine-peaks',
} as const;

const VECTOR_LAYER_IDS = [
  'club-vec-land-wood',
  'club-vec-land-grass',
  'club-vec-land-glacier',
  'club-vec-land-rock',
  'club-vec-park',
  'club-vec-water',
  'club-vec-waterway',
  'club-vec-boundary',
  'club-vec-road-path',
  'club-vec-road-minor',
  'club-vec-road-major',
] as const;

export type ClubDemProvider = 'mapterhorn' | 'aws';

export function getClubBaseAttribution(
  mode: Club3DBaseStyle,
  dem: ClubDemProvider,
  overlays?: Partial<ClubOutdoorOverlaysState>,
): string {
  const relief = dem === 'mapterhorn' ? 'Mapterhorn LiDAR' : 'AWS Terrain';
  const base =
    mode === 'ign-ortho'
      ? `IGN Orthophotos 20 cm · ${relief} · © Esri`
      : mode === 'ign-topo'
        ? `Plan IGN v2 (Etalab 2.0) · ${relief}`
        : `OpenFreeMap © OpenStreetMap · ${relief}`;
  const active = overlays ?? DEFAULT_CLUB_OUTDOOR_OVERLAYS;
  const extras: string[] = [];
  if (active.hiking || active.mtb || active.cycling || active.slopes) {
    extras.push('Waymarked Trails');
  }
  if (active.nautical) {
    extras.push('OpenSeaMap · IGN Hydro');
  }
  return extras.length > 0 ? `${base} · ${extras.join(' · ')}` : base;
}

export function createClub3DStyle(
  mode: Club3DBaseStyle = 'topo3d',
  options: {
    projection?: 'globe' | 'mercator';
    isOutdoor?: boolean;
    overlays?: Partial<ClubOutdoorOverlaysState>;
  } = {},
): StyleSpecification {
  const { projection = 'mercator', isOutdoor = false } = options;
  const overlays: ClubOutdoorOverlaysState = {
    ...DEFAULT_CLUB_OUTDOOR_OVERLAYS,
    ...(options.overlays ?? {}),
  };
  const isVectorStyle = mode === 'topo3d' || mode === 'dusk';
  const isDusk = mode === 'dusk';

  const sources: Record<string, SourceSpecification> = {
    [CLUB_SOURCE_IDS.worldFallback]: {
      type: 'raster',
      tiles: mode === 'ign-ortho' ? ATLAS_TILES.satellite.tiles : ATLAS_TILES.topo.tiles,
      tileSize: mode === 'ign-ortho' ? ATLAS_TILES.satellite.tileSize : ATLAS_TILES.topo.tileSize,
      maxzoom: 19,
      attribution: ATLAS_TILES.topo.attribution,
    },
    [CLUB_SOURCE_IDS.openMapTiles]: {
      type: 'vector',
      url: OPENFREEMAP_PLANET_URL,
    },
    [CLUB_SOURCE_IDS.ignOrtho]: {
      type: 'raster',
      tiles: [IGN_ORTHO_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© IGN Géoplateforme (Etalab 2.0)',
    },
    [CLUB_SOURCE_IDS.ignTopo]: {
      type: 'raster',
      tiles: [IGN_PLAN_V2_TILES],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© IGN Géoplateforme (Etalab 2.0)',
    },
    [CLUB_SOURCE_IDS.ignHydro]: {
      type: 'raster',
      tiles: [IGN_HYDRO_TILES],
      tileSize: 256,
      minzoom: 9,
      maxzoom: 18,
      attribution: '© IGN Hydrographie (Etalab 2.0)',
    },
    [CLUB_SOURCE_IDS.waymarkedHiking]: {
      type: 'raster',
      tiles: [WAYMARKED_HIKING_TILES],
      tileSize: 256,
      minzoom: 10,
      maxzoom: 18,
      attribution: '© Waymarked Trails · OpenStreetMap (ODbL)',
    },
    [CLUB_SOURCE_IDS.waymarkedCycling]: {
      type: 'raster',
      tiles: [WAYMARKED_CYCLING_TILES],
      tileSize: 256,
      minzoom: 10,
      maxzoom: 18,
      attribution: '© Waymarked Trails Cycling · OpenStreetMap',
    },
    [CLUB_SOURCE_IDS.waymarkedMtb]: {
      type: 'raster',
      tiles: [WAYMARKED_MTB_TILES],
      tileSize: 256,
      minzoom: 10,
      maxzoom: 18,
      attribution: '© Waymarked Trails MTB · OpenStreetMap',
    },
    [CLUB_SOURCE_IDS.waymarkedSlopes]: {
      type: 'raster',
      tiles: [WAYMARKED_SLOPES_TILES],
      tileSize: 256,
      minzoom: 10,
      maxzoom: 18,
      attribution: '© Waymarked Trails Slopes · OpenStreetMap',
    },
    [CLUB_SOURCE_IDS.openSeaMap]: {
      type: 'raster',
      tiles: [OPENSEAMAP_SEAMARK_TILES],
      tileSize: 256,
      minzoom: 11,
      maxzoom: 18,
      attribution: '© OpenSeaMap contributors',
    },
    [CLUB_SOURCE_IDS.demTerrainPrimary]: {
      type: 'raster-dem',
      tiles: [MAPTERHORN_DEM_TILES],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 13,
      attribution: 'Mapterhorn Open DEM',
    },
    [CLUB_SOURCE_IDS.demHillshadePrimary]: {
      type: 'raster-dem',
      tiles: [MAPTERHORN_DEM_TILES],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 12,
    },
  };

  const vecVis = isVectorStyle ? 'visible' : 'none';
  const contrastBoost = isOutdoor ? 0.16 : 0;

  const layers: LayerSpecification[] = [
    {
      id: CLUB_BASE_LAYER_IDS.background,
      type: 'background',
      paint: {
        'background-color': isDusk ? '#1f2f46' : mode === 'ign-ortho' ? '#101a16' : '#ecf1e8',
      },
    },
    {
      id: CLUB_BASE_LAYER_IDS.worldFallback,
      type: 'raster',
      source: CLUB_SOURCE_IDS.worldFallback,
      layout: { visibility: !isVectorStyle || isDusk ? 'visible' : 'none' },
      paint: {
        'raster-opacity': isDusk ? 0.44 : mode === 'ign-ortho' ? 0.92 : 0.85,
        'raster-brightness-max': isDusk ? 0.66 : 1,
        'raster-saturation': isDusk ? -0.25 : 0,
        'raster-fade-duration': 180,
        'raster-contrast': isOutdoor ? 0.22 : 0.05,
      },
    },
    {
      id: 'club-vec-land-wood',
      type: 'fill',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]],
      layout: { visibility: vecVis },
      paint: {
        'fill-color': isDusk ? '#162923' : '#cfe0c8',
        'fill-opacity': 0.85,
      },
    },
    {
      id: 'club-vec-land-grass',
      type: 'fill',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'meadow']]],
      layout: { visibility: vecVis },
      paint: {
        'fill-color': isDusk ? '#1b2b29' : '#dde9d3',
        'fill-opacity': 0.72,
      },
    },
    {
      id: 'club-vec-land-rock',
      type: 'fill',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['rock', 'bare_rock', 'scree']]],
      layout: { visibility: vecVis },
      paint: {
        'fill-color': isDusk ? '#262f40' : '#dfddd5',
        'fill-opacity': 0.78,
      },
    },
    {
      id: 'club-vec-land-glacier',
      type: 'fill',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['ice', 'glacier', 'snow']]],
      layout: { visibility: vecVis },
      paint: {
        'fill-color': isDusk ? '#657fa3' : '#f3f9fc',
        'fill-opacity': isDusk ? 0.65 : 0.92,
      },
    },
    {
      id: 'club-vec-park',
      type: 'fill',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'park',
      layout: { visibility: vecVis },
      paint: {
        'fill-color': isDusk ? '#173026' : '#c6ddc0',
        'fill-opacity': 0.28,
      },
    },
    {
      id: 'club-vec-water',
      type: 'fill',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'water',
      layout: { visibility: vecVis },
      paint: {
        'fill-color': isDusk ? '#102840' : '#96c4dc',
        'fill-opacity': 0.94,
      },
    },
    {
      id: 'club-vec-waterway',
      type: 'line',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'waterway',
      layout: { visibility: vecVis, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDusk ? '#2b557a' : '#79b2d0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 14, 2.2] as never,
      },
    },
    {
      id: CLUB_BASE_LAYER_IDS.ignOrtho,
      type: 'raster',
      source: CLUB_SOURCE_IDS.ignOrtho,
      layout: { visibility: mode === 'ign-ortho' ? 'visible' : 'none' },
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 180,
        'raster-contrast': isOutdoor ? 0.24 : 0.12,
        'raster-saturation': 0.06,
      },
    },
    {
      id: CLUB_BASE_LAYER_IDS.ignTopo,
      type: 'raster',
      source: CLUB_SOURCE_IDS.ignTopo,
      layout: { visibility: mode === 'ign-topo' ? 'visible' : 'none' },
      paint: {
        'raster-opacity': 0.96,
        'raster-fade-duration': 180,
        'raster-contrast': isOutdoor ? 0.22 : 0.08,
      },
    },
    {
      id: CLUB_BASE_LAYER_IDS.hillshade,
      type: 'hillshade',
      source: CLUB_SOURCE_IDS.demHillshadePrimary,
      paint: {
        'hillshade-exaggeration': Math.min(0.95, (isDusk ? 0.78 : mode === 'ign-ortho' ? 0.26 : 0.46) + contrastBoost),
        'hillshade-shadow-color': isDusk ? '#0a1022' : '#1b3428',
        'hillshade-highlight-color': isDusk ? '#ff9e64' : '#fffdf4',
        'hillshade-accent-color': isDusk ? '#ff5533' : '#5b7f55',
        'hillshade-illumination-direction': isDusk ? 260 : 315,
      },
    },
    {
      id: 'club-vec-boundary',
      type: 'line',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      layout: { visibility: vecVis },
      paint: {
        'line-color': isDusk ? 'rgba(176, 198, 232, 0.35)' : 'rgba(23, 64, 44, 0.28)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.9, 8, 1.8] as never,
        'line-dasharray': [4, 2],
      },
    },
    {
      id: 'club-vec-road-path',
      type: 'line',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      layout: { visibility: vecVis, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDusk ? '#7a6856' : '#8b6f50',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 1.8] as never,
        'line-dasharray': [2.5, 2],
        'line-opacity': 0.75,
      },
    },
    {
      id: 'club-vec-road-minor',
      type: 'line',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'transportation',
      minzoom: 10,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
      layout: { visibility: vecVis, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDusk ? '#3d4a60' : '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 15, 3.0] as never,
        'line-opacity': 0.85,
      },
    },
    {
      id: 'club-vec-road-major',
      type: 'line',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      layout: { visibility: vecVis, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDusk ? '#556582' : '#f4ecd8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 14, 4.2] as never,
        'line-opacity': 0.9,
      },
    },
    {
      id: CLUB_OUTDOOR_LAYER_IDS.nauticalHydro,
      type: 'raster',
      source: CLUB_SOURCE_IDS.ignHydro,
      minzoom: 9.5,
      layout: { visibility: overlays.nautical ? 'visible' : 'none' },
      paint: {
        'raster-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9.5,
          0,
          11,
          isDusk ? 0.18 : 0.22,
          13,
          isDusk ? 0.28 : 0.32,
          15,
          isDusk ? 0.36 : 0.42,
        ] as never,
        'raster-saturation': -0.45,
        'raster-contrast': -0.14,
        'raster-fade-duration': 220,
      },
    },
    {
      id: CLUB_OUTDOOR_LAYER_IDS.nauticalSeamark,
      type: 'raster',
      source: CLUB_SOURCE_IDS.openSeaMap,
      minzoom: 11.5,
      layout: { visibility: overlays.nautical ? 'visible' : 'none' },
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0, 12.5, 0.42, 14.5, 0.58] as never,
        'raster-saturation': -0.35,
        'raster-fade-duration': 220,
      },
    },
    {
      id: CLUB_OUTDOOR_LAYER_IDS.hiking,
      type: 'raster',
      source: CLUB_SOURCE_IDS.waymarkedHiking,
      minzoom: 10,
      layout: { visibility: overlays.hiking ? 'visible' : 'none' },
      paint: {
        'raster-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          0,
          11.5,
          isDusk ? 0.2 : 0.22,
          13.5,
          isDusk ? 0.3 : 0.34,
          15.5,
          isDusk ? 0.4 : 0.44,
        ] as never,
        'raster-saturation': -0.66,
        'raster-contrast': -0.22,
        'raster-brightness-min': isDusk ? 0 : 0.08,
        'raster-fade-duration': 220,
      },
    },
    {
      id: CLUB_OUTDOOR_LAYER_IDS.mtb,
      type: 'raster',
      source: CLUB_SOURCE_IDS.waymarkedMtb,
      minzoom: 10,
      layout: { visibility: overlays.mtb ? 'visible' : 'none' },
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.5, 0.22, 13.5, 0.34, 15.5, 0.44] as never,
        'raster-saturation': -0.62,
        'raster-contrast': -0.2,
        'raster-brightness-min': isDusk ? 0 : 0.06,
        'raster-fade-duration': 220,
      },
    },
    {
      id: CLUB_OUTDOOR_LAYER_IDS.cycling,
      type: 'raster',
      source: CLUB_SOURCE_IDS.waymarkedCycling,
      minzoom: 10,
      layout: { visibility: overlays.cycling ? 'visible' : 'none' },
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.5, 0.22, 13.5, 0.34, 15.5, 0.44] as never,
        'raster-saturation': -0.62,
        'raster-contrast': -0.2,
        'raster-brightness-min': isDusk ? 0 : 0.06,
        'raster-fade-duration': 220,
      },
    },
    {
      id: CLUB_OUTDOOR_LAYER_IDS.slopes,
      type: 'raster',
      source: CLUB_SOURCE_IDS.waymarkedSlopes,
      minzoom: 10,
      layout: { visibility: overlays.slopes ? 'visible' : 'none' },
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.5, 0.22, 13.5, 0.34, 15.5, 0.44] as never,
        'raster-saturation': -0.62,
        'raster-contrast': -0.2,
        'raster-brightness-min': isDusk ? 0 : 0.06,
        'raster-fade-duration': 220,
      },
    },
    {
      id: CLUB_BASE_LAYER_IDS.buildings3D,
      type: 'fill-extrusion',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'building',
      minzoom: 14.5,
      layout: { visibility: mode === 'ign-topo' ? 'none' : 'visible' },
      paint: {
        'fill-extrusion-color': isDusk ? '#4a556e' : '#d8cbb8',
        'fill-extrusion-height': ['min', 16, ['coalesce', ['get', 'render_height'], 8]] as never,
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] as never,
        'fill-extrusion-opacity': mode === 'ign-ortho' ? 0.45 : 0.62,
      },
    },
    {
      id: CLUB_BASE_LAYER_IDS.alpinePeaks,
      type: 'symbol',
      source: CLUB_SOURCE_IDS.openMapTiles,
      'source-layer': 'mountain_peak',
      minzoom: 9,
      layout: {
        'text-field': [
          'case',
          ['has', 'ele'],
          ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'ele']], ' m'],
          ['get', 'name'],
        ] as never,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 12.5] as never,
        'text-anchor': 'center',
        'text-max-width': 8,
        'text-optional': true,
      },
      paint: {
        'text-color': isDusk || mode === 'ign-ortho' ? '#f8fafc' : '#17402c',
        'text-halo-color':
          isDusk || mode === 'ign-ortho'
            ? 'rgba(11, 18, 32, 0.88)'
            : 'rgba(255, 255, 255, 0.92)',
        'text-halo-width': isOutdoor ? 2.2 : 1.5,
      },
    },
  ];

  // ⚠️ MapLibre v6.4.1 : `sky` dans le style racine bloque le pipeline ; on applique `setSky` après `style.load`.
  return {
    version: 8,
    projection: { type: projection },
    glyphs: OPENFREEMAP_GLYPHS_URL,
    sources,
    layers,
  };
}

export function clubSkyForMode(mode: Club3DBaseStyle): SkySpecification {
  if (mode === 'dusk') {
    return {
      'sky-color': '#18223f',
      'horizon-color': '#e77a54',
      'fog-color': '#27314d',
      'sky-horizon-blend': 0.65,
      'horizon-fog-blend': 0.55,
      'fog-ground-blend': 0.72,
      'atmosphere-blend': 0.95,
    };
  }
  return {
    'sky-color': '#79a8d2',
    'horizon-color': '#e4efe5',
    'fog-color': '#ecf2ea',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.55,
    'fog-ground-blend': 0.7,
    'atmosphere-blend': 0.9,
  };
}

export interface SolarHillshadeState {
  direction: number;
  altitudeDeg: number;
  exaggeration: number;
  highlightColor: string;
  shadowColor: string;
  accentColor: string;
}

/**
 * Calcule l'illumination du relief 3D selon l'heure solaire (`suncalc`, 06h–21h).
 */
export function computeSolarHillshade(
  hourDecimal: number,
  lat: number,
  lng: number,
  mode: Club3DBaseStyle,
  isOutdoor = false,
): SolarHillshadeState {
  const safeLat = Number.isFinite(lat) ? lat : 45.5;
  const safeLng = Number.isFinite(lng) ? lng : 6.4;
  const clampedHour = Math.max(5, Math.min(22, Number.isFinite(hourDecimal) ? hourDecimal : 13));
  const now = new Date();
  const wholeHours = Math.floor(clampedHour);
  const mins = Math.round((clampedHour - wholeHours) * 60);
  const sampleDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), wholeHours, mins, 0);

  const pos = SunCalc.getPosition(sampleDate, safeLat, safeLng);
  // SunCalc azimuth : radians horaires depuis le Sud ; MapLibre : degrés horaires depuis le Nord.
  const degFromNorth = (((pos.azimuth * 180) / Math.PI + 180) % 360 + 360) % 360;
  const altitudeDeg = (pos.altitude * 180) / Math.PI;

  const isLowSun = altitudeDeg < 22 || mode === 'dusk';
  const baseExag = mode === 'dusk' ? 0.96 : mode === 'ign-ortho' ? 0.84 : 0.9;
  const lowSunBoost = isLowSun ? 0.08 : 0;
  const outdoorBoost = isOutdoor ? 0.04 : 0;

  return {
    direction: Math.round(degFromNorth),
    altitudeDeg: Number(altitudeDeg.toFixed(1)),
    exaggeration: Math.min(0.99, baseExag + lowSunBoost + outdoorBoost),
    highlightColor: isLowSun ? '#ffba6b' : '#fff1b8',
    shadowColor: isLowSun ? '#06102b' : '#0a1e4a',
    accentColor: isLowSun ? '#d95d39' : '#1f427a',
  };
}

/**
 * Bascule les sources/couches entre les 4 styles 3D instantanément sans reconstruire la carte.
 */
export function applyClub3DStyleMode(
  map: MapLibreMap,
  mode: Club3DBaseStyle,
  options: { isOutdoor?: boolean; solarHour?: number | null; center?: [number, number] } = {},
): void {
  if (!map.isStyleLoaded()) return;
  const { isOutdoor = false, solarHour = null, center = [6.45, 45.35] } = options;
  const isVector = mode === 'topo3d' || mode === 'dusk';
  const isDusk = mode === 'dusk';

  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  };

  setVis(CLUB_BASE_LAYER_IDS.worldFallback, !isVector || isDusk);
  setVis(CLUB_BASE_LAYER_IDS.ignOrtho, mode === 'ign-ortho');
  setVis(CLUB_BASE_LAYER_IDS.ignTopo, mode === 'ign-topo');
  setVis(CLUB_BASE_LAYER_IDS.buildings3D, mode !== 'ign-topo');

  for (const layerId of VECTOR_LAYER_IDS) {
    setVis(layerId, isVector);
  }
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith(OFM_PREFIX)) {
      setVis(layer.id, mode === 'topo3d');
    }
  }

  try {
    if (map.getLayer(CLUB_BASE_LAYER_IDS.worldFallback)) {
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.worldFallback,
        'raster-opacity',
        isDusk ? 0.44 : mode === 'ign-ortho' ? 0.92 : 0.85,
      );
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.worldFallback,
        'raster-brightness-max',
        isDusk ? 0.66 : 1,
      );
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.worldFallback,
        'raster-saturation',
        isDusk ? -0.25 : 0,
      );
    }
    if (map.getLayer(CLUB_BASE_LAYER_IDS.background)) {
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.background,
        'background-color',
        isDusk ? '#1f2f46' : mode === 'ign-ortho' ? '#101a16' : '#ecf1e8',
      );
    }
    if (map.getLayer('club-vec-land-wood')) {
      map.setPaintProperty('club-vec-land-wood', 'fill-color', isDusk ? '#162923' : '#cfe0c8');
    }
    if (map.getLayer('club-vec-land-grass')) {
      map.setPaintProperty('club-vec-land-grass', 'fill-color', isDusk ? '#1b2b29' : '#dde9d3');
    }
    if (map.getLayer('club-vec-land-rock')) {
      map.setPaintProperty('club-vec-land-rock', 'fill-color', isDusk ? '#262f40' : '#dfddd5');
    }
    if (map.getLayer('club-vec-land-glacier')) {
      map.setPaintProperty('club-vec-land-glacier', 'fill-color', isDusk ? '#657fa3' : '#f3f9fc');
    }
    if (map.getLayer('club-vec-water')) {
      map.setPaintProperty('club-vec-water', 'fill-color', isDusk ? '#102840' : '#96c4dc');
    }
    if (map.getLayer(CLUB_BASE_LAYER_IDS.buildings3D)) {
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.buildings3D,
        'fill-extrusion-color',
        isDusk ? '#4a556e' : '#d8cbb8',
      );
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.buildings3D,
        'fill-extrusion-opacity',
        mode === 'ign-ortho' ? 0.56 : 0.88,
      );
    }
    if (map.getLayer(CLUB_BASE_LAYER_IDS.alpinePeaks)) {
      const darkBg = isDusk || mode === 'ign-ortho';
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.alpinePeaks,
        'text-color',
        darkBg ? '#f8fafc' : '#17402c',
      );
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.alpinePeaks,
        'text-halo-color',
        darkBg ? 'rgba(11, 18, 32, 0.88)' : 'rgba(255, 255, 255, 0.92)',
      );
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.alpinePeaks,
        'text-halo-width',
        isOutdoor ? 2.2 : 1.5,
      );
    }

    if (map.getLayer(CLUB_BASE_LAYER_IDS.hillshade)) {
      if (solarHour !== null) {
        const sun = computeSolarHillshade(solarHour, center[1], center[0], mode, isOutdoor);
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-illumination-anchor',
          'map',
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-illumination-direction',
          sun.direction,
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-exaggeration',
          sun.exaggeration,
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-highlight-color',
          sun.highlightColor,
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-shadow-color',
          sun.shadowColor,
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-accent-color',
          sun.accentColor,
        );
        try {
          map.setLight({
            anchor: 'map',
            color: sun.highlightColor,
            intensity: 0.65,
            position: [1.5, sun.direction, Math.max(15, 90 - Math.max(5, sun.altitudeDeg))],
          });
        } catch {
          // ignore if style doesn't accept setLight
        }
      } else {
        const contrastBoost = isOutdoor ? 0.16 : 0;
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-exaggeration',
          Math.min(0.95, (isDusk ? 0.78 : mode === 'ign-ortho' ? 0.26 : 0.46) + contrastBoost),
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-shadow-color',
          isDusk ? '#0a1022' : '#1b3428',
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-highlight-color',
          isDusk ? '#ff9e64' : '#fffdf4',
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-accent-color',
          isDusk ? '#ff5533' : '#5b7f55',
        );
        map.setPaintProperty(
          CLUB_BASE_LAYER_IDS.hillshade,
          'hillshade-illumination-direction',
          isDusk ? 260 : 315,
        );
      }
    }

    if (map.getLayer(CLUB_BASE_LAYER_IDS.ignOrtho)) {
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.ignOrtho,
        'raster-contrast',
        isOutdoor ? 0.24 : 0.12,
      );
    }
    if (map.getLayer(CLUB_BASE_LAYER_IDS.ignTopo)) {
      map.setPaintProperty(
        CLUB_BASE_LAYER_IDS.ignTopo,
        'raster-contrast',
        isOutdoor ? 0.22 : 0.08,
      );
    }
  } catch {
    /* certaines couches peuvent ne pas être montées */
  }

  try {
    map.setSky(clubSkyForMode(mode));
  } catch {
    /* setSky indisponible sur le rendu courant */
  }
}

/**
 * Active ou masque les calques plein-air ouverts (GR/Rando Waymarked Trails,
 * Lacs navigables OpenSeaMap + Hydrographie IGN, VTT, Vélo, Ski/Pistes) sans recharger la carte.
 */
export function applyClubOutdoorOverlays(
  map: MapLibreMap,
  overlays: ClubOutdoorOverlaysState,
): void {
  if (!map.isStyleLoaded()) return;
  const setVis = (id: string, visible: boolean) => {
    try {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    } catch {
      /* couche en cours de montage */
    }
  };
  setVis(CLUB_OUTDOOR_LAYER_IDS.hiking, overlays.hiking);
  setVis(CLUB_OUTDOOR_LAYER_IDS.nauticalHydro, overlays.nautical);
  setVis(CLUB_OUTDOOR_LAYER_IDS.nauticalSeamark, overlays.nautical);
  setVis(CLUB_OUTDOOR_LAYER_IDS.mtb, overlays.mtb);
  setVis(CLUB_OUTDOOR_LAYER_IDS.cycling, overlays.cycling);
  setVis(CLUB_OUTDOOR_LAYER_IDS.slopes, overlays.slopes);
}

/**
 * Active la bascule automatique vers AWS Terrain Tiles si Mapterhorn échoue.
 */
export function attachClubDemFallback(
  map: MapLibreMap,
  onProviderChange: (provider: ClubDemProvider) => void,
): () => void {
  let switched = false;
  let errorCount = 0;

  const switchToAws = () => {
    if (switched || !map.isStyleLoaded()) return;
    switched = true;
    try {
      if (!map.getSource(CLUB_SOURCE_IDS.demTerrainAws)) {
        map.addSource(CLUB_SOURCE_IDS.demTerrainAws, {
          type: 'raster-dem',
          tiles: [AWS_TERRAIN_DEM_TILES],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 13,
          attribution: 'Terrain Tiles (Mapzen / AWS Open Data)',
        });
      }
      if (!map.getSource(CLUB_SOURCE_IDS.demHillshadeAws)) {
        map.addSource(CLUB_SOURCE_IDS.demHillshadeAws, {
          type: 'raster-dem',
          tiles: [AWS_TERRAIN_DEM_TILES],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 13,
        });
      }
      if (map.getTerrain()) {
        map.setTerrain({
          source: CLUB_SOURCE_IDS.demTerrainAws,
          exaggeration: CLUB_DEFAULT_TERRAIN_EXAGGERATION,
        });
      }
      if (map.getLayer(CLUB_BASE_LAYER_IDS.hillshade)) {
        const currentPaint = {
          'hillshade-exaggeration':
            (map.getPaintProperty(CLUB_BASE_LAYER_IDS.hillshade, 'hillshade-exaggeration') as number) ??
            0.46,
          'hillshade-shadow-color':
            (map.getPaintProperty(CLUB_BASE_LAYER_IDS.hillshade, 'hillshade-shadow-color') as string) ??
            '#1b3428',
          'hillshade-highlight-color':
            (map.getPaintProperty(CLUB_BASE_LAYER_IDS.hillshade, 'hillshade-highlight-color') as string) ??
            '#fffdf4',
          'hillshade-accent-color':
            (map.getPaintProperty(CLUB_BASE_LAYER_IDS.hillshade, 'hillshade-accent-color') as string) ??
            '#5b7f55',
          'hillshade-illumination-direction':
            (map.getPaintProperty(
              CLUB_BASE_LAYER_IDS.hillshade,
              'hillshade-illumination-direction',
            ) as number) ?? 315,
        };
        const beforeId = map.getLayer('club-vec-boundary') ? 'club-vec-boundary' : undefined;
        map.removeLayer(CLUB_BASE_LAYER_IDS.hillshade);
        map.addLayer(
          {
            id: CLUB_BASE_LAYER_IDS.hillshade,
            type: 'hillshade',
            source: CLUB_SOURCE_IDS.demHillshadeAws,
            paint: currentPaint,
          },
          beforeId,
        );
      }
      onProviderChange('aws');
    } catch {
      /* ignore */
    }
  };

  const onError = (ev: { sourceId?: string }) => {
    if (switched) return;
    const src = ev?.sourceId;
    if (
      src === CLUB_SOURCE_IDS.demTerrainPrimary ||
      src === CLUB_SOURCE_IDS.demHillshadePrimary
    ) {
      errorCount += 1;
      if (errorCount >= 2) switchToAws();
    }
  };

  map.on('error', onError as never);
  return () => {
    map.off('error', onError as never);
  };
}

/**
 * No-op conservé pour compatibilité : on n'injecte plus le style complet `liberty`
 * par-dessus `club-openmaptiles` afin d'éviter la double décodification WebGL et tout lag.
 */
export function attachOpenFreeMapLibertyEnhancement(
  _map: MapLibreMap,
  _isVectorActive: () => boolean,
): () => void {
  void OPENFREEMAP_STYLE_URL;
  void createFallbackCounter;
  void isOpenFreeMapError;
  void prepareVectorBase;
  return () => undefined;
}

/**
 * Bascule sans couture `globe` (z < 5.5) ↔ `mercator` 3D (z >= 5.5) avec relief LiDAR.
 */
export function syncClubProjectionAndTerrain(
  map: MapLibreMap,
  zoom: number,
  demProvider: ClubDemProvider,
  styleMode: Club3DBaseStyle,
  exaggeration = CLUB_DEFAULT_TERRAIN_EXAGGERATION,
): 'globe' | 'mercator' {
  const wantGlobe = zoom < CLUB_GLOBE_SWITCH_ZOOM;
  const targetProj: 'globe' | 'mercator' = wantGlobe ? 'globe' : 'mercator';

  try {
    const currentProj = map.getProjection?.()?.type;
    if (wantGlobe) {
      if (map.getTerrain()) {
        map.setTerrain(null);
      }
      if (currentProj !== 'globe') {
        map.setProjection({ type: 'globe' });
      }
      try {
        map.setSky(clubSkyForMode(styleMode));
      } catch {
        /* ignore */
      }
    } else {
      if (currentProj !== 'mercator') {
        map.setProjection({ type: 'mercator' });
      }
      const sourceId =
        demProvider === 'aws'
          ? CLUB_SOURCE_IDS.demTerrainAws
          : CLUB_SOURCE_IDS.demTerrainPrimary;
      const currentTerrain = map.getTerrain();
      if (
        map.getSource(sourceId) &&
        (!currentTerrain ||
          currentTerrain.source !== sourceId ||
          Math.abs((currentTerrain.exaggeration ?? 1) - exaggeration) > 0.01)
      ) {
        map.setTerrain({ source: sourceId, exaggeration });
      }
    }
  } catch {
    /* ignore transient style swap */
  }

  try {
    map.setMaxPitch?.(CLUB_MAX_PITCH);
    map.dragRotate?.enable?.();
    map.touchZoomRotate?.enable?.();
    map.touchZoomRotate?.enableRotation?.();
    map.touchPitch?.enable?.();
  } catch {
    /* ignore */
  }

  return targetProj;
}

/**
 * Culling d'horizon globe : renvoie true si le point est caché derrière la courbure terrestre.
 */
export function isLngLatOccludedOnGlobe(map: MapLibreMap, lng: number, lat: number): boolean {
  if (map.getZoom() >= CLUB_GLOBE_SWITCH_ZOOM) return false;
  const transform = (
    map as unknown as { transform?: { isLocationOccluded?: (loc: LngLat) => boolean } | null }
  ).transform;
  if (!transform || typeof transform.isLocationOccluded !== 'function') return false;
  try {
    return Boolean(transform.isLocationOccluded(new LngLat(lng, lat)));
  } catch {
    return false;
  }
}
