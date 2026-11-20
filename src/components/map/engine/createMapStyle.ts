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
  /** Mention complète en texte (dépliée depuis la pastille). */
  credits: string;
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
      credits: 'Powered by Esri · Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, GIS User Community',
      maxzoom: 19,
      tileSize: 512,
    },
    osm: {
      tiles: [`${ARCGIS_STATIC}/open/osm-style/static/tile/{z}/{y}/{x}${token}`],
      attribution: `${POWERED_BY_ESRI} | ${OSM_COPYRIGHT} contributors, Microsoft, Esri Community Maps contributors`,
      short: 'Powered by Esri · © OpenStreetMap',
      credits: 'Powered by Esri · © OpenStreetMap contributors, Microsoft, Esri Community Maps contributors',
      maxzoom: 19,
      tileSize: 512,
    },
    satellite: {
      tiles: [`${ARCGIS_IMAGERY}/{z}/{y}/{x}${token}`],
      attribution: `${POWERED_BY_ESRI} | Esri, Maxar, Earthstar Geographics, GIS User Community`,
      short: 'Powered by Esri · Maxar, Earthstar',
      credits: 'Powered by Esri · Esri, Maxar, Earthstar Geographics, GIS User Community',
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
    credits: '© Esri, USGS, NOAA',
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
    credits: '© OpenStreetMap contributors · OSM France',
    maxzoom: 19,
    tileSize: 256,
  },
  satellite: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: '&copy; Esri, Earthstar Geographics',
    short: '© Esri',
    credits: '© Esri, Earthstar Geographics',
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
  /** Projection de la carte : 'globe' (défaut) ou 'mercator' (cartes 2D locales ultra-fluides). */
  projection?: 'globe' | 'mercator';
}

/**
 * Options de constructeur MapLibre optimisées pour un zoom, dézoom et déplacement
 * ultra-fluides (60/120 Hz) sur iOS tactile et desktop :
 * - conserve les tuiles en cours de chargement pendant le zoom (`cancelPendingTileRequestsWhileZooming: false`)
 * - cache élargi en mémoire (`maxTileCacheSize: 160`) pour éviter les flashs blancs au dézoom
 * - fondu rapide (`fadeDuration: 120`)
 */
export const SMOOTH_MAPLIBRE_OPTIONS = {
  fadeDuration: 120,
  maxTileCacheSize: 160,
  refreshExpiredTiles: false,
  cancelPendingTileRequestsWhileZooming: false,
} as const;

export interface SmoothMapPhysicsTarget {
  dragPan?: {
    enable?: (options?: { linearity?: number; maxSpeed?: number; deceleration?: number }) => void;
  };
  scrollZoom?: {
    setWheelZoomRate?: (wheelZoomRate: number) => void;
    setZoomRate?: (zoomRate: number) => void;
  };
  touchZoomRotate?: {
    enable?: () => void;
    disableRotation?: () => void;
  };
  touchPitch?: {
    disable?: () => void;
  };
  dragRotate?: {
    disable?: () => void;
  };
}

export interface SmoothMapPhysicsOptions {
  /** Verrouille la rotation à 2 doigts et le pitch pour un pinch-to-zoom pur et sans tremblement. */
  lockRotation?: boolean;
}

/**
 * Applique une physique de déplacement et de zoom ultra-fluide (inertie longue type iOS natif,
 * suivi immédiat du doigt, vitesse de zoom molette/trackpad x2.8, pinch-zoom stable).
 */
export function applySmoothMapPhysics(
  map: SmoothMapPhysicsTarget | null | undefined,
  options: SmoothMapPhysicsOptions = {},
): void {
  if (!map) return;
  const { lockRotation = false } = options;
  try {
    map.dragPan?.enable?.({
      linearity: 0.15,
      maxSpeed: 2400,
      deceleration: 1600,
    });
  } catch {
    map.dragPan?.enable?.();
  }
  try {
    map.scrollZoom?.setWheelZoomRate?.(1 / 160);
    map.scrollZoom?.setZoomRate?.(1 / 65);
  } catch {
    /* ignore */
  }
  try {
    map.touchZoomRotate?.enable?.();
    if (lockRotation) {
      map.touchZoomRotate?.disableRotation?.();
      map.touchPitch?.disable?.();
      map.dragRotate?.disable?.();
    }
  } catch {
    /* ignore */
  }
}

export function createMapStyle(
  mode: AtlasTileMode = 'topo',
  options: CreateMapStyleOptions = {}
): StyleSpecification {
  // ⚠️ MapLibre v6.4.1 : un `sky` déclaré à la racine du style bloque tout le
  // pipeline de style (aucun style.load/load, sources jamais chargées).
  // L'atmosphère est donc appliquée via `map.setSky()` APRÈS le load
  // (voir UnifiedExplorerMap). Écart v6 documenté dans MISSION_LOG.
  const { withTiles = true, transparentBackground = false, projection = 'globe' } = options;
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
    projection: { type: projection },
    sources,
    layers,
  };
}
