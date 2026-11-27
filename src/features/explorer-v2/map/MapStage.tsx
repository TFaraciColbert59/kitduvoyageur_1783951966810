'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import {
  addProtocol,
  Map as MapLibreMap,
  removeProtocol,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoCollection } from '../data/hooks';
import type { CameraIntent, Level, MapBaseStyle, PoiKind, Sport } from '../state/types';
import type { ExplorerMode } from '../state/hudMachine';
import type { ExplorerPresetId } from '../state/presets';
import {
  disposeNonEssentialMapLayers,
  restoreMapTileCacheBudget,
  syncUnifiedOverlayLayers,
} from './layerLifecycle';
import { registerSlopeProtocol } from './slopeProtocol';
import { registerContourProtocol } from './contourProtocol';
import {
  accentHexFor3DKind,
  createExplorerThree3DLayer,
  MAX_FLOATING_3D_ITEMS,
  normalize3DEntityKind,
  type ExplorerThree3DController,
  type Floating3DItem,
} from './explorerThree3DLayer';
import { createMapVfxEngine, type MapVfxController } from './mapVfxEngine';
import { lod3DBudgetForZoom } from '../data/spatialLoader';
import { selectBalanced3DItems } from './lod3D';
import {
  asCartoMap,
  applyExplorerBaseCartography,
  applyExplorerSky,
  applyZoomResponsiveCartography,
  findFirstSymbolAnchor,
  findHillshadeBeforeId,
  GLOBE_TO_MERCATOR_ZOOM,
  hillshadePaintForTheme,
  LABELS_SHOW_ALL_ZOOM,
  resolvePresetCartoProfile,
  syncPresetVectorCartography,
  territoryFillOpacityExpression,
  territoryLineOpacityExpression,
} from './explorerCartography';
import { registerExplorerMapSprites } from './mapSprites';
import {
  isInteractiveMapLayerId,
  pickHighestPriorityFeature,
  type MapInteractiveSelection,
  type PickableMapFeature,
} from './featurePicking';
import { clusterPins, selectVisiblePins, type PinCluster } from './hierarchy';
import { slopeGradientExpression, type SlopeLayer } from './slope';
import type { NationalTopoSource } from './nationalTopo';
import type { DistanceMarker } from './distanceMarkers';
import {
  applyExplorerSilkyPhysics,
  boundsOfTrack,
  centerAt,
  cinematicStartupZoom,
  easeCinematicOut,
  flyToLevel,
  flyoverTrack,
  focusTargetPadding,
  followAt,
  followPadding,
  orbitController,
  overviewOf,
  overviewPadding,
  revealAt,
} from './camera';
import {
  TRACE_COLOR_EXPRESSION,
  TRACE_DASH_EXPRESSION,
  TRACE_WIDTH_EXPRESSION,
  traceStyleForRoute,
} from './traceStyles';
import { OPENFREEMAP_STYLE_URL } from '@/components/map/engine/standardBase';
import {
  SMOOTH_MAPLIBRE_OPTIONS,
  applySmoothMapPhysics,
} from '@/components/map/engine/createMapStyle';
import type { SearchViewport } from '../searchArea';
import { lineStringFromSections, type RouteDraft } from '@/features/adventure-prep/routeRevision';
import type { ComputedItinerary } from '../routing/types';

export interface MapPin {
  id: string;
  kind: string;
  /** Granular `geo_pois.subtype` or `geo_places.kind` (e.g. `peak`, `saddle`, `spring`, `bus_stop`, `village`). */
  subtype?: string | null;
  name: string;
  sub?: string | null;
  lat: number;
  lon: number;
  tone?: 'ink' | 'water' | 'warn' | 'bad' | 'good';
  /** Distance au centre, utilisée par la hiérarchie d'affichage. */
  distanceKm?: number;
}

export interface MapStageProps {
  level: Level;
  center: [number, number];
  zoom: number;
  theme: 'light' | 'dark';
  countries?: GeoCollection | null;
  regions?: GeoCollection | null;
  routes?: Array<{ id: number; name: string | null; network?: string | null; geojson: unknown }>;
  pins: MapPin[];
  activityTrack?: GeoCollection | null;
  selectedId?: string | null;
  reducedMotion?: boolean;
  paused?: boolean;
  onCountryClick?: (iso: string, name: string, center: [number, number]) => void;
  onRegionClick?: (group: string, center: [number, number]) => void;
  onPinClick?: (pin: MapPin) => void;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  /** Emprise réellement visible, émise à la fin de chaque mouvement de caméra. */
  onViewportChange?: (viewport: SearchViewport) => void;
  /**
   * Cap **réel** de la carte : direction monde affichée en haut (0 = nord,
   * 90 = est). Émis pendant une rotation et à la fin d'un mouvement : la
   * flèche hors-trace doit être compensée même quand l'utilisateur tourne la
   * carte à la main.
   */
  onBearingChange?: (bearingDeg: number) => void;
  onReady?: () => void;
  me?: { lat: number; lng: number } | null;
  /** Hauteur du tiroir en pixels : aucun repère ne doit apparaître dessous. */
  sheetHeightPx?: number;
  /** Mouvement de caméra demandé par la machine d'état. */
  cameraIntent?: CameraIntent | null;
  /** Appui long sur la carte (départ d'activité). */
  longPressHandlers?: Record<string, unknown>;
  /** Fond de carte : relief 3D, satellite, plan vectoriel ou fond national. */
  mapBaseStyle?: MapBaseStyle;
  /** Source nationale officielle déjà validée pour le pays courant. */
  nationalTopo?: NationalTopoSource | null;
  /** Pente réelle de l'itinéraire sélectionné (DEM, fiche K3.04). */
  slopeLayer?: SlopeLayer | null;
  /** Marqueurs de distance dérivés de la géométrie réelle (fiche K3.12). */
  distanceMarkers?: DistanceMarker[] | null;
  /** Calques de données : sentiers, eau, refuges, etc. */
  layerVisibility?: Record<string, boolean>;
  /** Couche GeoJSON de fréquentation collective (C02). */
  communityHeatmapGeo?: GeoCollection | null;
  /** Couche GeoJSON de heatmap personnelle privée (C02). */
  personalHeatmapGeo?: GeoCollection | null;
  /** Couche GeoJSON POI vélo OSM (K3.10). */
  bikePoisGeo?: GeoCollection | null;
  /** Couche GeoJSON des lieux favoris locaux (K3.11). */
  savedPlacesGeo?: GeoCollection | null;
  /** Couche GeoJSON des feux actifs (K3.14). */
  firesGeo?: GeoCollection | null;
  /** Couche GeoJSON des revêtements de surface (K3.04). */
  surfacesGeo?: GeoCollection | null;
  /** Couche GeoJSON des highlights (K5.13). */
  highlightsGeo?: GeoCollection | null;
  /** Détour recalculé en ligne (K4.05). */
  rerouteGeometry?: GeoCollection | null;
  /** Itinéraire d'approche vers le départ ou le tracé (K4.03). */
  accessRouteGeometry?: GeoCollection | null;
  /** Emprises des paquets hors ligne installés (K4.16). */
  offlineCoverage?: GeoCollection | null;
  /** Affiche la couche couverture hors ligne sur la carte (K4.16). */
  showOfflineCoverage?: boolean;
  /** Notifie un déplacement ou une rotation manuelle de la carte par l'utilisateur (K4.06). */
  onUserPan?: (bearing: number) => void;
  /** Tracé en cours d'édition dans l'éditeur Explorer (R01). */
  plannerDraft?: RouteDraft | null;
  /** Masquage temporaire de la ligne du tracé en mode édition (K2.16). */
  plannerLineHidden?: boolean;
  /** Active le placement de point par toucher sur la carte (K2.06/K2.09). */
  plannerMapPick?: boolean;
  /** Curseur synchronisé entre le profil altimétrique et la carte (R02). */
  profileCursor?: { lon: number; lat: number; distanceM: number; elevationM: number | null } | null;
  /** Segment de montée/descente sélectionné sur le profil pour surbrillance (K2.20). */
  highlightedSegment?: { coordinates: Array<[number, number]>; label?: string } | null;
  /** Zones de feux/brûlées (K2.23). */
  fireLayer?: GeoCollection | null;
  /** Clic sur la carte en mode placement de waypoint. */
  onMapClick?: (lngLat: [number, number]) => void;
  /** Mode FSM du HUD polymorphe (`EXPLORE` / `GPS_ACTIVE` / `SOS`). */
  explorerMode?: ExplorerMode;
  /** Pré-réglage cartographique actif (style vectoriel adaptatif). */
  activePreset?: ExplorerPresetId;
  /** Sport actif en mode GPS (conserve les calques pertinents, décharge le reste). */
  activeSport?: Sport | null;
  /** Modèle d'URL tuiles RainViewer (injecté depuis `/api/explorer/v2/radar`). */
  radarTileTemplate?: string | null;
  /** Données GeoJSON des couches unifiées (hazards, airspace, pokedex, social). */
  unifiedGeojson?: Record<string, GeoCollection | null | undefined>;
  /** Notifié si le plafond de 2 calques rasters analytiques évince un calque. */
  onUnifiedLayerEvict?: (evictedKeys: string[]) => void;
  /** Entité actuellement sélectionnée (halo circulaire + modèle 3D héroïque sur la carte). */
  selectedFeature?: {
    id: string;
    coordinates: [number, number];
    kind?: string;
    label?: string;
  } | null;
  /** Clic unifié sur une couche interactive (risque, bouteille, Pokédex, social). */
  onUnifiedFeatureClick?: (feature: MapInteractiveSelection) => void;
  /** Clic sur un itinéraire (`xp-routes-line` / `xp-routes-casing`). */
  onRouteClick?: (routeId: string, name: string | null, coordinates: [number, number]) => void;
  /** Catégorie active du tiroir pour prioriser intelligemment les objets 3D. */
  activeCategory?: string | null;
  /** Itinéraires personnalisés générés vers un POI (recommandé + alternatives). */
  poiItineraries?: ComputedItinerary[] | null;
  /** Identifiant de l'itinéraire actuellement sélectionné sur la carte. */
  selectedItineraryId?: string | null;
  /** Affiche aussi les alternatives en pointillés cliquables sur la carte. */
  showItineraryAlternatives?: boolean;
  /** Callback déclenché quand l'utilisateur clique une alternative directement sur la carte. */
  onSelectItinerary?: (id: string) => void;
  /** État temps réel d'activité carte (geste en cours, tuiles, décodage 3D GLB). */
  onMapActivityChange?: (activity: {
    isMoving: boolean;
    tilesLoading: boolean;
    glbPendingCount: number;
  }) => void;
}

const TERRAIN_SOURCE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/**
 * Écart minimal entre deux étiquettes de distance à l'écran. Sans cette
 * décimation, un kilomètre à faible zoom ferait moins de 10 px et les libellés
 * se superposeraient ; les marqueurs restent dans l'ordre de la trace.
 */
const DISTANCE_LABEL_GAP_X = 38;
const DISTANCE_LABEL_GAP_Y = 20;

const EMPTY: GeoCollection = { type: 'FeatureCollection', features: [] };

/**
 * Repères RUM de la carte, lus par `WebVitalsReporter` (MAP_FIRST_PAINT / MAP_INTERACTIVE).
 * `detail.route` permet d'écarter les navigations client : la valeur rapportée est le temps
 * depuis le début de la navigation du document.
 */
function markMap(name: 'map:first-paint' | 'map:interactive'): void {
  try {
    performance.mark(name, { detail: { route: window.location.pathname } });
  } catch {
    /* Performance API indisponible : la carte ne dépend jamais de la mesure */
  }
}

/**
 * Scène cartographique unique de l'Explorer v2 (02_ARCHITECTURE.md §4).
 * Un seul composant monte la carte ; changer de niveau ne recrée jamais la
 * carte. Projection globe aux niveaux 0–1, mercator à partir du niveau 2.
 */
const MapStage = React.memo(function MapStage({
  level,
  center,
  zoom,
  theme,
  countries,
  regions,
  routes,
  pins,
  activityTrack,
  selectedId,
  reducedMotion = false,
  paused = false,
  onCountryClick,
  onRegionClick,
  onPinClick,
  onMoveEnd,
  onViewportChange,
  onBearingChange,
  onReady,
  me,
  sheetHeightPx = 176,
  cameraIntent = null,
  longPressHandlers,
  mapBaseStyle = 'relief',
  nationalTopo = null,
  slopeLayer = null,
  distanceMarkers = null,
  layerVisibility,
  communityHeatmapGeo = null,
  personalHeatmapGeo = null,
  bikePoisGeo = null,
  savedPlacesGeo = null,
  firesGeo = null,
  surfacesGeo = null,
  highlightsGeo = null,
  rerouteGeometry = null,
  accessRouteGeometry = null,
  offlineCoverage = null,
  showOfflineCoverage = false,
  onUserPan,
  plannerDraft = null,
  plannerLineHidden = false,
  plannerMapPick = false,
  profileCursor = null,
  highlightedSegment = null,
  fireLayer = null,
  onMapClick,
  explorerMode = 'EXPLORE',
  activePreset = 'hiking',
  activeSport = null,
  radarTileTemplate = null,
  unifiedGeojson,
  onUnifiedLayerEvict,
  selectedFeature = null,
  onUnifiedFeatureClick,
  onRouteClick,
  activeCategory = 'explorer',
  poiItineraries = null,
  selectedItineraryId = null,
  showItineraryAlternatives = false,
  onSelectItinerary,
  onMapActivityChange,
}: MapStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vfxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Double garde : même si un appelant transmet une source non vérifiée, elle
  // n'est jamais chargée. Le registre reste la source de vérité.
  const nationalSource = nationalTopo?.status === 'verified' ? nationalTopo : null;
  const mapRef = useRef<MapLibreMap | null>(null);
  const three3DRef = useRef<ExplorerThree3DController | null>(null);
  const vfxRef = useRef<MapVfxController | null>(null);
  const [overlay, setOverlay] = useState<Array<{ pin: MapPin; x: number; y: number }>>([]);
  const [distanceScreen, setDistanceScreen] = useState<
    Array<{ marker: DistanceMarker; x: number; y: number }>
  >([]);
  const [clusters, setClusters] = useState<PinCluster[]>([]);
  const [meScreen, setMeScreen] = useState<{ x: number; y: number } | null>(null);
  const [hoverTip, setHoverTip] = useState<{
    x: number;
    y: number;
    title: string;
    sub?: string;
  } | null>(null);
  const lastHoverCheckRef = useRef(0);
  const [ready, setReady] = useState(false);
  const movedToRef = useRef<string>('');
  const orbitRef = useRef<number | null>(null);
  // En suivi (ou en vue d'ensemble), la caméra applique un padding : le centre
  // rendu par la carte n'est pas celui de l'état. On n'écrase donc pas l'état.
  const suppressMoveEnd = useRef(false);
  // Le callback peut changer à chaque rendu du parent ; la carte est créée une
  // seule fois, on garde donc toujours la dernière version dans une référence.
  const onBearingChangeRef = useRef(onBearingChange);
  onBearingChangeRef.current = onBearingChange;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const plannerMapPickRef = useRef(plannerMapPick);
  plannerMapPickRef.current = plannerMapPick;
  const onUnifiedFeatureClickRef = useRef(onUnifiedFeatureClick);
  onUnifiedFeatureClickRef.current = onUnifiedFeatureClick;
  const onRouteClickRef = useRef(onRouteClick);
  onRouteClickRef.current = onRouteClick;
  const onSelectItineraryRef = useRef(onSelectItinerary);
  onSelectItineraryRef.current = onSelectItinerary;
  const onCountryClickRef = useRef(onCountryClick);
  onCountryClickRef.current = onCountryClick;
  const onRegionClickRef = useRef(onRegionClick);
  onRegionClickRef.current = onRegionClick;
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const sheetHeightPxRef = useRef(sheetHeightPx);
  sheetHeightPxRef.current = sheetHeightPx;
  const selectedFeatureRef = useRef(selectedFeature);
  selectedFeatureRef.current = selectedFeature;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onMapActivityChangeRef = useRef(onMapActivityChange);
  onMapActivityChangeRef.current = onMapActivityChange;
  const mapActivityRef = useRef({ isMoving: false, tilesLoading: false, glbPendingCount: 0 });
  const emitMapActivity = (
    patch: Partial<{ isMoving: boolean; tilesLoading: boolean; glbPendingCount: number }>,
  ) => {
    const prev = mapActivityRef.current;
    const next = { ...prev, ...patch };
    if (
      next.isMoving === prev.isMoving &&
      next.tilesLoading === prev.tilesLoading &&
      next.glbPendingCount === prev.glbPendingCount
    ) {
      return;
    }
    mapActivityRef.current = next;
    onMapActivityChangeRef.current?.(next);
  };

  // ── création de la carte (une seule fois) ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    setReady(false);
    setDistanceScreen([]);
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    registerSlopeProtocol({ addProtocol, removeProtocol });
    registerContourProtocol({ addProtocol, removeProtocol });

    let map: MapLibreMap;
    try {
      const initialZoom = Number.isFinite(zoom) ? zoom : 1.6;
      map = new MapLibreMap({
        container: containerRef.current,
        style: OPENFREEMAP_STYLE_URL,
        center: Array.isArray(center) && Number.isFinite(center[0]) && Number.isFinite(center[1]) ? center : [2.35, 48.85],
        zoom: initialZoom,
        pitch: initialZoom >= 8 ? 48 : 0,
        attributionControl: false,
        dragRotate: true,
        pitchWithRotate: true,
        maxPitch: 70,
        ...SMOOTH_MAPLIBRE_OPTIONS,
      });
      applySmoothMapPhysics(map);
      applyExplorerSilkyPhysics(map);
      mapRef.current = map;
    } catch (caught) {
      console.error('[MapStage] MapLibre creation caught:', caught);
      return;
    }
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_EXPLORER_SCENES === '1' ||
      typeof window !== 'undefined' &&
        (Boolean((window as unknown as { __xpStore?: unknown }).__xpStore) ||
          Boolean(document.querySelector('.xp-root[data-scene]')?.getAttribute('data-scene')))
    ) {
      (window as unknown as { __xpMap?: MapLibreMap }).__xpMap = map;
    }

    // Emprise visible : la carte est la seule source de vérité pour
    // « Rechercher dans cette zone ». Aucun calcul d'écran parallèle.
    const reportViewport = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      onViewportChangeRef.current?.({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
        zoom: map.getZoom(),
      });
    };

    // Premiers pixels : premier rendu GL une fois le style chargé (fond de carte peint).
    let styleLoaded = false;
    const onStyleData = () => {
      styleLoaded = true;
      map.off('styledata', onStyleData);
    };
    const onFirstRender = () => {
      if (!styleLoaded) return;
      map.off('render', onFirstRender);
      markMap('map:first-paint');
    };
    map.on('styledata', onStyleData);
    map.on('render', onFirstRender);

    let startupTimer: number | null = null;

    map.on('load', () => {
      map.setProjection({ type: 'globe' });
      const bootHeight = map.getContainer()?.clientHeight || 844;
      const bootPadding = focusTargetPadding(sheetHeightPxRef.current, bootHeight);
      try {
        map.setPadding(bootPadding);
      } catch {
        /* ignore */
      }
      // 3.1 Animation cinématique au démarrage :
      // La Terre est d'abord entièrement visible (globe).
      // Après 100 ms, zoom vers la position de l'utilisateur centré au-dessus du tiroir.
      startupTimer = window.setTimeout(() => {
        if (!mapRef.current) return;
        const target =
          me && Number.isFinite(me.lng) && Number.isFinite(me.lat)
            ? [me.lng, me.lat]
            : Array.isArray(center) && Number.isFinite(center[0]) && Number.isFinite(center[1])
              ? center
              : [2.35, 48.85];
        cinematicStartupZoom(map, target as [number, number], reducedMotion, {
          sheetHeightPx: sheetHeightPxRef.current,
          viewportHeightPx: map.getContainer()?.clientHeight || 844,
        });
      }, 100);
      try {
        map.setSky({
          'sky-color': 'rgba(233,238,231,0.0)',
          'sky-horizon-blend': 0.5,
          'horizon-color': '#e9eee7',
          'horizon-fog-blend': 0.6,
          'fog-color': '#eef2ed',
          'fog-ground-blend': 0.7,
        } as never);
      } catch {
        /* setSky indisponible : le style reste fonctionnel */
      }

      const ensureSources = () => {
        if (!map.getSource('xp-countries')) {
          map.addSource('xp-countries', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-regions')) {
          map.addSource('xp-regions', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-routes')) {
          map.addSource('xp-routes', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-track')) {
          map.addSource('xp-track', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-slope')) {
          // `lineMetrics` est obligatoire pour `line-gradient` : sans lui,
          // MapLibre ignore le dégradé de pente (K3.04).
          map.addSource('xp-slope', {
            type: 'geojson',
            data: EMPTY as never,
            lineMetrics: true,
          });
        }
        if (!map.getSource('xp-planner-line')) {
          map.addSource('xp-planner-line', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-planner-points')) {
          map.addSource('xp-planner-points', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-climb-highlight')) {
          map.addSource('xp-climb-highlight', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-profile-cursor')) {
          map.addSource('xp-profile-cursor', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-fire-zones')) {
          map.addSource('xp-fire-zones', { type: 'geojson', data: EMPTY as never });
        }
        // NOTE PERF : `xp-terrain`, `xp-terrain-hillshade`, `xp-satellite` et `xp-cycle`
        // sont créés paresseusement au premier besoin (évite 4 pipelines raster/DEM au boot globe).
        if (!map.getSource('xp-community-heatmap')) {
          map.addSource('xp-community-heatmap', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-personal-heatmap')) {
          map.addSource('xp-personal-heatmap', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-surfaces')) {
          map.addSource('xp-surfaces', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-bike-pois')) {
          map.addSource('xp-bike-pois', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-saved-places')) {
          map.addSource('xp-saved-places', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-fires')) {
          map.addSource('xp-fires', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-highlights')) {
          map.addSource('xp-highlights', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getLayer('xp-countries-fill')) {
          map.addLayer({
            id: 'xp-countries-fill',
            type: 'fill',
            source: 'xp-countries',
            paint: {
              'fill-color': '#5B7F55',
              'fill-opacity': territoryFillOpacityExpression('country', false) as never,
            },
          });
          map.addLayer({
            id: 'xp-countries-line',
            type: 'line',
            source: 'xp-countries',
            paint: {
              'line-color': '#17402C',
              'line-width': ['interpolate', ['linear'], ['zoom'], 1.5, 0.8, 6, 1.3] as never,
              'line-opacity': territoryLineOpacityExpression('country', false) as never,
            },
          });
        }
        if (!map.getLayer('xp-regions-fill')) {
          map.addLayer({
            id: 'xp-regions-fill',
            type: 'fill',
            source: 'xp-regions',
            paint: {
              'fill-color': '#2F6F78',
              'fill-opacity': territoryFillOpacityExpression('region', false) as never,
            },
          });
          map.addLayer({
            id: 'xp-regions-line',
            type: 'line',
            source: 'xp-regions',
            paint: {
              'line-color': '#2F6F78',
              'line-width': ['interpolate', ['linear'], ['zoom'], 4.5, 0.85, 8.5, 1.1] as never,
              'line-opacity': territoryLineOpacityExpression('region', false) as never,
            },
          });
        }
        if (!map.getLayer('xp-routes-casing')) {
          map.addLayer({
            id: 'xp-routes-casing',
            type: 'line',
            source: 'xp-routes',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': ['*', 1.7, TRACE_WIDTH_EXPRESSION as never],
              'line-opacity': 0.9,
            },
          });
        }
        if (!map.getLayer('xp-routes-line')) {
          map.addLayer({
            id: 'xp-routes-line',
            type: 'line',
            source: 'xp-routes',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': TRACE_COLOR_EXPRESSION as never,
              'line-width': TRACE_WIDTH_EXPRESSION as never,
              'line-opacity': 0.95,
              'line-dasharray': TRACE_DASH_EXPRESSION as never,
            },
          });
        }
        if (!map.getLayer('xp-slope-line')) {
          map.addLayer({
            id: 'xp-slope-line',
            type: 'line',
            source: 'xp-slope',
            layout: {
              visibility: 'none',
              'line-cap': 'round',
              'line-join': 'round',
            },
            paint: {
              'line-color': '#7FA27A',
              'line-width': 4.8,
              'line-opacity': 0.96,
            },
          });
        }
        if (!map.getLayer('xp-track-line')) {
          map.addLayer({
            id: 'xp-track-line',
            type: 'line',
            source: 'xp-track',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#17402C', 'line-width': 4, 'line-opacity': 0.9 },
          });
        }
        if (!map.getSource('xp-reroute')) {
          map.addSource('xp-reroute', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getLayer('xp-reroute-line')) {
          map.addLayer({
            id: 'xp-reroute-line',
            type: 'line',
            source: 'xp-reroute',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#D97706',
              'line-width': 4,
              'line-dasharray': [2, 1.5],
              'line-opacity': 0.92,
            },
          });
        }
        if (!map.getSource('xp-access-route')) {
          map.addSource('xp-access-route', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getLayer('xp-access-route-line')) {
          map.addLayer({
            id: 'xp-access-route-line',
            type: 'line',
            source: 'xp-access-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#226148',
              'line-width': 3.5,
              'line-dasharray': [2.5, 1.5],
              'line-opacity': 0.9,
            },
          });
        }
        if (!map.getSource('xp-offline-coverage')) {
          map.addSource('xp-offline-coverage', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getLayer('xp-offline-coverage-fill')) {
          map.addLayer({
            id: 'xp-offline-coverage-fill',
            type: 'fill',
            source: 'xp-offline-coverage',
            layout: { visibility: 'none' },
            paint: { 'fill-color': '#17402C', 'fill-opacity': 0.14 },
          });
        }
        if (!map.getLayer('xp-offline-coverage-line')) {
          map.addLayer({
            id: 'xp-offline-coverage-line',
            type: 'line',
            source: 'xp-offline-coverage',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#17402C', 'line-width': 2, 'line-dasharray': [3, 2] },
          });
        }
        if (!map.getLayer('xp-fire-fill')) {
          map.addLayer({
            id: 'xp-fire-fill',
            type: 'fill',
            source: 'xp-fire-zones',
            paint: { 'fill-color': '#DC2626', 'fill-opacity': 0.18 },
          });
          map.addLayer({
            id: 'xp-fire-line',
            type: 'line',
            source: 'xp-fire-zones',
            paint: { 'line-color': '#DC2626', 'line-width': 1.5, 'line-opacity': 0.85 },
          });
        }
        if (!map.getLayer('xp-planner-line')) {
          map.addLayer({
            id: 'xp-planner-line',
            type: 'line',
            source: 'xp-planner-line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#2F6F78', 'line-width': 4, 'line-opacity': 0.95 },
          });
        }
        if (!map.getLayer('xp-planner-points')) {
          map.addLayer({
            id: 'xp-planner-points',
            type: 'circle',
            source: 'xp-planner-points',
            paint: {
              'circle-radius': 6,
              'circle-color': '#FFFFFF',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#17402C',
            },
          });
        }
        if (!map.getLayer('xp-climb-highlight')) {
          map.addLayer({
            id: 'xp-climb-highlight',
            type: 'line',
            source: 'xp-climb-highlight',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#D97706', 'line-width': 6, 'line-opacity': 0.96 },
          });
        }
        if (!map.getLayer('xp-profile-cursor')) {
          map.addLayer({
            id: 'xp-profile-cursor',
            type: 'circle',
            source: 'xp-profile-cursor',
            paint: {
              'circle-radius': 6.5,
              'circle-color': '#D97706',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          });
        }
        if (!map.getLayer('xp-surfaces-line')) {
          map.addLayer({
            id: 'xp-surfaces-line',
            type: 'line',
            source: 'xp-surfaces',
            layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': [
                'match',
                ['get', 'surfaceClass'],
                'paved',
                '#475569',
                'unpaved',
                '#d97706',
                'natural',
                '#92400e',
                'steps',
                '#7c3aed',
                'ferry',
                '#0284c7',
                '#94a3b8',
              ],
              'line-width': 3.5,
              'line-opacity': 0.88,
            },
          });
        }
        if (!map.getLayer('xp-community-heatmap-layer')) {
          map.addLayer({
            id: 'xp-community-heatmap-layer',
            type: 'heatmap',
            source: 'xp-community-heatmap',
            layout: { visibility: 'none' },
            paint: {
              'heatmap-weight': ['coalesce', ['get', 'intensity'], 0.4],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 13, 2],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 14, 24],
              'heatmap-opacity': 0.72,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(16, 185, 129, 0)',
                0.25,
                '#6ee7b7',
                0.55,
                '#f59e0b',
                0.85,
                '#ef4444',
                1,
                '#991b1b',
              ],
            },
          });
        }
        if (!map.getLayer('xp-personal-heatmap-layer')) {
          map.addLayer({
            id: 'xp-personal-heatmap-layer',
            type: 'heatmap',
            source: 'xp-personal-heatmap',
            layout: { visibility: 'none' },
            paint: {
              'heatmap-weight': ['coalesce', ['get', 'intensity'], 0.5],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 13, 2.2],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 12, 14, 26],
              'heatmap-opacity': 0.78,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(20, 184, 166, 0)',
                0.3,
                '#2dd4bf',
                0.65,
                '#0284c7',
                1,
                '#4338ca',
              ],
            },
          });
        }
        if (!map.getLayer('xp-bike-pois-layer')) {
          map.addLayer({
            id: 'xp-bike-pois-layer',
            type: 'circle',
            source: 'xp-bike-pois',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': 6,
              'circle-color': [
                'match',
                ['get', 'category'],
                'bike_shop',
                '#0f766e',
                'bike_repair',
                '#d97706',
                'ebike_charging',
                '#16a34a',
                '#0f766e',
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.8,
            },
          });
        }
        if (!map.getLayer('xp-saved-places-layer')) {
          map.addLayer({
            id: 'xp-saved-places-layer',
            type: 'circle',
            source: 'xp-saved-places',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': 6.5,
              'circle-color': '#0f766e',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
        }
        if (!map.getLayer('xp-fires-layer')) {
          map.addLayer({
            id: 'xp-fires-layer',
            type: 'circle',
            source: 'xp-fires',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': 7,
              'circle-color': '#dc2626',
              'circle-stroke-color': '#fed7aa',
              'circle-stroke-width': 2.5,
              'circle-opacity': 0.9,
            },
          });
        }
        if (!map.getLayer('xp-highlights-layer')) {
          map.addLayer({
            id: 'xp-highlights-layer',
            type: 'circle',
            source: 'xp-highlights',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': 6.5,
              'circle-color': '#ca8a04',
              'circle-stroke-color': '#fef9c3',
              'circle-stroke-width': 2,
            },
          });
        }
        // ── Itinéraires personnalisés POI (recommandé + alternatives + approche multimodale) ──
        if (!map.getSource('xp-poi-itineraries')) {
          map.addSource('xp-poi-itineraries', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-poi-itinerary-nodes')) {
          map.addSource('xp-poi-itinerary-nodes', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getLayer('xp-poi-itinerary-alt-hit')) {
          map.addLayer({
            id: 'xp-poi-itinerary-alt-hit',
            type: 'line',
            source: 'xp-poi-itineraries',
            filter: ['==', ['get', 'selected'], false],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#000000', 'line-opacity': 0.01, 'line-width': 18 },
          });
        }
        if (!map.getLayer('xp-poi-itinerary-alt-line')) {
          map.addLayer({
            id: 'xp-poi-itinerary-alt-line',
            type: 'line',
            source: 'xp-poi-itineraries',
            filter: ['==', ['get', 'selected'], false],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#475569',
              'line-width': 4,
              'line-opacity': 0.72,
              'line-dasharray': [2.2, 1.6],
            },
          });
        }
        if (!map.getLayer('xp-poi-itinerary-main-casing')) {
          map.addLayer({
            id: 'xp-poi-itinerary-main-casing',
            type: 'line',
            source: 'xp-poi-itineraries',
            filter: ['==', ['get', 'selected'], true],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 9,
              'line-opacity': 0.92,
            },
          });
        }
        if (!map.getLayer('xp-poi-itinerary-main-line')) {
          map.addLayer({
            id: 'xp-poi-itinerary-main-line',
            type: 'line',
            source: 'xp-poi-itineraries',
            filter: ['==', ['get', 'selected'], true],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'legKind'], 'approach_car'],
                '#1D4ED8',
                ['==', ['get', 'legKind'], 'approach_transit'],
                '#0369A1',
                '#0E8F5B',
              ],
              'line-width': 5.2,
              'line-opacity': 0.98,
            },
          });
        }
        if (!map.getLayer('xp-poi-itinerary-nodes-circle')) {
          map.addLayer({
            id: 'xp-poi-itinerary-nodes-circle',
            type: 'circle',
            source: 'xp-poi-itinerary-nodes',
            paint: {
              'circle-radius': [
                'match',
                ['get', 'nodeRole'],
                'destination',
                8,
                'hub',
                7,
                6.5,
              ],
              'circle-color': [
                'match',
                ['get', 'nodeRole'],
                'start',
                '#0E8F5B',
                'hub',
                '#D97706',
                'destination',
                '#C85A32',
                '#0E8F5B',
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2.5,
            },
          });
        }
      };

      ensureSources();

      // Enregistrement des sprites vectoriels Retina (2x) pour tous les calques unifiés.
      registerExplorerMapSprites(map);

      // Couche Three.js 3D flottante style Neopolis (canvas WebGL dédié synchronisé au relief 3D).
      let unsubGlbPending: (() => void) | null = null;
      try {
        if (!three3DRef.current && threeCanvasRef.current) {
          const controller = createExplorerThree3DLayer();
          controller.setReducedMotion(Boolean(reducedMotionRef.current));
          controller.attach(map, threeCanvasRef.current);
          unsubGlbPending = controller.onPendingGlbChange((count) => {
            emitMapActivity({ glbPendingCount: count });
          });
          three3DRef.current = controller;
        }
      } catch {
        /* contexte WebGL 3D indisponible : les marqueurs 2D restent actifs */
      }
      (map as unknown as { __unsubGlbPending?: (() => void) | null }).__unsubGlbPending = unsubGlbPending;

      // Moteur VFX cinétique (filets de vitesse zoom/pan, ondes de toucher, sonar d'arrivée).
      try {
        if (!vfxRef.current && vfxCanvasRef.current) {
          const vfx = createMapVfxEngine();
          vfx.setReducedMotion(Boolean(reducedMotionRef.current));
          vfx.attach(map, vfxCanvasRef.current);
          vfxRef.current = vfx;
        }
      } catch {
        /* canvas 2D VFX indisponible : la carte reste 100% fonctionnelle */
      }

      // Cartographie LKDV Alpine Topographic + ciel atmosphérique + couches vectorielles plein air.
      const cartoMap = asCartoMap(map);
      if (cartoMap) {
        const isSatBoot = mapBaseStyle === 'satellite';
        const isNatBoot = mapBaseStyle === 'national' && Boolean(nationalSource);
        applyExplorerBaseCartography(cartoMap, {
          theme,
          mapBaseStyle,
          isSatelliteActive: isSatBoot,
        });
        applyExplorerSky(cartoMap, theme, isSatBoot);
        const profile = syncPresetVectorCartography(cartoMap, {
          activePreset,
          layerVisibility,
          theme,
          isSatelliteActive: isSatBoot,
          isNationalActive: isNatBoot,
          isGpsLive: explorerMode === 'GPS_ACTIVE' || explorerMode === 'SOS',
        });
        applyZoomResponsiveCartography(cartoMap, map.getZoom(), {
          showAlpinePeaks: profile.showAlpinePeaks,
        });
      }

      setReady(true);
      reportViewport();
      onReady?.();
      markMap('map:interactive');

      map.on(
        'click',
        (event: {
          point?: { x: number; y: number };
          lngLat?: { lng: number; lat: number };
        }) => {
          if (plannerMapPickRef.current) {
            if (event.lngLat) {
              onMapClickRef.current?.([event.lngLat.lng, event.lngLat.lat]);
            }
            return;
          }

          if (!event.point) return;

          // Micro-VFX tactile immédiat au point de contact
          vfxRef.current?.spawnTapRipple(event.point.x, event.point.y);

          // 0. Hit-test prioritaire sur les objets 3D flottants Neopolis (POIs, carnets, bouteilles, clubs, Pokédex)
          const picked3D = three3DRef.current?.pickAtPoint(event.point.x, event.point.y, 44);
          if (picked3D) {
            three3DRef.current?.triggerSelectionJuice(picked3D.id);
            vfxRef.current?.spawnArrivalBurst(
              event.point.x,
              event.point.y,
              accentHexFor3DKind(picked3D.kind),
            );
            if (picked3D.sourceCategory === 'pin') {
              const matchedPin: MapPin =
                pinsRef.current.find((p) => p.id === picked3D.id) ?? {
                  id: picked3D.id,
                  kind: picked3D.kind,
                  name: picked3D.label ?? 'Point d’intérêt',
                  sub: picked3D.eleM != null ? `${Math.round(picked3D.eleM)} m` : undefined,
                  lat: picked3D.lat,
                  lon: picked3D.lng,
                };
              onPinClickRef.current?.(matchedPin);
              return;
            } else {
              onUnifiedFeatureClickRef.current?.({
                kind: picked3D.sourceCategory,
                id: picked3D.id,
                sourceId: `xp-3d-${picked3D.sourceCategory}`,
                properties: picked3D.properties ?? { id: picked3D.id, name: picked3D.label ?? '' },
                coordinates: [picked3D.lng, picked3D.lat],
              });
              return;
            }
          }

          const styleLayers = map.getStyle()?.layers ?? [];
          const interactiveLayers: string[] = [];
          for (const layer of styleLayers) {
            if (layer?.id && isInteractiveMapLayerId(layer.id)) {
              interactiveLayers.push(layer.id);
            }
          }

          let rendered: ReturnType<MapLibreMap['queryRenderedFeatures']> = [];
          if (interactiveLayers.length > 0) {
            try {
              const hitTolerancePx = 12;
              rendered = map.queryRenderedFeatures(
                [
                  [event.point.x - hitTolerancePx, event.point.y - hitTolerancePx],
                  [event.point.x + hitTolerancePx, event.point.y + hitTolerancePx],
                ],
                {
                  layers: interactiveLayers,
                },
              );
            } catch {
              rendered = [];
            }
          }

          // Clic libre sur la carte : recentre automatiquement en douceur le point touché
          // dans la zone visible au-dessus du tiroir pour ne jamais rester hors cadre.
          if (!rendered || rendered.length === 0) {
            if (
              event.lngLat &&
              Number.isFinite(event.lngLat.lng) &&
              Number.isFinite(event.lngLat.lat)
            ) {
              centerAt(
                map,
                [event.lngLat.lng, event.lngLat.lat],
                reducedMotionRef.current,
                {
                  sheetHeightPx: sheetHeightPxRef.current,
                  viewportHeightPx: map.getContainer()?.clientHeight || 844,
                },
              );
            }
            return;
          }

          const fallbackTarget = event.lngLat ?? map.getCenter();
          const fallbackCoords: [number, number] = [fallbackTarget.lng, fallbackTarget.lat];

          const candidates: PickableMapFeature[] = [];
          for (const feature of rendered) {
            const layerId = feature.layer?.id ?? '';
            const sourceId =
              typeof feature.source === 'string' && feature.source.length > 0
                ? feature.source
                : typeof (feature.layer as { source?: unknown } | undefined)?.source === 'string'
                  ? String((feature.layer as { source?: unknown }).source)
                  : '';
            let coords: [number, number] = fallbackCoords;
            const geom = feature.geometry as { type?: string; coordinates?: unknown } | undefined;
            if (
              geom?.type === 'Point' &&
              Array.isArray(geom.coordinates) &&
              typeof geom.coordinates[0] === 'number' &&
              typeof geom.coordinates[1] === 'number' &&
              Number.isFinite(geom.coordinates[0]) &&
              Number.isFinite(geom.coordinates[1])
            ) {
              coords = [geom.coordinates[0], geom.coordinates[1]];
            }
            candidates.push({
              layerId,
              sourceId,
              properties: (feature.properties ?? {}) as Record<string, unknown>,
              coordinates: coords,
            });
          }

          const picked = pickHighestPriorityFeature(candidates);
          if (!picked) {
            if (
              event.lngLat &&
              Number.isFinite(event.lngLat.lng) &&
              Number.isFinite(event.lngLat.lat)
            ) {
              centerAt(
                map,
                [event.lngLat.lng, event.lngLat.lat],
                reducedMotionRef.current,
                {
                  sheetHeightPx: sheetHeightPxRef.current,
                  viewportHeightPx: map.getContainer()?.clientHeight || 844,
                },
              );
            }
            return;
          }

          if (picked.isCluster) {
            const cHeight = map.getContainer()?.clientHeight || 844;
            map.easeTo({
              center: picked.coordinates,
              zoom: Math.min(15, map.getZoom() + 2.2),
              padding: focusTargetPadding(sheetHeightPxRef.current, cHeight),
              duration: reducedMotionRef.current ? 0 : 580,
              easing: easeCinematicOut,
              essential: true,
            });
            return;
          }

          if (picked.kind === 'itinerary') {
            if (picked.id) {
              onSelectItineraryRef.current?.(picked.id);
            }
            return;
          }

          if (picked.kind === 'route') {
            const routeName =
              typeof picked.properties.name === 'string' && picked.properties.name.trim().length > 0
                ? picked.properties.name
                : null;
            onRouteClickRef.current?.(picked.id, routeName, picked.coordinates);
            return;
          }

          if (picked.kind === 'region') {
            const props = picked.properties;
            const group =
              (typeof props.group === 'string' && props.group.trim().length > 0
                ? props.group
                : null) ||
              (typeof props.name === 'string' && props.name.trim().length > 0 ? props.name : null);
            if (group) {
              onRegionClickRef.current?.(group, picked.coordinates);
            }
            return;
          }

          if (picked.kind === 'country') {
            const props = picked.properties;
            const iso = typeof props.iso_a2 === 'string' ? props.iso_a2 : null;
            const name = typeof props.name === 'string' ? props.name : '';
            if (iso) {
              onCountryClickRef.current?.(iso, name, picked.coordinates);
            }
            return;
          }

          onUnifiedFeatureClickRef.current?.(picked);
        },
      );
    });

    const reportBearing = () => {
      const bearing = map.getBearing();
      if (Number.isFinite(bearing)) onBearingChangeRef.current?.(bearing);
    };
    const reportUserPan = () => {
      const bearing = map.getBearing();
      onUserPanRef.current?.(Number.isFinite(bearing) ? bearing : 0);
    };
    // `rotate` couvre le geste et les `easeTo` de la boussole ; `moveend`
    // rattrape une rotation terminée sans dernier événement intermédiaire.
    const onMoveStartActivity = () => {
      setHoverTip(null);
      three3DRef.current?.setMoving(true);
      emitMapActivity({ isMoving: true });
    };
    let tilesLoadingTimer: number | null = null;
    const onDataLoadingActivity = (ev?: { dataType?: string }) => {
      if (ev?.dataType === 'source' || ev?.dataType === 'style') {
        // Debounce transient tile loads so panning never spams React re-renders
        if (tilesLoadingTimer === null && !mapActivityRef.current.tilesLoading) {
          tilesLoadingTimer = window.setTimeout(() => {
            tilesLoadingTimer = null;
            emitMapActivity({ tilesLoading: true });
          }, 220);
        }
      }
    };
    const onMapIdleActivity = () => {
      if (tilesLoadingTimer !== null) {
        window.clearTimeout(tilesLoadingTimer);
        tilesLoadingTimer = null;
      }
      three3DRef.current?.setMoving(false);
      emitMapActivity({ tilesLoading: false, isMoving: false });
    };

    // Progressive throttled viewport streaming during continuous pan so new elements
    // start loading while the user keeps moving (never blocking gesture frames!)
    let lastPanViewportMs = 0;
    let panViewportTimer: number | null = null;
    const onMoveProgressViewport = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastPanViewportMs >= 420) {
        lastPanViewportMs = now;
        reportViewport();
      } else if (panViewportTimer === null) {
        panViewportTimer = window.setTimeout(() => {
          panViewportTimer = null;
          lastPanViewportMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          reportViewport();
        }, 420 - (now - lastPanViewportMs));
      }
    };

    map.on('rotate', reportBearing);
    map.on('dragstart', reportUserPan);
    map.on('rotatestart', reportUserPan);
    map.on('movestart', onMoveStartActivity);
    map.on('move', onMoveProgressViewport);
    map.on('dataloading', onDataLoadingActivity as never);
    map.on('idle', onMapIdleActivity);
    reportBearing();

    map.on('moveend', () => {
      if (panViewportTimer !== null) {
        window.clearTimeout(panViewportTimer);
        panViewportTimer = null;
      }
      three3DRef.current?.setMoving(false);
      emitMapActivity({ isMoving: false });
      reportBearing();
      reportViewport();
      if (suppressMoveEnd.current) return;
      const c = map.getCenter();
      const z = map.getZoom();
      movedToRef.current = `${level}:${c.lng.toFixed(3)}:${c.lat.toFixed(3)}`;
      onMoveEnd?.([c.lng, c.lat], z);
    });

    const orbitTimerRef = orbitRef;
    return () => {
      if (startupTimer) window.clearTimeout(startupTimer);
      if (tilesLoadingTimer !== null) window.clearTimeout(tilesLoadingTimer);
      if (panViewportTimer !== null) window.clearTimeout(panViewportTimer);
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current);
      map.off('rotate', reportBearing);
      map.off('dragstart', reportUserPan);
      map.off('rotatestart', reportUserPan);
      map.off('movestart', onMoveStartActivity);
      map.off('move', onMoveProgressViewport);
      map.off('dataloading', onDataLoadingActivity as never);
      map.off('idle', onMapIdleActivity);
      const cleanupGlb = (map as unknown as { __unsubGlbPending?: (() => void) | null }).__unsubGlbPending;
      cleanupGlb?.();
      three3DRef.current?.dispose();
      three3DRef.current = null;
      vfxRef.current?.dispose();
      vfxRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sources ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-countries') as GeoJSONSource | undefined;
    if (source && countries) source.setData(countries as never);
  }, [countries, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-regions') as GeoJSONSource | undefined;
    if (source) source.setData((regions ?? EMPTY) as never);
  }, [regions, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-routes') as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: (routes ?? [])
        .filter((route) => route.geojson)
        .map((route) => ({
          type: 'Feature',
          properties: {
            id: route.id,
            name: route.name,
            network: route.network ?? '',
            isBike: /^(icn|ncn|rcn|lcn)$/i.test(route.network ?? ''),
            style: traceStyleForRoute(route.network),
          },
          geometry: route.geojson as never,
        })),
    } as never);
  }, [routes, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-track') as GeoJSONSource | undefined;
    if (source) source.setData((activityTrack ?? EMPTY) as never);
  }, [activityTrack, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-reroute') as GeoJSONSource | undefined;
    if (source) source.setData((rerouteGeometry ?? EMPTY) as never);
  }, [rerouteGeometry, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-access-route') as GeoJSONSource | undefined;
    if (source) source.setData((accessRouteGeometry ?? EMPTY) as never);
  }, [accessRouteGeometry, ready]);

  // ── Itinéraires personnalisés POI (recommandé + alternatives) ────────────
  const lastFittedItineraryKeyRef = useRef<string>('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lineSource = map.getSource('xp-poi-itineraries') as GeoJSONSource | undefined;
    const nodeSource = map.getSource('xp-poi-itinerary-nodes') as GeoJSONSource | undefined;
    if (!lineSource || !nodeSource) return;

    const list = poiItineraries ?? [];
    if (list.length === 0) {
      lineSource.setData(EMPTY as never);
      nodeSource.setData(EMPTY as never);
      lastFittedItineraryKeyRef.current = '';
      return;
    }

    const activeId = selectedItineraryId ?? list[0]?.id ?? null;
    const lineFeatures: Array<Record<string, unknown>> = [];
    const nodeFeatures: Array<Record<string, unknown>> = [];

    for (const it of list) {
      const isSelected = it.id === activeId;
      if (!isSelected && !showItineraryAlternatives) continue;
      for (const leg of it.legs) {
        if (leg.coordinates.length < 2) continue;
        lineFeatures.push({
          type: 'Feature',
          properties: {
            itineraryId: it.id,
            role: it.role,
            roleLabel: it.roleLabel,
            legKind: leg.kind,
            selected: isSelected,
            durationP50Min: it.durationP50Min,
            dplusM: it.dplusM,
          },
          geometry: {
            type: 'LineString',
            coordinates: leg.coordinates,
          },
        });
      }
      if (isSelected && it.geojson.geometry.coordinates.length >= 2) {
        const coords = it.geojson.geometry.coordinates;
        nodeFeatures.push({
          type: 'Feature',
          properties: { nodeRole: 'start', label: it.legs[0]?.fromLabel ?? 'Départ' },
          geometry: { type: 'Point', coordinates: coords[0] },
        });
        if (it.legs.length > 1) {
          const hubCoord = it.legs[0]?.coordinates[it.legs[0].coordinates.length - 1];
          if (hubCoord) {
            nodeFeatures.push({
              type: 'Feature',
              properties: { nodeRole: 'hub', label: it.legs[0]?.toLabel ?? 'Relais' },
              geometry: { type: 'Point', coordinates: hubCoord },
            });
          }
        }
        nodeFeatures.push({
          type: 'Feature',
          properties: { nodeRole: 'destination', label: it.title },
          geometry: { type: 'Point', coordinates: coords[coords.length - 1] },
        });
      }
    }

    lineSource.setData({ type: 'FeatureCollection', features: lineFeatures } as never);
    nodeSource.setData({ type: 'FeatureCollection', features: nodeFeatures } as never);

    // Fit bounds once when the active itinerary changes
    const activeIt = list.find((item) => item.id === activeId) ?? list[0];
    const fitKey = `${activeIt?.id ?? ''}:${activeIt?.geojson.geometry.coordinates.length ?? 0}`;
    if (activeIt && fitKey !== lastFittedItineraryKeyRef.current) {
      lastFittedItineraryKeyRef.current = fitKey;
      const bounds = boundsOfTrack(activeIt.geojson.geometry);
      if (bounds) {
        const vw = map.getContainer()?.clientWidth || 390;
        const pad = overviewPadding(vw, sheetHeightPxRef.current);
        overviewOf(map, bounds, pad, reducedMotionRef.current);
      }
    }
  }, [poiItineraries, selectedItineraryId, showItineraryAlternatives, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-offline-coverage') as GeoJSONSource | undefined;
    if (source) source.setData((offlineCoverage ?? EMPTY) as never);
    const vis = showOfflineCoverage ? 'visible' : 'none';
    if (map.getLayer('xp-offline-coverage-fill')) {
      map.setLayoutProperty('xp-offline-coverage-fill', 'visibility', vis);
    }
    if (map.getLayer('xp-offline-coverage-line')) {
      map.setLayoutProperty('xp-offline-coverage-line', 'visibility', vis);
    }
  }, [offlineCoverage, showOfflineCoverage, ready]);
  // ── calques planificateur R01 + curseur/montée R02 + feux K2.23 ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lineSource = map.getSource('xp-planner-line') as GeoJSONSource | undefined;
    const ptsSource = map.getSource('xp-planner-points') as GeoJSONSource | undefined;
    if (lineSource) {
      const geom =
        !plannerLineHidden && plannerDraft
          ? (plannerDraft.geometry as { type?: string; coordinates?: unknown } | null) ??
            lineStringFromSections(plannerDraft.sections)
          : null;
      lineSource.setData(
        geom && Array.isArray((geom as { coordinates?: unknown }).coordinates)
          ? ({ type: 'Feature', properties: {}, geometry: geom } as never)
          : (EMPTY as never),
      );
    }
    if (ptsSource) {
      ptsSource.setData(
        plannerDraft
          ? ({
              type: 'FeatureCollection',
              features: plannerDraft.points.map((pt, index) => ({
                type: 'Feature',
                properties: { index, kind: pt.semanticKind ?? 'via' },
                geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
              })),
            } as never)
          : (EMPTY as never),
      );
    }
  }, [plannerDraft, plannerLineHidden, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const cursorSource = map.getSource('xp-profile-cursor') as GeoJSONSource | undefined;
    if (cursorSource) {
      cursorSource.setData(
        profileCursor
          ? ({
              type: 'Feature',
              properties: { distanceM: profileCursor.distanceM },
              geometry: { type: 'Point', coordinates: [profileCursor.lon, profileCursor.lat] },
            } as never)
          : (EMPTY as never),
      );
    }
  }, [profileCursor, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const climbSource = map.getSource('xp-climb-highlight') as GeoJSONSource | undefined;
    if (climbSource) {
      climbSource.setData(
        highlightedSegment && highlightedSegment.coordinates.length >= 2
          ? ({
              type: 'Feature',
              properties: { label: highlightedSegment.label ?? '' },
              geometry: { type: 'LineString', coordinates: highlightedSegment.coordinates },
            } as never)
          : (EMPTY as never),
      );
    }
  }, [highlightedSegment, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const fireSource = map.getSource('xp-fire-zones') as GeoJSONSource | undefined;
    const visible = layerVisibility?.fire !== false;
    if (fireSource) {
      fireSource.setData((visible && fireLayer ? fireLayer : EMPTY) as never);
    }
  }, [fireLayer, layerVisibility?.fire, ready]);

  // ── thème & contours territoriaux ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const dark = theme === 'dark';
    const isSat = mapBaseStyle === 'satellite' && !(mapBaseStyle === 'national' && Boolean(nationalSource));
    try {
      if (map.getLayer('xp-countries-fill')) {
        map.setPaintProperty('xp-countries-fill', 'fill-color', dark ? '#8FB79B' : '#5B7F55');
        map.setPaintProperty(
          'xp-countries-fill',
          'fill-opacity',
          territoryFillOpacityExpression('country', dark) as never,
        );
      }
      if (map.getLayer('xp-countries-line')) {
        map.setPaintProperty('xp-countries-line', 'line-color', dark || isSat ? '#DCEFE2' : '#17402C');
        map.setPaintProperty(
          'xp-countries-line',
          'line-opacity',
          territoryLineOpacityExpression('country', dark) as never,
        );
      }
      if (map.getLayer('xp-regions-fill')) {
        map.setPaintProperty(
          'xp-regions-fill',
          'fill-opacity',
          territoryFillOpacityExpression('region', dark) as never,
        );
      }
      if (map.getLayer('xp-regions-line')) {
        map.setPaintProperty('xp-regions-line', 'line-color', dark || isSat ? '#BAE6FD' : '#2F6F78');
        map.setPaintProperty(
          'xp-regions-line',
          'line-opacity',
          territoryLineOpacityExpression('region', dark) as never,
        );
      }
      const cartoMap = asCartoMap(map);
      if (cartoMap) {
        applyExplorerBaseCartography(cartoMap, {
          theme,
          mapBaseStyle,
          isSatelliteActive: isSat,
        });
        applyExplorerSky(cartoMap, theme, isSat);
      }
    } catch {
      /* propriétés absentes : aucune conséquence */
    }
    const canvas = map.getCanvas();
    if (canvas?.style) {
      canvas.style.filter = '';
    }
  }, [theme, mapBaseStyle, nationalSource, ready]);

  // ── fond national officiel (K3.05) ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Une source non vérifiée n'arrive jamais ici : l'appelant ne transmet que
    // `verifiedNationalTopoFor(...)`. Sans source, aucune tuile n'est chargée.
    if (!nationalSource) {
      if (map.getLayer('xp-national-topo-layer')) {
        try {
          map.removeLayer('xp-national-topo-layer');
        } catch {
          /* déjà retirée */
        }
      }
      if (map.getSource('xp-national-topo')) {
        try {
          map.removeSource('xp-national-topo');
        } catch {
          /* déjà retirée */
        }
      }
      return;
    }

    if (!map.getSource('xp-national-topo')) {
      try {
        map.addSource('xp-national-topo', {
          type: 'raster',
          tiles: nationalSource.tiles,
          tileSize: nationalSource.tileSize,
          maxzoom: nationalSource.maxzoom,
          attribution: nationalSource.attribution,
        });
      } catch {
        /* style non prêt ou source déjà retirée : aucun fond national affiché */
        return;
      }
    }
    if (!map.getLayer('xp-national-topo-layer')) {
      // Sous les étiquettes du fond vectoriel et sous les aplats pays.
      const firstSymbol = map
        .getStyle()
        .layers?.find((layer) => layer.type === 'symbol')?.id;
      try {
        map.addLayer(
          {
            id: 'xp-national-topo-layer',
            type: 'raster',
            source: 'xp-national-topo',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 0.94, 'raster-fade-duration': 200 },
          },
          firstSymbol,
        );
      } catch {
        /* couche impossible à insérer : on ne casse pas la carte */
      }
    }
  }, [nationalSource, ready]);

  // ── projection, fond, cartographie adaptative par preset et relief 3D ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const cartoMap = asCartoMap(map);
    const cycleKey = process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY?.trim();
    const isNational = mapBaseStyle === 'national' && Boolean(nationalSource);
    const isSat = mapBaseStyle === 'satellite' && !isNational;
    const isCycle = mapBaseStyle === 'cycle' && Boolean(cycleKey) && !isNational;
    const isGps = explorerMode === 'GPS_ACTIVE' || explorerMode === 'SOS';
    const isRelief =
      (mapBaseStyle === 'relief' ||
        !mapBaseStyle ||
        (mapBaseStyle === 'national' && !isNational) ||
        (mapBaseStyle === 'cycle' && !isCycle)) &&
      !isNational;

    // 1. Couches vectorielles plein air (sentiers rando/trail, VTT, voies navigables, parcs, sommets 3D)
    const presetProfile = cartoMap
      ? syncPresetVectorCartography(cartoMap, {
          activePreset,
          layerVisibility,
          theme,
          isSatelliteActive: isSat,
          isNationalActive: isNational,
          isGpsLive: isGps,
        })
      : resolvePresetCartoProfile(activePreset, layerVisibility, isGps);

    // 2. Fond hybride Satellite (inséré SOUS les étiquettes, sommets, sentiers et itinéraires!)
    const symbolAnchor = cartoMap ? findFirstSymbolAnchor(cartoMap) : undefined;
    if (isSat && !map.getSource('xp-satellite')) {
      map.addSource('xp-satellite', {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© Esri · Earthstar Geographics',
      });
    }
    if (isSat && !map.getLayer('xp-satellite-layer') && map.getSource('xp-satellite')) {
      map.addLayer(
        {
          id: 'xp-satellite-layer',
          type: 'raster',
          source: 'xp-satellite',
          layout: { visibility: 'visible' },
          paint: { 'raster-opacity': 1, 'raster-contrast': 0.06, 'raster-saturation': 0.08 },
        },
        symbolAnchor,
      );
    } else if (map.getLayer('xp-satellite-layer')) {
      map.setLayoutProperty('xp-satellite-layer', 'visibility', isSat ? 'visible' : 'none');
    }

    if (isCycle && cycleKey && !map.getSource('xp-cycle')) {
      map.addSource('xp-cycle', {
        type: 'raster',
        tiles: [
          `https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${encodeURIComponent(cycleKey)}`,
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenCycleMap · © OpenStreetMap contributors',
      });
    }
    if (isCycle && !map.getLayer('xp-cycle-layer') && map.getSource('xp-cycle')) {
      map.addLayer(
        {
          id: 'xp-cycle-layer',
          type: 'raster',
          source: 'xp-cycle',
          layout: { visibility: 'visible' },
          paint: { 'raster-opacity': 0.96 },
        },
        symbolAnchor,
      );
    } else if (map.getLayer('xp-cycle-layer')) {
      map.setLayoutProperty('xp-cycle-layer', 'visibility', isCycle ? 'visible' : 'none');
    }

    if (map.getLayer('xp-national-topo-layer')) {
      map.setLayoutProperty(
        'xp-national-topo-layer',
        'visibility',
        isNational ? 'visible' : 'none',
      );
    }

    // 3. Gardes d'état strictes sur zoom : projection, étiquettes, ombrage relief & DEM 3D.
    let lastTerrain: boolean | null = null;
    let lastHillshade: boolean | null = null;
    let lastGlobe: boolean | null = null;
    let lastLabelsAll: boolean | null = null;

    const updateZoomCartography = () => {
      const z = map.getZoom();
      const shouldBeGlobe = z < GLOBE_TO_MERCATOR_ZOOM;
      const shouldShowAllLabels = z >= LABELS_SHOW_ALL_ZOOM;

      if (cartoMap && (shouldBeGlobe !== lastGlobe || shouldShowAllLabels !== lastLabelsAll)) {
        lastGlobe = shouldBeGlobe;
        lastLabelsAll = shouldShowAllLabels;
        applyZoomResponsiveCartography(cartoMap, z, {
          showAlpinePeaks: presetProfile.showAlpinePeaks,
        });
      }

      const terrainAllowed = layerVisibility?.terrain3d !== false && !isGps;
      const hillshadeAllowed = layerVisibility?.hillshade !== false;
      const showTerrain = (isRelief || isSat) && terrainAllowed && (level >= 2 || z >= 7.0);
      const showHillshade = (isRelief || isSat) && hillshadeAllowed && (level >= 2 || z >= 5.5);

      if (showHillshade !== lastHillshade) {
        lastHillshade = showHillshade;
        if (showHillshade) {
          if (!map.getSource('xp-terrain-hillshade')) {
            map.addSource('xp-terrain-hillshade', {
              type: 'raster-dem',
              tiles: [TERRAIN_SOURCE],
              encoding: 'terrarium',
              tileSize: 256,
              maxzoom: 13,
            });
          }
          const paint = hillshadePaintForTheme(theme, presetProfile.hillshadeExaggeration, isSat);
          if (!map.getLayer('xp-hillshade')) {
            const hillshadeAnchor = cartoMap ? findHillshadeBeforeId(cartoMap) : undefined;
            map.addLayer(
              {
                id: 'xp-hillshade',
                type: 'hillshade',
                source: 'xp-terrain-hillshade',
                layout: { visibility: 'visible' },
                paint: paint as never,
              },
              hillshadeAnchor,
            );
          } else {
            map.setLayoutProperty('xp-hillshade', 'visibility', 'visible');
            for (const [k, v] of Object.entries(paint)) {
              try {
                map.setPaintProperty('xp-hillshade', k, v as never);
              } catch {
                /* ignore */
              }
            }
          }
        } else if (map.getLayer('xp-hillshade')) {
          map.setLayoutProperty('xp-hillshade', 'visibility', 'none');
        }
      } else if (showHillshade && map.getLayer('xp-hillshade')) {
        const paint = hillshadePaintForTheme(theme, presetProfile.hillshadeExaggeration, isSat);
        for (const [k, v] of Object.entries(paint)) {
          try {
            map.setPaintProperty('xp-hillshade', k, v as never);
          } catch {
            /* ignore */
          }
        }
      }

      if (showTerrain !== lastTerrain) {
        lastTerrain = showTerrain;
        try {
          if (showTerrain && !map.getSource('xp-terrain')) {
            map.addSource('xp-terrain', {
              type: 'raster-dem',
              tiles: [TERRAIN_SOURCE],
              encoding: 'terrarium',
              tileSize: 256,
              maxzoom: 13,
              attribution: 'Relief : AWS Terrain Tiles (open data)',
            });
          }
          map.setTerrain(
            showTerrain ? { source: 'xp-terrain', exaggeration: 1.5 } : null,
          );
        } catch {
          /* DEM indisponible */
        }
      }
    };

    updateZoomCartography();
    map.on('zoom', updateZoomCartography);
    return () => {
      map.off('zoom', updateZoomCartography);
    };
  }, [
    level,
    theme,
    mapBaseStyle,
    nationalSource,
    activePreset,
    explorerMode,
    layerVisibility,
    ready,
  ]);

  // ── calques de données interactifs ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !layerVisibility) return;
    const showRoutes = layerVisibility.routes !== false;
    const walkOn = layerVisibility.walkRoutes !== false;
    const bikeOn = layerVisibility.bikeRoutes !== false;
    const effectiveRoutes = showRoutes && (walkOn || bikeOn);
    if (map.getLayer('xp-routes-line') && map.getLayer('xp-routes-casing')) {
      map.setLayoutProperty('xp-routes-line', 'visibility', effectiveRoutes ? 'visible' : 'none');
      map.setLayoutProperty('xp-routes-casing', 'visibility', effectiveRoutes ? 'visible' : 'none');
      if (effectiveRoutes) {
        const filter =
          walkOn && !bikeOn
            ? (['!=', ['get', 'isBike'], true] as never)
            : !walkOn && bikeOn
              ? (['==', ['get', 'isBike'], true] as never)
              : null;
        try {
          map.setFilter('xp-routes-line', filter);
          map.setFilter('xp-routes-casing', filter);
        } catch {
          /* filtre ignoré */
        }
      }
    }
  }, [layerVisibility, ready]);

  // ── couches dynamiques C01/C02/C03 (heatmaps, vélo, feux, surfaces, lieux, highlights) ──
  const lastDynamicLayerGeoRef = useRef<Map<string, unknown>>(new Map());
  useEffect(() => {
    if (!ready) {
      lastDynamicLayerGeoRef.current.clear();
    }
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const syncLayer = (
      sourceId: string,
      layerId: string,
      geo: GeoCollection | null | undefined,
      visible: boolean,
    ) => {
      const nextData = visible && geo ? geo : EMPTY;
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (source && lastDynamicLayerGeoRef.current.get(sourceId) !== nextData) {
        source.setData(nextData as never);
        lastDynamicLayerGeoRef.current.set(sourceId, nextData);
      }
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          visible && geo && geo.features.length > 0 ? 'visible' : 'none',
        );
      }
    };

    syncLayer('xp-community-heatmap', 'xp-community-heatmap-layer', communityHeatmapGeo, Boolean(communityHeatmapGeo));
    syncLayer('xp-personal-heatmap', 'xp-personal-heatmap-layer', personalHeatmapGeo, Boolean(personalHeatmapGeo));
    syncLayer('xp-surfaces', 'xp-surfaces-line', surfacesGeo, layerVisibility?.surfaceLayer === true);
    syncLayer('xp-bike-pois', 'xp-bike-pois-layer', bikePoisGeo, layerVisibility?.bikePois === true);
    syncLayer('xp-saved-places', 'xp-saved-places-layer', savedPlacesGeo, layerVisibility?.savedPlaces === true);
    syncLayer('xp-fires', 'xp-fires-layer', firesGeo, layerVisibility?.fires === true);
    syncLayer('xp-highlights', 'xp-highlights-layer', highlightsGeo, layerVisibility?.highlights !== false);
  }, [
    ready,
    layerVisibility,
    communityHeatmapGeo,
    personalHeatmapGeo,
    surfacesGeo,
    bikePoisGeo,
    savedPlacesGeo,
    firesGeo,
    highlightsGeo,
  ]);

  // ── couches unifiées Explorer (hazards, radar, airspace, light pollution, GBIF, Pokédex, social) + déchargement déterministe GPS ──
  const onUnifiedLayerEvictRef = useRef(onUnifiedLayerEvict);
  onUnifiedLayerEvictRef.current = onUnifiedLayerEvict;
  const lastDisposedModeRef = useRef<ExplorerMode | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (explorerMode === 'GPS_ACTIVE' || explorerMode === 'SOS') {
      disposeNonEssentialMapLayers(map, activeSport ?? undefined);
      lastDisposedModeRef.current = explorerMode;
    } else if (lastDisposedModeRef.current === 'GPS_ACTIVE' || lastDisposedModeRef.current === 'SOS') {
      restoreMapTileCacheBudget(map);
      lastDisposedModeRef.current = explorerMode;
    }
    const res = syncUnifiedOverlayLayers(map, {
      layerVisibility: layerVisibility ?? {},
      mode: explorerMode,
      activeSport: activeSport ?? undefined,
      radarTileTemplate,
      geojsonDataBySource: (unifiedGeojson ?? {}) as Record<string, GeoJSON.FeatureCollection | null | undefined>,
    });
    if (res.evictedKeys.length > 0) {
      onUnifiedLayerEvictRef.current?.(res.evictedKeys);
    }
  }, [ready, explorerMode, activeSport, layerVisibility, radarTileTemplate, unifiedGeojson]);

  // ── halo de sélection forest léger (monté paresseusement uniquement si selectedFeature != null) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const SOURCE_ID = 'xp-selected-highlight';
    const HALO_LAYER_ID = 'xp-selected-highlight-halo';
    const RING_LAYER_ID = 'xp-selected-highlight-ring';

    const hasValidCoords =
      Boolean(selectedFeature) &&
      Array.isArray(selectedFeature?.coordinates) &&
      Number.isFinite(selectedFeature.coordinates[0]) &&
      Number.isFinite(selectedFeature.coordinates[1]);

    const suppress2DRingFor3D = Boolean(
      three3DRef.current && explorerMode !== 'GPS_ACTIVE' && explorerMode !== 'SOS',
    );

    if (!hasValidCoords || !selectedFeature || suppress2DRingFor3D) {
      const existingSource = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(EMPTY as never);
      }
      if (map.getLayer(HALO_LAYER_ID)) {
        map.setLayoutProperty(HALO_LAYER_ID, 'visibility', 'none');
      }
      if (map.getLayer(RING_LAYER_ID)) {
        map.setLayoutProperty(RING_LAYER_ID, 'visibility', 'none');
      }
      return;
    }

    const pointCollection: GeoCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: selectedFeature.id },
          geometry: {
            type: 'Point',
            coordinates: [selectedFeature.coordinates[0], selectedFeature.coordinates[1]],
          },
        },
      ],
    };

    const existingSource = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!existingSource) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: pointCollection as never,
      });
    } else {
      existingSource.setData(pointCollection as never);
    }

    if (!map.getLayer(HALO_LAYER_ID)) {
      map.addLayer({
        id: HALO_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 18,
          'circle-color': '#17402C',
          'circle-opacity': 0.22,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#96BA8E',
          'circle-stroke-opacity': 0.85,
        },
      });
    } else {
      map.setLayoutProperty(HALO_LAYER_ID, 'visibility', 'visible');
    }

    if (!map.getLayer(RING_LAYER_ID)) {
      map.addLayer({
        id: RING_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#17402C',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#FFFFFF',
        },
      });
    } else {
      map.setLayoutProperty(RING_LAYER_ID, 'visibility', 'visible');
    }

    if (reducedMotion) return;

    let rafId = 0;
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const animatePulse = (nowMs: number) => {
      const elapsed = (nowMs - startMs) % 1800;
      const t = (Math.sin((elapsed / 1800) * Math.PI * 2) + 1) / 2;
      try {
        if (map.getLayer(HALO_LAYER_ID)) {
          map.setPaintProperty(HALO_LAYER_ID, 'circle-radius', 15 + t * 9);
          map.setPaintProperty(HALO_LAYER_ID, 'circle-opacity', 0.28 - t * 0.14);
        }
      } catch {
        return;
      }
      rafId = window.requestAnimationFrame(animatePulse);
    };
    rafId = window.requestAnimationFrame(animatePulse);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [ready, selectedFeature, reducedMotion, explorerMode]);

  // ── synchronisation de la couche Three.js 3D flottante (Neopolis) ──────
  useEffect(() => {
    const controller = three3DRef.current;
    if (!controller || !ready) return;

    const isGps = explorerMode === 'GPS_ACTIVE' || explorerMode === 'SOS';
    controller.setEnabled(!isGps);
    controller.setReducedMotion(Boolean(reducedMotion));
    controller.setSelectedId(selectedFeature?.id ?? selectedId ?? null);
    controller.setActiveCategory(activeCategory ?? 'explorer');
    vfxRef.current?.setEnabled(!isGps);
    vfxRef.current?.setReducedMotion(Boolean(reducedMotion));

    const mapHeight = mapRef.current?.getContainer()?.clientHeight || 844;
    controller.setSafeBounds(60, Math.max(140, mapHeight - sheetHeightPx - 8));

    if (isGps) {
      controller.setItems([]);
      return;
    }

    const cLng = Array.isArray(center) && Number.isFinite(center[0]) ? center[0] : 2.35;
    const cLat = Array.isArray(center) && Number.isFinite(center[1]) ? center[1] : 48.85;
    const distSq = (lng: number, lat: number) => (lng - cLng) ** 2 + (lat - cLat) ** 2;
    const liveZoom = mapRef.current?.getZoom?.() ?? zoom;
    const lodBudget = lod3DBudgetForZoom(liveZoom);

    const items: Array<{ item: Floating3DItem; score: number }> = [];
    const seen = new Set<string>();

    // 0. Entité actuellement sélectionnée (toujours rendue en 3D héroïque même hors cluster)
    if (
      selectedFeature &&
      Number.isFinite(selectedFeature.coordinates[0]) &&
      Number.isFinite(selectedFeature.coordinates[1])
    ) {
      const selKind = normalize3DEntityKind(selectedFeature.kind ?? 'spot');
      const selCategory: Floating3DItem['sourceCategory'] =
        selKind === 'carnet' ||
        selKind === 'bottle' ||
        selKind === 'club' ||
        selKind === 'story' ||
        selKind === 'friend'
          ? selKind
          : selKind === 'club_event'
            ? 'club'
            : selKind === 'pokedex' || selKind.startsWith('pokedex_')
              ? 'pokedex'
              : selKind === 'fire' ||
                  selKind === 'flood' ||
                  selKind === 'seismic' ||
                  selKind === 'aircraft' ||
                  selKind === 'rescue'
                ? 'hazard'
                : 'pin';
      seen.add(selectedFeature.id);
      items.push({
        score: -1,
        item: {
          id: selectedFeature.id,
          kind: selKind,
          lng: selectedFeature.coordinates[0],
          lat: selectedFeature.coordinates[1],
          label: selectedFeature.label,
          selected: true,
          sourceCategory: selCategory,
        },
      });
    }

    // 1. POIs stables (alimentés directement depuis le cache spatial `pins`, et non `overlay` DOM,
    // pour éliminer définitivement tout scintillement en pan/zoom!)
    for (const pin of pins) {
      if (!pin || pin.kind === 'country') continue;
      if (!Number.isFinite(pin.lon) || !Number.isFinite(pin.lat)) continue;
      if (seen.has(pin.id)) continue;
      const resolvedPinKind = normalize3DEntityKind(pin.kind, pin.subtype);
      const isPinSelected = pin.id === selectedId || pin.id === selectedFeature?.id;
      if (!lodBudget.allowKind(resolvedPinKind, isPinSelected)) continue;
      seen.add(pin.id);
      const eleMatch = pin.sub ? /(\d[\d\s]*)\s*m/i.exec(pin.sub) : null;
      const eleM = eleMatch ? Number(eleMatch[1].replace(/\s+/g, '')) : null;
      items.push({
        score: distSq(pin.lon, pin.lat) * 0.85,
        item: {
          id: pin.id,
          kind: resolvedPinKind,
          lng: pin.lon,
          lat: pin.lat,
          eleM: Number.isFinite(eleM) ? eleM : null,
          label: pin.name,
          selected: isPinSelected,
          sourceCategory: 'pin',
        },
      });
    }

    // 2. Objets unifiés actifs (Carnets, Bouteilles, Clubs, Sorties, Stories, Amis, Pokédex taxonomique, Risques)
    const lv = layerVisibility ?? {};
    const unifiedSpecs: Array<{
      sourceId: string;
      visKey: string;
      kind: Floating3DItem['kind'];
      sourceCategory: Floating3DItem['sourceCategory'];
    }> = [
      { sourceId: 'xp-social-bottles', visKey: 'socialBottles', kind: 'bottle', sourceCategory: 'bottle' },
      { sourceId: 'xp-social-carnets', visKey: 'socialCarnets', kind: 'carnet', sourceCategory: 'carnet' },
      { sourceId: 'xp-social-clubs', visKey: 'socialClubs', kind: 'club', sourceCategory: 'club' },
      { sourceId: 'xp-social-events', visKey: 'socialClubs', kind: 'club_event', sourceCategory: 'club' },
      { sourceId: 'xp-social-stories', visKey: 'socialStories', kind: 'story', sourceCategory: 'story' },
      { sourceId: 'xp-social-friends', visKey: 'socialFriends', kind: 'friend', sourceCategory: 'friend' },
      { sourceId: 'xp-pokedex-species', visKey: 'pokedexSpecies', kind: 'pokedex', sourceCategory: 'pokedex' },
      { sourceId: 'xp-hazard-fires', visKey: 'hazardFires', kind: 'fire', sourceCategory: 'hazard' },
      { sourceId: 'xp-hazard-floods', visKey: 'hazardFloods', kind: 'flood', sourceCategory: 'hazard' },
      { sourceId: 'xp-hazard-seismic', visKey: 'hazardSeismic', kind: 'seismic', sourceCategory: 'hazard' },
      { sourceId: 'xp-airspace-aircraft', visKey: 'airspaceAircraft', kind: 'aircraft', sourceCategory: 'hazard' },
    ];

    for (const spec of unifiedSpecs) {
      if (!lv[spec.visKey]) continue;
      const collection = unifiedGeojson?.[spec.sourceId];
      if (!collection || !Array.isArray(collection.features)) continue;
      for (const feat of collection.features) {
        const geom = feat?.geometry as { type?: string; coordinates?: unknown } | undefined;
        if (geom?.type !== 'Point' || !Array.isArray(geom.coordinates)) continue;
        const lng = Number(geom.coordinates[0]);
        const lat = Number(geom.coordinates[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const props = (feat.properties ?? {}) as Record<string, unknown>;
        // Never mount 3D pins at synthetic/fallback coordinates for GPS-less stories or out-of-area records
        if (props.hasExactCoords === false) continue;
        const rawId = props.id ?? props.taxonId ?? props.icao24 ?? props.callsign ?? `${spec.sourceId}:${lng.toFixed(4)},${lat.toFixed(4)}`;
        const id = String(rawId);
        const key = `${spec.sourceCategory}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const headingRaw = props.heading ?? props.true_track;
        const resolvedKind =
          spec.sourceId === 'xp-pokedex-species'
            ? normalize3DEntityKind('pokedex', undefined, {
                iconicTaxon: typeof props.iconicTaxon === 'string' ? props.iconicTaxon : null,
                kingdom: typeof props.kingdom === 'string' ? props.kingdom : null,
              })
            : spec.kind;
        items.push({
          score: distSq(lng, lat),
          item: {
            id,
            kind: resolvedKind,
            lng,
            lat,
            label: String(props.title ?? props.name ?? props.commonName ?? props.callsign ?? ''),
            headingDeg: typeof headingRaw === 'number' ? headingRaw : null,
            selected: id === selectedFeature?.id,
            sourceCategory: spec.sourceCategory,
            properties: props,
          },
        });
      }
    }

    // 3. Couches locales vélo (atelier, réparation, borne VAE), favoris & highlights en 3D
    const extraGeoSpecs: Array<{
      collection: GeoCollection | null | undefined;
      enabled: boolean;
      defaultKind: Floating3DItem['kind'];
      prefix: string;
    }> = [
      { collection: bikePoisGeo, enabled: lv.bikePois === true, defaultKind: 'bike_shop', prefix: 'bike' },
      { collection: savedPlacesGeo, enabled: lv.savedPlaces === true, defaultKind: 'saved_place', prefix: 'saved' },
      { collection: highlightsGeo, enabled: lv.highlights !== false, defaultKind: 'saved_place', prefix: 'highlight' },
    ];

    for (const extra of extraGeoSpecs) {
      if (!extra.enabled || !extra.collection?.features?.length) continue;
      for (const feat of extra.collection.features) {
        const geom = feat?.geometry as { type?: string; coordinates?: unknown } | undefined;
        if (geom?.type !== 'Point' || !Array.isArray(geom.coordinates)) continue;
        const lng = Number(geom.coordinates[0]);
        const lat = Number(geom.coordinates[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const props = (feat.properties ?? {}) as Record<string, unknown>;
        const id = String(props.id ?? `${extra.prefix}:${lng.toFixed(4)},${lat.toFixed(4)}`);
        if (seen.has(id)) continue;
        seen.add(id);
        const rawCat = typeof props.category === 'string' ? props.category : null;
        const resolvedKind = rawCat
          ? normalize3DEntityKind(extra.defaultKind, rawCat, { category: rawCat })
          : extra.defaultKind;
        items.push({
          score: distSq(lng, lat) * 0.95,
          item: {
            id,
            kind: resolvedKind,
            lng,
            lat,
            label: String(props.name ?? props.title ?? ''),
            selected: id === selectedId || id === selectedFeature?.id,
            sourceCategory: 'pin',
            properties: props,
          },
        });
      }
    }

    const filteredForLod = items.filter((entry) =>
      lodBudget.allowKind(entry.item.kind, Boolean(entry.item.selected)),
    );
    const balancedItems = selectBalanced3DItems(filteredForLod, {
      zoom: liveZoom,
      activeCategory,
      maxTotal: Math.min(MAX_FLOATING_3D_ITEMS, lodBudget.maxItems),
    });
    controller.setItems(balancedItems);
  }, [
    ready,
    explorerMode,
    reducedMotion,
    selectedId,
    selectedFeature,
    activeCategory,
    pins,
    layerVisibility,
    unifiedGeojson,
    bikePoisGeo,
    savedPlacesGeo,
    highlightsGeo,
    center,
    zoom,
    sheetHeightPx,
  ]);

  // ── protection WebGL context loss (mobile Safari / WKWebView) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const canvas = map.getCanvas?.();
    if (!canvas) return;
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    const onRestored = () => {
      registerExplorerMapSprites(map);
      if (explorerMode === 'GPS_ACTIVE' || explorerMode === 'SOS') {
        disposeNonEssentialMapLayers(map, activeSport ?? undefined);
      }
      syncUnifiedOverlayLayers(map, {
        layerVisibility: layerVisibility ?? {},
        mode: explorerMode,
        activeSport: activeSport ?? undefined,
        zoom,
        radarTileTemplate,
        geojsonDataBySource: (unifiedGeojson ?? {}) as Record<string, GeoJSON.FeatureCollection | null | undefined>,
      });
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [ready, explorerMode, activeSport, layerVisibility, zoom, radarTileTemplate, unifiedGeojson]);

  // ── pente réelle de l'itinéraire sélectionné (K3.04) ────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-slope') as GeoJSONSource | undefined;
    const show = layerVisibility?.slope === true && !!slopeLayer && slopeLayer.stops.length >= 2;
    if (source) {
      source.setData(
        show && slopeLayer
          ? ({
              type: 'Feature',
              properties: { routeId: slopeLayer.id },
              geometry: slopeLayer.geojson as never,
            } as never)
          : (EMPTY as never),
      );
    }
    if (map.getLayer('xp-slope-line')) {
      if (show && slopeLayer) {
        const gradient = slopeGradientExpression(slopeLayer.stops);
        if (gradient) {
          try {
            map.setPaintProperty('xp-slope-line', 'line-gradient', gradient as never);
          } catch {
            /* lineMetrics absent : la couche reste masquée */
            map.setLayoutProperty('xp-slope-line', 'visibility', 'none');
            return;
          }
        }
      }
      map.setLayoutProperty('xp-slope-line', 'visibility', show ? 'visible' : 'none');
    }
  }, [layerVisibility, ready, slopeLayer]);

  // ── orbite de sommet (pause au toucher, reprise après 6 s) ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (cameraIntent?.type !== 'orbit' || paused || reducedMotion) return;
    return orbitController(map, true);
  }, [cameraIntent, paused, reducedMotion, ready]);

  // ── intentions de caméra (plongée, révélation, suivi, vue d'ensemble, survol) ──
  // On suit l'identité de l'objet `cameraIntent` via un compteur monotone afin qu'un
  // second clic sur le même élément 3D ou le bouton Ma Position recentre TOUJOURS la carte.
  const lastIntentObjRef = useRef<CameraIntent | null | undefined>(undefined);
  const intentSeqRef = useRef(0);
  const intentChangedThisRender = cameraIntent !== lastIntentObjRef.current;
  if (intentChangedThisRender) {
    lastIntentObjRef.current = cameraIntent;
    intentSeqRef.current += 1;
  }

  // ── cadrage dynamique continu au-dessus du tiroir (ne jamais être hors cadre) ──
  const lastAppliedSheetHeightRef = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (explorerMode === 'GPS_ACTIVE' || explorerMode === 'SOS') return;
    if (lastAppliedSheetHeightRef.current === sheetHeightPx) return;
    const prevHeight = lastAppliedSheetHeightRef.current;
    lastAppliedSheetHeightRef.current = sheetHeightPx;

    const cHeight = map.getContainer()?.clientHeight || 844;
    const nextPad = focusTargetPadding(sheetHeightPx, cHeight);

    // Si une intention caméra (`reveal` / `level` / `follow`) part dans ce même rendu,
    // elle applique déjà le nouveau `padding` + boucle fermée 3D : on évite un double `easeTo`.
    if (prevHeight === null || (intentChangedThisRender && cameraIntent && cameraIntent.type !== 'none')) {
      if (prevHeight === null) {
        try {
          map.setPadding(nextPad);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const activeTarget = selectedFeatureRef.current?.coordinates;
    const hasActiveTarget =
      Array.isArray(activeTarget) &&
      Number.isFinite(activeTarget[0]) &&
      Number.isFinite(activeTarget[1]);

    suppressMoveEnd.current = true;
    window.setTimeout(() => {
      suppressMoveEnd.current = false;
    }, 450);

    map.easeTo({
      ...(hasActiveTarget ? { center: activeTarget } : {}),
      padding: nextPad,
      duration: reducedMotion ? 0 : 380,
      easing: easeCinematicOut,
      essential: true,
    });
  }, [ready, sheetHeightPx, explorerMode, reducedMotion, intentChangedThisRender, cameraIntent]);

  const intentKey = cameraIntent
    ? `${intentSeqRef.current}:${
        cameraIntent.type === 'level'
          ? `level:${cameraIntent.level}:${cameraIntent.center.join(',')}`
          : cameraIntent.type === 'reveal'
            ? `reveal:${cameraIntent.center.join(',')}`
            : cameraIntent.type === 'bearing'
              ? `bearing:${cameraIntent.northUp}:${cameraIntent.bearingDeg ?? ''}`
              : cameraIntent.type === 'zoom'
                ? `zoom:${cameraIntent.zoom}`
                : cameraIntent.type === 'flyover'
                  ? `flyover:${cameraIntent.routeId}`
                  : cameraIntent.type === 'follow'
                    ? `follow:${me ? `${me.lat.toFixed(5)},${me.lng.toFixed(5)}` : center.join(',')}`
                    : cameraIntent.type
      }`
    : '';

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !cameraIntent) return;
    const container = map.getContainer();
    const viewportHeightPx = container.clientHeight || 844;
    const livePadding = focusTargetPadding(sheetHeightPxRef.current, viewportHeightPx);

    if (cameraIntent.type === 'level') {
      if (!Number.isFinite(cameraIntent.center?.[0]) || !Number.isFinite(cameraIntent.center?.[1])) return;
      suppressMoveEnd.current = true;
      window.setTimeout(() => {
        suppressMoveEnd.current = false;
      }, 1500);
      flyToLevel(map, cameraIntent.center, cameraIntent.level, reducedMotion, {
        sheetHeightPx: sheetHeightPxRef.current,
        viewportHeightPx,
      });
      return;
    }
    if (cameraIntent.type === 'bearing') {
      if (cameraIntent.northUp) {
        map.easeTo({
          bearing: 0,
          padding: livePadding,
          duration: reducedMotion ? 0 : 420,
          easing: easeCinematicOut,
          essential: true,
        });
      } else if (typeof cameraIntent.bearingDeg === 'number' && Number.isFinite(cameraIntent.bearingDeg)) {
        map.easeTo({
          bearing: cameraIntent.bearingDeg,
          padding: livePadding,
          duration: reducedMotion ? 0 : 380,
          easing: easeCinematicOut,
          essential: true,
        });
      }
      return;
    }
    if (cameraIntent.type === 'zoom') {
      if (Number.isFinite(cameraIntent.zoom)) {
        map.easeTo({
          zoom: cameraIntent.zoom,
          padding: livePadding,
          duration: reducedMotion ? 0 : 380,
          easing: easeCinematicOut,
          essential: true,
        });
      }
      return;
    }
    if (cameraIntent.type === 'reveal') {
      if (!Number.isFinite(cameraIntent.center?.[0]) || !Number.isFinite(cameraIntent.center?.[1])) return;
      const targetCenter = cameraIntent.center;
      const viewportWidthPx = container.clientWidth || 390;
      revealAt(map, targetCenter, reducedMotion, {
        targetZoom: cameraIntent.zoom,
        sheetHeightPx: sheetHeightPxRef.current,
        viewportWidthPx,
        viewportHeightPx,
        onArrive: () => {
          const activeId = selectedFeatureRef.current?.id ?? selectedIdRef.current ?? null;
          if (activeId) {
            three3DRef.current?.triggerSelectionJuice(activeId);
          }
          try {
            const pt = map.project(targetCenter);
            if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
              const kind = normalize3DEntityKind(selectedFeatureRef.current?.kind ?? 'spot');
              vfxRef.current?.spawnArrivalBurst(pt.x, pt.y, accentHexFor3DKind(kind));
            }
          } catch {
            /* ignore */
          }
        },
      });
      return;
    }
    if (cameraIntent.type === 'follow') {
      const targetPos: [number, number] =
        me && Number.isFinite(me.lng) && Number.isFinite(me.lat)
          ? [me.lng, me.lat]
          : Array.isArray(center) && Number.isFinite(center[0]) && Number.isFinite(center[1])
            ? center
            : [2.35, 48.85];
      suppressMoveEnd.current = true;
      window.setTimeout(() => {
        suppressMoveEnd.current = false;
      }, 2500);
      const padding = followPadding(container.clientHeight, sheetHeightPx);
      followAt(map, targetPos, map.getBearing(), 1.4, padding, reducedMotion);
      return;
    }
    if (cameraIntent.type === 'overview') {
      suppressMoveEnd.current = true;
      window.setTimeout(() => {
        suppressMoveEnd.current = false;
      }, 2500);
      // Le tracé peut être découpé aux pauses : l'emprise doit couvrir tous les
      // segments, pas seulement le premier.
      const geometry = activityTrack
        ? {
            coordinates: activityTrack.features
              .map((feature) => feature.geometry?.coordinates)
              .filter(Boolean),
          }
        : null;
      const bounds = cameraIntent.bounds ?? boundsOfTrack(geometry);
      overviewOf(map, bounds, overviewPadding(container.clientWidth, sheetHeightPx), reducedMotion);
      return;
    }
    if (cameraIntent.type === 'flyover') {
      const points: Array<[number, number]> = [];
      const walk = (value: unknown) => {
        if (!Array.isArray(value)) return;
        if (typeof value[0] === 'number' && typeof value[1] === 'number') {
          if (Number.isFinite(value[0]) && Number.isFinite(value[1])) {
            points.push([value[0], value[1]]);
          }
          return;
        }
        for (const child of value) walk(child);
      };
      const targetRoutes = cameraIntent.routeId
        ? (routes ?? []).filter((r) => String(r.id) === String(cameraIntent.routeId))
        : (routes ?? []);
      for (const route of targetRoutes.length ? targetRoutes : (routes ?? [])) {
        walk((route.geojson as { coordinates?: unknown })?.coordinates);
      }
      if (points.length < 2) return;
      return flyoverTrack(map, points, reducedMotion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentKey, ready]);

  // ── repères projetés (overlay DOM, pas de Marker MapLibre) ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const hasDistanceMarkers = Boolean(distanceMarkers && distanceMarkers.length > 0);
    const hasMe = Boolean(me && Number.isFinite(me.lng) && Number.isFinite(me.lat));
    if (pins.length === 0 && !hasDistanceMarkers && !hasMe) {
      setOverlay((current) => (current.length === 0 ? current : []));
      setClusters((current) => (current.length === 0 ? current : []));
      setDistanceScreen((current) => (current.length === 0 ? current : []));
      setMeScreen((current) => (current === null ? current : null));
      return;
    }

    let frame = 0;

    const cachedChromeBottomRef = { current: 64 };
    const measureChrome = () => {
      const chrome = document.querySelector('.xp20-top-chrome, .xp-chrome') as HTMLElement | null;
      cachedChromeBottomRef.current = chrome?.getBoundingClientRect().bottom ?? 64;
    };
    measureChrome();

    const project = () => {
      frame = 0;
      const next: Array<{ pin: MapPin; x: number; y: number }> = [];
      const container = map.getContainer();
      if (!container) return;
      const cWidth = container.clientWidth || 390;
      const cHeight = container.clientHeight || 844;
      const sheetTop = cHeight - sheetHeightPx;
      // Bande haute occupée par la capsule et les boutons ronds : aucun repère
      // ni pastille ne doit s'y trouver (04_CARTE §1).
      const chromeBottom = cachedChromeBottomRef.current;

      for (const pin of pins) {
        if (!pin || !Number.isFinite(pin.lon) || !Number.isFinite(pin.lat)) continue;
        try {
          const point = map.project([pin.lon, pin.lat]);
          if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
          if (point.x < -80 || point.x > cWidth + 80) continue;
          if (point.y < -60 || point.y > cHeight + 60) continue;
          next.push({ pin, x: point.x, y: point.y });
        } catch {
          continue;
        }
      }
      // Agrégation (04_CARTE §1) : au-delà de 6 repères dans 100×100 px, la
      // cellule devient une pastille chiffrée qui zoome au toucher.
      const clustered = clusterPins(
        next
          .map((item) => ({
            id: item.pin.id,
            kind: item.pin.kind as PoiKind,
            x: item.x,
            y: item.y,
            distanceKm: item.pin.distanceKm ?? 0,
            item,
          }))
          .filter((entry) => entry.y >= chromeBottom + 4 && entry.y <= sheetTop - 8),
        { maxPerCell: 6, top: chromeBottom + 4 },
      );
      setClusters((current) => {
        const same =
          current.length === clustered.clusters.length &&
          current.every(
            (entry, index) =>
              Math.abs(entry.x - (clustered.clusters[index]?.x ?? 0)) < 0.5 &&
              Math.abs(entry.y - (clustered.clusters[index]?.y ?? 0)) < 0.5 &&
              entry.count === clustered.clusters[index]?.count,
          );
        return same ? current : clustered.clusters;
      });
      const zNow = map.getZoom();
      const effectiveLevel: Level = (
        Math.max(level, zNow >= 9.5 ? 3 : zNow >= 6.5 ? 2 : zNow >= 4.2 ? 1 : 0) as Level
      );
      const kept = selectVisiblePins(
        clustered.pins,
        {
          level: effectiveLevel,
          sheetTop,
          viewport: {
            width: cWidth,
            height: cHeight,
          },
        },
      ).map((entry) => entry.item);
      setOverlay((current) => {
        const same =
          current.length === kept.length &&
          current.every(
            (item, index) =>
              item.pin.id === kept[index]?.pin.id &&
              Math.abs(item.x - kept[index].x) < 0.5 &&
              Math.abs(item.y - kept[index].y) < 0.5,
          );
        return same ? current : kept;
      });
      // Marqueurs de distance (K3.12) : de simples étiquettes, jamais des
      // contrôles. Aucune ne doit apparaître sous le tiroir ni sous le chrome.
      if (distanceMarkers && distanceMarkers.length > 0) {
        const markerScreen: Array<{ marker: DistanceMarker; x: number; y: number }> = [];
        for (const marker of distanceMarkers) {
          if (!marker || !Number.isFinite(marker.lng) || !Number.isFinite(marker.lat)) continue;
          try {
            const point = map.project([marker.lng, marker.lat]);
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            if (point.x < -40 || point.x > cWidth + 40) continue;
            if (point.y < chromeBottom + 12 || point.y > sheetTop - 8) continue;
            const tooClose = markerScreen.some(
              (placed) =>
                Math.abs(placed.x - point.x) < DISTANCE_LABEL_GAP_X &&
                Math.abs(placed.y - point.y) < DISTANCE_LABEL_GAP_Y,
            );
            if (tooClose) continue;
            markerScreen.push({ marker, x: point.x, y: point.y });
          } catch {
            continue;
          }
        }
        setDistanceScreen((current) => {
          const same =
            current.length === markerScreen.length &&
            current.every(
              (entry, index) =>
                entry.marker.id === markerScreen[index]?.marker.id &&
                entry.marker.label === markerScreen[index]?.marker.label &&
                Math.abs(entry.x - (markerScreen[index]?.x ?? 0)) < 0.5 &&
                Math.abs(entry.y - (markerScreen[index]?.y ?? 0)) < 0.5,
            );
          return same ? current : markerScreen;
        });
      } else {
        setDistanceScreen((current) => (current.length === 0 ? current : []));
      }
      if (me && Number.isFinite(me.lng) && Number.isFinite(me.lat)) {
        try {
          const point = map.project([me.lng, me.lat]);
          if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
            setMeScreen((current) =>
              current && Math.abs(current.x - point.x) < 0.5 && Math.abs(current.y - point.y) < 0.5
                ? current
                : { x: point.x, y: point.y },
            );
          }
        } catch {
          /* ignore projection errors during map transitions */
        }
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(project);
    };

    project();
    map.on('move', schedule);
    map.on('zoom', schedule);
    map.on('moveend', schedule);
    window.addEventListener('resize', measureChrome);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      map.off('move', schedule);
      map.off('zoom', schedule);
      map.off('moveend', schedule);
      window.removeEventListener('resize', measureChrome);
    };
  }, [distanceMarkers, level, me, pins, ready, sheetHeightPx]);

  return (
    <div
      className="xp-map"
      ref={containerRef}
      data-testid="xp-map"
      data-level={level}
      data-ready={ready ? '1' : '0'}
      data-pins={pins.length}
      onPointerMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const rx = event.clientX - rect.left;
        const ry = event.clientY - rect.top;
        three3DRef.current?.setPointerScreenPos(rx, ry);

        // Desktop-only pointer hover tooltip & interactive cursor feedback (throttled to 40 ms)
        if (event.pointerType !== 'mouse') return;
        const now = performance.now();
        if (now - lastHoverCheckRef.current < 40) return;
        lastHoverCheckRef.current = now;

        const map = mapRef.current;
        const canvas = map?.getCanvas?.();
        const hovered3D = three3DRef.current?.pickAtPoint(rx, ry, 34);
        if (hovered3D && hovered3D.label) {
          if (canvas) canvas.style.cursor = 'pointer';
          const screenPos = three3DRef.current?.getScreenPos(hovered3D.id);
          setHoverTip({
            x: screenPos ? screenPos.x : rx,
            y: (screenPos ? screenPos.y : ry) - 28,
            title: hovered3D.label,
            sub: hovered3D.eleM != null ? `${Math.round(hovered3D.eleM)} m` : undefined,
          });
          return;
        }

        if (map && ready && map.getLayer('xp-routes-line')) {
          try {
            const routeHits = map.queryRenderedFeatures(
              [
                [rx - 10, ry - 10],
                [rx + 10, ry + 10],
              ],
              { layers: ['xp-routes-line'] },
            );
            const firstRoute = routeHits?.[0];
            if (firstRoute) {
              const rName =
                typeof firstRoute.properties?.name === 'string' && firstRoute.properties.name.trim()
                  ? firstRoute.properties.name.trim()
                  : 'Itinéraire';
              if (canvas) canvas.style.cursor = 'pointer';
              setHoverTip({ x: rx, y: ry - 18, title: rName });
              return;
            }
          } catch {
            /* ignore query error during style transitions */
          }
        }

        if (canvas && canvas.style.cursor === 'pointer') {
          canvas.style.cursor = '';
        }
        setHoverTip((prev) => (prev ? null : prev));
      }}
      onPointerLeave={() => {
        three3DRef.current?.setPointerScreenPos(null, null);
        const canvas = mapRef.current?.getCanvas?.();
        if (canvas && canvas.style.cursor === 'pointer') canvas.style.cursor = '';
        setHoverTip(null);
      }}
      {...(longPressHandlers as Record<string, unknown>)}
    >
      {!ready ? (
        <div className="xp-map-globe-skeleton" aria-hidden="true">
          <span />
        </div>
      ) : null}
      <canvas
        ref={threeCanvasRef}
        className="xp-three-overlay"
        data-testid="xp-three-overlay"
        aria-hidden="true"
      />
      <canvas
        ref={vfxCanvasRef}
        className="xp-vfx-overlay"
        data-testid="xp-vfx-overlay"
        aria-hidden="true"
      />
      <div className="xp-map-overlay" aria-hidden={false}>
        {distanceScreen.map(({ marker, x, y }) => (
          <span
            key={marker.id}
            className="xp-km-marker"
            data-distance-m={Math.round(marker.distanceM)}
            style={{ left: x, top: y }}
            aria-hidden="true"
          >
            <span>{marker.label}</span>
          </span>
        ))}
        {meScreen ? (
          <>
            <span className="xp-me-halo" style={{ left: meScreen.x, top: meScreen.y }} aria-hidden="true" />
            <span
              className="xp-me"
              style={{ transform: `translate3d(${meScreen.x}px, ${meScreen.y}px, 0) translate(-50%, -50%)` }}
              aria-label="Ma position"
              role="img"
            />
          </>
        ) : null}
        {clusters.map((cluster) => (
          <button
            key={`cluster-${Math.round(cluster.x)}-${Math.round(cluster.y)}`}
            type="button"
            className="xp-cluster"
            style={{ transform: `translate3d(${cluster.x}px, ${cluster.y}px, 0)` }}
            ref={(node) => {
              if (!node) return;
              node.onclick = () => {
                const map = mapRef.current;
                if (!map) return;
                vfxRef.current?.spawnTapRipple(cluster.x, cluster.y);
                map.easeTo({
                  center: map.unproject([cluster.x, cluster.y]),
                  zoom: Math.min(16, map.getZoom() + 2),
                  padding: focusTargetPadding(
                    sheetHeightPxRef.current,
                    map.getContainer()?.clientHeight || 844,
                  ),
                  duration: reducedMotion ? 0 : 580,
                  easing: easeCinematicOut,
                  essential: true,
                });
              };
            }}
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              vfxRef.current?.spawnTapRipple(cluster.x, cluster.y);
              map.easeTo({
                center: map.unproject([cluster.x, cluster.y]),
                zoom: Math.min(16, map.getZoom() + 2),
                padding: focusTargetPadding(
                  sheetHeightPxRef.current,
                  map.getContainer()?.clientHeight || 844,
                ),
                duration: reducedMotion ? 0 : 580,
                easing: easeCinematicOut,
                essential: true,
              });
            }}
            aria-label={`${cluster.count} repères groupés — zoomer`}
          >
            {cluster.count}
          </button>
        ))}
        {overlay.map(({ pin, x, y }) => {
          const pinKind = (pin.kind ?? '').toLowerCase();
          // Local 3D models (POIs, summits, refuges, water, bivouacs, spots) are self-explanatory in 3D:
          // render ONLY a clean invisible 44×44px accessible hit target over the floating 3D object
          // (no title pill clutter under 3D elements — tapping opens full details in the drawer below).
          if (pinKind !== 'country') {
            const live3DPos = three3DRef.current?.getScreenPos(pin.id);
            const hitX = live3DPos ? live3DPos.x : x;
            const hitY = live3DPos ? live3DPos.y : y - 18;
            return (
              <button
                key={pin.id}
                type="button"
                className="xp-pin-hit"
                data-pin={pin.id}
                data-kind={pinKind}
                data-selected={pin.id === selectedId ? 'true' : 'false'}
                style={{
                  transform: `translate3d(${hitX}px, ${hitY}px, 0) translate(-50%, -50%)`,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  const kind3D = normalize3DEntityKind(pin.kind);
                  three3DRef.current?.triggerSelectionJuice(pin.id);
                  vfxRef.current?.spawnTapRipple(hitX, hitY, accentHexFor3DKind(kind3D));
                  onPinClick?.(pin);
                }}
                aria-label={`${pin.name}${pin.sub ? `, ${pin.sub}` : ''}`}
              />
            );
          }

          return (
            <button
              key={pin.id}
              type="button"
              className="xp-pin"
              data-pin={pin.id}
              data-kind={pinKind}
              data-selected={pin.id === selectedId ? 'true' : 'false'}
              style={{
                transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`,
              }}
              onClick={(event) => {
                event.stopPropagation();
                onPinClick?.(pin);
              }}
              aria-label={`${pin.name}${pin.sub ? `, ${pin.sub}` : ''}`}
            >
              <span className="xp-pin-ico" data-tone={pin.tone ?? 'ink'} aria-hidden="true">
                <Compass size={11} strokeWidth={2.4} />
              </span>
              <span className="xp-pin-text">
                <span className="xp-pin-title">{pin.name}</span>
                {pin.sub ? <span className="xp-pin-sub">{pin.sub}</span> : null}
              </span>
            </button>
          );
        })}
        {hoverTip ? (
          <div
            className="xp20-hover-tip"
            style={{ left: hoverTip.x, top: hoverTip.y }}
            aria-hidden="true"
          >
            <span>{hoverTip.title}</span>
            {hoverTip.sub ? <span className="xp20-hover-tip-sub">{hoverTip.sub}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default MapStage;

