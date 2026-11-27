'use client';

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  CloudDownload,
  Phone,
  Play,
  Send,
  Sparkles,
} from 'lucide-react';
import './map/prefetchMapStage';
import type { MapPin } from './map/MapStage';
import { normalize3DEntityKind } from './map/explorerThree3DLayer';
import type { MapInteractiveSelection } from './map/featurePicking';
import { type ClubIslandToast } from '@/components/clubs/drawer/ClubIsland';
import { useAuth } from '@/contexts/AuthContext';
import { SortMenuButton, type SortMenuGroup } from '@/components/ui/drawer/SortMenuButton';
import type { SlotLens } from '@/components/compte/drawer/SlotShell';
import type { StoryUser } from '@/components/communaute/StoriesViewer';
import { ExplorerMapChrome } from './redesign/ExplorerMapChrome';
import { ExplorerGlassDrawer } from './redesign/ExplorerGlassDrawer';
import { ExplorerSportLaunchSheet } from './redesign/ExplorerSportLaunchSheet';
import { ExplorerPreFlightSheet } from './redesign/ExplorerPreFlightSheet';
import {
  ExplorerGpsDrawer,
  type ExplorerGpsClimbCard,
  type ExplorerGpsReroute,
  type ExplorerGpsTurnByTurn,
  type QuickWaypointKind,
} from './redesign/ExplorerGpsDrawer';
import {
  ExplorerSearchSheet,
  type ExplorerSearchResultItem,
} from './redesign/ExplorerSearchSheet';
import {
  ExplorerSummarySheet,
  type ExplorerSummaryPoint,
  type ExplorerSummaryWaypoint,
} from './redesign/ExplorerSummarySheet';
import { SavedPlacesDrawer } from './redesign/SavedPlacesDrawer';
import {
  SafetyReportModal,
  type SafetyReportOfflinePayload,
} from './redesign/SafetyReportModal';
import { buildGpxXml, downloadGpxFile, parseGpxXml } from './redesign/routing/gpxExport';
import { parseExplorerDeepLink, resolveCountryCenter } from './deepLink';
import {
  selectExplorerMapContext,
  type ExplorerCategory,
  type ExplorerDetent,
} from './redesign/mapContext';
import {
  EXPLORER_CATEGORY_LENSES,
  ExplorerRouteDetailView,
  ExplorerSpotsLens,
  ExplorerTerritoryLens,
  type ExplorerFeaturedDestination,
  type ExplorerSpotRoute,
} from './redesign/lenses/ExplorerCategoryLenses';
import { ExplorerPoiDetailView } from './redesign/lenses/ExplorerPoiDetailView';
import { ExplorerPoiRoutingView } from './redesign/routing/ExplorerPoiRoutingView';
import type { VerifiedGpsState } from './redesign/routing/RouteOriginSubDrawer';
import type {
  ComputedItinerary,
  RoutePlanEndpoint,
  RoutePlanResponse,
  RoutingTravelMode,
  UserCapabilityManifest,
} from './routing/types';
import { poiMatchesSpotsFilter, type SpotsFilterKind } from './poiTaxonomy';
import {
  LAYERS_CATEGORY_LENSES,
  LayersOfflineLens,
  LayersOverlaysLens,
  LayersPresetsLens,
  type OfflinePackItem,
} from './redesign/lenses/LayersCategoryLenses';
import {
  ExplorerPokedexLens,
  POKEDEX_CATEGORY_LENSES,
  type PokedexRarityFilter,
} from './redesign/lenses/PokedexCategoryLenses';
import {
  SAFETY_CATEGORY_LENSES,
  SafetyHazardsLens,
  SafetySurvivalLens,
  SafetyWeatherLens,
  type HazardKindFilter,
  type SurvivalKindFilter,
} from './redesign/lenses/SafetyCategoryLenses';
import {
  COMMUNITY_CATEGORY_LENSES,
  CommunityBottlesLens,
  CommunityCarnetsLens,
  CommunityClubsLens,
  CommunityStoriesLens,
  extractCarnetsFromGeoJson,
  extractClubsFromGeoJson,
  extractEventsFromGeoJson,
  extractFriendsFromGeoJson,
  extractStoriesFromGeoJson,
  type ExplorerBottleItem,
  type ExplorerStoryItem,
} from './redesign/lenses/CommunityCategoryLenses';
import { explorerAbortRegistry } from './data/abortRegistry';
import {
  useAirspaceLive,
  useExplorerHazards,
  usePokedexNear,
  useRadarManifest,
  useSocialMapLayers,
  useTerritorialEncyclopedia,
  type ExplorerHudMode,
  type GeoJsonFeatureCollection,
  type MapBbox,
  type SocialMapKind,
} from './data/unifiedLayersHooks';
import { computeOfflineDaylight } from './adaptive';
import { countCorridorVitalPois } from './map/safetyCorridor';
import { GpsKalmanFilter } from './hud/kalmanFilter';
import {
  buildAdaptiveOverviewBundle,
  buildUnifiedLayerItems,
} from './unifiedBridge';
import { useLongPress } from './activity/Countdown';
import { useGpsTracker, type RestoredTrackerState } from './activity/useGpsTracker';
import {
  createTrackTrace,
  interruptTrack,
  pushTrackPoint,
  trackGeoJson,
  type TrackTrace,
} from './activity/trackTrace';
import type { ActivityMetrics, GpsFix } from './activity/tracker';
import { endLiveActivity, startLiveActivity, updateLiveActivity } from './native/liveActivity';
import {
  detectDevicePlatform,
  requestDeviceLocationAndSensors,
  subscribeGeolocationPermissionChange,
  type DeviceLocationResult,
  type FailedDeviceLocation,
} from './native/devicePermissions';
import { performSosCall, planSosCall, sosSimulated } from './activity/sosCall';
import { enqueue, flushQueue, idempotencyKey, listQueue } from './offline/queue';
import { downloadZone, registerOfflineWorker } from './offline/zone';
import { bearingLabel, offRouteLabel } from './activity/offRoute';
import { nearestPointOnRouteM, routeLines } from './geo/track';
import { fetchRouteGeometry } from './data/routeGeometry';
import { consumePendingStageLaunch, trailSnapshotFromStage } from '@/features/planning/explorerAdapter';
import { useRouteSlope } from './data/useRouteSlope';
import { verifiedNationalTopoFor } from './map/nationalTopo';
import { buildDistanceMarkers } from './map/distanceMarkers';
import { shouldKeepFinishInQueue } from './activity/finishOutcome';
import {
  activityFromRecord,
  appendSessionPoint,
  flushLocalSessionWrites,
  forgetFinishedSession,
  newClientSessionId,
  readActiveSession,
  readLatestFinishedSession,
  readSessionPoints,
  readSessionRoute,
  recordFromActivity,
  saveActiveSession,
  saveFinishedSession,
  saveSessionRoute,
  type LocalSessionPoint,
  type LocalSessionRecord,
} from './activity/localSession';
import {
  defaultAccessToken,
  ensureServerSession,
  finishSession,
  finishSessionById,
  loadSessionForSync,
  syncPendingPoints,
} from './activity/sessionSync';
import { writeSavedPlaces, type SavedPlace } from './savedPlaces';
import { haptic } from './state/haptics';
import { EXPLORER_PRESET_BY_ID } from './state/presets';
import type { SpatialScale } from './state/spatialScale';
import {
  hydrateAutoPausePreference,
  useExplorerStore,
  useTransientStart,
} from './state/store';
import type {
  ActivityState,
  MapBaseStyle,
  PoiKind,
  Sport,
  SportSelection,
  TrailRouteSnapshot,
} from './state/types';
import { useNavigationGuidance } from './guidance/useNavigationGuidance';
import type { OfflineRuntimeStore } from '@/features/offline/offlineRuntimeStore';
import type {
  OfflineDownloadProgress,
  OfflineInstalledPackRecord,
  PredefinedRegionCatalogItem,
} from '@/features/offline';
import { isSceneName, SCENES } from './state/scenes';
import type { SearchViewport } from './searchArea';
import type { GeoCollection } from './data/hooks';
import {
  isGeoJsonInViewport,
  isPointInViewport,
  mergeSpatialPois,
  mergeSpatialRoutes,
  useExplorerLoadingState,
  viewportRadiusKm,
} from './data/spatialLoader';
import {
  geometryCenter,
  useBikePois,
  useCommunityHeatmap,
  useCountriesGeo,
  useCountryDetails,
  useFireIncidents,
  useOnline,
  usePersonalHeatmap,
  usePlace,
  usePoiDetail,
  useReducedMotion,
  useRegionsGeo,
  useReportsNear,
  useRouteDetail,
  useRouteHighlights,
  useRouteSurfaces,
  useSystemTheme,
  useWeather,
  type CountryFeatureProperties,
  type RouteItem,
} from './data/hooks';
import {
  distanceKm,
  findCountryAt,
  findRegionAt,
  type CountryEntry,
} from './sheet/context';
import '@/styles/explorer-glass.css';
import '@/styles/explorer-v2.css';

const MapStage = dynamic(() => import('./map/MapStage'), {
  ssr: false,
  loading: () => (
    <div className="xp-map">
      <div className="xp-map-globe-skeleton" aria-hidden="true">
        <span />
      </div>
    </div>
  ),
});

const Countdown = dynamic(
  () => import('./activity/Countdown').then((m) => m.Countdown),
  { ssr: false, loading: () => null },
);

const BottleLaunchModal = dynamic(
  () => import('./redesign/lenses/BottleLaunchModal').then((m) => m.BottleLaunchModal),
  { ssr: false, loading: () => null },
);

const StoriesViewer = dynamic(
  () => import('@/components/communaute/StoriesViewer'),
  { ssr: false, loading: () => null },
);

const loadOfflineRuntimeStore = () =>
  import('@/features/offline/offlineRuntimeStore').then((m) => m.getOfflineRuntimeStore());

const IMPERIAL_COUNTRIES = new Set(['US', 'LR', 'MM']);
const EMPTY_PINS: MapPin[] = [];
const EMPTY_VISIBILITY: Record<string, boolean> = Object.freeze({});
const EMPTY_UNIFIED_GEOJSON: Record<string, GeoCollection | null | undefined> = Object.freeze({});
const SUMMARY_RESTORE_TTL_MS = 24 * 60 * 60 * 1000;
const POINT_SYNC_EVERY = 10;
const POINT_SYNC_INTERVAL_MS = 5000;

type OverlayMode =
  | 'none'
  | 'sport'
  | 'preflight'
  | 'saved'
  | 'search'
  | 'route-detail'
  | 'poi-detail'
  | 'poi-routing'
  | 'summary';

const SPORT_LABELS: Record<Sport, string> = {
  rando: 'Rando',
  trail: 'Trail',
  velo: 'Vélo',
  course: 'Course',
  escalade: 'Alpinisme',
  ski: 'Ski',
  kayak: 'Kayak',
  bivouac: 'Bivouac',
  famille: 'Famille',
};

function inferSportFromRouteNetwork(network?: string | null): Sport {
  const net = (network ?? '').trim().toLowerCase();
  if (net === 'mtb' || net === 'ncn' || net === 'rcn' || net === 'lcn') {
    return 'velo';
  }
  return 'rando';
}

function computeGeoJsonBounds(geojson: unknown): [[number, number], [number, number]] | null {
  const lines = routeLines(geojson);
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const line of lines) {
    for (const [lng, lat] of line) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }
  if (Math.abs(maxLng - minLng) < 0.0005 && Math.abs(maxLat - minLat) < 0.0005) {
    return null;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function formatClockHm(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(ms),
    );
  } catch {
    return null;
  }
}

function normalizeExplorerCategory(raw: string | null | undefined): ExplorerCategory | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key === 'explorer' || key === 'spots' || key === 'territoire') return 'explorer';
  if (key === 'layers' || key === 'calques' || key === 'carte' || key === 'offline') return 'layers';
  if (key === 'pokedex' || key === 'faune' || key === 'flore' || key === 'nature') return 'pokedex';
  if (key === 'safety' || key === 'securite' || key === 'meteo' || key === 'risques') return 'safety';
  if (key === 'community' || key === 'communaute' || key === 'clubs' || key === 'carnets') {
    return 'community';
  }
  return null;
}

function normalizeSavedPlaceKind(raw: string | null | undefined): SavedPlace['kind'] {
  if (raw === 'route' || raw === 'highlight' || raw === 'place' || raw === 'poi') return raw;
  return 'poi';
}

function mapOfflineReportPayload(
  payload: SafetyReportOfflinePayload,
  placeName: string,
): Record<string, unknown> {
  const mapping: Record<
    string,
    {
      apiCategory: 'obstacle' | 'snow_ice' | 'water' | 'mud' | 'rockfall' | 'marking';
      severity: 'info' | 'warning' | 'critical';
      passability: 'passable' | 'difficult' | 'impassable';
      label: string;
    }
  > = {
    trail_blocked: {
      apiCategory: 'obstacle',
      severity: 'warning',
      passability: 'impassable',
      label: 'Sentier coupé / Obstacle',
    },
    snow: {
      apiCategory: 'snow_ice',
      severity: 'warning',
      passability: 'difficult',
      label: 'Neige / Verglas',
    },
    water_dry: {
      apiCategory: 'water',
      severity: 'warning',
      passability: 'passable',
      label: "Point d'eau à sec",
    },
    mud: {
      apiCategory: 'mud',
      severity: 'info',
      passability: 'difficult',
      label: 'Boue / Glissant',
    },
    hazard: {
      apiCategory: 'rockfall',
      severity: 'critical',
      passability: 'impassable',
      label: 'Danger / Éboulement',
    },
    clear: {
      apiCategory: 'marking',
      severity: 'info',
      passability: 'passable',
      label: 'Accès dégagé',
    },
  };
  const meta = mapping[payload.category] ?? mapping.trail_blocked;
  const prefix = placeName.trim() ? `${placeName.trim()} · ${meta.label}` : meta.label;
  const description = payload.note.trim() ? `${prefix} — ${payload.note.trim()}` : prefix;
  return {
    lat: payload.lat,
    lng: payload.lng,
    category: meta.apiCategory,
    severity: meta.severity,
    passability: meta.passability,
    description: description.slice(0, 950),
  };
}

const CATEGORY_TITLES: Record<ExplorerCategory, string> = {
  explorer: 'Explorer',
  layers: 'Carte & Calques',
  pokedex: 'Pokédex',
  safety: 'Sécurité & Terrain',
  community: 'Communauté',
};

const CATEGORY_LENSES_MAP: Record<ExplorerCategory, SlotLens[]> = {
  explorer: EXPLORER_CATEGORY_LENSES,
  layers: LAYERS_CATEGORY_LENSES,
  pokedex: POKEDEX_CATEGORY_LENSES,
  safety: SAFETY_CATEGORY_LENSES,
  community: COMMUNITY_CATEGORY_LENSES,
};

function traceFromSessionPoints(points: ReadonlyArray<LocalSessionPoint>): TrackTrace {
  let trace = createTrackTrace();
  for (const point of points) {
    if (point.drawn === false) continue;
    if (point.breakBefore === true) {
      trace = interruptTrack(trace);
    } else {
      const last = trace.current[trace.current.length - 1];
      if (last && last[0] === point.lng && last[1] === point.lat) continue;
    }
    trace = pushTrackPoint(trace, [point.lng, point.lat]);
  }
  return trace;
}

function extractBottlesFromGeoJson(
  fc: GeoJsonFeatureCollection | null | undefined,
): ExplorerBottleItem[] {
  if (!fc?.features?.length) return [];
  const out: ExplorerBottleItem[] = [];
  for (let i = 0; i < fc.features.length; i += 1) {
    const f = fc.features[i];
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const geom = f.geometry as { type?: unknown; coordinates?: unknown } | null | undefined;
    let coords: [number, number] | null = null;
    if (
      geom?.type === 'Point' &&
      Array.isArray(geom.coordinates) &&
      geom.coordinates.length >= 2 &&
      Number.isFinite(Number(geom.coordinates[0])) &&
      Number.isFinite(Number(geom.coordinates[1]))
    ) {
      coords = [Number(geom.coordinates[0]), Number(geom.coordinates[1])];
    }
    const maxMembers = typeof p.maxMembers === 'number' && Number.isFinite(p.maxMembers) ? p.maxMembers : 6;
    const activeMembersCount =
      typeof p.activeMembersCount === 'number' && Number.isFinite(p.activeMembersCount)
        ? p.activeMembersCount
        : 0;
    const spotsLeft =
      typeof p.spotsLeft === 'number' && Number.isFinite(p.spotsLeft)
        ? p.spotsLeft
        : Math.max(0, maxMembers - activeMembersCount);

    out.push({
      id: String(p.id ?? f.id ?? `bottle-${i}`),
      name: String(p.name ?? 'Bouteille à la mer'),
      description: typeof p.description === 'string' ? p.description : null,
      countryIso: typeof p.countryIso === 'string' ? p.countryIso : null,
      departureDate: typeof p.departureDate === 'string' ? p.departureDate : null,
      returnDate: typeof p.returnDate === 'string' ? p.returnDate : null,
      maxMembers,
      activeMembersCount,
      spotsLeft,
      minTrustScore:
        typeof p.minTrustScore === 'number' && Number.isFinite(p.minTrustScore)
          ? p.minTrustScore
          : 50,
      mixite: typeof p.mixite === 'string' ? p.mixite : null,
      ownerId: typeof p.ownerId === 'string' ? p.ownerId : null,
      coordinates: coords,
      ownerName: typeof p.ownerName === 'string' ? p.ownerName : null,
      ownerAvatarUrl: typeof p.ownerAvatarUrl === 'string' ? p.ownerAvatarUrl : null,
      ownerTrustScore:
        typeof p.ownerTrustScore === 'number' && Number.isFinite(p.ownerTrustScore)
          ? p.ownerTrustScore
          : null,
      destination: typeof p.destination === 'string' ? p.destination : null,
      inArea: typeof p.inArea === 'boolean' ? p.inArea : true,
      hasExactCoords: typeof p.hasExactCoords === 'boolean' ? p.hasExactCoords : true,
    });
  }
  return out;
}

function extractRouteFirstCoord(geojson: unknown): [number, number] | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const obj = geojson as Record<string, unknown>;
  if (obj.type === 'Feature') return extractRouteFirstCoord(obj.geometry);
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      const hit = extractRouteFirstCoord(f);
      if (hit) return hit;
    }
    return null;
  }
  const walk = (node: unknown): [number, number] | null => {
    if (!Array.isArray(node)) return null;
    if (
      typeof node[0] === 'number' &&
      typeof node[1] === 'number' &&
      Number.isFinite(node[0]) &&
      Number.isFinite(node[1])
    ) {
      return [node[0], node[1]];
    }
    for (const child of node) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(obj.coordinates);
}

export interface ExplorerV2Props {
  initialScene?: string | null;
  initialCenter?: [number, number] | null;
  initialZoom?: number | null;
  hasExplicitUrlLocation?: boolean;
}

interface ExplorerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ExplorerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ExplorerErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ExplorerErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ExplorerV2 caught]', error, info);
    try {
      fetch('/api/dev/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error?.message ?? String(error),
          stack: error?.stack,
          componentStack: info?.componentStack,
          href: typeof window !== 'undefined' ? window.location.href : '',
        }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="xp-root xp20-root"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            background: '#FBFAF6',
            color: '#172B24',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>
            Explorer temporairement indisponible
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#56665D' }}>
            Un module de la carte a rencontré un imprévu.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              height: 42,
              padding: '0 22px',
              borderRadius: 999,
              border: 0,
              background: '#17402C',
              color: '#FBFAF6',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GPS_LOCATE_HARD_TIMEOUT_MS = 6000;
const GUIDED_ROUTE_FOLLOW_MAX_KM = 20;

function extractItineraryFocus(
  itinerary: ComputedItinerary,
  fallbackOrigin?: RoutePlanEndpoint | null,
): {
  start: [number, number] | null;
  bounds: [[number, number], [number, number]] | null;
} {
  const rawCoords = itinerary.geojson?.geometry?.coordinates ?? [];
  let start: [number, number] | null = null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const pt of rawCoords) {
    if (
      Array.isArray(pt) &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
    ) {
      if (!start) start = [pt[0], pt[1]];
      if (pt[0] < minLng) minLng = pt[0];
      if (pt[1] < minLat) minLat = pt[1];
      if (pt[0] > maxLng) maxLng = pt[0];
      if (pt[1] > maxLat) maxLat = pt[1];
    }
  }

  if (
    !start &&
    fallbackOrigin &&
    Number.isFinite(fallbackOrigin.lng) &&
    Number.isFinite(fallbackOrigin.lat)
  ) {
    start = [fallbackOrigin.lng, fallbackOrigin.lat];
  }

  const hasValidBounds =
    Number.isFinite(minLng) &&
    Number.isFinite(minLat) &&
    Number.isFinite(maxLng) &&
    Number.isFinite(maxLat) &&
    (Math.abs(maxLng - minLng) > 0.0005 || Math.abs(maxLat - minLat) > 0.0005);

  return {
    start,
    bounds: hasValidBounds
      ? [
          [minLng, minLat],
          [maxLng, maxLat],
        ]
      : null,
  };
}

function ExplorerV2Inner({
  initialScene,
  initialCenter,
  initialZoom,
  hasExplicitUrlLocation = false,
}: ExplorerV2Props) {
  const state = useExplorerStore();
  const { user } = useAuth();
  const savedPlacesUserKey = user?.id ?? null;
  const { pendingStart, requestStart, confirmStart, cancelStart } = useTransientStart();
  const systemTheme = useSystemTheme();
  const reducedMotion = useReducedMotion();
  const online = useOnline();

  // ── 20/20 Apple Liquid Glass Single-Drawer State ────────────────────────
  const [detent, setDetentState] = useState<ExplorerDetent>(
    hasExplicitUrlLocation ? 'mid' : 'peek',
  );
  const [category, setCategoryState] = useState<ExplorerCategory>('explorer');
  const [lensIndexByCategory, setLensIndexByCategory] = useState<Record<ExplorerCategory, number>>({
    explorer: 0,
    layers: 0,
    pokedex: 0,
    safety: 0,
    community: 0,
  });
  const [hasInteracted, setHasInteracted] = useState<boolean>(
    Boolean(initialScene || hasExplicitUrlLocation),
  );
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [preFlightSport, setPreFlightSport] = useState<Sport>('rando');
  const [preFlightSelection, setPreFlightSelection] = useState<SportSelection | undefined>(undefined);
  const [lastSummaryId, setLastSummaryId] = useState<string | null>(null);
  const [sessionWaypoints, setSessionWaypoints] = useState<ExplorerSummaryWaypoint[]>([]);
  const [sessionPhotosCount, setSessionPhotosCount] = useState<number>(0);
  const [liveTelemetry, setLiveTelemetry] = useState<{
    altitudeM: number | null;
    speedKmh: number | null;
  }>({ altitudeM: null, speedKmh: null });
  const [beaconSessionId, setBeaconSessionId] = useState<string | null>(null);
  const [beaconShareUrl, setBeaconShareUrl] = useState<string | null>(null);
  const [observedTaxonIds, setObservedTaxonIds] = useState<Set<number>>(() => new Set());
  const [safetyReportOpen, setSafetyReportOpen] = useState(false);
  const sessionPointsRef = useRef<ExplorerSummaryPoint[]>([]);
  const autoLocatedRef = useRef(false);

  // Interactive selections & filters inside lenses
  const [selectedFeature, setSelectedFeature] = useState<{
    id: string;
    coordinates: [number, number];
    kind?: string;
    label?: string;
  } | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<ExplorerSpotRoute | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<MapPin | null>(null);
  // Personalized POI Routing Engine state (preserved across drawer peek collapses)
  const [userCapabilities, setUserCapabilities] = useState<UserCapabilityManifest | null>(null);
  const [poiRoutePlan, setPoiRoutePlan] = useState<RoutePlanResponse | null>(null);
  const [poiRouteLoading, setPoiRouteLoading] = useState(false);
  const [poiRouteError, setPoiRouteError] = useState<string | null>(null);
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [showRouteAlternativesOnMap, setShowRouteAlternativesOnMap] = useState(false);
  const [routingMode, setRoutingMode] = useState<RoutingTravelMode>('rando');
  const [routingPackWeightKg, setRoutingPackWeightKg] = useState<number | null>(null);
  const [routingKitId, setRoutingKitId] = useState<string | null>(null);
  const [routingOrigin, setRoutingOrigin] = useState<RoutePlanEndpoint | null>(null);
  const [verifiedGps, setVerifiedGps] = useState<VerifiedGpsState>({ status: 'idle' });
  const routePlanAbortRef = useRef<AbortController | null>(null);
  const [selectedTaxonId, setSelectedTaxonId] = useState<number | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [selectedCarnetId, setSelectedCarnetId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [bottleModalOpen, setBottleModalOpen] = useState(false);
  const [activeStoryViewer, setActiveStoryViewer] = useState<StoryUser[] | null>(null);

  // Per-category SortMenuButton filters
  const [spotsSort, setSpotsSort] = useState<'proximity' | 'elevation' | 'distance'>('proximity');
  const [spotsFilter, setSpotsFilter] = useState<SpotsFilterKind>('all');
  const [pokedexRarity, setPokedexRarity] = useState<PokedexRarityFilter>('all');
  const [hazardKindFilter, setHazardKindFilter] = useState<HazardKindFilter>('all');
  const [survivalFilter, setSurvivalFilter] = useState<SurvivalKindFilter>('all');
  const [communitySort, setCommunitySort] = useState<
    'recent' | 'spots' | 'popular' | 'members' | 'verified' | 'alpha'
  >('recent');

  // Headless runtime state
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);
  const locateRequestSeqRef = useRef(0);
  const locateTimeoutRef = useRef<number | null>(null);
  const guidedRouteFocusRef = useRef<{
    start: [number, number];
    bounds: [[number, number], [number, number]] | null;
  } | null>(null);
  const freshActivityGpsFixRef = useRef<{ lat: number; lng: number; atMs: number } | null>(null);
  const lastFreshPlaceRef = useRef<{
    center: [number, number];
    placeName: string | null;
    regionName: string | null;
    countryCode: string | null;
    elevationM: number | null;
  } | null>(null);
  const [locationErrorInfo, setLocationErrorInfo] = useState<FailedDeviceLocation | null>(null);
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(false);
  const [bearingDeg, setBearingDeg] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState(0);
  const [mapViewport, setMapViewport] = useState<SearchViewport | null>(null);
  const [mapActivity, setMapActivity] = useState<{
    isMoving: boolean;
    tilesLoading: boolean;
    glbPendingCount: number;
  }>({ isMoving: false, tilesLoading: false, glbPendingCount: 0 });
  const handleMapActivityChange = useCallback(
    (next: { isMoving: boolean; tilesLoading: boolean; glbPendingCount: number }) => {
      startTransition(() => {
        setMapActivity((prev) =>
          prev.isMoving === next.isMoving &&
          prev.tilesLoading === next.tilesLoading &&
          prev.glbPendingCount === next.glbPendingCount
            ? prev
            : next,
        );
      });
    },
    [],
  );
  const mapViewportRef = useRef<SearchViewport | null>(null);
  const onMapViewportChange = useCallback((next: SearchViewport) => {
    mapViewportRef.current = next;
    startTransition(() => {
      setMapViewport(next);
    });
  }, []);

  const [restoredTracker, setRestoredTracker] = useState<RestoredTrackerState | null>(null);
  const traceBreakRef = useRef(false);
  const restoreDoneRef = useRef(false);
  const pointSeqRef = useRef(0);
  const pointsSinceSyncRef = useRef(0);
  const pointSyncInFlightRef = useRef(false);
  const startAttemptRef = useRef(new Set<string>());
  const localSessionRef = useRef<LocalSessionRecord | null>(null);
  const kalmanRef = useRef<GpsKalmanFilter | null>(null);
  const [gpsMeta, setGpsMeta] = useState<{ accuracyM: number | null; deadReckoning: boolean }>({
    accuracyM: null,
    deadReckoning: false,
  });

  // Expose store for QA / scenes in non-prod
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_EXPLORER_SCENES !== '1' &&
      !initialScene
    ) {
      return;
    }
    (window as unknown as { __xpStore?: unknown }).__xpStore = useExplorerStore;
  }, [initialScene]);

  const theme = state.theme ?? systemTheme;
  const unitsForCountry: 'metric' | 'imperial' =
    state.units === 'imperial' || IMPERIAL_COUNTRIES.has(state.geo) ? 'imperial' : 'metric';

  // Scene & universal URL deep-link hydration in effect (never mutate store during render!)
  const initialHydrationDoneRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || initialHydrationDoneRef.current) return;
    initialHydrationDoneRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    const dl = parseExplorerDeepLink(sp);

    let s = initialScene;
    if (
      !s &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      s = dl.scene ?? sp.get('scene');
    }
    if (s && isSceneName(s)) {
      useExplorerStore.getState().hydrateFromScene(s);
      return;
    }

    if (hasExplicitUrlLocation && initialCenter) {
      const targetZoom =
        typeof initialZoom === 'number' && Number.isFinite(initialZoom) ? initialZoom : 12.5;
      const targetLevel: 0 | 1 | 2 | 3 =
        targetZoom >= 9.5 ? 3 : targetZoom >= 6.5 ? 2 : targetZoom >= 4.2 ? 1 : 0;
      useExplorerStore.setState({
        center: initialCenter,
        zoom: targetZoom,
        level: targetLevel,
        detent: 'mid',
        camera: { type: 'reveal', center: initialCenter, zoom: targetZoom },
      });
      setHasInteracted(true);
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
    } else if (dl.country) {
      const countryHit = resolveCountryCenter(dl.country);
      if (countryHit) {
        useExplorerStore.setState({
          center: countryHit.center,
          zoom: countryHit.zoom,
          level: countryHit.zoom >= 7 ? 2 : 1,
          geo: dl.country.length === 2 ? dl.country.toUpperCase() : '',
          camera: { type: 'reveal', center: countryHit.center, zoom: countryHit.zoom },
        });
        setHasInteracted(true);
        setDetentState((d) => (d === 'peek' ? 'mid' : d));
      }
    }

    if (dl.kitId) {
      setRoutingKitId(dl.kitId);
    }

    const mappedCategory = normalizeExplorerCategory(dl.category);
    if (mappedCategory) {
      setCategoryState(mappedCategory);
      setHasInteracted(true);
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
    }

    if (dl.carnet) {
      setCategoryState('community');
      setLensIndexByCategory((prev) => ({ ...prev, community: 1 }));
      setSelectedCarnetId(dl.carnet);
      setHasInteracted(true);
      setDetentState('mid');
    } else if (dl.sortie) {
      setCategoryState('community');
      setLensIndexByCategory((prev) => ({ ...prev, community: 2 }));
      setSelectedClubId(dl.sortie);
      setHasInteracted(true);
      setDetentState('mid');
    }

    const deepRouteId = dl.routeId ?? dl.trail;
    if (deepRouteId) {
      const numericId = Number(deepRouteId);
      const stubRoute: ExplorerSpotRoute = {
        id: Number.isFinite(numericId) && numericId > 0 ? numericId : 0,
        name: `Itinéraire #${deepRouteId}`,
        distance_km: null,
        network: null,
        ref: null,
        geojson: null,
      };
      setSelectedRoute(stubRoute);
      useExplorerStore.getState().select({ kind: 'trail', id: deepRouteId }, 'trail', 'mid');
      setCategoryState('explorer');
      setLensIndexByCategory((prev) => ({ ...prev, explorer: 0 }));
      setOverlayMode('route-detail');
      setDetentState('mid');
      setHasInteracted(true);
    } else if (dl.query) {
      useExplorerStore.setState({ searchQuery: dl.query });
      setHasInteracted(true);
      setOverlayMode('search');
      setDetentState('full');
    } else if (dl.planner) {
      setHasInteracted(true);
      setOverlayMode('saved');
    }
  }, [initialScene, initialCenter, initialZoom, hasExplicitUrlLocation]);

  useEffect(() => {
    if (!initialScene || !isSceneName(initialScene)) return;
    if (useExplorerStore.getState().scene !== initialScene) {
      useExplorerStore.getState().hydrateFromScene(initialScene);
    }
  }, [initialScene]);

  useEffect(() => {
    if (typeof window === 'undefined' || initialScene || !initialCenter) return;
    const current = useExplorerStore.getState();
    if (current.scene) return;
    if (hasExplicitUrlLocation) {
      const targetZoom =
        typeof initialZoom === 'number' && Number.isFinite(initialZoom) ? initialZoom : 12.5;
      const targetLevel: 0 | 1 | 2 | 3 =
        targetZoom >= 9.5 ? 3 : targetZoom >= 6.5 ? 2 : targetZoom >= 4.2 ? 1 : 0;
      useExplorerStore.setState({
        center: initialCenter,
        zoom: targetZoom,
        level: targetLevel,
        camera: { type: 'reveal', center: initialCenter, zoom: targetZoom },
      });
      setHasInteracted(true);
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
      return;
    }
    useExplorerStore.setState({ center: initialCenter, level: 0 });
  }, [initialCenter, initialZoom, hasExplicitUrlLocation, initialScene]);

  useEffect(() => {
    useExplorerStore.setState({ online });
  }, [online]);

  useEffect(() => {
    hydrateAutoPausePreference();
  }, []);

  useEffect(() => {
    void registerOfflineWorker();
    void listQueue().then((items) => setOfflineQueue(items.length));
  }, []);

  // Offline write queue flush
  const flushInFlight = useRef(false);
  const flushPending = useCallback(async () => {
    if (flushInFlight.current) return;
    flushInFlight.current = true;
    try {
      const result = await flushQueue(async (operation) => {
        if (operation.kind === 'activity.finish') {
          const queuedClient =
            typeof operation.payload.clientSessionId === 'string'
              ? operation.payload.clientSessionId
              : null;
          const queuedSession =
            typeof operation.payload.sessionId === 'string'
              ? operation.payload.sessionId
              : null;
          const queuedKey =
            typeof operation.payload.idempotencyKey === 'string'
              ? operation.payload.idempotencyKey
              : operation.key;

          let outcome = null;
          if (queuedClient) {
            const stored = await loadSessionForSync(queuedClient);
            if (stored) {
              const endedAt =
                typeof operation.payload.endedAt === 'number' ? operation.payload.endedAt : null;
              const record =
                stored.endedAt === null && endedAt !== null
                  ? { ...stored, endedAt, status: 'finished' as const }
                  : stored;
              const finished = await finishSession(record);
              if (!finished.ok) {
                const terminal =
                  finished.reason === 'conflict' ||
                  finished.reason === 'rejected' ||
                  finished.reason === 'invalid';
                if (
                  terminal &&
                  useExplorerStore.getState().summary?.clientSessionId === queuedClient
                ) {
                  useExplorerStore.setState({ summarySaved: 'failed' });
                }
                return terminal;
              }
              outcome = finished.outcome;
            } else if (queuedSession) {
              outcome = await finishSessionById(queuedSession, queuedKey);
            } else {
              return true;
            }
          } else if (queuedSession) {
            outcome = await finishSessionById(queuedSession, queuedKey);
          } else {
            return true;
          }
          if (!outcome) return false;
          if (shouldKeepFinishInQueue(outcome)) return false;
          const current = useExplorerStore.getState();
          const sameSummary =
            (queuedClient && current.summary?.clientSessionId === queuedClient) ||
            (queuedSession && current.summary?.sessionId === queuedSession);
          if (sameSummary) {
            if (outcome.summaryId) setLastSummaryId(outcome.summaryId);
            useExplorerStore.setState({ summarySaved: outcome.state });
          }
          return true;
        }
        const token = await defaultAccessToken();
        if (!token) return false;
        const authHeaders = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        if (operation.kind === 'report-confirm') {
          const res = await fetch('/api/explorer/v2/reports/confirm', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(operation.payload),
          });
          return res.ok || res.status === 400 || res.status === 404;
        }
        if (operation.kind === 'report') {
          const res = await fetch('/api/explorer/v2/reports', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(operation.payload),
          });
          return res.ok || res.status === 400;
        }
        if (operation.kind === 'sos') {
          const res = await fetch('/api/explorer/v2/sos', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(operation.payload),
          });
          return res.ok || res.status === 400;
        }
        return false;
      });
      if (result.sent > 0) {
        useExplorerStore.getState().showToast({
          title: `${result.sent} opération(s) synchronisée(s)`,
          tone: 'good',
        });
      }
      const items = await listQueue();
      setOfflineQueue(items.length);
    } finally {
      flushInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!online) return;
    void flushPending();
  }, [online, flushPending]);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    void import('@/lib/supabase/client')
      .then(({ createClient }) => {
        if (cancelled) return;
        const { data } = createClient().auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || session) {
            void flushPending();
          } else if (event === 'SIGNED_OUT') {
            useExplorerStore.getState().hydrateSavedPlaces(null);
            void loadOfflineRuntimeStore().then((store) => store.purgePrivateOnLogout());
          }
        });
        subscription = data.subscription;
      })
      .catch(() => undefined);

    const onFocus = () => {
      if (navigator.onLine) void flushPending();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void flushPending();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushPending]);

  // Cross-platform Geolocation & Sensor Permission acquisition (iOS Safari/PWA, Android, macOS, Desktop, Capacitor)
  // Always bounded by a hard <= 6s ceiling so the GPS locate spinner can never spin indefinitely.
  const clearLocateTimeout = useCallback(() => {
    if (locateTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(locateTimeoutRef.current);
      locateTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLocateTimeout(), [clearLocateTimeout]);

  const acquireDeviceLocationBounded = useCallback(
    (opts: {
      highAccuracy: boolean;
      timeoutMs: number;
      maximumAgeMs: number;
      includeSensors: boolean;
    }): { seq: number; promise: Promise<DeviceLocationResult> } => {
      const seq = locateRequestSeqRef.current + 1;
      locateRequestSeqRef.current = seq;
      clearLocateTimeout();
      setIsLocatingDevice(true);

      const boundedTimeoutMs = Math.min(opts.timeoutMs, GPS_LOCATE_HARD_TIMEOUT_MS - 400);

      // CRITICAL: Invoke synchronously before any await to preserve iOS/Safari/Android user-gesture token!
      const rawPromise = requestDeviceLocationAndSensors({
        highAccuracy: opts.highAccuracy,
        timeoutMs: boundedTimeoutMs,
        maximumAgeMs: opts.maximumAgeMs,
        includeSensors: opts.includeSensors,
      }).catch(
        (): FailedDeviceLocation => ({
          ok: false,
          reason: 'unavailable',
          platform: detectDevicePlatform(),
          titleFr: 'Signal GPS introuvable',
          instructionsFr:
            'Vérifiez que la localisation de votre appareil est activée, puis réessayez ou choisissez un lieu manuellement.',
        }),
      );

      const hardTimeoutPromise = new Promise<DeviceLocationResult>((resolve) => {
        if (typeof window === 'undefined') return;
        locateTimeoutRef.current = window.setTimeout(() => {
          locateTimeoutRef.current = null;
          if (locateRequestSeqRef.current === seq) {
            setIsLocatingDevice(false);
          }
          resolve({
            ok: false,
            reason: 'timeout',
            platform: detectDevicePlatform(),
            titleFr: 'Signal GPS introuvable',
            instructionsFr:
              'La localisation n’a pas répondu sous 6 s. Vérifiez votre GPS ou choisissez un lieu manuellement.',
          });
        }, GPS_LOCATE_HARD_TIMEOUT_MS);
      });

      const promise = Promise.race([rawPromise, hardTimeoutPromise]).finally(() => {
        if (locateRequestSeqRef.current === seq) {
          clearLocateTimeout();
          setIsLocatingDevice(false);
        }
      });

      return { seq, promise };
    },
    [clearLocateTimeout],
  );

  const requestPosition = useCallback(
    (opts?: { flyTo?: boolean; fromUserGesture?: boolean; highAccuracy?: boolean }) => {
      const fromGesture = Boolean(opts?.fromUserGesture);
      if (fromGesture) {
        setLocationBannerDismissed(false);
        setLocationErrorInfo(null);
      }

      const { seq, promise } = acquireDeviceLocationBounded({
        highAccuracy: opts?.highAccuracy ?? fromGesture,
        timeoutMs: 5500,
        maximumAgeMs: fromGesture ? 15_000 : 120_000,
        includeSensors: fromGesture,
      });

      void promise.then((result) => {
        if (locateRequestSeqRef.current !== seq) return;
        if (result.ok) {
          const next = { lat: result.lat, lng: result.lng };
          setMe(next);
          setLocationErrorInfo(null);
          setLocationBannerDismissed(false);
          setVerifiedGps((prev) => ({
            ...prev,
            status: 'verified',
            lat: result.lat,
            lng: result.lng,
            accuracyM: result.accuracyM,
            errorTitle: undefined,
            errorHint: undefined,
          }));

          const currentZoom = useExplorerStore.getState().zoom;
          const shouldAutoZoom =
            Boolean(opts?.flyTo) ||
            (!initialScene &&
              !hasExplicitUrlLocation &&
              !autoLocatedRef.current &&
              currentZoom < 5);
          autoLocatedRef.current = true;
          if (shouldAutoZoom) {
            const targetZoom = opts?.flyTo ? 13 : 11.5;
            setHasInteracted(true);
            useExplorerStore.getState().patch({
              locationPermission: 'granted',
              center: [next.lng, next.lat],
              zoom: targetZoom,
              level: 3,
              camera: { type: 'reveal', center: [next.lng, next.lat], zoom: targetZoom },
            });
          } else {
            // Never clobber the user's current explored map center on a background GPS resolve!
            useExplorerStore.getState().patch({ locationPermission: 'granted' });
          }
          return;
        }

        if (result.reason === 'denied') {
          useExplorerStore.getState().patch({ locationPermission: 'denied' });
          setVerifiedGps((prev) => ({
            ...prev,
            status: 'denied',
            errorTitle: result.titleFr,
            errorHint: result.instructionsFr,
          }));
        }
        if (fromGesture || result.reason === 'denied' || result.reason === 'insecure_context') {
          setLocationErrorInfo(result);
        }
        if (fromGesture) {
          useExplorerStore.getState().showToast({
            title: result.titleFr,
            sub: result.instructionsFr,
            tone: 'warn',
          });
        }
      });
    },
    [acquireDeviceLocationBounded, initialScene, hasExplicitUrlLocation],
  );

  // Watch live OS/browser permission changes (auto-locks as soon as user grants in Settings or dialog)
  useEffect(() => {
    if (initialScene) return;
    const unsub = subscribeGeolocationPermissionChange((permState) => {
      const prev = useExplorerStore.getState().locationPermission;
      if (prev !== permState) {
        useExplorerStore.getState().patch({ locationPermission: permState });
      }
      if (permState === 'granted') {
        setLocationErrorInfo(null);
        if (!autoLocatedRef.current) {
          requestPosition({ flyTo: false, fromUserGesture: false, highAccuracy: false });
        }
      }
    });
    if (useExplorerStore.getState().locationPermission !== 'denied') {
      requestPosition({ flyTo: false, fromUserGesture: false, highAccuracy: false });
    }
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScene]);

  // ── Mode & Deterministic GPS Teardown ───────────────────────────────────
  const explorerMode = state.mode ?? (state.activity ? 'GPS_ACTIVE' : 'EXPLORE');
  const isGpsLive =
    explorerMode === 'GPS_ACTIVE' ||
    explorerMode === 'SOS' ||
    Boolean(state.activity && state.sheet === 'live');
  const hookHudMode: ExplorerHudMode = !online
    ? 'OFFLINE'
    : explorerMode === 'SOS'
      ? 'SOS'
      : isGpsLive
        ? 'GPS_ACTIVE'
        : explorerMode === 'PLAN'
          ? 'PLAN'
          : 'EXPLORE';

  useEffect(() => {
    if (!isGpsLive) return;
    explorerAbortRegistry.abortAllNonCritical();
  }, [isGpsLive]);

  // Open summary overlay automatically when an activity finishes
  useEffect(() => {
    if (state.summary && !state.activity) {
      setHasInteracted(true);
      setOverlayMode('summary');
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
    }
  }, [state.summary, state.activity]);

  // Detent / Category / Lens handlers (mark hasInteracted on first user gesture)
  const handleDetentChange = useCallback((next: ExplorerDetent) => {
    if (next !== 'peek') setHasInteracted(true);
    setDetentState(next);
    useExplorerStore.getState().setDetent(next);
  }, []);

  const handleCategoryChange = useCallback((next: ExplorerCategory) => {
    haptic('tab');
    setHasInteracted(true);
    setOverlayMode('none');
    setCategoryState(next);
  }, []);

  const activeLenses = CATEGORY_LENSES_MAP[category];
  const activeLensIndex = Math.min(
    activeLenses.length - 1,
    Math.max(0, lensIndexByCategory[category] ?? 0),
  );
  const activeLensId = activeLenses[activeLensIndex]?.id ?? 'spots';

  const handleLensChange = useCallback(
    (index: number) => {
      setHasInteracted(true);
      setLensIndexByCategory((prev) => ({ ...prev, [category]: index }));
    },
    [category],
  );

  // ── Cold-Boot Zero-Fetch Gate + Contextual Map Layers ───────────────────
  const canFetchExplorerData = hasInteracted || detent !== 'peek';
  const lv = useMemo(() => state.layerVisibility ?? EMPTY_VISIBILITY, [state.layerVisibility]);

  const effectiveLayerVisibility = useMemo(
    () =>
      isGpsLive
        ? lv
        : selectExplorerMapContext({
            detent,
            category,
            lensId: activeLensId,
            userLayerVisibility: lv,
            hasInteracted,
            hazardKindFilter,
          }),
    [isGpsLive, lv, detent, category, activeLensId, hasInteracted, hazardKindFilter],
  );

  // Static globe countries GeoJSON (served from /data/explorer-v2/countries.geojson — 0 BFF API calls)
  const countriesQuery = useCountriesGeo();
  const countriesGeo = countriesQuery.data;

  const qCountryLat = Math.round((state.center?.[1] ?? 48.85) * 50) / 50;
  const qCountryLng = Math.round((state.center?.[0] ?? 2.35) * 50) / 50;
  const detectedCountry = useMemo(
    () => findCountryAt(countriesGeo, [qCountryLng, qCountryLat]),
    [countriesGeo, qCountryLng, qCountryLat],
  );

  // Stream POIs & routes continuously using the live throttled viewport while panning
  // (never freeze fetching until the user stops moving!)
  const livePlaceLat = mapViewport
    ? (mapViewport.minLat + mapViewport.maxLat) * 0.5
    : state.center[1];
  const livePlaceLng = mapViewport
    ? (mapViewport.minLng + mapViewport.maxLng) * 0.5
    : state.center[0];
  const livePlaceZoom = mapViewport?.zoom ?? state.zoom;

  const placeQuery = usePlace(
    livePlaceLat,
    livePlaceLng,
    livePlaceZoom,
    !isGpsLive && canFetchExplorerData,
    { paused: false, debounceMs: 180 },
  );
  const place = placeQuery.data;
  const placeLoading = placeQuery.isFetching && !place;

  // Guard against stale placeholderData during flyTo transitions (e.g. Paris -> Chamonix)
  const isPlaceFresh = Boolean(place?.place) && !placeQuery.isPlaceholderData;
  useEffect(() => {
    if (!isPlaceFresh || !place?.place) return;
    lastFreshPlaceRef.current = {
      center: [livePlaceLng, livePlaceLat],
      placeName: place.place.placeName ?? null,
      regionName: place.place.regionName ?? null,
      countryCode: place.place.countryCode ?? null,
      elevationM: place.place.elevationM ?? null,
    };
  }, [isPlaceFresh, place?.place, livePlaceLat, livePlaceLng]);

  const liveZoom = Number.isFinite(state.zoom) ? state.zoom : 1.6;
  const cachedPlaceNearby =
    lastFreshPlaceRef.current !== null &&
    distanceKm(state.center, lastFreshPlaceRef.current.center) <= 15
      ? lastFreshPlaceRef.current
      : null;
  const activePlaceName = isPlaceFresh
    ? (place?.place?.placeName ?? null)
    : (cachedPlaceNearby?.placeName ?? null);
  const activePlaceRegionName = isPlaceFresh
    ? (place?.place?.regionName ?? null)
    : (cachedPlaceNearby?.regionName ?? null);
  const activePlaceElevationM = isPlaceFresh
    ? (place?.place?.elevationM ?? null)
    : (cachedPlaceNearby?.elevationM ?? null);
  const activePlaceIso = isPlaceFresh
    ? (place?.place?.countryCode ? String(place.place.countryCode).toUpperCase() : null)
    : cachedPlaceNearby?.countryCode
      ? String(cachedPlaceNearby.countryCode).toUpperCase()
      : null;

  const detectedIso = detectedCountry?.iso_a2 ? String(detectedCountry.iso_a2).toUpperCase() : null;
  const storeIso = state.geo ? String(state.geo).toUpperCase() : null;
  const activeGeo = detectedIso || activePlaceIso || storeIso || null;

  const needsGeoDetails = !isGpsLive && canFetchExplorerData;
  const { data: regionsGeo } = useRegionsGeo(needsGeoDetails ? activeGeo : null);
  const { data: country } = useCountryDetails(needsGeoDetails ? activeGeo : null);
  const region = useMemo(
    () => (liveZoom >= 7 ? findRegionAt(regionsGeo, state.center) : null),
    [liveZoom, regionsGeo, state.center],
  );

  const countries = useMemo<CountryEntry[]>(() => {
    if (!countriesGeo || !Array.isArray(countriesGeo.features)) return [];
    return countriesGeo.features
      .filter((feature) => feature && feature.properties)
      .map((feature) => {
        const props = feature.properties as unknown as CountryFeatureProperties;
        return {
          iso: props.iso_a2 ? String(props.iso_a2).toUpperCase() : '',
          name: props.name ?? '',
          continent: props.continent ?? null,
          center: geometryCenter(feature.geometry),
        };
      })
      .filter((entry) => Boolean(entry.iso && entry.name));
  }, [countriesGeo]);

  // Gated BFF hooks: strictly dormant on cold boot in peek with !hasInteracted
  const reportsAnchorLat = overlayMode === 'poi-detail' && selectedPoi ? selectedPoi.lat : state.center[1];
  const reportsAnchorLng = overlayMode === 'poi-detail' && selectedPoi ? selectedPoi.lon : state.center[0];
  const reportsQuery = useReportsNear(
    reportsAnchorLat,
    reportsAnchorLng,
    !isGpsLive &&
      canFetchExplorerData &&
      (state.level >= 2 ||
        overlayMode === 'poi-detail' ||
        overlayMode === 'route-detail' ||
        (category === 'safety' && activeLensId === 'hazards')),
  );

  const weatherWanted =
    !isGpsLive &&
    canFetchExplorerData &&
    ((category === 'safety' && activeLensId === 'weather') ||
      overlayMode === 'preflight' ||
      (category === 'explorer' && (activeLensId === 'territory' || overlayMode === 'route-detail')));
  const weatherQuery = useWeather(
    weatherWanted ? state.center[1] : null,
    weatherWanted ? state.center[0] : null,
  );
  const weather = weatherQuery.data;
  const weatherLoading = weatherQuery.isFetching && !weather;

  // Spatial Cache Ring: preserve & merge POIs and routes smoothly across pans (zero wipe!)
  const spatialPoisRef = useRef<typeof place extends { pois: infer P } | undefined ? P : never>([] as never);
  const spatialRoutesRef = useRef<ExplorerSpotRoute[]>([]);

  const pois = useMemo(() => {
    const incoming = place?.pois ?? [];
    if (incoming.length === 0) return spatialPoisRef.current;
    const merged = mergeSpatialPois(spatialPoisRef.current, incoming, state.center, 140);
    spatialPoisRef.current = merged;
    return merged;
  }, [place?.pois, state.center]);

  const routes = useMemo<ExplorerSpotRoute[]>(() => {
    const incoming = place?.routes ?? [];
    const base =
      incoming.length > 0
        ? (spatialRoutesRef.current = mergeSpatialRoutes(spatialRoutesRef.current, incoming, 45))
        : spatialRoutesRef.current;
    const known = new Set(base.map((r) => String(r.id)));
    const additions: RouteItem[] = [];
    for (const r of state.searchRoutes ?? []) {
      const id = String(r.id);
      if (known.has(id)) continue;
      known.add(id);
      additions.push({
        id: r.id,
        name: r.name,
        distance_km: r.distance_km,
        network: r.network,
        ref: r.ref,
        geojson: null,
      });
    }
    return additions.length > 0 ? [...base, ...additions] : base;
  }, [place?.routes, state.searchRoutes]);

  const selectedFullPoi = useMemo(
    () => (selectedPoi ? pois.find((p) => p.id === selectedPoi.id) ?? null : null),
    [pois, selectedPoi],
  );

  const poiDetailInput = useMemo(() => {
    if (!selectedPoi) return null;
    return {
      id: selectedPoi.id,
      name: selectedPoi.name,
      kind: selectedPoi.kind,
      subtype: selectedPoi.subtype ?? selectedFullPoi?.subtype ?? null,
      lat: selectedPoi.lat,
      lon: selectedPoi.lon,
      ele_m: selectedFullPoi?.ele_m ?? null,
      potable: selectedFullPoi?.potable ?? null,
      capacity: selectedFullPoi?.capacity ?? null,
    };
  }, [selectedPoi, selectedFullPoi]);

  const poiDetailQuery = usePoiDetail(poiDetailInput, overlayMode === 'poi-detail');

  const routeDetailInput = useMemo(() => {
    if (!selectedRoute) return null;
    return {
      id: selectedRoute.id,
      name: selectedRoute.name,
      distance_km: selectedRoute.distance_km,
      anchor: extractRouteFirstCoord(selectedRoute.geojson),
    };
  }, [selectedRoute]);

  const routeDetailQuery = useRouteDetail(routeDetailInput, overlayMode === 'route-detail');

  // ── Current Map Viewport BBox (strictly scopes all drawer lists & APIs to the viewed zone) ─
  const currentViewportBbox = useMemo<MapBbox | null>(() => {
    if (mapViewport) {
      return {
        south: mapViewport.minLat,
        west: mapViewport.minLng,
        north: mapViewport.maxLat,
        east: mapViewport.maxLng,
      };
    }
    return null;
  }, [mapViewport]);

  // Filtered & sorted routes + POIs for Lieux & Parcours lens (strictly scoped to viewed zone)
  const visibleSpotsRoutes = useMemo(() => {
    if (
      spotsFilter === 'relief' ||
      spotsFilter === 'water_refuge' ||
      spotsFilter === 'bivouac' ||
      spotsFilter === 'access'
    ) {
      return [];
    }
    const filtered = routes.filter((r) => {
      if (currentViewportBbox && r.geojson && !isGeoJsonInViewport(r.geojson, currentViewportBbox)) {
        return false;
      }
      if (spotsFilter === 'all' || spotsFilter === 'routes') return true;
      const net = (r.network ?? '').toLowerCase();
      const ref = (r.ref ?? '').toLowerCase();
      if (spotsFilter === 'gr') return net === 'iwn' || net === 'nwn' || ref.startsWith('gr');
      if (spotsFilter === 'pr') return net === 'lwn' || net === 'rwn' || ref.startsWith('pr');
      if (spotsFilter === 'vtt') return net === 'mtb' || net === 'ncn' || net === 'rcn' || net === 'lcn';
      return true;
    });

    if (spotsSort === 'distance') {
      return [...filtered].sort((a, b) => (b.distance_km ?? 0) - (a.distance_km ?? 0));
    }
    if (spotsSort === 'elevation') {
      return [...filtered].sort((a, b) => (b.elev_gain_m ?? 0) - (a.elev_gain_m ?? 0));
    }
    return filtered;
  }, [routes, spotsFilter, spotsSort, currentViewportBbox]);

  const visibleSpotsPois = useMemo(() => {
    const filtered = pois.filter((poi) => {
      if (!poi || !poi.name) return false;
      if (currentViewportBbox && !isPointInViewport(poi.lat, poi.lon, currentViewportBbox)) {
        return false;
      }
      return poiMatchesSpotsFilter(poi, spotsFilter);
    });
    const center = state.center;
    return [...filtered].sort((a, b) => {
      if (spotsSort === 'elevation') {
        return (b.ele_m ?? -1) - (a.ele_m ?? -1);
      }
      const da = distanceKm(center, [a.lon, a.lat]);
      const db = distanceKm(center, [b.lon, b.lat]);
      if (spotsSort === 'distance') {
        return db - da;
      }
      return da - db;
    });
  }, [pois, spotsFilter, spotsSort, state.center, currentViewportBbox]);

  // ── Route Geometry Loading & Off-Route Engine ───────────────────────────
  const activityRoute = state.activity?.route ?? null;
  const trailRouteId = state.trailRoute?.id;
  const trailRouteStatus = state.trailRoute?.status;
  const activityRouteId = activityRoute?.id;
  const activityRouteStatus = activityRoute?.status;
  const routesRef = useRef(routes);
  routesRef.current = routes;

  const resetLiveSessionMetadata = useCallback(() => {
    setLastSummaryId(null);
    setSessionWaypoints([]);
    setSessionPhotosCount(0);
    setLiveTelemetry({ altitudeM: null, speedKmh: null });
    setBeaconSessionId(null);
    setBeaconShareUrl(null);
    sessionPointsRef.current = [];
  }, []);

  const sanitizeRouteBeforeLaunch = useCallback(() => {
    const current = useExplorerStore.getState();
    const route = current.trailRoute;
    if (route && current.selection?.kind === 'trail') {
      const display = routesRef.current.find((candidate) => String(candidate.id) === route.id);
      if (display?.unavailable) {
        useExplorerStore.setState({ selection: undefined, trailRoute: undefined });
        current.showToast({
          title: 'Suivi libre',
          sub: 'Trace de démonstration ignorée',
          tone: 'neutral',
        });
      }
    }
  }, []);

  const requestStartSafe = useCallback(
    (sport: Sport, selection?: SportSelection) => {
      sanitizeRouteBeforeLaunch();
      resetLiveSessionMetadata();
      setOverlayMode('none');
      requestStart(sport, selection);
    },
    [sanitizeRouteBeforeLaunch, resetLiveSessionMetadata, requestStart],
  );

  const confirmStartImmediate = useCallback(
    (sport: Sport, selection?: SportSelection) => {
      sanitizeRouteBeforeLaunch();
      resetLiveSessionMetadata();
      setOverlayMode('none');
      useExplorerStore
        .getState()
        .startActivity(sport, null, selection, newClientSessionId());
    },
    [sanitizeRouteBeforeLaunch, resetLiveSessionMetadata],
  );

  useEffect(() => {
    if (activityRouteStatus !== 'unavailable') return;
    useExplorerStore.setState((store) => {
      const current = store.activity;
      if (!current) return {};
      const hadAlert =
        current.offRoute ||
        current.offRouteM !== undefined ||
        (current.offRouteBearing !== undefined && current.offRouteBearing !== null);
      if (!hadAlert && store.toast?.title !== 'Hors itinéraire') return {};
      return {
        ...(hadAlert
          ? {
              activity: {
                ...current,
                offRoute: false,
                offRouteM: undefined,
                offRouteBearing: undefined,
              },
            }
          : {}),
        ...(store.toast?.title === 'Hors itinéraire' ? { toast: undefined } : {}),
      };
    });
  }, [activityRouteStatus]);

  const routeDisplayKey = useMemo(
    () =>
      routes
        .map((route) => `${route.id}:${route.unavailable ? '1' : '0'}:${route.name ?? ''}`)
        .join('|'),
    [routes],
  );

  const publishRouteGeometry = useCallback(
    (id: string, geojson: unknown | null, displayName: string | null, force = false) => {
      const ready = geojson !== null && routeLines(geojson).length > 0;
      const current = useExplorerStore.getState();
      const name =
        current.activity?.route?.id === id
          ? current.activity.route.name
          : current.trailRoute?.id === id
            ? current.trailRoute.name
            : null;
      const snapshot: TrailRouteSnapshot = {
        id,
        name: name ?? displayName ?? null,
        geojson: ready ? geojson : null,
        status: ready ? 'ready' : 'unavailable',
      };
      current.setRouteGeometry(snapshot, { force });
    },
    [],
  );

  useEffect(() => {
    if (!trailRouteId) return;
    const display = routesRef.current.find((route) => String(route.id) === trailRouteId);
    if (display?.unavailable) {
      if (trailRouteStatus !== 'unavailable') {
        publishRouteGeometry(trailRouteId, null, display.name, true);
      }
      return;
    }
    if (trailRouteStatus !== 'loading') return;
    if (activityRouteId === trailRouteId && activityRouteStatus === 'loading') return;
    const controller = new AbortController();
    let cancelled = false;
    void fetchRouteGeometry(trailRouteId, { signal: controller.signal })
      .then((geojson) => {
        if (!cancelled) publishRouteGeometry(trailRouteId, geojson, display?.name ?? null);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          publishRouteGeometry(trailRouteId, null, display?.name ?? null);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    trailRouteId,
    trailRouteStatus,
    activityRouteId,
    activityRouteStatus,
    routeDisplayKey,
    publishRouteGeometry,
  ]);

  useEffect(() => {
    if (!activityRouteId) return;
    const display = routesRef.current.find((route) => String(route.id) === activityRouteId);
    if (display?.unavailable) {
      if (activityRouteStatus !== 'unavailable') {
        publishRouteGeometry(activityRouteId, null, display.name, true);
      }
      return;
    }
    if (activityRouteStatus !== 'loading') return;
    const controller = new AbortController();
    let cancelled = false;
    void fetchRouteGeometry(activityRouteId, { signal: controller.signal })
      .then((geojson) => {
        if (!cancelled) publishRouteGeometry(activityRouteId, geojson, display?.name ?? null);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          publishRouteGeometry(activityRouteId, null, display?.name ?? null);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activityRouteId, activityRouteStatus, routeDisplayKey, publishRouteGeometry]);

  const activityRouteLines = useMemo(
    () => (activityRoute?.status === 'ready' ? routeLines(activityRoute.geojson) : []),
    [activityRoute],
  );

  const distanceToRoute = useCallback(
    (fix: GpsFix) => {
      if (activityRouteLines.length === 0) return null;
      const projection = nearestPointOnRouteM([fix.lng, fix.lat], activityRouteLines);
      if (!projection) return null;
      return {
        distanceM: projection.distanceM,
        bearingDeg: projection.bearingDeg,
      };
    },
    [activityRouteLines],
  );

  useEffect(() => {
    const clientSessionId = state.activity?.clientSessionId;
    if (!clientSessionId || !activityRoute) return;
    void saveSessionRoute(clientSessionId, activityRoute);
  }, [state.activity?.clientSessionId, activityRoute]);

  const mapRoutes = useMemo(() => {
    const active =
      activityRoute?.status === 'ready'
        ? activityRoute
        : state.trailRoute?.status === 'ready'
          ? state.trailRoute
          : null;
    if (!active?.geojson) return routes;
    const rawNum = Number(active.id);
    const id = Number.isSafeInteger(rawNum)
      ? rawNum
      : -Math.abs(
          Array.from(String(active.id)).reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) | 0), 17) || 1,
        );
    const existing = routes.find((route) => String(route.id) === active.id);
    const full = {
      id,
      name: active.name ?? existing?.name ?? null,
      network: existing?.network ?? null,
      geojson: active.geojson,
    };
    return existing
      ? routes.map((route) => (String(route.id) === active.id ? { ...route, ...full } : route))
      : [...routes, full];
  }, [routes, activityRoute, state.trailRoute]);

  const slopeRoute = useMemo(() => {
    const active = state.activity?.route;
    if (active) return active;
    return state.trailRoute ?? null;
  }, [state.activity?.route, state.trailRoute]);
  const slope = useRouteSlope(slopeRoute, effectiveLayerVisibility.slope === true);
  const nationalTopo = useMemo(
    () => verifiedNationalTopoFor(state.geo || country?.iso_a2 || ''),
    [country?.iso_a2, state.geo],
  );

  const allDistanceMarkers = useMemo(
    () =>
      slopeRoute?.status === 'ready' && slopeRoute.geojson
        ? buildDistanceMarkers(slopeRoute.geojson, unitsForCountry)
        : [],
    [slopeRoute, unitsForCountry],
  );
  const distanceMarkers = useMemo(
    () =>
      effectiveLayerVisibility.distanceMarkers === false ||
      effectiveLayerVisibility.routes === false ||
      isGpsLive
        ? []
        : allDistanceMarkers,
    [allDistanceMarkers, effectiveLayerVisibility.distanceMarkers, effectiveLayerVisibility.routes, isGpsLive],
  );

  // ── Secondary Overlays (strictly gated on canFetchExplorerData) ─────────
  // Scope savedPlaces strictly per authenticated user account (invariant C-PRIV) + cloud sync
  useEffect(() => {
    useExplorerStore.getState().hydrateSavedPlaces(savedPlacesUserKey);
    if (!savedPlacesUserKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await defaultAccessToken();
        const res = await fetch('/api/explorer/v2/saved-places', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          places?: Array<{
            place_id?: string;
            kind?: string;
            name?: string;
            lat?: number;
            lng?: number;
            metadata?: Record<string, unknown> | null;
            created_at?: string;
          }>;
        };
        if (cancelled || !Array.isArray(data.places)) return;
        const remotePlaces: SavedPlace[] = [];
        for (const row of data.places) {
          if (
            typeof row.place_id !== 'string' ||
            typeof row.name !== 'string' ||
            typeof row.lat !== 'number' ||
            typeof row.lng !== 'number' ||
            !Number.isFinite(row.lat) ||
            !Number.isFinite(row.lng)
          ) {
            continue;
          }
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          remotePlaces.push({
            id: row.place_id,
            name: row.name,
            kind: normalizeSavedPlaceKind(row.kind),
            subtype: typeof meta.subtype === 'string' ? meta.subtype : undefined,
            lat: row.lat,
            lng: row.lng,
            eleM: typeof meta.eleM === 'number' ? meta.eleM : null,
            areaLabel: typeof meta.areaLabel === 'string' ? meta.areaLabel : null,
            savedAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
          });
        }
        const local = useExplorerStore.getState().savedPlaces ?? [];
        const byId = new Map<string, SavedPlace>();
        for (const item of remotePlaces) byId.set(item.id, item);
        for (const item of local) {
          if (!byId.has(item.id)) byId.set(item.id, item);
        }
        const merged = Array.from(byId.values()).slice(0, 200);
        writeSavedPlaces(merged, savedPlacesUserKey);
        useExplorerStore.setState({ savedPlaces: merged });
      } catch {
        /* keep local savedPlaces offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedPlacesUserKey]);

  const toggleSavedPlaceSynced = useCallback(
    (candidate: Omit<SavedPlace, 'savedAt'>): boolean => {
      const saved = useExplorerStore.getState().toggleSavedPlace(candidate, savedPlacesUserKey);
      if (!savedPlacesUserKey) return saved;
      void (async () => {
        try {
          const token = await defaultAccessToken();
          const headers: Record<string, string> = {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(saved ? { 'Content-Type': 'application/json' } : {}),
          };
          if (saved) {
            await fetch('/api/explorer/v2/saved-places', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                placeId: candidate.id,
                kind: candidate.kind,
                name: candidate.name,
                lat: candidate.lat,
                lng: candidate.lng,
                metadata: {
                  subtype: candidate.subtype ?? null,
                  eleM: candidate.eleM ?? null,
                  areaLabel: candidate.areaLabel ?? null,
                },
              }),
            });
          } else {
            await fetch(
              `/api/explorer/v2/saved-places?placeId=${encodeURIComponent(candidate.id)}`,
              { method: 'DELETE', headers },
            );
          }
        } catch {
          /* best-effort cloud sync */
        }
      })();
      return saved;
    },
    [savedPlacesUserKey],
  );

  // Hydrate authenticated user's observed Pokédex taxon IDs
  useEffect(() => {
    if (!savedPlacesUserKey) {
      setObservedTaxonIds(new Set());
      return;
    }
    if (!canFetchExplorerData) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await defaultAccessToken();
        const res = await fetch('/api/explorer/v2/pokedex/observations', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { observedTaxonIds?: unknown };
        if (cancelled || !Array.isArray(data.observedTaxonIds)) return;
        const next = new Set<number>();
        for (const id of data.observedTaxonIds) {
          if (typeof id === 'number' && Number.isFinite(id)) next.add(id);
        }
        setObservedTaxonIds(next);
      } catch {
        /* ignore offline hydration failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedPlacesUserKey, canFetchExplorerData]);

  const communityState = state.communityHeatmap ?? {
    enabled: false,
    sport: 'all',
    window: 'global' as const,
  };
  const personalState = state.personalHeatmap ?? {
    enabled: false,
    sport: 'all',
    period: 'all_time' as const,
    comparePeriod: null,
  };

  const communityHeatmapQuery = useCommunityHeatmap(
    communityState.sport,
    communityState.window,
    !isGpsLive && canFetchExplorerData && Boolean(communityState.enabled),
  );
  const personalHeatmapQuery = usePersonalHeatmap(
    personalState.sport,
    personalState.period,
    personalState.comparePeriod,
    !isGpsLive && canFetchExplorerData && Boolean(personalState.enabled),
  );
  const bikePoisQuery = useBikePois(
    mapViewport,
    !isGpsLive && canFetchExplorerData && effectiveLayerVisibility.bikePois === true,
  );
  const firesQuery = useFireIncidents(
    mapViewport,
    canFetchExplorerData && effectiveLayerVisibility.fires === true,
  );
  const surfacesQuery = useRouteSurfaces(
    mapViewport,
    !isGpsLive && canFetchExplorerData && effectiveLayerVisibility.surfaceLayer === true,
  );
  const activeHighlightRouteId = state.selection?.kind === 'trail' ? state.selection.id : null;
  const highlightsQuery = useRouteHighlights(
    activeHighlightRouteId,
    !isGpsLive &&
      canFetchExplorerData &&
      effectiveLayerVisibility.highlights !== false &&
      Boolean(activeHighlightRouteId),
  );

  // ── Unified Open-Data, Pokédex, Social/Bottles & Encyclopedia BFF Hooks ─
  const unifiedBbox = useMemo<MapBbox | null>(() => {
    if (mapViewport) {
      return {
        south: mapViewport.minLat,
        west: mapViewport.minLng,
        north: mapViewport.maxLat,
        east: mapViewport.maxLng,
      };
    }
    const [lng, lat] = state.center ?? [2.35, 48.85];
    return { south: lat - 0.25, west: lng - 0.3, north: lat + 0.25, east: lng + 0.3 };
  }, [mapViewport, state.center]);

  const hazardsEnabled =
    (canFetchExplorerData || isGpsLive) &&
    Boolean(
      effectiveLayerVisibility.hazardFires ||
        effectiveLayerVisibility.hazardFloods ||
        effectiveLayerVisibility.hazardSeismic,
    );
  const radarEnabled = canFetchExplorerData && Boolean(effectiveLayerVisibility.rainRadar);
  const airspaceEnabled =
    canFetchExplorerData && !isGpsLive && Boolean(effectiveLayerVisibility.airspaceAircraft);
  const pokedexEnabled =
    canFetchExplorerData && !isGpsLive && Boolean(effectiveLayerVisibility.pokedexSpecies);

  const activeSocialKinds = useMemo<SocialMapKind[]>(() => {
    if (!canFetchExplorerData || isGpsLive) return [];
    const kinds: SocialMapKind[] = [];
    if (effectiveLayerVisibility.socialBottles) kinds.push('bottles');
    if (effectiveLayerVisibility.socialCarnets) kinds.push('carnets');
    if (effectiveLayerVisibility.socialClubs) {
      kinds.push('clubs');
      kinds.push('events');
    }
    if (effectiveLayerVisibility.socialStories) kinds.push('stories');
    if (effectiveLayerVisibility.socialFriends) kinds.push('friends');
    return kinds;
  }, [
    canFetchExplorerData,
    isGpsLive,
    effectiveLayerVisibility.socialBottles,
    effectiveLayerVisibility.socialCarnets,
    effectiveLayerVisibility.socialClubs,
    effectiveLayerVisibility.socialStories,
    effectiveLayerVisibility.socialFriends,
  ]);

  const hazardsUnifiedQuery = useExplorerHazards(unifiedBbox, {
    enabled: hazardsEnabled,
    zoom: livePlaceZoom,
    mode: hookHudMode,
    debounceMs: 260,
  });
  const radarManifestQuery = useRadarManifest({
    enabled: radarEnabled,
    zoom: livePlaceZoom,
    mode: hookHudMode,
  });
  const airspaceLiveQuery = useAirspaceLive(unifiedBbox, {
    enabled: airspaceEnabled,
    zoom: livePlaceZoom,
    mode: hookHudMode,
    debounceMs: 320,
  });
  const pokedexNearQuery = usePokedexNear(
    { lat: livePlaceLat, lng: livePlaceLng },
    {
      enabled: pokedexEnabled,
      zoom: livePlaceZoom,
      mode: hookHudMode,
      radiusKm: viewportRadiusKm(unifiedBbox, 2, 50),
      threatened: pokedexRarity === 'threatened',
      debounceMs: 260,
    },
  );
  const socialMapQuery = useSocialMapLayers(unifiedBbox, activeSocialKinds, {
    enabled: activeSocialKinds.length > 0,
    zoom: livePlaceZoom,
    mode: hookHudMode,
    iso: activeGeo,
    debounceMs: 260,
  });

  const loadingSummary = useExplorerLoadingState({
    mapTilesLoading: mapActivity.tilesLoading,
    placeFetching: placeQuery.isFetching,
    layersFetching:
      poiRouteLoading ||
      hazardsUnifiedQuery.isFetching ||
      pokedexNearQuery.isFetching ||
      socialMapQuery.isFetching ||
      airspaceLiveQuery.isFetching ||
      bikePoisQuery.isFetching ||
      firesQuery.isFetching,
    glbPendingCount: mapActivity.glbPendingCount,
    hasError: Boolean(placeQuery.isError && !place),
    isMoving: mapActivity.isMoving,
  });

  const encyclopediaScale: SpatialScale =
    liveZoom < 2.5
      ? 'world'
      : liveZoom < 4.2
        ? 'continent'
        : liveZoom < 7
          ? 'country'
          : liveZoom < 10
            ? 'region'
            : liveZoom >= 13
              ? 'sector'
              : 'city';
  const encyclopediaName =
    encyclopediaScale === 'world'
      ? 'Monde'
      : encyclopediaScale === 'continent'
        ? (country?.continent ?? detectedCountry?.continent ?? 'Monde')
        : encyclopediaScale === 'country'
          ? (country?.name ?? detectedCountry?.name ?? activeGeo ?? 'Pays')
          : encyclopediaScale === 'region'
            ? (region?.name ?? activePlaceRegionName ?? state.regionId ?? country?.name ?? 'Région')
            : (activePlaceName ??
              activePlaceRegionName ??
              region?.name ??
              country?.name ??
              detectedCountry?.name ??
              'Secteur');
  const encyclopediaSlug = encyclopediaName.toLowerCase().replace(/\s+/g, '-');
  const encyclopediaId =
    encyclopediaScale === 'world'
      ? 'world:world'
      : encyclopediaScale === 'continent'
        ? `continent:${encyclopediaSlug}`
        : encyclopediaScale === 'country'
          ? `country:${activeGeo ?? encyclopediaSlug}`
          : `${encyclopediaScale}:${encyclopediaSlug}:${state.center[1].toFixed(2)},${state.center[0].toFixed(2)}`;

  const encyclopediaQuery = useTerritorialEncyclopedia(
    {
      scale: encyclopediaScale,
      id: encyclopediaId,
      name: encyclopediaName,
      lat: state.center[1],
      lng: state.center[0],
      iso: encyclopediaScale === 'world' ? undefined : (activeGeo ?? undefined),
    },
    {
      enabled: canFetchExplorerData && !isGpsLive && category === 'explorer' && activeLensId === 'territory',
      zoom: liveZoom,
      mode: hookHudMode,
    },
  );

  const filteredPokedexGeojson = useMemo<GeoCollection | null>(() => {
    const raw = pokedexNearQuery.data?.geojson as unknown as GeoCollection | null | undefined;
    if (!raw || !Array.isArray(raw.features)) return null;
    if (category !== 'pokedex') return raw;
    const activeKingdom =
      activeLensId === 'faune' ? 'faune' : activeLensId === 'flore' ? 'flore' : 'all';
    if (activeKingdom === 'all' && pokedexRarity === 'all') return raw;

    const speciesByTaxon = new Map(
      (pokedexNearQuery.data?.species ?? []).map((sp) => [sp.taxonId, sp]),
    );
    return {
      type: 'FeatureCollection',
      features: raw.features.filter((f) => {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const taxonId = Number(props.taxonId);
        const sp = Number.isFinite(taxonId) ? speciesByTaxon.get(taxonId) : undefined;
        const kingdom = sp?.kingdom ?? (typeof props.kingdom === 'string' ? props.kingdom : null);
        if (activeKingdom !== 'all' && kingdom !== activeKingdom) return false;
        if (pokedexRarity !== 'all') {
          const threatened = Boolean(sp?.threatened ?? props.threatened);
          const endemic = Boolean(sp?.endemic ?? props.endemic);
          const obsCount = Number(sp?.observationCount ?? props.observationCount ?? 0);
          const bucket = threatened
            ? 'threatened'
            : endemic || obsCount <= 10
              ? 'rare'
              : 'common';
          if (bucket !== pokedexRarity) return false;
        }
        return true;
      }),
    };
  }, [pokedexNearQuery.data, category, activeLensId, pokedexRarity]);

  const unifiedGeojson = useMemo<Record<string, GeoCollection | null | undefined>>(() => {
    if (
      !hazardsUnifiedQuery.data &&
      !airspaceLiveQuery.data &&
      !pokedexNearQuery.data &&
      !socialMapQuery.data
    ) {
      return EMPTY_UNIFIED_GEOJSON;
    }
    return {
      'xp-hazard-fires': (hazardsUnifiedQuery.data?.fires as unknown as GeoCollection) ?? null,
      'xp-hazard-seismic': (hazardsUnifiedQuery.data?.earthquakes as unknown as GeoCollection) ?? null,
      'xp-hazard-floods': (hazardsUnifiedQuery.data?.floods as unknown as GeoCollection) ?? null,
      'xp-airspace-aircraft': (airspaceLiveQuery.data as unknown as GeoCollection) ?? null,
      'xp-pokedex-species': filteredPokedexGeojson,
      'xp-social-bottles': (socialMapQuery.data?.bottles as unknown as GeoCollection) ?? null,
      'xp-social-carnets': (socialMapQuery.data?.carnets as unknown as GeoCollection) ?? null,
      'xp-social-clubs': (socialMapQuery.data?.clubs as unknown as GeoCollection) ?? null,
      'xp-social-events': (socialMapQuery.data?.events as unknown as GeoCollection) ?? null,
      'xp-social-stories': (socialMapQuery.data?.stories as unknown as GeoCollection) ?? null,
      'xp-social-friends': (socialMapQuery.data?.friends as unknown as GeoCollection) ?? null,
    };
  }, [
    hazardsUnifiedQuery.data,
    airspaceLiveQuery.data,
    pokedexNearQuery.data,
    filteredPokedexGeojson,
    socialMapQuery.data,
  ]);

  const radarTileTemplate = radarManifestQuery.data?.latestFrame?.tileUrl ?? null;

  const unifiedLayerItems = useMemo(
    () =>
      canFetchExplorerData
        ? buildUnifiedLayerItems(lv, {
            hazards: hazardsUnifiedQuery.data?.meta.fetchedAt
              ? Date.parse(hazardsUnifiedQuery.data.meta.fetchedAt)
              : null,
            radar: radarManifestQuery.data?.meta.fetchedAt
              ? Date.parse(radarManifestQuery.data.meta.fetchedAt)
              : null,
            airspace: airspaceLiveQuery.data?.meta.fetchedAt
              ? Date.parse(airspaceLiveQuery.data.meta.fetchedAt)
              : null,
            pokedex: pokedexNearQuery.data?.meta.fetchedAt
              ? Date.parse(pokedexNearQuery.data.meta.fetchedAt)
              : null,
            social: socialMapQuery.data?.meta.fetchedAt
              ? Date.parse(socialMapQuery.data.meta.fetchedAt)
              : null,
          })
        : [],
    [
      canFetchExplorerData,
      lv,
      hazardsUnifiedQuery.data,
      radarManifestQuery.data,
      airspaceLiveQuery.data,
      pokedexNearQuery.data,
      socialMapQuery.data,
    ],
  );

  // Extracted community entities — strictly scoped to the currently viewed zone
  const bottles = useMemo(() => {
    const raw = extractBottlesFromGeoJson(socialMapQuery.data?.bottles).filter((b) => {
      if (b.inArea === false) return false;
      if (currentViewportBbox && b.coordinates) {
        return isPointInViewport(b.coordinates[1], b.coordinates[0], currentViewportBbox, {
          padRatio: 0.15,
          minPadDeg: 0.01,
        });
      }
      return true;
    });
    if (communitySort === 'spots') {
      return [...raw].sort((a, b) => b.spotsLeft - a.spotsLeft);
    }
    return raw;
  }, [socialMapQuery.data?.bottles, communitySort, currentViewportBbox]);

  const carnets = useMemo(() => {
    const raw = extractCarnetsFromGeoJson(socialMapQuery.data?.carnets).filter((c) => {
      if (c.inArea === false) return false;
      if (currentViewportBbox && c.coordinates) {
        return isPointInViewport(c.coordinates[1], c.coordinates[0], currentViewportBbox, {
          padRatio: 0.15,
          minPadDeg: 0.01,
        });
      }
      return true;
    });
    if (communitySort === 'popular') {
      return [...raw].sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0));
    }
    return raw;
  }, [socialMapQuery.data?.carnets, communitySort, currentViewportBbox]);

  const clubs = useMemo(() => {
    const raw = extractClubsFromGeoJson(socialMapQuery.data?.clubs).filter((c) => {
      if (c.inArea === false) return false;
      if (currentViewportBbox && c.coordinates) {
        return isPointInViewport(c.coordinates[1], c.coordinates[0], currentViewportBbox, {
          padRatio: 0.15,
          minPadDeg: 0.01,
        });
      }
      return true;
    });
    if (communitySort === 'verified') {
      return [...raw].sort((a, b) => Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified)));
    }
    if (communitySort === 'alpha') {
      return [...raw].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return [...raw].sort((a, b) => (b.membersCount ?? 0) - (a.membersCount ?? 0));
  }, [socialMapQuery.data?.clubs, communitySort, currentViewportBbox]);

  const clubEvents = useMemo(
    () =>
      extractEventsFromGeoJson(socialMapQuery.data?.events).filter((ev) => {
        if (currentViewportBbox && ev.coordinates) {
          return isPointInViewport(ev.coordinates[1], ev.coordinates[0], currentViewportBbox, {
            padRatio: 0.15,
            minPadDeg: 0.01,
          });
        }
        return true;
      }),
    [socialMapQuery.data?.events, currentViewportBbox],
  );
  const stories = useMemo(
    () =>
      extractStoriesFromGeoJson(socialMapQuery.data?.stories).filter((s) => {
        if (s.inArea === false) return false;
        if (currentViewportBbox && s.coordinates) {
          return isPointInViewport(s.coordinates[1], s.coordinates[0], currentViewportBbox, {
            padRatio: 0.15,
            minPadDeg: 0.01,
          });
        }
        return true;
      }),
    [socialMapQuery.data?.stories, currentViewportBbox],
  );
  const friends = useMemo(
    () =>
      extractFriendsFromGeoJson(socialMapQuery.data?.friends).filter((f) => {
        if (currentViewportBbox && f.coordinates) {
          return isPointInViewport(f.coordinates[1], f.coordinates[0], currentViewportBbox, {
            padRatio: 0.15,
            minPadDeg: 0.01,
          });
        }
        return true;
      }),
    [socialMapQuery.data?.friends, currentViewportBbox],
  );

  // Hydrate real user routing capability manifest lazily after first interaction
  useEffect(() => {
    if (!canFetchExplorerData || userCapabilities) return;
    let cancelled = false;
    void fetch('/api/explorer/v2/capabilities')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; manifest?: UserCapabilityManifest } | null) => {
        if (cancelled || !data?.ok || !data.manifest) return;
        setUserCapabilities(data.manifest);
        setRoutingPackWeightKg((prev) => prev ?? data.manifest!.packWeightKg);
        setRoutingKitId((prev) => prev ?? data.manifest!.activeKitId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canFetchExplorerData, userCapabilities]);

  const requestVerifiedGpsForRouting = useCallback(
    (): Promise<RoutePlanEndpoint | null> => {
      setVerifiedGps((prev) => ({
        ...prev,
        status: 'locating',
        errorTitle: undefined,
        errorHint: undefined,
      }));

      const { promise } = acquireDeviceLocationBounded({
        highAccuracy: true,
        timeoutMs: 5500,
        maximumAgeMs: 20_000,
        includeSensors: true,
      });

      return promise.then(async (result) => {
        if (!result.ok) {
          if (result.reason === 'denied') {
            useExplorerStore.getState().patch({ locationPermission: 'denied' });
          }
          setLocationErrorInfo(result);
          setVerifiedGps({
            status: result.reason === 'denied' ? 'denied' : 'error',
            errorTitle: result.titleFr,
            errorHint: result.instructionsFr,
          });
          return null;
        }

        const { lat, lng, accuracyM } = result;
        setMe({ lat, lng });
        setLocationErrorInfo(null);
        useExplorerStore.getState().patch({ locationPermission: 'granted' });

        // Reverse geocode verified GPS coordinates to confirm exact commune/city name
        let placeLabel = 'Ma position GPS';
        try {
          const geoRes = await fetch(`/api/geocode?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`);
          if (geoRes.ok) {
            const geoData = (await geoRes.json()) as {
              matches?: Array<{ name?: string }>;
            };
            const name = geoData.matches?.[0]?.name?.trim();
            if (name) placeLabel = `Ma position · ${name}`;
          }
        } catch {
          /* keep fallback GPS label */
        }

        setVerifiedGps({
          status: 'verified',
          lat,
          lng,
          accuracyM,
          label: placeLabel.replace(/^Ma position · /, ''),
        });
        return { lat, lng, label: placeLabel };
      });
    },
    [acquireDeviceLocationBounded],
  );

  const requestPoiRoutePlan = useCallback(
    async (
      dest: MapPin,
      opts?: {
        origin?: RoutePlanEndpoint | null;
        mode?: RoutingTravelMode;
        kitId?: string | null;
        packWeightKg?: number | null;
      },
    ) => {
      routePlanAbortRef.current?.abort();
      const controller = new AbortController();
      routePlanAbortRef.current = controller;

      const resolvedOrigin = opts?.origin ?? routingOrigin;
      if (!resolvedOrigin) {
        setPoiRouteLoading(false);
        return;
      }

      const nextMode = opts?.mode ?? routingMode;
      const nextKitId = opts?.kitId !== undefined ? opts.kitId : routingKitId;
      const nextPack = opts?.packWeightKg !== undefined ? opts.packWeightKg : routingPackWeightKg;

      setRoutingOrigin(resolvedOrigin);
      setRoutingMode(nextMode);
      setPoiRouteLoading(true);
      setPoiRouteError(null);

      try {
        const res = await fetch('/api/explorer/v2/route-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: resolvedOrigin,
            destination: {
              lat: dest.lat,
              lng: dest.lon,
              label: dest.name,
              poiId: dest.id,
            },
            mode: nextMode,
            kitId: nextKitId,
            packWeightKg: nextPack,
          }),
          signal: controller.signal,
        });
        const data = (await res.json()) as RoutePlanResponse & { error?: string };
        if (controller.signal.aborted) return;
        if (!res.ok || !data.ok) {
          setPoiRouteError(data.error ?? 'Impossible de calculer un itinéraire vers ce lieu.');
          setPoiRouteLoading(false);
          return;
        }
        setPoiRoutePlan(data);
        setSelectedItineraryId(data.recommended.id);
        setRoutingMode(data.manifestSummary.activeMode);
        setRoutingPackWeightKg(data.manifestSummary.packWeightKg);
        setPoiRouteLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPoiRouteError(
          err instanceof Error && err.name !== 'AbortError'
            ? 'Connexion interrompue pendant le calcul d’itinéraire.'
            : 'Calcul interrompu.',
        );
        setPoiRouteLoading(false);
      }
    },
    [routingOrigin, routingMode, routingKitId, routingPackWeightKg],
  );

  const handlePlanRouteToPoi = useCallback(
    (dest: MapPin) => {
      haptic('sheet-open');
      setSelectedPoi(dest);
      setHasInteracted(true);
      setOverlayMode('poi-routing');
      setDetentState('mid');
      setShowRouteAlternativesOnMap(false);
      setPoiRoutePlan(null);
      setPoiRouteError(null);

      // ALWAYS impose & verify real browser GPS position first (never silently pick a random village!)
      void (async () => {
        if (
          verifiedGps.status === 'verified' &&
          typeof verifiedGps.lat === 'number' &&
          typeof verifiedGps.lng === 'number'
        ) {
          const verifiedOrigin: RoutePlanEndpoint = {
            lat: verifiedGps.lat,
            lng: verifiedGps.lng,
            label: verifiedGps.label ? `Ma position · ${verifiedGps.label}` : 'Ma position GPS',
          };
          setRoutingOrigin(verifiedOrigin);
          await requestPoiRoutePlan(dest, { origin: verifiedOrigin });
          return;
        }

        const freshGpsOrigin = await requestVerifiedGpsForRouting();
        if (freshGpsOrigin) {
          setRoutingOrigin(freshGpsOrigin);
          await requestPoiRoutePlan(dest, { origin: freshGpsOrigin });
        } else {
          setRoutingOrigin(null);
          setPoiRouteLoading(false);
        }
      })();
    },
    [verifiedGps, requestVerifiedGpsForRouting, requestPoiRoutePlan],
  );

  const handlePlanRouteToSelectedPoi = useCallback(() => {
    if (!selectedPoi) return;
    handlePlanRouteToPoi(selectedPoi);
  }, [selectedPoi, handlePlanRouteToPoi]);

  const [activeGuidedItinerary, setActiveGuidedItinerary] = useState<ComputedItinerary | null>(null);

  const handleStartComputedItinerary = useCallback(
    (itinerary: ComputedItinerary) => {
      haptic('activity-start');
      resetLiveSessionMetadata();
      setActiveGuidedItinerary(itinerary);
      setShowRouteAlternativesOnMap(false);
      setOverlayMode('none');
      useExplorerStore.getState().patch({ profileCursor: null });

      const focus = extractItineraryFocus(itinerary, routingOrigin);
      guidedRouteFocusRef.current = focus.start
        ? { start: focus.start, bounds: focus.bounds }
        : null;
      freshActivityGpsFixRef.current = null;

      const readyRoute: TrailRouteSnapshot = {
        id: itinerary.id,
        name: itinerary.title,
        geojson: itinerary.geojson.geometry,
        status: 'ready',
      };
      // Arm both selection & trailRoute directly so `startActivity` attaches `activity.route`
      // (enabling live turn-by-turn maneuvers & off-route detection) and enters GPS_ACTIVE immediately.
      useExplorerStore.setState({
        selection: { kind: 'trail', id: itinerary.id },
        trailRoute: readyRoute,
      });
      const clientId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `poi-nav-${Date.now()}`;
      useExplorerStore.getState().startActivity(itinerary.recommendedSport, null, undefined, clientId);

      // Keep the camera anchored on the itinerary bounds/start (never snap back to Paris / stale GPS!)
      // until a real, fresh GPS fix arrives within 20 km of the route start.
      if (focus.start) {
        const focusZoom = Math.max(useExplorerStore.getState().zoom, 13.5);
        useExplorerStore.setState({
          center: focus.start,
          zoom: focusZoom,
          camera: focus.bounds
            ? { type: 'overview', bounds: focus.bounds }
            : { type: 'reveal', center: focus.start, zoom: focusZoom },
        });
      }

      useExplorerStore.getState().showToast({
        title: 'Guidage démarré',
        sub: itinerary.title,
        tone: 'good',
      });
    },
    [routingOrigin, resetLiveSessionMetadata],
  );

  // Adaptive bundle & offline daylight
  const adaptiveNowRef = useRef<number>(Date.now());
  const currentWeatherHour = weather?.hours?.[0] ?? null;

  const adaptiveBundle = useMemo(() => {
    const activeRouteForFit = selectedRoute ?? null;
    return buildAdaptiveOverviewBundle({
      sessions: [],
      profileMode: state.profile ?? null,
      gear: userCapabilities?.gear ?? null,
      packWeightKg: routingPackWeightKg ?? userCapabilities?.packWeightKg ?? null,
      temperatureC: currentWeatherHour?.temperature_c ?? null,
      windKmh: currentWeatherHour?.wind_ms != null ? currentWeatherHour.wind_ms * 3.6 : null,
      precipMm: currentWeatherHour?.precip_mm ?? currentWeatherHour?.precipitation_mm ?? null,
      selectedRoute: activeRouteForFit
        ? {
            id: String(activeRouteForFit.id),
            title: activeRouteForFit.name || 'Itinéraire',
            sport: inferSportFromRouteNetwork(activeRouteForFit.network),
            distanceKm: activeRouteForFit.distance_km ?? 8,
            elevationGainM: activeRouteForFit.elev_gain_m ?? 450,
            maxAltitudeM: place?.place?.elevationM ?? null,
            startLat: state.center[1],
            startLng: state.center[0],
          }
        : null,
      nowMs: adaptiveNowRef.current,
    });
  }, [
    state.profile,
    userCapabilities,
    routingPackWeightKg,
    selectedRoute,
    state.center,
    place?.place?.elevationM,
    currentWeatherHour,
  ]);

  const offlineDaylight = useMemo(
    () => computeOfflineDaylight(state.center[1], state.center[0], adaptiveNowRef.current),
    [state.center],
  );

  // Secondary GeoJSON projections for MapStage
  const communityHeatmapGeo = useMemo<GeoCollection | null>(
    () => (communityState.enabled ? communityHeatmapQuery.data?.layer?.geojson ?? null : null),
    [communityState.enabled, communityHeatmapQuery.data],
  );
  const personalHeatmapGeo = useMemo<GeoCollection | null>(
    () => (personalState.enabled ? personalHeatmapQuery.data?.layer?.geojson ?? null : null),
    [personalState.enabled, personalHeatmapQuery.data],
  );
  const bikePoisGeo = useMemo<GeoCollection | null>(() => {
    const items = bikePoisQuery.data?.items ?? [];
    if (items.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: items.map((item) => ({
        type: 'Feature',
        properties: { id: item.id, name: item.name, category: item.category },
        geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
      })),
    };
  }, [bikePoisQuery.data]);
  const savedPlacesGeo = useMemo<GeoCollection | null>(() => {
    const places = state.savedPlaces ?? [];
    if (places.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: places.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, name: p.name, kind: p.kind },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    };
  }, [state.savedPlaces]);
  const firesGeo = useMemo<GeoCollection | null>(() => {
    const items = firesQuery.data?.incidents ?? [];
    if (items.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: items.map((fire) => ({
        type: 'Feature',
        properties: { id: fire.id, kind: fire.kind, label: fire.label },
        geometry: fire.geometry as { type: string; coordinates: unknown },
      })),
    };
  }, [firesQuery.data]);
  const surfacesGeo = useMemo<GeoCollection | null>(() => {
    const features = surfacesQuery.data?.features ?? [];
    if (features.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        properties: { id: f.id, name: f.name, surface: f.surface, surfaceClass: f.category },
        geometry: { type: 'LineString', coordinates: f.coordinates },
      })),
    };
  }, [surfacesQuery.data]);
  const highlightsGeo = useMemo<GeoCollection | null>(() => {
    const items = highlightsQuery.data?.items ?? [];
    const withLoc = items.filter((hl) => hl.location !== null);
    if (withLoc.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: withLoc.map((hl) => ({
        type: 'Feature',
        properties: { id: hl.id, title: hl.title, kind: hl.kind },
        geometry: { type: 'Point', coordinates: [hl.location!.lng, hl.location!.lat] },
      })),
    };
  }, [highlightsQuery.data]);

  // ── GPS Tracking, Kalman Filter (`kf.process`) & Local Session Sync ─────
  const [trackTrace, setTrackTrace] = useState(createTrackTrace);
  const trackTraceRef = useRef<TrackTrace>(trackTrace);
  trackTraceRef.current = trackTrace;

  const requestPointSync = useCallback(async (clientSessionId: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (pointSyncInFlightRef.current) return false;
    pointSyncInFlightRef.current = true;
    try {
      const stored = await loadSessionForSync(clientSessionId);
      if (!stored || stored.status !== 'active') return false;
      const result = await syncPendingPoints(stored);
      if (result.ok) {
        if (useExplorerStore.getState().activity?.clientSessionId === clientSessionId) {
          localSessionRef.current = result.record;
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      pointSyncInFlightRef.current = false;
    }
  }, []);

  const processGuidanceFixRef = useRef<((fix: GpsFix, updated?: ActivityState) => void) | null>(
    null,
  );

  const onGpsFix = useCallback(
    (fix: GpsFix, metrics: ActivityMetrics) => {
      const activity = useExplorerStore.getState().activity;
      if (!activity) return;
      if (!metrics.accepted) return;
      if (metrics.lastFix !== fix) return;

      processGuidanceFixRef.current?.(fix, {
        ...activity,
        distanceM: metrics.distanceM,
        elevGainM: metrics.elevGainM,
        movingS: metrics.movingS,
        autoPaused: metrics.autoPaused,
      });

      const startsNewSegment = metrics.discontinuity || traceBreakRef.current;
      if (metrics.autoPaused) {
        traceBreakRef.current = true;
        setTrackTrace(interruptTrack);
      } else {
        traceBreakRef.current = false;
        setMe({ lat: fix.lat, lng: fix.lng });
        setTrackTrace((prev) => {
          const base = startsNewSegment ? interruptTrack(prev) : prev;
          const last = base.current[base.current.length - 1];
          if (last && last[0] === fix.lng && last[1] === fix.lat) return base;
          return pushTrackPoint(base, [fix.lng, fix.lat]);
        });

        // Fixed audit bug #1: use exact `kf.process(...)` signature with `fix.acc`
        const kf = (kalmanRef.current ??= new GpsKalmanFilter());
        const nowFixMs = Date.now();
        const accuracyM =
          typeof fix.acc === 'number' && Number.isFinite(fix.acc) && fix.acc > 0 ? fix.acc : 15;
        kf.process({
          lat: fix.lat,
          lng: fix.lng,
          accuracyM,
          timestampMs: nowFixMs,
          speedMps: fix.speed ?? null,
        });
        setGpsMeta({
          accuracyM:
            typeof fix.acc === 'number' && Number.isFinite(fix.acc) ? Math.round(fix.acc) : null,
          deadReckoning: kf.isDeadReckoning(nowFixMs),
        });
        setLiveTelemetry((prev) => ({
          altitudeM:
            typeof fix.ele === 'number' && Number.isFinite(fix.ele)
              ? Math.round(fix.ele)
              : prev.altitudeM,
          speedKmh:
            typeof fix.speed === 'number' && Number.isFinite(fix.speed) && fix.speed >= 0
              ? Number((fix.speed * 3.6).toFixed(1))
              : prev.speedKmh,
        }));
        sessionPointsRef.current.push({
          lat: fix.lat,
          lng: fix.lng,
          ele: typeof fix.ele === 'number' && Number.isFinite(fix.ele) ? fix.ele : null,
          t: Number.isFinite(fix.t) ? fix.t : nowFixMs,
        });

        const current = useExplorerStore.getState();
        const activeRouteStart =
          guidedRouteFocusRef.current?.start ??
          extractRouteFirstCoord(activity.route?.geojson);
        const fixFarFromRouteStart =
          activeRouteStart !== null &&
          distanceKm([fix.lng, fix.lat], activeRouteStart) > GUIDED_ROUTE_FOLLOW_MAX_KM;

        if (!fixFarFromRouteStart) {
          freshActivityGpsFixRef.current = { lat: fix.lat, lng: fix.lng, atMs: nowFixMs };
          current.setCenter([fix.lng, fix.lat], current.zoom);
        }
      }

      if (!activity.clientSessionId) return;
      if (localSessionRef.current?.clientSessionId !== activity.clientSessionId) {
        pointSeqRef.current = 0;
      }
      const seq = pointSeqRef.current + 1;
      pointSeqRef.current = seq;
      const previous =
        localSessionRef.current?.clientSessionId === activity.clientSessionId
          ? localSessionRef.current
          : null;
      const next = {
        ...recordFromActivity(
          {
            ...activity,
            distanceM: metrics.distanceM,
            elevGainM: metrics.elevGainM,
            movingS: metrics.movingS,
          },
          previous,
        ),
        lastPointSeq: seq,
        status: 'active' as const,
        endedAt: null,
      };
      localSessionRef.current = next;
      pointsSinceSyncRef.current += 1;
      const measuredAt =
        Number.isFinite(fix.t) && fix.t >= 946_684_800_000 && fix.t <= 4_102_444_800_000
          ? fix.t
          : Date.now();
      void appendSessionPoint(next, {
        seq,
        t: measuredAt,
        lat: fix.lat,
        lng: fix.lng,
        ele: fix.ele ?? null,
        acc: fix.acc ?? null,
        speed: fix.speed ?? null,
        drawn: !metrics.autoPaused,
        ...(metrics.autoPaused ? {} : { breakBefore: startsNewSegment }),
      });
      if (pointsSinceSyncRef.current >= POINT_SYNC_EVERY) {
        pointsSinceSyncRef.current = 0;
        void requestPointSync(activity.clientSessionId);
      }
    },
    [requestPointSync],
  );

  const { markLap } = useGpsTracker({
    distanceToRouteM: distanceToRoute,
    onFix: onGpsFix,
    restored: restoredTracker,
  });

  useEffect(() => {
    if (!state.activity?.paused) return;
    traceBreakRef.current = true;
    setTrackTrace(interruptTrack);
  }, [state.activity?.paused]);

  // Restore active or recently finished local session
  useEffect(() => {
    if (restoreDoneRef.current) return;
    restoreDoneRef.current = true;
    if (typeof window === 'undefined' || initialScene) return;
    const current = useExplorerStore.getState();
    if (current.scene || current.activity || current.summary) return;
    let cancelled = false;

    void (async () => {
      try {
        const active = await readActiveSession();
        if (cancelled) return;
        if (active) {
          const [points, route] = await Promise.all([
            readSessionPoints(active.clientSessionId),
            readSessionRoute(active.clientSessionId),
          ]);
          if (cancelled) return;
          localSessionRef.current = active;
          pointSeqRef.current = active.lastPointSeq;
          traceBreakRef.current = points.length > 0 && points[points.length - 1].drawn === false;
          setTrackTrace(traceFromSessionPoints(points));
          sessionPointsRef.current = points.map((pt) => ({
            lat: pt.lat,
            lng: pt.lng,
            ele: pt.ele ?? null,
            t: pt.t,
          }));
          setRestoredTracker({
            clientSessionId: active.clientSessionId,
            fixes: points.map((point) => ({
              t: point.t,
              lat: point.lat,
              lng: point.lng,
              ele: point.ele ?? null,
              acc: point.acc ?? null,
              speed: point.speed ?? null,
            })),
          });
          useExplorerStore.setState({
            activity: {
              sport: active.sport,
              ...(active.selection ? { selection: active.selection } : {}),
              ...(route ? { route } : {}),
              sessionId: active.serverSessionId,
              clientSessionId: active.clientSessionId,
              startedAt: active.startedAt,
              paused: active.paused,
              offRoute: false,
              distanceM: active.distanceM,
              elevGainM: active.elevGainM,
              movingS: active.movingS,
            },
            mode: 'GPS_ACTIVE',
            sheet: 'live',
            detent: 'peek',
            camera: { type: 'follow' },
          });
          return;
        }

        const latest = await readLatestFinishedSession();
        if (cancelled || !latest || latest.endedAt === null) return;
        if (Date.now() - latest.endedAt > SUMMARY_RESTORE_TTL_MS) return;
        const [points, route] = await Promise.all([
          readSessionPoints(latest.clientSessionId),
          readSessionRoute(latest.clientSessionId),
        ]);
        if (cancelled) return;
        const summary = activityFromRecord(latest, route);
        if (!summary) return;
        localSessionRef.current = latest;
        traceBreakRef.current = false;
        setTrackTrace(traceFromSessionPoints(points));
        sessionPointsRef.current = points.map((pt) => ({
          lat: pt.lat,
          lng: pt.lng,
          ele: pt.ele ?? null,
          t: pt.t,
        }));
        useExplorerStore.setState({
          summary,
          summarySaved: latest.summarySaved ?? 'pending',
          sheet: 'summary',
          detent: 'full',
          camera: { type: 'overview' },
        });
      } catch {
        /* ignore local DB errors */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialScene]);

  // Persist active local session record
  const activeClientSessionId = state.activity?.clientSessionId ?? null;
  const activeServerSessionId = state.activity?.sessionId ?? null;
  const activePaused = state.activity?.paused ?? false;

  useEffect(() => {
    const activity = useExplorerStore.getState().activity;
    if (!activeClientSessionId || !activity?.clientSessionId) return;
    if (localSessionRef.current?.clientSessionId !== activity.clientSessionId) {
      pointSeqRef.current = 0;
    }
    let cancelled = false;
    void (async () => {
      try {
        const known =
          localSessionRef.current?.clientSessionId === activity.clientSessionId
            ? localSessionRef.current
            : activity.clientSessionId
              ? await loadSessionForSync(activity.clientSessionId)
              : null;
        if (cancelled) return;
        const next = {
          ...recordFromActivity(activity, known),
          lastPointSeq: known?.lastPointSeq ?? 0,
          syncedThroughSeq: known?.syncedThroughSeq ?? 0,
          status: 'active' as const,
          endedAt: null,
        };
        if (!known) pointSeqRef.current = 0;
        localSessionRef.current = next;
        await saveActiveSession(next);
        if (!known) {
          const latest = await readLatestFinishedSession();
          if (latest && latest.clientSessionId !== next.clientSessionId) {
            void forgetFinishedSession(latest.clientSessionId);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeClientSessionId]);

  // Deferred server session start
  useEffect(() => {
    const activity = useExplorerStore.getState().activity;
    if (!activeClientSessionId || activeServerSessionId || !activity?.clientSessionId) return;
    const clientSessionId = activeClientSessionId;
    if (startAttemptRef.current.has(clientSessionId)) return;
    startAttemptRef.current.add(clientSessionId);
    let cancelled = false;

    void (async () => {
      try {
        const known =
          (await loadSessionForSync(clientSessionId)) ??
          (localSessionRef.current?.clientSessionId === clientSessionId
            ? localSessionRef.current
            : null) ??
          recordFromActivity(activity);
        const result = await ensureServerSession(known);
        if (cancelled) return;
        if (!result.ok) {
          startAttemptRef.current.delete(clientSessionId);
          if (result.reason === 'conflict') {
            useExplorerStore.getState().showToast({
              title: 'Séance déjà liée',
              sub: 'Cette identité a déjà été utilisée avec un autre contenu.',
              tone: 'warn',
            });
          }
          return;
        }
        const liveActivity = useExplorerStore.getState().activity;
        if (liveActivity && liveActivity.clientSessionId === clientSessionId) {
          localSessionRef.current = result.record;
          useExplorerStore.setState({
            activity: { ...liveActivity, sessionId: result.sessionId },
          });
          void requestPointSync(clientSessionId);
        }
      } catch {
        startAttemptRef.current.delete(clientSessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [online, requestPointSync, activeClientSessionId, activeServerSessionId]);

  useEffect(() => {
    if (!activeClientSessionId) return;
    const timer = window.setInterval(() => {
      if (navigator.onLine) void requestPointSync(activeClientSessionId);
    }, POINT_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [requestPointSync, activeClientSessionId]);

  useEffect(() => {
    if (!activeClientSessionId) return;
    const record = localSessionRef.current;
    if (record && record.clientSessionId === activeClientSessionId) {
      const next = { ...record, paused: activePaused, updatedAt: Date.now() };
      localSessionRef.current = next;
      void saveActiveSession(next);
    }
    if (activePaused) void requestPointSync(activeClientSessionId);
  }, [requestPointSync, activeClientSessionId, activePaused]);

  useEffect(() => {
    const summary = state.summary;
    if (!summary?.clientSessionId) return;
    if (
      localSessionRef.current &&
      localSessionRef.current.clientSessionId !== summary.clientSessionId &&
      localSessionRef.current.status === 'active'
    ) {
      return;
    }
    const previous =
      localSessionRef.current?.clientSessionId === summary.clientSessionId
        ? localSessionRef.current
        : null;
    const record = {
      ...recordFromActivity(summary, previous),
      status: 'finished' as const,
      summarySaved: state.summarySaved,
      updatedAt: Date.now(),
    };
    localSessionRef.current = record;
    void (async () => {
      await flushLocalSessionWrites();
      await saveFinishedSession(record);
    })();
  }, [state.summary, state.summarySaved]);

  useEffect(() => {
    if (!state.activity && !state.summary) {
      traceBreakRef.current = false;
      setTrackTrace((prev) =>
        prev.segments.length > 0 || prev.current.length > 0 ? createTrackTrace() : prev,
      );
    }
  }, [state.activity, state.summary]);

  const activityTrack = useMemo<GeoCollection | null>(() => trackGeoJson(trackTrace), [trackTrace]);

  // Summary server sync
  useEffect(() => {
    const summary = state.summary;
    if (!summary || state.summarySaved !== 'pending') return;
    const sessionId = summary.sessionId;
    const clientSessionId = summary.clientSessionId ?? null;
    const hasServerId = typeof sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(sessionId);
    if (!clientSessionId && !hasServerId) {
      useExplorerStore.setState({ summarySaved: 'local' });
      return;
    }

    let cancelled = false;
    const idempotencyKey = `activity.finish:${clientSessionId ?? sessionId}`;
    const persistInQueue = async (
      savedState:
        | 'pending'
        | 'saved'
        | 'failed'
        | 'conflict'
        | 'unauthenticated'
        | 'already_finished'
        | 'already_finished_without_summary',
    ) => {
      await enqueue({
        key: idempotencyKey,
        kind: 'activity.finish',
        payload: {
          ...(hasServerId ? { sessionId } : {}),
          ...(clientSessionId ? { clientSessionId } : {}),
          sport: summary.sport,
          variantId: summary.selection?.variantId ?? null,
          startedAt: summary.startedAt,
          endedAt: summary.endedAt,
          idempotencyKey,
        },
      }).catch(() => undefined);
      const items = await listQueue().catch(() => []);
      setOfflineQueue(items.length);
      if (!cancelled) useExplorerStore.setState({ summarySaved: savedState });
    };

    void (async () => {
      try {
        await flushLocalSessionWrites();
        if (clientSessionId) {
          const stored = await loadSessionForSync(clientSessionId);
          const previous =
            stored?.clientSessionId === clientSessionId
              ? stored
              : localSessionRef.current?.clientSessionId === clientSessionId
                ? localSessionRef.current
                : null;
          const finished =
            stored?.status === 'finished' && stored.endedAt !== null
              ? stored
              : recordFromActivity(summary, previous);
          const result = await finishSession(finished);
          if (cancelled) return;
          if (result.ok) {
            if (result.outcome.summaryId) setLastSummaryId(result.outcome.summaryId);
            useExplorerStore.setState({ summarySaved: result.outcome.state });
            return;
          }
          if (result.reason === 'unauthenticated') {
            await persistInQueue('unauthenticated');
            return;
          }
          if (result.reason === 'conflict') {
            useExplorerStore.setState({ summarySaved: 'conflict' });
            return;
          }
          if (result.reason === 'rejected' || result.reason === 'invalid') {
            useExplorerStore.setState({ summarySaved: 'failed' });
            return;
          }
          await persistInQueue('failed');
          return;
        }

        const outcome = await finishSessionById(sessionId as string, idempotencyKey);
        if (cancelled) return;
        if (!outcome) {
          await persistInQueue('failed');
          return;
        }
        if (outcome.summaryId) setLastSummaryId(outcome.summaryId);
        if (outcome.terminal) {
          useExplorerStore.setState({ summarySaved: outcome.state });
          return;
        }
        await persistInQueue(outcome.state);
      } catch {
        await persistInQueue('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.summary, state.summarySaved]);

  // ── Offline Packs Store ─────────────────────────────────────────────────
  const [installedOfflinePacks, setInstalledOfflinePacks] = useState<OfflineInstalledPackRecord[]>(
    [],
  );
  const [offlineProgress, setOfflineProgress] = useState<OfflineDownloadProgress | null>(null);
  const [coverageVisible, setCoverageVisible] = useState(false);
  const offlineStoreRef = useRef<OfflineRuntimeStore | null>(null);

  const refreshOfflinePacks = useCallback(() => {
    void loadOfflineRuntimeStore().then((store) => {
      offlineStoreRef.current = store;
      setInstalledOfflinePacks(store.listInstalledPacks());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const hydrate = () => {
      void loadOfflineRuntimeStore()
        .then((store) => {
          offlineStoreRef.current = store;
          return store.hydrate();
        })
        .then((packs) => {
          if (!cancelled) setInstalledOfflinePacks(packs);
        })
        .catch(() => {});
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      idleId = w.requestIdleCallback(hydrate, { timeout: 2500 });
    } else {
      timerId = setTimeout(hydrate, 1200);
    }
    return () => {
      cancelled = true;
      if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  const offlineCoverageGeoJson = useMemo<GeoCollection | null>(() => {
    if (!coverageVisible || !offlineStoreRef.current || installedOfflinePacks.length === 0) return null;
    const fc = offlineStoreRef.current.buildCoverageGeoJson();
    return {
      type: 'FeatureCollection',
      features: fc.features.map((f) => ({
        type: 'Feature',
        properties: f.properties as unknown as Record<string, unknown>,
        geometry: { type: f.geometry.type, coordinates: f.geometry.coordinates },
      })),
    };
  }, [coverageVisible, installedOfflinePacks]);

  const offlinePackItems = useMemo<OfflinePackItem[]>(
    () =>
      installedOfflinePacks.map((pack) => {
        const bytes = Number.isFinite(pack.actualStoredBytes) ? pack.actualStoredBytes : 0;
        return {
          id: pack.manifest.packId,
          name: pack.manifest.title || 'Zone hors-ligne',
          sizeMb: Number((bytes / (1024 * 1024)).toFixed(1)),
          tilesCount: pack.manifest.resources?.length,
          savedAt: pack.installedAtMs,
        };
      }),
    [installedOfflinePacks],
  );

  const handleShortcutLaunch = useCallback((deepLinkUri: string) => {
    void loadOfflineRuntimeStore().then((store) => {
      offlineStoreRef.current = store;
      const res = store.resolveShortcut(deepLinkUri);
      if (res.status === 'unavailable') {
        useExplorerStore.getState().showToast({
          title: 'Raccourci hors ligne indisponible',
          sub: res.reason ?? 'Paquet supprimé ou non téléchargé.',
          tone: 'warn',
        });
        return;
      }
      const s = useExplorerStore.getState();
      setHasInteracted(true);
      if (res.actionKind === 'open_offline_downloads' || res.actionKind === 'open_downloaded_region') {
        setCategoryState('layers');
        setLensIndexByCategory((prev) => ({ ...prev, layers: 2 }));
        setDetentState('mid');
      } else if (res.actionKind === 'record_activity') {
        if (!s.activity) s.startActivity('rando');
      } else if (res.actionKind === 'open_downloaded_route' && res.targetRouteId) {
        const offlineRoute = store.getInstalledRouteNavigationData(res.targetRouteId);
        if (offlineRoute) {
          s.setTrailRoute({
            id: offlineRoute.routeId,
            name: offlineRoute.name,
            geojson: offlineRoute.geojson,
            status: 'ready',
          });
          s.select({ kind: 'trail', id: offlineRoute.routeId }, 'trail', 'mid');
          setCategoryState('explorer');
          setDetentState('mid');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramUri = params.get('shortcut');
    if (paramUri && paramUri.startsWith('lkdv://shortcut/')) {
      handleShortcutLaunch(paramUri);
    }
    const onShortcutEvent = (ev: Event) => {
      const uri = (ev as CustomEvent<{ uri?: string }>).detail?.uri;
      if (uri) handleShortcutLaunch(uri);
    };
    window.addEventListener('lkdv:shortcut', onShortcutEvent);
    return () => {
      window.removeEventListener('lkdv:shortcut', onShortcutEvent);
    };
  }, [handleShortcutLaunch]);

  // ── Navigation Guidance & Live Activity ─────────────────────────────────
  const navGuidance = useNavigationGuidance({
    activity: state.activity,
    trailRoute: state.trailRoute,
    routes,
    pois,
    me,
    center: state.center,
    units: unitsForCountry,
    northUp: state.northUp,
    online,
    onNorthUpSync: (nextNorthUp) => {
      if (useExplorerStore.getState().northUp !== nextNorthUp) {
        useExplorerStore.setState({ northUp: nextNorthUp });
      }
    },
    onSwapActiveRoute: (nextRoute) => {
      useExplorerStore.getState().swapActivityRoute(nextRoute);
    },
    onApplyCameraBearing: (isNorthUp, nextBearing) => {
      useExplorerStore.getState().setCamera({
        type: 'bearing',
        northUp: isNorthUp,
        bearingDeg: nextBearing,
      });
    },
    onApplyAutoZoom: (zoom) => {
      useExplorerStore.getState().setCamera({ type: 'zoom', zoom });
    },
    onPauseOrResumeActivity: () => {
      const current = useExplorerStore.getState().activity;
      if (current) {
        useExplorerStore.getState().updateActivity({ paused: !current.paused });
      }
    },
    onMarkLap: markLap,
  });

  processGuidanceFixRef.current = navGuidance.processAcceptedFix;

  const liveActivityRef = useRef<{ started: boolean; lastPush: number }>({
    started: false,
    lastPush: 0,
  });
  useEffect(() => {
    const activity = state.activity;
    if (!activity) {
      if (liveActivityRef.current.started) {
        liveActivityRef.current = { started: false, lastPush: 0 };
        void endLiveActivity({
          distanceM: 0,
          elevGainM: 0,
          movingS: 0,
          paused: false,
          offRoute: false,
        });
      }
      return;
    }
    const lockPayload = navGuidance.guidance.lockScreenPayload;
    const payload = {
      distanceM: activity.distanceM,
      elevGainM: activity.elevGainM,
      movingS: activity.movingS,
      paused: activity.paused,
      offRoute: activity.offRoute ?? false,
      clientSessionId: activity.clientSessionId ?? null,
      nextManeuverInstruction: lockPayload?.nextManeuver?.instruction ?? null,
      nextManeuverIcon: lockPayload?.nextManeuver?.iconName ?? null,
      nextManeuverDistanceM: lockPayload?.nextManeuver?.distanceM ?? null,
      offRouteLabel: activity.offRoute ? offRouteLabel(activity.offRouteM) : null,
      formattedRhythm: lockPayload?.dynamicIsland.expanded.trailingStatValue ?? null,
    };
    if (!liveActivityRef.current.started) {
      liveActivityRef.current = { started: true, lastPush: Date.now() };
      void startLiveActivity({ ...payload, sport: activity.sport, startedAt: activity.startedAt });
      return;
    }
    const now = Date.now();
    if (now - liveActivityRef.current.lastPush < 5000) return;
    liveActivityRef.current.lastPush = now;
    void updateLiveActivity(payload);
  }, [state.activity, navGuidance.guidance.lockScreenPayload]);

  // Pending stage launch deep-link from Planning
  useEffect(() => {
    const launch = consumePendingStageLaunch();
    if (launch) {
      const trail = trailSnapshotFromStage(launch.planTitle, {
        stageId: launch.stageId,
        dayNumber: launch.dayNumber,
        points: launch.points,
        revision: launch.stageRevision,
      });
      const bounds = computeGeoJsonBounds(trail.geojson);
      const firstCoord = extractRouteFirstCoord(trail.geojson);
      const store = useExplorerStore.getState();
      store.patch({
        selection: { kind: 'trail', id: trail.id },
        trailRoute: trail,
      });
      if (bounds) {
        store.setCamera({ type: 'overview', bounds });
      } else if (firstCoord) {
        store.setCamera({ type: 'reveal', center: firstCoord, zoom: 13 });
      }
      setPreFlightSport('rando');
      setPreFlightSelection(undefined);
      setHasInteracted(true);
      setOverlayMode('preflight');
      setDetentState('mid');
      store.showToast({ title: `Étape prête · ${launch.planTitle} (J${launch.dayNumber})` });
    }
  }, []);

  // Fixed audit bug #2: exact `SafetyCorridorState` keys + `.geojson` (not `.geometry`)
  useEffect(() => {
    if (!isGpsLive) return;
    const activeLines = state.activity?.route?.geojson
      ? routeLines(state.activity.route.geojson)
      : [];
    const vital = countCorridorVitalPois(
      pois.map((p) => ({ kind: p.kind, subtype: p.subtype, lat: p.lat, lon: p.lon })),
      activeLines,
      state.center,
      3.0,
    );
    const fireCount = hazardsUnifiedQuery.data?.fires?.features?.length ?? 0;
    const alertItems = hazardsUnifiedQuery.data?.alerts ?? [];
    const hazardLabels: string[] = [];
    if (fireCount > 0) {
      hazardLabels.push(`${fireCount} feu${fireCount > 1 ? 'x' : ''}`);
    }
    for (const al of alertItems.slice(0, 3)) {
      const label = al.headline || al.event;
      if (label) hazardLabels.push(label);
    }
    useExplorerStore.getState().updateSafetyCorridor({
      radiusKm: 3.0,
      waterCount: vital.water,
      shelterCount: vital.refuges + vital.bivouacs,
      activeHazardsCount: fireCount + alertItems.length,
      hazardLabels,
      rescuePointsCount: vital.medical,
      updatedAt: Date.now(),
    });
  }, [
    isGpsLive,
    pois,
    state.activity?.route?.geojson,
    state.center,
    hazardsUnifiedQuery.data,
  ]);

  // Follow camera while activity moves (never jump to Paris or remote GPS > 20 km from route start!)
  const activity = state.activity;
  const hasActiveActivity = Boolean(activity);
  const activityStartedAt = activity?.startedAt ?? 0;
  const activityDistanceM = activity?.distanceM ?? 0;
  const activitySport = activity?.sport ?? null;
  useEffect(() => {
    if (!hasActiveActivity) {
      guidedRouteFocusRef.current = null;
      freshActivityGpsFixRef.current = null;
      setActiveGuidedItinerary((prev) => (prev ? null : prev));
      return;
    }
    const routeStart =
      guidedRouteFocusRef.current?.start ??
      extractRouteFirstCoord(activity?.route?.geojson);
    const freshFix = freshActivityGpsFixRef.current;
    const hasFreshActivityFix = Boolean(
      freshFix && activityStartedAt > 0 && freshFix.atMs >= activityStartedAt,
    );

    if (routeStart) {
      if (!hasFreshActivityFix || !freshFix) return;
      if (distanceKm([freshFix.lng, freshFix.lat], routeStart) > GUIDED_ROUTE_FOLLOW_MAX_KM) {
        return;
      }
      useExplorerStore.setState({ camera: { type: 'follow' } });
      return;
    }

    if (hasFreshActivityFix || me) {
      useExplorerStore.setState({ camera: { type: 'follow' } });
    }
  }, [hasActiveActivity, activityStartedAt, activityDistanceM, activitySport, activity?.route?.geojson, me]);

  // ── Effective zoom-aware scale level (0=globe, 1=country, 2=region, 3=local) ─
  const effectiveScaleLevel = useMemo<0 | 1 | 2 | 3>(() => {
    if (!Number.isFinite(state.zoom)) return state.level;
    return liveZoom >= 9.5 ? 3 : liveZoom >= 7 ? 2 : liveZoom >= 4.2 ? 1 : 0;
  }, [state.level, state.zoom, liveZoom]);

  // ── Map Pins (level 0 globe countries or local visible POIs) ────────────
  const pins = useMemo<MapPin[]>(() => {
    if (isGpsLive) return EMPTY_PINS;
    const center =
      Array.isArray(state.center) &&
      Number.isFinite(state.center[0]) &&
      Number.isFinite(state.center[1])
        ? state.center
        : ([2.35, 48.85] as [number, number]);

    if (effectiveScaleLevel === 0) {
      return countries
        .filter(
          (entry) =>
            entry.center && Number.isFinite(entry.center[0]) && Number.isFinite(entry.center[1]),
        )
        .map((entry) => ({ entry, km: distanceKm(center, entry.center as [number, number]) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 10)
        .map(({ entry, km }) => ({
          id: `country-${entry.iso}`,
          kind: 'country',
          name: entry.name,
          sub: entry.continent,
          lat: (entry.center as [number, number])[1],
          lon: (entry.center as [number, number])[0],
          distanceKm: km,
          tone: 'ink' as const,
        }));
    }

    const shows = (key: string) => effectiveLayerVisibility[key] !== false;
    const visibleForLayer = (kind: string): boolean => {
      switch (kind) {
        case 'water':
          return shows('water');
        case 'refuge':
        case 'bivouac':
          return shows('refuges');
        case 'summit':
        case 'viewpoint':
          return shows('summits');
        case 'access':
          return shows('access');
        case 'danger':
          return shows('dangers');
        case 'trail':
          return shows('routes');
        case 'friend':
          return shows('friends');
        default:
          return true;
      }
    };

    const pinMatchesActiveFilter = (poi: { kind: string; subtype?: string }): boolean => {
      const k = (poi.kind ?? '').toLowerCase();
      if (category === 'explorer' && activeLensId === 'spots') {
        return poiMatchesSpotsFilter(poi, spotsFilter);
      }
      if (category === 'safety' && activeLensId === 'survival' && survivalFilter !== 'all') {
        if (survivalFilter === 'water') return k === 'water';
        if (survivalFilter === 'refuge') return k === 'refuge' || k === 'shelter' || k === 'bivouac';
        if (survivalFilter === 'rescue') return k === 'rescue' || k === 'medical';
      }
      return true;
    };

    return (pois ?? [])
      .filter(
        (poi) =>
          poi &&
          poi.name &&
          poi.name.trim().length > 1 &&
          Number.isFinite(poi.lat) &&
          Number.isFinite(poi.lon) &&
          (poi.id === state.selection?.id ||
            (visibleForLayer(poi.kind) && pinMatchesActiveFilter(poi))),
      )
      .map((poi) => ({ poi, km: distanceKm(center, [poi.lon, poi.lat]) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 60)
      .map(({ poi, km }) => ({
        id: poi.id,
        kind: poi.kind,
        subtype: poi.subtype,
        name: poi.name,
        sub: poi.ele_m ? `${poi.ele_m} m` : undefined,
        lat: poi.lat,
        lon: poi.lon,
        distanceKm: km,
        tone: (poi.kind === 'water'
          ? 'water'
          : poi.kind === 'danger'
            ? 'bad'
            : poi.kind === 'bivouac' || poi.kind === 'refuge'
              ? 'warn'
              : 'ink') as MapPin['tone'],
      }));
  }, [
    isGpsLive,
    countries,
    pois,
    effectiveScaleLevel,
    state.center,
    effectiveLayerVisibility,
    state.selection?.id,
    category,
    activeLensId,
    spotsFilter,
    survivalFilter,
  ]);

  // ── Bidirectional Map ↔ Drawer Handlers ─────────────────────────────────
  const onFocusCoordinates = useCallback(
    (coords: [number, number] | null | undefined, label?: string) => {
      if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
      setHasInteracted(true);
      const inferredKind =
        category === 'community'
          ? activeLensId === 'bottles'
            ? 'bottle'
            : activeLensId === 'carnets'
              ? 'carnet'
              : activeLensId === 'clubs'
                ? 'club'
                : 'story'
          : category === 'pokedex'
            ? 'pokedex'
            : category === 'safety'
              ? 'danger'
              : 'spot';
      setSelectedFeature({
        id: label ?? `${coords[0].toFixed(3)},${coords[1].toFixed(3)}`,
        coordinates: coords,
        kind: inferredKind,
        label,
      });
      useExplorerStore.getState().setCamera({
        type: 'reveal',
        center: coords,
        zoom: Math.max(useExplorerStore.getState().zoom, 11),
      });
      setDetentState((current) => (current === 'full' ? 'mid' : current));
    },
    [category, activeLensId],
  );

  const onCountryClick = useCallback(
    (iso: string, name: string, center: [number, number]) => {
      haptic('level');
      setHasInteracted(true);
      setSelectedFeature({ id: iso, coordinates: center });
      useExplorerStore.getState().openCountry(iso, center, name);
      setCategoryState('explorer');
      setLensIndexByCategory((prev) => ({ ...prev, explorer: 1 }));
      setOverlayMode('none');
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
    },
    [],
  );

  const onRegionClick = useCallback(
    (group: string, center: [number, number]) => {
      haptic('level');
      setHasInteracted(true);
      setSelectedFeature({ id: group, coordinates: center });
      useExplorerStore.getState().openRegion(group, center, group);
      setCategoryState('explorer');
      setLensIndexByCategory((prev) => ({ ...prev, explorer: 0 }));
      setOverlayMode('none');
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
    },
    [],
  );

  const onRouteClick = useCallback(
    (routeId: string, name: string | null, coords: [number, number]) => {
      haptic('pin');
      setHasInteracted(true);
      setSelectedFeature({ id: routeId, coordinates: coords, kind: 'trailhead', label: name ?? undefined });
      const found =
        routesRef.current.find((r) => String(r.id) === routeId) ??
        ({
          id: Number(routeId) || 0,
          name: name ?? `Itinéraire #${routeId}`,
          distance_km: null,
          network: null,
          ref: null,
          geojson: null,
        } as ExplorerSpotRoute);
      setSelectedRoute(found);
      useExplorerStore.getState().select({ kind: 'trail', id: routeId }, 'trail', 'mid');
      useExplorerStore.getState().setCamera({ type: 'reveal', center: coords, zoom: 14.2 });
      setCategoryState('explorer');
      setLensIndexByCategory((prev) => ({ ...prev, explorer: 0 }));
      setOverlayMode('route-detail');
      setDetentState('mid');
    },
    [],
  );

  const onUnifiedFeatureClick = useCallback((picked: MapInteractiveSelection) => {
    haptic('pin');
    setHasInteracted(true);
    const resolved3DKind = normalize3DEntityKind(picked.kind, undefined, {
      iconicTaxon:
        typeof picked.properties?.iconicTaxon === 'string' ? picked.properties.iconicTaxon : null,
      kingdom: typeof picked.properties?.kingdom === 'string' ? picked.properties.kingdom : null,
    });
    setSelectedFeature({
      id: picked.id,
      coordinates: picked.coordinates,
      kind: resolved3DKind,
      label: String(picked.properties?.title ?? picked.properties?.name ?? picked.properties?.commonName ?? ''),
    });
    useExplorerStore.getState().setCamera({
      type: 'reveal',
      center: picked.coordinates,
      zoom: 14.4,
    });
    setOverlayMode('none');
    setDetentState((d) => (d === 'peek' ? 'mid' : d));

    switch (picked.kind) {
      case 'bottle':
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 0 }));
        setSelectedBottleId(picked.id);
        break;
      case 'carnet':
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 1 }));
        setSelectedCarnetId(picked.id);
        break;
      case 'club':
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 2 }));
        setSelectedClubId(picked.id);
        break;
      case 'story':
      case 'friend':
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 3 }));
        if (picked.kind === 'story') setSelectedStoryId(picked.id);
        break;
      case 'pokedex': {
        setCategoryState('pokedex');
        setLensIndexByCategory((prev) => ({ ...prev, pokedex: 0 }));
        const rawTaxon = picked.properties?.taxonId ?? picked.id;
        const parsedTaxon = Number(rawTaxon);
        if (Number.isFinite(parsedTaxon) && parsedTaxon > 0) {
          setSelectedTaxonId(parsedTaxon);
        }
        break;
      }
      case 'hazard':
        setCategoryState('safety');
        setLensIndexByCategory((prev) => ({ ...prev, safety: 0 }));
        break;
      default:
        break;
    }
  }, []);

  const onPinClick = useCallback(
    (pin: MapPin) => {
      setHasInteracted(true);
      if (pin.kind === 'country') {
        const iso = pin.id.replace('country-', '');
        onCountryClick(iso, pin.name, [pin.lon, pin.lat]);
        return;
      }
      haptic('pin');
      setSelectedPoi(pin);
      setSelectedFeature({
        id: pin.id,
        coordinates: [pin.lon, pin.lat],
        kind: normalize3DEntityKind(pin.kind, pin.subtype),
        label: pin.name,
      });
      useExplorerStore.getState().select({ kind: pin.kind as PoiKind, id: pin.id }, pin.kind as never, 'mid');
      useExplorerStore.getState().setCamera({ type: 'reveal', center: [pin.lon, pin.lat] });
      setOverlayMode('poi-detail');
      setDetentState('mid');
    },
    [onCountryClick],
  );

  const handleSelectSpotRoute = useCallback(
    (route: ExplorerSpotRoute) => {
      haptic('pin');
      setHasInteracted(true);
      setSelectedRoute(route);
      useExplorerStore.getState().select({ kind: 'trail', id: String(route.id) }, 'trail', 'mid');
      const coord = extractRouteFirstCoord(route.geojson);
      if (coord) {
        setSelectedFeature({
          id: String(route.id),
          coordinates: coord,
          kind: 'trailhead',
          label: route.name ?? undefined,
        });
        useExplorerStore.getState().setCamera({ type: 'reveal', center: coord });
      }
      setOverlayMode('route-detail');
      setDetentState((d) => (d === 'peek' ? 'mid' : d));
    },
    [],
  );

  const handlePickSearchResult = useCallback(
    (result: ExplorerSearchResultItem) => {
      setOverlayMode('none');
      setHasInteracted(true);
      if (result.kind === 'country' && result.iso && result.coordinates) {
        onCountryClick(result.iso, result.title, result.coordinates);
        return;
      }
      if (result.kind === 'route' && result.routeId != null) {
        const matched = routesRef.current.find((r) => r.id === result.routeId);
        if (matched) {
          handleSelectSpotRoute(matched);
          return;
        }
        onRouteClick(String(result.routeId), result.title, result.coordinates ?? state.center);
        return;
      }
      if (result.kind === 'species' && result.taxonId != null) {
        setCategoryState('pokedex');
        setLensIndexByCategory((prev) => ({ ...prev, pokedex: 0 }));
        setSelectedTaxonId(result.taxonId);
        if (result.coordinates) onFocusCoordinates(result.coordinates, result.title);
        setDetentState('mid');
        return;
      }
      if (result.kind === 'bottle') {
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 0 }));
        setSelectedBottleId(result.id.replace(/^bottle-/, ''));
        if (result.coordinates) onFocusCoordinates(result.coordinates, result.title);
        setDetentState('mid');
        return;
      }
      if (result.kind === 'carnet') {
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 1 }));
        setSelectedCarnetId(result.id.replace(/^carnet-/, ''));
        if (result.coordinates) onFocusCoordinates(result.coordinates, result.title);
        setDetentState('mid');
        return;
      }
      if (result.kind === 'club') {
        setCategoryState('community');
        setLensIndexByCategory((prev) => ({ ...prev, community: 2 }));
        setSelectedClubId(result.id.replace(/^club-/, ''));
        if (result.coordinates) onFocusCoordinates(result.coordinates, result.title);
        setDetentState('mid');
        return;
      }
      if (result.kind === 'poi' && result.coordinates) {
        onPinClick({
          id: result.poiId ?? result.id,
          kind: result.poiKind ?? 'place',
          subtype: result.poiSubtype ?? undefined,
          name: result.title,
          sub: result.elevationM != null ? `${Math.round(result.elevationM)} m` : undefined,
          lat: result.coordinates[1],
          lon: result.coordinates[0],
        });
        return;
      }
      if (result.coordinates) {
        onFocusCoordinates(result.coordinates, result.title);
        setDetentState('mid');
      }
    },
    [onCountryClick, handleSelectSpotRoute, onRouteClick, onPinClick, state.center, onFocusCoordinates],
  );

  const handleOpenStory = useCallback((story: ExplorerStoryItem) => {
    if (!story.imageUrl) return;
    setSelectedStoryId(story.id);
    setActiveStoryViewer([
      {
        id: story.id,
        name: story.caption || 'Story Explorer',
        slides: [
          {
            image: story.imageUrl,
            caption: story.caption ?? undefined,
            storyId: story.id,
            mediaType: story.mediaType === 'video' ? 'video' : 'image',
          },
        ],
      },
    ]);
  }, []);

  const handleConfirmSos = useCallback(() => {
    haptic('sos-fired');
    const emergencyNum = country?.practical?.emergency_numbers?.general;
    const plan = planSosCall(emergencyNum, { simulated: sosSimulated() });
    const dialled = performSosCall(plan);

    void (async () => {
      const pos = me ?? { lat: state.center[1], lng: state.center[0] };
      const validCountryIso = activeGeo && /^[A-Z]{2}$/.test(activeGeo) ? activeGeo : null;
      const sosPayload: Record<string, unknown> = {
        lat: pos.lat,
        lng: pos.lng,
        sessionId: /^[0-9a-f-]{36}$/i.test(state.activity?.sessionId ?? '')
          ? state.activity?.sessionId
          : null,
        ...(typeof gpsMeta.accuracyM === 'number' && Number.isFinite(gpsMeta.accuracyM)
          ? { accuracyM: Math.min(10000, Math.max(0, gpsMeta.accuracyM)) }
          : {}),
        countryIso: validCountryIso,
      };

      const enqueueSosOffline = async () => {
        await enqueue({
          key: idempotencyKey('sos', { ...sosPayload, ts: Math.floor(Date.now() / 1000) }),
          kind: 'sos',
          payload: sosPayload,
        }).catch(() => undefined);
        const items = await listQueue().catch(() => []);
        setOfflineQueue(items.length);
      };

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueueSosOffline();
        return;
      }

      try {
        const token = await defaultAccessToken();
        if (!token) {
          await enqueueSosOffline();
          return;
        }
        const res = await fetch('/api/explorer/v2/sos', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(sosPayload),
        });
        if (!res.ok) {
          await enqueueSosOffline();
        }
      } catch {
        await enqueueSosOffline();
      }
    })();

    useExplorerStore.getState().showToast({
      title: 'Alerte SOS déclenchée',
      sub: dialled ? `Appel ${plan.number}` : `Numéro ${plan.number}`,
      tone: 'bad',
    });
  }, [
    country?.practical?.emergency_numbers?.general,
    me,
    state.center,
    state.activity?.sessionId,
    gpsMeta.accuracyM,
    activeGeo,
  ]);

  const handleMapMoveEnd = useCallback((nextCenter: [number, number], nextZoom: number) => {
    if (nextZoom >= 5.5) setHasInteracted(true);
    useExplorerStore.getState().setCenter(nextCenter, nextZoom);
  }, []);

  const handleMapBearingChange = useCallback((nextBearing: number) => {
    if (!Number.isFinite(nextBearing)) return;
    setBearingDeg(((nextBearing % 360) + 360) % 360);
  }, []);

  const handleUnifiedLayerEvict = useCallback((evicted: string[]) => {
    useExplorerStore.getState().showToast({
      title: 'Budget GPU préservé (max 2 rasters)',
      sub: `Calque mis en pause : ${evicted.join(', ')}`,
    });
  }, []);

  const longPress = useLongPress(() => {
    setHasInteracted(true);
    setOverlayMode('sport');
    setDetentState('mid');
  });

  // ── Location Label for Top Chrome ───────────────────────────────────────
  // Strictly prefers viewport-matching placeName / regionName (no stale placeholderData flicker during flyTo)
  // and always shows country name when zoom < 7.
  const countryLabel = country?.name ?? detectedCountry?.name ?? null;
  const locationLabel =
    liveZoom < 4.2
      ? 'Monde'
      : liveZoom < 7
        ? (countryLabel ?? 'Monde')
        : liveZoom < 10
          ? (region?.name ?? activePlaceRegionName ?? countryLabel ?? state.regionId ?? 'Monde')
          : (activePlaceName ??
            activePlaceRegionName ??
            region?.name ??
            countryLabel ??
            state.regionId ??
            'Monde');

  // ── Single Dynamic Island Toast (exact ClubIslandToast contract!) ───────
  const offRouteDirection = bearingLabel(activity?.offRouteBearing);
  const islandToast = useMemo<ClubIslandToast | null>(() => {
    if (isGpsLive && activity?.offRoute && activityRouteStatus !== 'unavailable') {
      return {
        id: 'off-route-alert',
        message: offRouteLabel(activity.offRouteM),
        subtitle: offRouteDirection ? `Retour ${offRouteDirection}` : undefined,
      };
    }
    if (
      isGpsLive &&
      activityRouteStatus === 'ready' &&
      navGuidance.guidance.turnByTurn.nextManeuver
    ) {
      const maneuver = navGuidance.guidance.turnByTurn.nextManeuver;
      return {
        id: `maneuver-${maneuver.instruction}`,
        message: maneuver.instruction,
        subtitle:
          typeof maneuver.distanceM === 'number' && Number.isFinite(maneuver.distanceM)
            ? maneuver.distanceM < 1000
              ? `${Math.round(maneuver.distanceM)} m`
              : `${(maneuver.distanceM / 1000).toFixed(1)} km`
            : undefined,
      };
    }
    if (state.toast && state.toast.title) {
      return {
        id: String(state.toast.id),
        message: state.toast.title,
        subtitle: state.toast.sub,
      };
    }
    return null;
  }, [
    isGpsLive,
    activity?.offRoute,
    activity?.offRouteM,
    activityRouteStatus,
    offRouteDirection,
    navGuidance.guidance.turnByTurn.nextManeuver,
    state.toast,
  ]);

  // ── Bottom-Right SortMenuButton per Active Category ─────────────────────
  const bottomRightFilter = useMemo<React.ReactNode>(() => {
    if (category === 'explorer') {
      if (activeLensId !== 'spots') return undefined;
      const groups: SortMenuGroup[] = [
        {
          id: 'spots-sort',
          label: 'Trier',
          value: spotsSort,
          defaultValue: 'proximity',
          options: [
            { value: 'proximity', label: 'Proximité' },
            { value: 'elevation', label: 'Altitude / D+' },
            { value: 'distance', label: 'Distance' },
          ],
          onChange: (v) => setSpotsSort(v as 'proximity' | 'elevation' | 'distance'),
        },
        {
          id: 'spots-filter',
          label: 'Afficher',
          value: spotsFilter,
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'Tout' },
            { value: 'relief', label: 'Sommets & Cols' },
            { value: 'water_refuge', label: 'Eau & Refuges' },
            { value: 'bivouac', label: 'Bivouac & Abris' },
            { value: 'access', label: 'Accès & Transports' },
            { value: 'routes', label: 'Itinéraires' },
            { value: 'gr', label: 'GR' },
            { value: 'pr', label: 'PR' },
            { value: 'vtt', label: 'VTT' },
          ],
          onChange: (v) => setSpotsFilter(v as SpotsFilterKind),
        },
      ];
      return (
        <SortMenuButton
          value={spotsFilter !== 'all' ? spotsFilter : spotsSort}
          defaultValue="proximity"
          options={[]}
          onChange={() => {}}
          groups={groups}
          label="Trier et filtrer les lieux et itinéraires"
        />
      );
    }

    if (category === 'layers') {
      const styleOptions = [
        { value: 'relief', label: 'Relief 3D' },
        { value: 'satellite', label: 'Satellite' },
        { value: 'plan', label: 'Plan' },
        ...(nationalTopo ? [{ value: 'national', label: nationalTopo.label || 'IGN / National' }] : []),
      ];
      const groups: SortMenuGroup[] = [
        {
          id: 'base-style',
          label: 'Fond de carte',
          value: state.mapBaseStyle ?? 'relief',
          defaultValue: 'relief',
          options: styleOptions,
          onChange: (v) => state.setMapBaseStyle(v as MapBaseStyle),
        },
        {
          id: 'offline-cov',
          label: 'Couverture',
          value: coverageVisible ? 'on' : 'off',
          defaultValue: 'off',
          options: [
            { value: 'off', label: 'Masquée' },
            { value: 'on', label: 'Afficher zones hors-ligne' },
          ],
          onChange: (v) => setCoverageVisible(v === 'on'),
        },
      ];
      return (
        <SortMenuButton
          value={state.mapBaseStyle ?? 'relief'}
          defaultValue="relief"
          options={[]}
          onChange={() => {}}
          groups={groups}
          label="Fond de carte et affichage"
        />
      );
    }

    if (category === 'pokedex') {
      const gbifOn = Boolean(lv.pokedexGbif);
      const groups: SortMenuGroup[] = [
        {
          id: 'pokedex-rarity',
          label: 'Rareté',
          value: pokedexRarity,
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'Toutes' },
            { value: 'threatened', label: 'Menacées' },
            { value: 'rare', label: 'Rares' },
            { value: 'common', label: 'Communes' },
          ],
          onChange: (v) => setPokedexRarity(v as PokedexRarityFilter),
        },
        {
          id: 'pokedex-gbif',
          label: 'Densité GBIF',
          value: gbifOn ? 'on' : 'off',
          defaultValue: 'off',
          options: [
            { value: 'off', label: 'Masquée' },
            { value: 'on', label: 'Couche GBIF active' },
          ],
          onChange: (v) => {
            if ((v === 'on') !== gbifOn) state.toggleLayer('pokedexGbif');
          },
        },
      ];
      return (
        <SortMenuButton
          value={pokedexRarity}
          defaultValue="all"
          options={[]}
          onChange={() => {}}
          groups={groups}
          label="Filtrer le Pokédex"
        />
      );
    }

    if (category === 'safety') {
      if (activeLensId === 'survival') {
        const groups: SortMenuGroup[] = [
          {
            id: 'survival-kind',
            label: 'Points vitaux',
            value: survivalFilter,
            defaultValue: 'all',
            options: [
              { value: 'all', label: 'Tous' },
              { value: 'water', label: 'Eau potable' },
              { value: 'refuge', label: 'Refuges & Abris' },
              { value: 'rescue', label: 'Secours' },
            ],
            onChange: (v) => setSurvivalFilter(v as SurvivalKindFilter),
          },
        ];
        return (
          <SortMenuButton
            value={survivalFilter}
            defaultValue="all"
            options={[]}
            onChange={() => {}}
            groups={groups}
            label="Filtrer eau et secours"
          />
        );
      }

      const slopeOn = Boolean(lv.avalancheSlope);
      const groups: SortMenuGroup[] = [
        {
          id: 'hazard-kind',
          label: 'Risques',
          value: hazardKindFilter,
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'Tous' },
            { value: 'fire', label: 'Feux' },
            { value: 'flood', label: 'Crues' },
            { value: 'quake', label: 'Séismes' },
            { value: 'airspace', label: 'Aérien' },
          ],
          onChange: (v) => setHazardKindFilter(v as HazardKindFilter),
        },
        {
          id: 'safety-slope',
          label: 'Pentes >30°',
          value: slopeOn ? 'on' : 'off',
          defaultValue: 'off',
          options: [
            { value: 'off', label: 'Désactivé' },
            { value: 'on', label: 'Activer pentes >30°' },
          ],
          onChange: (v) => {
            if ((v === 'on') !== slopeOn) state.toggleLayer('avalancheSlope');
          },
        },
      ];
      return (
        <SortMenuButton
          value={hazardKindFilter}
          defaultValue="all"
          options={[]}
          onChange={() => {}}
          groups={groups}
          label="Filtrer les risques"
        />
      );
    }

    if (category === 'community') {
      if (activeLensId === 'carnets') {
        const current = communitySort === 'popular' ? 'popular' : 'recent';
        const groups: SortMenuGroup[] = [
          {
            id: 'carnets-sort',
            label: 'Carnets',
            value: current,
            defaultValue: 'recent',
            options: [
              { value: 'recent', label: 'Récents' },
              { value: 'popular', label: 'Populaires' },
            ],
            onChange: (v) => setCommunitySort(v as 'recent' | 'popular'),
          },
        ];
        return (
          <SortMenuButton
            value={current}
            defaultValue="recent"
            options={[]}
            onChange={() => {}}
            groups={groups}
            label="Trier les carnets"
          />
        );
      }
      if (activeLensId === 'clubs') {
        const current =
          communitySort === 'verified' || communitySort === 'alpha' ? communitySort : 'members';
        const groups: SortMenuGroup[] = [
          {
            id: 'clubs-sort',
            label: 'Clubs',
            value: current,
            defaultValue: 'members',
            options: [
              { value: 'members', label: 'Membres' },
              { value: 'verified', label: 'Vérifiés' },
              { value: 'alpha', label: 'A–Z' },
            ],
            onChange: (v) => setCommunitySort(v as 'members' | 'verified' | 'alpha'),
          },
        ];
        return (
          <SortMenuButton
            value={current}
            defaultValue="members"
            options={[]}
            onChange={() => {}}
            groups={groups}
            label="Trier les clubs"
          />
        );
      }
      if (activeLensId === 'stories') {
        return undefined;
      }

      const current = communitySort === 'spots' ? 'spots' : 'recent';
      const groups: SortMenuGroup[] = [
        {
          id: 'comm-sort',
          label: 'Bouteilles',
          value: current,
          defaultValue: 'recent',
          options: [
            { value: 'recent', label: 'Récents' },
            { value: 'spots', label: 'Places disponibles' },
          ],
          onChange: (v) => setCommunitySort(v as 'recent' | 'spots'),
        },
      ];
      return (
        <SortMenuButton
          value={current}
          defaultValue="recent"
          options={[]}
          onChange={() => {}}
          groups={groups}
          label="Trier les bouteilles"
        />
      );
    }

    return undefined;
  }, [
    category,
    activeLensId,
    spotsSort,
    spotsFilter,
    nationalTopo,
    state,
    coverageVisible,
    lv.pokedexGbif,
    lv.avalancheSlope,
    pokedexRarity,
    hazardKindFilter,
    survivalFilter,
    communitySort,
  ]);

  // ── Bottom-Left Contextual Primary CTA ──────────────────────────────────
  const hasAnyActiveLayer = useMemo(
    () => unifiedLayerItems.some((item) => item.enabled),
    [unifiedLayerItems],
  );

  const emergencyPrimaryNumber = country?.practical?.emergency_numbers?.general?.trim() || '112';

  const handleSelectDestination = useCallback((dest: ExplorerFeaturedDestination) => {
    haptic('level');
    setHasInteracted(true);
    setSelectedFeature({
      id: dest.id,
      coordinates: dest.coords,
      kind: 'summit',
      label: dest.name,
    });
    useExplorerStore.setState({
      center: dest.coords,
      zoom: dest.zoom,
      level: 3,
      ...(dest.iso ? { geo: dest.iso } : {}),
      camera: { type: 'reveal', center: dest.coords, zoom: dest.zoom },
    });
    setDetentState((d) => (d === 'peek' ? 'mid' : d));
  }, []);

  const handleGoUp = useCallback(() => {
    haptic('level');
    const current = useExplorerStore.getState();
    if (current.level > 0) {
      current.goUp();
      return;
    }
    const z = Number.isFinite(current.zoom) ? current.zoom : 1.6;
    const nextLevel: 0 | 1 | 2 = z >= 9.5 ? 2 : z >= 6.5 ? 1 : 0;
    const nextZoom = nextLevel === 2 ? 7.2 : nextLevel === 1 ? 5.0 : 1.8;
    useExplorerStore.setState({
      level: nextLevel,
      zoom: nextZoom,
      camera: { type: 'level', level: nextLevel, center: current.center },
    });
  }, []);

  const handleDownloadCurrentSector = useCallback(() => {
    const [lng, lat] = useExplorerStore.getState().center;
    const bounds = {
      west: Math.max(-180, lng - 0.15),
      south: Math.max(-85, lat - 0.12),
      east: Math.min(180, lng + 0.15),
      north: Math.min(85, lat + 0.12),
    };
    const regionItem: PredefinedRegionCatalogItem = {
      regionId: `zone-${lat.toFixed(2)}-${lng.toFixed(2)}`,
      name: locationLabel,
      countryIsoA2: activeGeo && /^[A-Z]{2}$/.test(activeGeo) ? activeGeo : 'FR',
      bounds,
      recommendedMinZoom: 9,
      recommendedMaxZoom: 15,
      poiCount: pois.length,
      routeCount: routes.length,
      unlocked: true,
      providerId: 'openfreemap-vector',
    };

    void (async () => {
      try {
        const store = await loadOfflineRuntimeStore();
        offlineStoreRef.current = store;
        const [packResult] = await Promise.allSettled([
          store.downloadOrResumeRegion(
            regionItem,
            { pois, routes },
            {
              ownerUserId: savedPlacesUserKey,
              onProgress: (progress) => setOfflineProgress(progress),
            },
          ),
          downloadZone(
            bounds,
            { pois: [...pois], routes: [...routes] },
            { minZoom: 9, maxZoom: 14 },
          ).catch(() => null),
        ]);
        refreshOfflinePacks();
        if (
          packResult.status === 'fulfilled' &&
          packResult.value.status !== 'corrupted' &&
          packResult.value.status !== 'unavailable'
        ) {
          useExplorerStore.getState().showToast({
            title: 'Zone prête hors ligne',
            sub: locationLabel,
            tone: 'good',
          });
        } else {
          useExplorerStore.getState().showToast({
            title: 'Téléchargement incomplet',
            sub: 'Vérifiez le réseau ou le stockage disponible.',
            tone: 'warn',
          });
        }
      } catch {
        useExplorerStore.getState().showToast({
          title: 'Échec du téléchargement hors ligne',
          sub: 'Réessayez dans un instant.',
          tone: 'warn',
        });
      } finally {
        setOfflineProgress(null);
      }
    })();
  }, [locationLabel, activeGeo, pois, routes, savedPlacesUserKey, refreshOfflinePacks]);

  const handleFocusOfflinePack = useCallback(
    (packId: string) => {
      const pack = installedOfflinePacks.find((p) => p.manifest.packId === packId);
      if (!pack) return;
      const b = pack.manifest.bounds;
      const center: [number, number] = [(b.west + b.east) / 2, (b.south + b.north) / 2];
      haptic('pin');
      setHasInteracted(true);
      useExplorerStore.setState({
        center,
        camera: {
          type: 'overview',
          bounds: [
            [b.west, b.south],
            [b.east, b.north],
          ],
        },
      });
      setDetentState((d) => (d === 'full' ? 'mid' : d));
    },
    [installedOfflinePacks],
  );

  const handlePokedexObservationSubmit = useCallback(
    async (payload: {
      taxonId: number;
      commonName: string;
      scientificName: string;
      place: string;
      note: string;
      file: File | null;
      coords: [number, number];
    }) => {
      const matchedSpecies = pokedexNearQuery.data?.species?.find(
        (sp) => sp.taxonId === payload.taxonId,
      );
      const rawKingdom = matchedSpecies?.kingdom;
      const kingdom: 'faune' | 'flore' | 'fungi' | 'autre' =
        rawKingdom === 'faune' || rawKingdom === 'flore' || rawKingdom === 'fungi'
          ? rawKingdom
          : 'faune';

      const alreadyObserved = observedTaxonIds.has(payload.taxonId);
      setObservedTaxonIds((prev) => {
        const next = new Set(prev);
        next.add(payload.taxonId);
        return next;
      });

      try {
        const token = await defaultAccessToken();
        const res = await fetch('/api/explorer/v2/pokedex/observations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            taxonId: payload.taxonId,
            commonName: payload.commonName,
            scientificName: payload.scientificName,
            kingdom,
            lat: payload.coords[1],
            lng: payload.coords[0],
            placeLabel: payload.place.trim() || locationLabel,
            note: payload.note.trim() || null,
          }),
        });

        if (res.status === 401) {
          if (!alreadyObserved) {
            setObservedTaxonIds((prev) => {
              const next = new Set(prev);
              next.delete(payload.taxonId);
              return next;
            });
          }
          useExplorerStore.getState().showToast({
            title: 'Connexion requise',
            sub: 'Connectez-vous pour enregistrer vos observations.',
            tone: 'warn',
          });
          return;
        }

        if (!res.ok) {
          if (!alreadyObserved) {
            setObservedTaxonIds((prev) => {
              const next = new Set(prev);
              next.delete(payload.taxonId);
              return next;
            });
          }
          useExplorerStore.getState().showToast({
            title: 'Observation non enregistrée',
            sub: 'Réessayez dans un instant.',
            tone: 'warn',
          });
          return;
        }

        useExplorerStore.getState().showToast({
          title: 'Observation enregistrée',
          sub: payload.commonName,
          tone: 'good',
        });
      } catch {
        if (!alreadyObserved) {
          setObservedTaxonIds((prev) => {
            const next = new Set(prev);
            next.delete(payload.taxonId);
            return next;
          });
        }
        useExplorerStore.getState().showToast({
          title: 'Connexion interrompue',
          sub: 'Impossible d’enregistrer l’observation.',
          tone: 'warn',
        });
      }
    },
    [pokedexNearQuery.data?.species, observedTaxonIds, locationLabel],
  );

  const handleConfirmReport = useCallback(
    async (reportId: string, action: 'confirm' | 'gone') => {
      const verdict = action === 'confirm' ? 'present' : 'gone';
      const payload = { reportId, verdict };

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueue({
          key: idempotencyKey('report-confirm', payload),
          kind: 'report-confirm',
          payload,
        }).catch(() => undefined);
        const items = await listQueue().catch(() => []);
        setOfflineQueue(items.length);
        useExplorerStore.getState().showToast({
          title: 'Confirmation mise en file hors ligne',
          tone: 'neutral',
        });
        return;
      }

      try {
        const token = await defaultAccessToken();
        if (!token) {
          useExplorerStore.getState().showToast({
            title: 'Connexion requise',
            sub: 'Connectez-vous pour confirmer un signalement.',
            tone: 'warn',
          });
          return;
        }
        const res = await fetch('/api/explorer/v2/reports/confirm', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          useExplorerStore.getState().showToast({
            title: 'Confirmation refusée',
            tone: 'warn',
          });
          return;
        }
        void reportsQuery.refetch();
        useExplorerStore.getState().showToast({
          title: action === 'confirm' ? 'Signalement confirmé' : 'Marqué comme résolu',
          tone: 'good',
        });
      } catch {
        await enqueue({
          key: idempotencyKey('report-confirm', payload),
          kind: 'report-confirm',
          payload,
        }).catch(() => undefined);
        const items = await listQueue().catch(() => []);
        setOfflineQueue(items.length);
        useExplorerStore.getState().showToast({
          title: 'Confirmation mise en file hors ligne',
          tone: 'neutral',
        });
      }
    },
    [reportsQuery],
  );

  const handleOfflineReportSubmit = useCallback(
    (payload: SafetyReportOfflinePayload) => {
      const apiPayload = mapOfflineReportPayload(payload, locationLabel);
      void enqueue({
        key: idempotencyKey('report', { ...apiPayload, ts: Math.floor(Date.now() / 1000) }),
        kind: 'report',
        payload: apiPayload,
      })
        .then(() => listQueue())
        .then((items) => {
          setOfflineQueue(items.length);
          useExplorerStore.getState().showToast({
            title: 'Signalement en file hors ligne',
            sub: 'Synchronisé dès le retour du réseau',
            tone: 'neutral',
          });
        })
        .catch(() => undefined);
    },
    [locationLabel],
  );

  const handleToggleBeacon = useCallback(() => {
    void (async () => {
      if (beaconSessionId) {
        try {
          await fetch(`/api/live-tracking/sessions/${encodeURIComponent(beaconSessionId)}`, {
            method: 'DELETE',
          });
        } catch {
          /* ignore stop network error */
        }
        setBeaconSessionId(null);
        setBeaconShareUrl(null);
        useExplorerStore.getState().showToast({
          title: 'Balise Live arrêtée',
          tone: 'neutral',
        });
        return;
      }

      try {
        const res = await fetch('/api/live-tracking/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            state.activity?.sessionId && /^[0-9a-f-]{36}$/i.test(state.activity.sessionId)
              ? { sessionId: state.activity.sessionId }
              : {},
          ),
        });
        if (res.status === 401) {
          useExplorerStore.getState().showToast({
            title: 'Connexion requise',
            sub: 'Connectez-vous pour activer la balise Live.',
            tone: 'warn',
          });
          return;
        }
        if (!res.ok) {
          useExplorerStore.getState().showToast({
            title: 'Impossible d’activer la balise Live',
            tone: 'warn',
          });
          return;
        }
        const data = (await res.json()) as {
          session?: { sessionId?: string; id?: string; token?: string; shareToken?: string };
        };
        const createdSessionId = data.session?.sessionId ?? data.session?.id ?? null;
        if (!createdSessionId) {
          useExplorerStore.getState().showToast({
            title: 'Session Live indisponible',
            tone: 'warn',
          });
          return;
        }
        setBeaconSessionId(createdSessionId);

        let resolvedUrl: string | null = null;
        const directToken = data.session?.shareToken ?? data.session?.token;
        if (directToken && typeof window !== 'undefined') {
          resolvedUrl = `${window.location.origin}/live/${encodeURIComponent(directToken)}`;
        } else {
          const linkRes = await fetch('/api/live-tracking/share-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: createdSessionId,
              durationMinutes: 240,
              label: locationLabel,
              includeTrail: true,
            }),
          });
          if (linkRes.ok) {
            const linkData = (await linkRes.json()) as {
              shareUrl?: string;
              link?: { shareUrl?: string; token?: string };
              token?: string;
            };
            const token = linkData.link?.token ?? linkData.token;
            resolvedUrl =
              linkData.shareUrl ??
              linkData.link?.shareUrl ??
              (token && typeof window !== 'undefined'
                ? `${window.location.origin}/live/${encodeURIComponent(token)}`
                : null);
          }
        }

        setBeaconShareUrl(resolvedUrl);
        if (resolvedUrl && typeof navigator !== 'undefined' && navigator.clipboard) {
          void navigator.clipboard.writeText(resolvedUrl).catch(() => undefined);
        }
        useExplorerStore.getState().showToast({
          title: 'Balise Live active',
          sub: resolvedUrl ? 'Lien de suivi copié' : 'Position diffusée en direct',
          tone: 'good',
        });
      } catch {
        useExplorerStore.getState().showToast({
          title: 'Balise Live indisponible hors ligne',
          tone: 'warn',
        });
      }
    })();
  }, [beaconSessionId, state.activity?.sessionId, locationLabel]);

  const handleDropWaypoint = useCallback(
    (wp: { kind: QuickWaypointKind; label: string }) => {
      haptic('pin');
      const coords = me ? ([me.lng, me.lat] as [number, number]) : state.center;
      const entry: ExplorerSummaryWaypoint = {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: wp.kind,
        label: wp.label,
        lat: coords[1],
        lng: coords[0],
      };
      setSessionWaypoints((prev) => [...prev, entry]);
      markLap();
      useExplorerStore.getState().showToast({
        title: `Repère « ${wp.label} » posé`,
        sub: 'Ajouté à votre trace',
        tone: 'good',
      });
    },
    [me, state.center, markLap],
  );

  const handleCapturePhoto = useCallback(
    (file: File) => {
      haptic('pin');
      const coords = me ? ([me.lng, me.lat] as [number, number]) : state.center;
      setSessionPhotosCount((prev) => prev + 1);
      useExplorerStore.getState().addCapturedMedia({
        id: `media-${Date.now()}`,
        label: file.name || 'Photo terrain',
        kind: 'photo',
        capturedAt: new Date().toISOString(),
        elapsedSeconds: useExplorerStore.getState().activity?.movingS ?? 0,
        lat: coords[1],
        lng: coords[0],
        previewUrl: null,
      });
      useExplorerStore.getState().showToast({
        title: 'Photo ajoutée à la sortie',
        tone: 'good',
      });
    },
    [me, state.center],
  );

  const handleImportGpxFile = useCallback((file: File) => {
    void file
      .text()
      .then((xmlText) => {
        const parsed = parseGpxXml(xmlText);
        if (parsed.coordinates.length < 2) {
          useExplorerStore.getState().showToast({
            title: 'Fichier GPX invalide',
            sub: 'Aucune trace exploitable trouvée dans ce fichier.',
            tone: 'warn',
          });
          return;
        }
        const gpxId = `gpx-${Date.now()}`;
        const geojson = {
          type: 'Feature',
          properties: { name: parsed.name },
          geometry: {
            type: 'LineString',
            coordinates: parsed.coordinates,
          },
        };
        const snapshot: TrailRouteSnapshot = {
          id: gpxId,
          name: parsed.name,
          geojson,
          status: 'ready',
        };
        const bounds = computeGeoJsonBounds(geojson);
        const firstCoord = parsed.coordinates[0];
        const store = useExplorerStore.getState();
        store.patch({
          selection: { kind: 'trail', id: gpxId },
          trailRoute: snapshot,
        });
        if (bounds) {
          store.setCamera({ type: 'overview', bounds });
        } else if (firstCoord) {
          store.setCamera({ type: 'reveal', center: firstCoord, zoom: 13 });
        }
        setSelectedRoute({
          id: -Math.abs(Date.now() % 1_000_000_000),
          name: parsed.name,
          distance_km: null,
          network: null,
          ref: 'GPX',
          geojson,
        });
        setPreFlightSport('rando');
        setPreFlightSelection(undefined);
        setHasInteracted(true);
        setOverlayMode('preflight');
        setDetentState('mid');
        store.showToast({
          title: 'Trace GPX importée',
          sub: `${parsed.name} · ${parsed.coordinates.length} points`,
          tone: 'good',
        });
      })
      .catch(() => {
        useExplorerStore.getState().showToast({
          title: 'Lecture GPX impossible',
          tone: 'warn',
        });
      });
  }, []);

  const summaryPoints = useMemo<ExplorerSummaryPoint[]>(() => {
    if (sessionPointsRef.current.length > 0) {
      return sessionPointsRef.current;
    }
    const pts: ExplorerSummaryPoint[] = [];
    for (const seg of trackTrace.segments) {
      for (const [lng, lat] of seg) {
        pts.push({ lat, lng, ele: null });
      }
    }
    for (const [lng, lat] of trackTrace.current) {
      pts.push({ lat, lng, ele: null });
    }
    return pts;
  }, [trackTrace]);

  const handleSaveSummaryDetails = useCallback(
    async (details: { title: string; rpe: number; notes: string }) => {
      const currentSummary = useExplorerStore.getState().summary;
      const sessionId = currentSummary?.sessionId ?? null;
      const clientSessionId = currentSummary?.clientSessionId ?? null;
      if (sessionId && /^[0-9a-f-]{36}$/i.test(sessionId)) {
        try {
          const token = await defaultAccessToken();
          if (token) {
            await fetch('/api/explorer/v2/activity/finish', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId,
                idempotencyKey: `activity.finish:${clientSessionId ?? sessionId}`,
                title: details.title,
                rpe: details.rpe,
                notes: details.notes || null,
                kitId: routingKitId && /^[0-9a-f-]{36}$/i.test(routingKitId) ? routingKitId : null,
                waypoints: sessionWaypoints.map((wp) => ({
                  lat: wp.lat,
                  lng: wp.lng,
                  label: wp.label,
                  kind: wp.kind,
                })),
              }),
            });
          }
        } catch {
          /* best-effort enrichment */
        }
      }
      useExplorerStore.getState().showToast({
        title: 'Détails de sortie enregistrés',
        sub: details.title,
        tone: 'good',
      });
    },
    [routingKitId, sessionWaypoints],
  );

  const handleExportSummaryGpx = useCallback(() => {
    const currentSummary = useExplorerStore.getState().summary;
    if (!currentSummary) return;
    const sportName =
      currentSummary.selection?.variantLabel ?? SPORT_LABELS[currentSummary.sport] ?? 'Sortie';
    const title = currentSummary.route?.name || `Sortie ${sportName}`;
    const pts: Array<{ lat: number; lng: number; ele?: number | null; time?: string | null }> =
      sessionPointsRef.current.length > 0
        ? sessionPointsRef.current.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            ele: p.ele ?? null,
            time: typeof p.t === 'number' ? new Date(p.t).toISOString() : null,
          }))
        : [
            ...trackTraceRef.current.segments.flatMap((seg) =>
              seg.map(([lng, lat]) => ({ lat, lng, ele: null, time: null })),
            ),
            ...trackTraceRef.current.current.map(([lng, lat]) => ({
              lat,
              lng,
              ele: null,
              time: null,
            })),
          ];
    const xml = buildGpxXml({
      name: title,
      trackPoints: pts,
      waypoints: sessionWaypoints.map((wp) => ({
        name: wp.label,
        lat: wp.lat,
        lng: wp.lng,
        desc: wp.kind,
      })),
    });
    downloadGpxFile(title, xml);
    useExplorerStore.getState().showToast({
      title: 'Trace GPX téléchargée',
      sub: `${pts.length} points`,
      tone: 'good',
    });
  }, [sessionWaypoints]);

  const handleShareOuting = useCallback(() => {
    const currentSummary = useExplorerStore.getState().summary;
    if (!currentSummary) return;
    const sportName =
      currentSummary.selection?.variantLabel ?? SPORT_LABELS[currentSummary.sport] ?? 'Sortie';
    const title = currentSummary.route?.name || `Sortie ${sportName}`;
    const distKm = ((currentSummary.distanceM || 0) / 1000).toFixed(1).replace('.', ',');
    const elevM = Math.round(currentSummary.elevGainM || 0);
    const shareText = `${title} — ${distKm} km, +${elevM} m D+ sur Le Kit du Voyageur`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      void navigator.share({ title, text: shareText }).catch(() => undefined);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard
        .writeText(shareText)
        .then(() => {
          useExplorerStore.getState().showToast({
            title: 'Résumé copié',
            tone: 'good',
          });
        })
        .catch(() => undefined);
    }
  }, []);

  const handleDiscardSummary = useCallback(() => {
    const clientSessionId = useExplorerStore.getState().summary?.clientSessionId;
    if (clientSessionId) {
      void forgetFinishedSession(clientSessionId).catch(() => undefined);
    }
    resetLiveSessionMetadata();
    useExplorerStore.setState({ summary: null, sheet: 'level', detent: 'peek' });
    setOverlayMode('none');
    setDetentState('peek');
    useExplorerStore.getState().showToast({
      title: 'Sortie ignorée',
      tone: 'neutral',
    });
  }, [resetLiveSessionMetadata]);

  const liveTurnByTurn = useMemo<ExplorerGpsTurnByTurn | null>(() => {
    const tbt = navGuidance.guidance.turnByTurn;
    if (!tbt.nextManeuver && !tbt.primaryInstruction) return null;
    const remainingM = tbt.progress?.remainingDistanceM ?? null;
    const speedMps =
      liveTelemetry.speedKmh && liveTelemetry.speedKmh > 0.5
        ? liveTelemetry.speedKmh / 3.6
        : activity?.sport === 'velo'
          ? 4.2
          : 1.1;
    const etaMinutes =
      remainingM !== null && Number.isFinite(remainingM) && remainingM > 0
        ? Math.max(1, Math.round(remainingM / speedMps / 60))
        : null;
    return {
      instruction: tbt.primaryInstruction || tbt.nextManeuver?.rawInstruction || '',
      distanceM: tbt.distanceToNextM,
      remainingM,
      etaMinutes,
      kind: tbt.nextManeuver?.kind,
      nextInstruction: tbt.secondaryManeuver?.rawInstruction ?? null,
    };
  }, [navGuidance.guidance.turnByTurn, liveTelemetry.speedKmh, activity?.sport]);

  const liveReroute = useMemo<ExplorerGpsReroute | null>(() => {
    const rr = navGuidance.guidance.reroute;
    if (rr.status === 'on_route' && !activity?.offRoute) return null;
    return {
      state: rr.status,
      distanceOffRouteM: rr.deviationDistanceM ?? activity?.offRouteM ?? null,
      bearingLabel: bearingLabel(rr.returnBearingDeg ?? activity?.offRouteBearing),
      error: rr.failureReason,
    };
  }, [navGuidance.guidance.reroute, activity?.offRoute, activity?.offRouteM, activity?.offRouteBearing]);

  const liveClimbCard = useMemo<ExplorerGpsClimbCard | null>(() => {
    const cc = navGuidance.guidance.climbCard;
    if (
      cc.status !== 'active_climb' &&
      cc.status !== 'active_descent' &&
      cc.status !== 'upcoming_climb' &&
      cc.status !== 'upcoming_descent'
    ) {
      return null;
    }
    return {
      name:
        cc.summaryLabel ??
        (cc.segment ? (cc.segment.kind === 'climb' ? 'Montée en cours' : 'Descente') : null),
      remainingGainM: cc.remainingElevationDeltaM,
      avgGradePct: cc.currentGradePct ?? cc.segment?.averageGradePct ?? null,
      remainingDistM: cc.remainingDistanceM,
    };
  }, [navGuidance.guidance.climbCard]);

  const hasArrivedLive = Boolean(
    navGuidance.guidance.turnByTurn.nextManeuver?.kind === 'arrive' &&
      navGuidance.guidance.turnByTurn.stage === 'imminent',
  );

  const floatingLeftAction = useMemo<React.ReactNode>(() => {
    if (category === 'layers') {
      if (activeLensId === 'offline') {
        return (
          <button
            type="button"
            className="xp20-floating-pill-primary"
            onClick={handleDownloadCurrentSector}
          >
            <CloudDownload size={13} aria-hidden="true" />
            <span>Télécharger</span>
          </button>
        );
      }
      if (hasAnyActiveLayer) {
        return (
          <button
            type="button"
            className="xp20-floating-pill"
            onClick={() => {
              haptic('tab');
              state.applyPreset('clean');
              state.showToast({ title: 'Carte épurée' });
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>Épurer</span>
          </button>
        );
      }
    }

    if (category === 'safety' && activeLensId === 'survival') {
      const dial = emergencyPrimaryNumber.replace(/[^+\d]/g, '') || '112';
      return (
        <a
          href={`tel:${dial}`}
          className="xp20-floating-pill-primary"
          style={{ textDecoration: 'none' }}
        >
          <Phone size={13} aria-hidden="true" />
          <span>Urgences {emergencyPrimaryNumber}</span>
        </a>
      );
    }

    if (category === 'community' && activeLensId === 'bottles') {
      return (
        <button
          type="button"
          className="xp20-floating-pill-primary"
          aria-label="Lancer une bouteille à la mer"
          onClick={() => setBottleModalOpen(true)}
        >
          <Send size={13} aria-hidden="true" />
          <span>+ Bouteille</span>
        </button>
      );
    }

    return undefined;
  }, [
    category,
    activeLensId,
    state,
    handleDownloadCurrentSector,
    hasAnyActiveLayer,
    emergencyPrimaryNumber,
  ]);

  // ── Category Lens Renderer ──────────────────────────────────────────────
  const renderLens = useCallback(
    (lens: SlotLens, _index: number, isActive: boolean) => {
      if (category === 'explorer') {
        if (lens.id === 'spots') {
          return (
            <ExplorerSpotsLens
              routes={visibleSpotsRoutes}
              pois={visibleSpotsPois}
              center={state.center}
              zoom={state.zoom}
              selectedRouteId={selectedRoute?.id ?? null}
              loading={placeLoading}
              onSelectRoute={handleSelectSpotRoute}
              onSelectPoi={(poi) =>
                onPinClick({
                  id: poi.id,
                  kind: poi.kind,
                  subtype: poi.subtype,
                  name: poi.name,
                  sub: poi.ele_m != null ? `${Math.round(poi.ele_m)} m` : undefined,
                  lat: poi.lat,
                  lon: poi.lon,
                  tone:
                    poi.kind === 'water'
                      ? 'water'
                      : poi.kind === 'danger'
                        ? 'bad'
                        : poi.kind === 'refuge' || poi.kind === 'bivouac'
                          ? 'warn'
                          : 'ink',
                })
              }
              onSelectDestination={handleSelectDestination}
              onFocusCoordinates={onFocusCoordinates}
              onEmptyAction={() => {
                setOverlayMode('search');
                setDetentState('full');
              }}
              emptyActionLabel="Rechercher un secteur"
            />
          );
        }
        return (
          <ExplorerTerritoryLens
            name={locationLabel}
            scale={encyclopediaScale}
            coordinates={{ lat: state.center[1], lng: state.center[0] }}
            entry={encyclopediaQuery.data?.entry ?? null}
            countryDetails={country ?? null}
            elevationM={activePlaceElevationM}
            temperatureC={currentWeatherHour?.temperature_c ?? null}
            spotsCount={routes.length > 0 ? routes.length : pois.length}
            speciesCount={pokedexNearQuery.data?.species?.length ?? null}
            active={isActive}
            onFocusCoordinates={onFocusCoordinates}
          />
        );
      }

      if (category === 'layers') {
        if (lens.id === 'presets') {
          return (
            <LayersPresetsLens
              activePreset={state.activePreset ?? 'clean'}
              onSelectPreset={(presetId) => {
                haptic('tab');
                setHasInteracted(true);
                state.applyPreset(presetId);
                const def = EXPLORER_PRESET_BY_ID[presetId];
                const presetSubtitles: Record<string, string> = {
                  clean: 'Fond topo épuré',
                  hiking: 'Sentiers, sommets & eau',
                  trail: 'Sentiers, pentes & radar',
                  mtb: 'Singles VTT & pistes',
                  bivouac: 'Eau, abris & ciel noir',
                  nautical: 'Rivières & balisage',
                  safety: 'Pentes >30° & risques',
                  pokedex: 'Faune, flore & GBIF',
                  community: 'Bouteilles, carnets & clubs',
                };
                state.showToast({
                  title: presetId === 'clean' ? 'Carte épurée' : (def?.label ?? 'Pré-réglage appliqué'),
                  sub: presetSubtitles[presetId],
                });
              }}
            />
          );
        }
        if (lens.id === 'overlays') {
          return (
            <LayersOverlaysLens
              layers={unifiedLayerItems}
              onToggleLayer={(layerId) => state.toggleLayer(layerId)}
            />
          );
        }
        return (
          <LayersOfflineLens
            packs={offlinePackItems}
            activeDownload={
              offlineProgress
                ? {
                    name: locationLabel,
                    done: offlineProgress.verifiedResourcesCount ?? 0,
                    total: Math.max(1, offlineProgress.totalResourcesCount ?? 1),
                    bytes: offlineProgress.downloadedBytes ?? 0,
                  }
                : null
            }
            currentSectorName={locationLabel}
            estimatedSizeMb={18}
            onDownloadCurrentSector={handleDownloadCurrentSector}
            onFocusPack={handleFocusOfflinePack}
            onDeletePack={(packId) => {
              void loadOfflineRuntimeStore()
                .then((store) => store.deletePack(packId))
                .then(() => {
                  refreshOfflinePacks();
                  useExplorerStore.getState().showToast({ title: 'Paquet supprimé' });
                });
            }}
          />
        );
      }

      if (category === 'pokedex') {
        const kingdom = lens.id === 'faune' ? 'faune' : lens.id === 'flore' ? 'flore' : 'all';
        return (
          <ExplorerPokedexLens
            species={pokedexNearQuery.data?.species ?? []}
            kingdomFilter={kingdom}
            rarityFilter={pokedexRarity}
            selectedTaxonId={selectedTaxonId}
            loading={pokedexNearQuery.isFetching && !pokedexNearQuery.data}
            onSelectSpecies={(sp, coords) => {
              setSelectedTaxonId(sp.taxonId);
              if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
                setHasInteracted(true);
                const resolved3D = normalize3DEntityKind('pokedex', undefined, {
                  iconicTaxon: sp.iconicTaxon,
                  kingdom: sp.kingdom,
                });
                setSelectedFeature({
                  id: String(sp.taxonId),
                  coordinates: coords,
                  kind: resolved3D,
                  label: sp.commonName,
                });
                useExplorerStore.getState().setCamera({
                  type: 'reveal',
                  center: coords,
                  zoom: Math.max(useExplorerStore.getState().zoom, 12),
                });
                setDetentState((current) => (current === 'full' ? 'mid' : current));
              }
            }}
            onClearSelection={() => setSelectedTaxonId(null)}
            onFocusCoordinates={onFocusCoordinates}
            center={state.center}
            observationsGeojson={pokedexNearQuery.data?.geojson ?? null}
            observedTaxonIds={observedTaxonIds}
            onObservationSubmitted={handlePokedexObservationSubmit}
          />
        );
      }

      if (category === 'safety') {
        if (lens.id === 'hazards') {
          return (
            <SafetyHazardsLens
              hazards={hazardsUnifiedQuery.data}
              kindFilter={hazardKindFilter}
              center={state.center}
              viewportBounds={currentViewportBbox}
              zoom={livePlaceZoom}
              areaName={locationLabel}
              airspaceCount={airspaceLiveQuery.data?.features?.length ?? 0}
              loading={hazardsUnifiedQuery.isFetching && !hazardsUnifiedQuery.data}
              onFocusCoordinates={onFocusCoordinates}
              reports={reportsQuery.data?.reports ?? []}
              onOpenReportModal={() => setSafetyReportOpen(true)}
              onConfirmReport={handleConfirmReport}
            />
          );
        }
        if (lens.id === 'weather') {
          return (
            <SafetyWeatherLens
              weather={weather}
              daylight={offlineDaylight}
              radarEnabled={Boolean(lv.rainRadar)}
              onToggleRadar={() => state.toggleLayer('rainRadar')}
              radarUpdatedAt={radarManifestQuery.data?.meta.fetchedAt ?? null}
              loading={weatherLoading}
            />
          );
        }
        return (
          <SafetySurvivalLens
            pois={pois}
            center={state.center}
            viewportBounds={currentViewportBbox}
            kindFilter={survivalFilter}
            loading={placeLoading}
            onSelectPoi={(poi) =>
              onPinClick({
                id: poi.id,
                kind: poi.kind,
                subtype: poi.subtype,
                name: poi.name,
                sub: poi.ele_m != null ? `${Math.round(poi.ele_m)} m` : undefined,
                lat: poi.lat,
                lon: poi.lon,
              })
            }
            onFocusCoordinates={onFocusCoordinates}
          />
        );
      }

      // Community category (5.0 bottles, 5.1 carnets, 5.2 clubs, 5.3 stories)
      if (lens.id === 'bottles') {
        return (
          <CommunityBottlesLens
            bottles={bottles}
            loading={socialMapQuery.isFetching && !socialMapQuery.data}
            selectedBottleId={selectedBottleId}
            onFocusCoordinates={onFocusCoordinates}
            onJoined={() => {
              useExplorerStore.getState().showToast({
                title: 'Demande envoyée',
                tone: 'good',
              });
            }}
          />
        );
      }
      if (lens.id === 'carnets') {
        return (
          <CommunityCarnetsLens
            carnets={carnets}
            loading={socialMapQuery.isFetching && !socialMapQuery.data}
            selectedCarnetId={selectedCarnetId}
            onFocusCoordinates={onFocusCoordinates}
          />
        );
      }
      if (lens.id === 'clubs') {
        return (
          <CommunityClubsLens
            clubs={clubs}
            events={clubEvents}
            loading={socialMapQuery.isFetching && !socialMapQuery.data}
            selectedClubId={selectedClubId}
            onFocusCoordinates={onFocusCoordinates}
          />
        );
      }
      return (
        <CommunityStoriesLens
          stories={stories}
          friends={friends}
          loading={socialMapQuery.isFetching && !socialMapQuery.data}
          selectedStoryId={selectedStoryId}
          onFocusCoordinates={onFocusCoordinates}
          onSelectStory={handleOpenStory}
        />
      );
    },
    [
      category,
      visibleSpotsRoutes,
      visibleSpotsPois,
      pois,
      selectedRoute?.id,
      placeLoading,
      handleSelectSpotRoute,
      handleSelectDestination,
      handleDownloadCurrentSector,
      handleFocusOfflinePack,
      handlePokedexObservationSubmit,
      handleConfirmReport,
      observedTaxonIds,
      reportsQuery.data?.reports,
      onPinClick,
      onFocusCoordinates,
      locationLabel,
      encyclopediaScale,
      state,
      activePlaceElevationM,
      encyclopediaQuery.data?.entry,
      country,
      currentWeatherHour?.temperature_c,
      routes.length,
      pokedexNearQuery.data,
      pokedexNearQuery.isFetching,
      unifiedLayerItems,
      offlinePackItems,
      offlineProgress,
      refreshOfflinePacks,
      pokedexRarity,
      selectedTaxonId,
      hazardsUnifiedQuery.data,
      hazardsUnifiedQuery.isFetching,
      hazardKindFilter,
      survivalFilter,
      currentViewportBbox,
      livePlaceZoom,
      airspaceLiveQuery.data?.features?.length,
      weather,
      offlineDaylight,
      lv.rainRadar,
      radarManifestQuery.data?.meta.fetchedAt,
      weatherLoading,
      bottles,
      socialMapQuery.data,
      socialMapQuery.isFetching,
      selectedBottleId,
      carnets,
      selectedCarnetId,
      clubs,
      clubEvents,
      selectedClubId,
      stories,
      friends,
      selectedStoryId,
      handleOpenStory,
    ],
  );

  // ── Overlay Sub-Drawer View (Sport / PreFlight / Search / Route Detail / Summary) ───
  const overlayView = useMemo<React.ReactNode>(() => {
    if (overlayMode === 'sport') {
      return (
        <ExplorerSportLaunchSheet
          gpsReady={state.locationPermission === 'granted' && Boolean(me)}
          activeRouteName={state.trailRoute?.name ?? selectedRoute?.name ?? null}
          onSelectSport={(sport, selection) => {
            setPreFlightSport(sport);
            setPreFlightSelection(selection);
            setOverlayMode('preflight');
            setDetentState('mid');
          }}
          onClose={() => setOverlayMode('none')}
        />
      );
    }

    if (overlayMode === 'preflight') {
      const activeKitLabel =
        userCapabilities?.availableKits?.find((k) => k.id === routingKitId)?.name ??
        userCapabilities?.activeKitName ??
        null;
      const weatherSummary = currentWeatherHour
        ? `${Math.round(currentWeatherHour.temperature_c)}°C${
            currentWeatherHour.wind_ms != null
              ? ` · ${Math.round(currentWeatherHour.wind_ms * 3.6)} km/h`
              : ''
          }`
        : null;
      const sunsetHm = formatClockHm(offlineDaylight?.sunsetMs);
      const [cLng, cLat] = state.center;
      const offlineReady = installedOfflinePacks.some((pack) => {
        const b = pack.manifest.bounds;
        return cLng >= b.west && cLng <= b.east && cLat >= b.south && cLat <= b.north;
      });
      const activeRouteStatus =
        state.trailRoute?.status ?? (selectedRoute?.geojson ? 'ready' : 'idle');

      return (
        <ExplorerPreFlightSheet
          sport={preFlightSport}
          onChangeSport={(nextSport) => {
            setPreFlightSport(nextSport);
            setPreFlightSelection(undefined);
          }}
          routeName={state.trailRoute?.name ?? selectedRoute?.name ?? null}
          routeDistanceKm={selectedRoute?.distance_km ?? null}
          routeElevGainM={
            selectedRoute?.elev_gain_m ?? routeDetailQuery.data?.elevation?.gainM ?? null
          }
          routeStatus={activeRouteStatus}
          onClearRoute={() => {
            useExplorerStore.setState({ selection: undefined, trailRoute: undefined });
            setSelectedRoute(null);
          }}
          onRetryRoute={() => {
            const rid = useExplorerStore.getState().trailRoute?.id;
            if (rid) useExplorerStore.getState().retryRouteGeometry(rid);
          }}
          kitLabel={activeKitLabel}
          packWeightKg={routingPackWeightKg ?? userCapabilities?.packWeightKg ?? null}
          gpsReady={state.locationPermission === 'granted' && Boolean(me)}
          locationPermission={state.locationPermission}
          onRequestLocation={() =>
            requestPosition({ flyTo: false, fromUserGesture: true, highAccuracy: true })
          }
          weatherSummary={weatherSummary}
          sunsetHm={sunsetHm}
          offlineReady={offlineReady}
          onDownloadOffline={handleDownloadCurrentSector}
          onLaunch={({ express }) =>
            express
              ? confirmStartImmediate(preFlightSport, preFlightSelection)
              : requestStartSafe(preFlightSport, preFlightSelection)
          }
          onBack={() => setOverlayMode(selectedRoute ? 'route-detail' : 'sport')}
          onClose={() => setOverlayMode('none')}
        />
      );
    }

    if (overlayMode === 'search') {
      return (
        <ExplorerSearchSheet
          center={state.center}
          countries={countries}
          pois={pois}
          species={pokedexNearQuery.data?.species ?? []}
          carnets={carnets}
          clubs={clubs}
          bottles={bottles}
          onPickResult={handlePickSearchResult}
          onClose={() => setOverlayMode('none')}
        />
      );
    }

    if (overlayMode === 'route-detail' && selectedRoute) {
      const routeSaveId = `route-${selectedRoute.id}`;
      const isRouteSaved = (state.savedPlaces ?? []).some(
        (sp) => sp.id === routeSaveId || sp.id === String(selectedRoute.id),
      );
      const effectiveGeojson =
        selectedRoute.geojson ??
        (state.trailRoute?.id === String(selectedRoute.id) ? state.trailRoute.geojson : null);
      const trailheadCoord = extractRouteFirstCoord(effectiveGeojson) ?? state.center;
      const routeTitle =
        selectedRoute.name?.trim() || selectedRoute.ref?.trim() || `Itinéraire #${selectedRoute.id}`;

      return (
        <div
          style={{
            position: 'relative',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              padding: '6px 12px 16px',
              boxSizing: 'border-box',
            }}
          >
            <ExplorerRouteDetailView
              route={selectedRoute}
              routeDetail={routeDetailQuery.data ?? null}
              routeDetailLoading={routeDetailQuery.isFetching && !routeDetailQuery.data}
              nearbyPois={pois}
              reports={reportsQuery.data?.reports ?? []}
              onSelectNearbyPoi={(poi) =>
                onPinClick({
                  id: poi.id,
                  kind: poi.kind,
                  subtype: poi.subtype,
                  name: poi.name,
                  sub: poi.ele_m != null ? `${Math.round(poi.ele_m)} m` : undefined,
                  lat: poi.lat,
                  lon: poi.lon,
                })
              }
              weather={
                currentWeatherHour
                  ? {
                      tempC: currentWeatherHour.temperature_c,
                      windKmh:
                        currentWeatherHour.wind_ms != null
                          ? Math.round(currentWeatherHour.wind_ms * 3.6)
                          : null,
                      symbol: currentWeatherHour.symbol,
                    }
                  : null
              }
              safeEta={adaptiveBundle.safeEta}
              outingFit={adaptiveBundle.outingFit}
              isSaved={isRouteSaved}
              onToggleSave={() => {
                haptic('pin');
                const saved = toggleSavedPlaceSynced({
                  id: routeSaveId,
                  name: routeTitle,
                  kind: 'route',
                  lat: trailheadCoord[1],
                  lng: trailheadCoord[0],
                  areaLabel: locationLabel,
                });
                useExplorerStore.getState().showToast({
                  title: saved ? 'Parcours enregistré' : 'Retiré des favoris',
                  sub: routeTitle,
                  tone: saved ? 'good' : 'neutral',
                });
              }}
              onExportGpx={() => {
                const lines = effectiveGeojson ? routeLines(effectiveGeojson) : [];
                const coords = lines.flat();
                if (coords.length === 0) {
                  useExplorerStore.getState().showToast({
                    title: 'Tracé en cours de chargement',
                    sub: 'Réessayez dans un instant.',
                    tone: 'warn',
                  });
                  return;
                }
                const xml = buildGpxXml({
                  name: routeTitle,
                  trackPoints: coords,
                });
                downloadGpxFile(routeTitle, xml);
                useExplorerStore.getState().showToast({
                  title: 'GPX téléchargé',
                  sub: routeTitle,
                  tone: 'good',
                });
              }}
              onDownloadOffline={handleDownloadCurrentSector}
              onOpenReport={() => setSafetyReportOpen(true)}
              onPlanApproach={() => {
                handlePlanRouteToPoi({
                  id: `trailhead-${selectedRoute.id}`,
                  kind: 'access',
                  subtype: 'trailhead',
                  name: `Départ · ${routeTitle}`,
                  lat: trailheadCoord[1],
                  lon: trailheadCoord[0],
                });
              }}
              onClose={() => {
                setOverlayMode('none');
                setSelectedRoute(null);
              }}
              onFocusCoordinates={onFocusCoordinates}
            />
          </div>
          <div
            style={{
              flex: 'none',
              padding: '10px 12px calc(12px + var(--safe-bottom, 0px))',
              background: 'rgba(251, 250, 246, 0.98)',
              borderTop: '0.5px solid rgba(23, 64, 44, 0.09)',
              boxShadow: '0 -6px 16px rgba(23, 43, 36, 0.05)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="xp20-floating-pill-primary"
              style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 13.5 }}
              onClick={() => {
                haptic('sheet-open');
                setPreFlightSport(inferSportFromRouteNetwork(selectedRoute.network));
                setPreFlightSelection(undefined);
                setOverlayMode('preflight');
                setDetentState('mid');
              }}
            >
              <Play size={13} fill="currentColor" aria-hidden="true" />
              <span>Démarrer cet itinéraire</span>
            </button>
          </div>
        </div>
      );
    }

    if (overlayMode === 'poi-detail' && selectedPoi) {
      const isSaved = (state.savedPlaces ?? []).some((sp) => sp.id === selectedPoi.id);
      return (
        <ExplorerPoiDetailView
          poi={selectedPoi}
          fullPoi={selectedFullPoi}
          detail={poiDetailQuery.data ?? null}
          loading={poiDetailQuery.isFetching && !poiDetailQuery.data}
          center={state.center}
          nearbyPois={pois}
          nearbyRoutes={routes}
          reports={reportsQuery.data?.reports ?? []}
          isSaved={isSaved}
          onToggleSave={() => {
            haptic('pin');
            toggleSavedPlaceSynced({
              id: selectedPoi.id,
              name: selectedPoi.name,
              kind: 'poi',
              subtype: selectedPoi.subtype ?? selectedPoi.kind,
              lat: selectedPoi.lat,
              lng: selectedPoi.lon,
              eleM: selectedFullPoi?.ele_m ?? null,
              areaLabel: locationLabel,
            });
          }}
          onStartActivity={() => {
            setPreFlightSport('rando');
            setPreFlightSelection(undefined);
            setOverlayMode('preflight');
          }}
          onPlanRouteToPoi={handlePlanRouteToSelectedPoi}
          onSelectNearbyPoi={(poi) =>
            onPinClick({
              id: poi.id,
              kind: poi.kind,
              subtype: poi.subtype,
              name: poi.name,
              sub: poi.ele_m != null ? `${Math.round(poi.ele_m)} m` : undefined,
              lat: poi.lat,
              lon: poi.lon,
            })
          }
          onSelectNearbyRoute={(route) => handleSelectSpotRoute(route)}
          onReportSubmitted={() => {
            void reportsQuery.refetch();
            useExplorerStore.getState().showToast({
              title: 'Signalement enregistré',
              tone: 'good',
            });
          }}
          onClose={() => {
            setOverlayMode('none');
            setSelectedPoi(null);
          }}
        />
      );
    }

    if (overlayMode === 'poi-routing' && selectedPoi) {
      return (
        <ExplorerPoiRoutingView
          destinationName={selectedPoi.name}
          destination={{
            id: selectedPoi.id,
            name: selectedPoi.name,
            lat: selectedPoi.lat,
            lng: selectedPoi.lon,
          }}
          origin={routingOrigin}
          verifiedGps={verifiedGps}
          savedPlaces={state.savedPlaces ?? []}
          plan={poiRoutePlan}
          loading={poiRouteLoading}
          error={poiRouteError}
          selectedItineraryId={selectedItineraryId}
          activeMode={routingMode}
          packWeightKg={routingPackWeightKg}
          activeKitId={routingKitId}
          onSelectItinerary={(id) => {
            haptic('tab');
            setSelectedItineraryId(id);
          }}
          onChangeMode={(nextMode) => {
            haptic('tab');
            setRoutingMode(nextMode);
            void requestPoiRoutePlan(selectedPoi, { mode: nextMode });
          }}
          onChangePack={(nextKitId, nextWeightKg) => {
            haptic('tab');
            setRoutingKitId(nextKitId);
            setRoutingPackWeightKg(nextWeightKg);
            void requestPoiRoutePlan(selectedPoi, {
              kitId: nextKitId,
              packWeightKg: nextWeightKg,
            });
          }}
          onChangeOrigin={(nextOrigin) => {
            haptic('pin');
            setRoutingOrigin(nextOrigin);
            void requestPoiRoutePlan(selectedPoi, { origin: nextOrigin });
          }}
          onRequestVerifiedGps={() => {
            void requestVerifiedGpsForRouting().then((fresh) => {
              if (fresh) {
                setRoutingOrigin(fresh);
                void requestPoiRoutePlan(selectedPoi, { origin: fresh });
              }
            });
          }}
          onToggleAlternativesPreview={(show) => setShowRouteAlternativesOnMap(show)}
          onProfileCursorChange={(cursor) => {
            useExplorerStore.getState().patch({ profileCursor: cursor });
          }}
          onFocusCoordinates={(coords, label) => {
            onFocusCoordinates(coords, label);
          }}
          onStartGuidance={handleStartComputedItinerary}
          onExportGpx={(itinerary) => {
            const trackPoints =
              itinerary.elevationProfile && itinerary.elevationProfile.length > 1
                ? itinerary.elevationProfile.map((pt) => ({
                    lat: pt.lat,
                    lng: pt.lng,
                    ele: pt.ele,
                  }))
                : (itinerary.geojson?.geometry?.coordinates ?? []);
            const xml = buildGpxXml({
              name: itinerary.title || selectedPoi.name,
              trackPoints,
              waypoints: [
                {
                  name: selectedPoi.name,
                  lat: selectedPoi.lat,
                  lng: selectedPoi.lon,
                },
              ],
            });
            downloadGpxFile(itinerary.title || selectedPoi.name, xml);
            useExplorerStore.getState().showToast({
              title: 'Itinéraire GPX téléchargé',
              sub: itinerary.title,
              tone: 'good',
            });
          }}
          onSaveRoute={(itinerary) => {
            haptic('pin');
            const saved = toggleSavedPlaceSynced({
              id: `itinerary-${selectedPoi.id}-${itinerary.id}`,
              name: itinerary.title || `Vers ${selectedPoi.name}`,
              kind: 'route',
              lat: selectedPoi.lat,
              lng: selectedPoi.lon,
              areaLabel: locationLabel,
            });
            useExplorerStore.getState().showToast({
              title: saved ? 'Itinéraire enregistré' : 'Itinéraire retiré',
              sub: itinerary.title,
              tone: saved ? 'good' : 'neutral',
            });
          }}
          onDownloadOffline={() => handleDownloadCurrentSector()}
          onRetry={() => {
            void requestPoiRoutePlan(selectedPoi);
          }}
          onBackToPoi={() => {
            routePlanAbortRef.current?.abort();
            setShowRouteAlternativesOnMap(false);
            useExplorerStore.getState().patch({ profileCursor: null });
            setOverlayMode('poi-detail');
          }}
          onClose={() => {
            routePlanAbortRef.current?.abort();
            setPoiRoutePlan(null);
            setShowRouteAlternativesOnMap(false);
            useExplorerStore.getState().patch({ profileCursor: null });
            setOverlayMode('none');
            setSelectedPoi(null);
          }}
        />
      );
    }

    if (overlayMode === 'summary' && state.summary) {
      return (
        <ExplorerSummarySheet
          summary={state.summary}
          summarySaved={state.summarySaved}
          units={unitsForCountry}
          activityTrack={activityTrack}
          summaryId={lastSummaryId}
          sportLabel={
            state.summary.selection?.variantLabel ?? SPORT_LABELS[state.summary.sport] ?? 'Sortie'
          }
          points={summaryPoints}
          waypoints={sessionWaypoints}
          photosCount={sessionPhotosCount}
          onSaveDetails={handleSaveSummaryDetails}
          onExportGpx={handleExportSummaryGpx}
          onAddToCarnet={() => {
            if (typeof window !== 'undefined') {
              window.location.assign('/carnets?nouveau=1');
            }
          }}
          onShareOuting={handleShareOuting}
          onDiscard={handleDiscardSummary}
          onRetrySync={() => {
            useExplorerStore.setState({ summarySaved: 'pending' });
            void flushPending();
          }}
          onDone={() => {
            useExplorerStore.setState({ summary: null, sheet: 'level', detent: 'peek' });
            setOverlayMode('none');
            setDetentState('peek');
          }}
        />
      );
    }

    return undefined;
  }, [
    overlayMode,
    preFlightSport,
    preFlightSelection,
    userCapabilities,
    offlineDaylight?.sunsetMs,
    installedOfflinePacks,
    requestPosition,
    handleDownloadCurrentSector,
    confirmStartImmediate,
    toggleSavedPlaceSynced,
    locationLabel,
    handlePlanRouteToPoi,
    lastSummaryId,
    summaryPoints,
    sessionWaypoints,
    sessionPhotosCount,
    handleSaveSummaryDetails,
    handleExportSummaryGpx,
    handleShareOuting,
    handleDiscardSummary,
    state.locationPermission,
    state.trailRoute,
    state.center,
    state.summary,
    state.summarySaved,
    state.savedPlaces,
    me,
    selectedRoute,
    selectedPoi,
    selectedFullPoi,
    poiDetailQuery.data,
    poiDetailQuery.isFetching,
    routeDetailQuery.data,
    routeDetailQuery.isFetching,
    reportsQuery,
    pois,
    routes,
    onPinClick,
    handleSelectSpotRoute,
    handlePlanRouteToSelectedPoi,
    handleStartComputedItinerary,
    requestPoiRoutePlan,
    requestVerifiedGpsForRouting,
    verifiedGps,
    poiRoutePlan,
    poiRouteLoading,
    poiRouteError,
    selectedItineraryId,
    routingMode,
    routingPackWeightKg,
    routingKitId,
    routingOrigin,
    requestStartSafe,
    countries,
    pokedexNearQuery.data?.species,
    carnets,
    clubs,
    bottles,
    handlePickSearchResult,
    currentWeatherHour,
    adaptiveBundle.safeEta,
    adaptiveBundle.outingFit,
    onFocusCoordinates,
    unitsForCountry,
    activityTrack,
    flushPending,
  ]);

  // ── Category Badges ─────────────────────────────────────────────────────
  const categoryBadges = useMemo<Partial<Record<ExplorerCategory, number>>>(() => {
    const activeHazardsCount =
      (hazardsUnifiedQuery.data?.fires?.features?.length ?? 0) +
      (hazardsUnifiedQuery.data?.alerts?.length ?? 0);
    return {
      ...(activeHazardsCount > 0 ? { safety: activeHazardsCount } : {}),
      ...(bottles.length > 0 ? { community: bottles.length } : {}),
    };
  }, [hazardsUnifiedQuery.data, bottles.length]);

  const [viewportH, setViewportH] = useState<number>(() =>
    typeof window !== 'undefined' && Number.isFinite(window.innerHeight) ? window.innerHeight : 844,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
        setViewportH(window.innerHeight);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sheetHeightPx =
    detent === 'full'
      ? Math.round(viewportH * 0.86)
      : detent === 'mid'
        ? Math.round(viewportH * 0.56)
        : 164;

  return (
    <div
      className="xp-root xp20-root"
      data-theme={theme}
      data-mode={explorerMode}
      data-hud-contrast={state.hudContrast ?? 'standard'}
      data-spatial-scale={encyclopediaScale}
      data-level={state.level}
      data-scene={state.scene ?? ''}
      data-detent={detent}
      data-countries={countries.length}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-units={unitsForCountry}
    >
      {/* 100% Viewport 3D MapStage */}
      <MapStage
        level={state.level}
        center={state.center}
        zoom={state.zoom}
        theme={theme}
        countries={countriesGeo ?? null}
        regions={regionsGeo ?? null}
        routes={mapRoutes}
        pins={isGpsLive ? EMPTY_PINS : pins}
        selectedId={state.selection?.id ?? null}
        selectedFeature={selectedFeature}
        reducedMotion={reducedMotion}
        paused={state.orbitPaused}
        me={me}
        onCountryClick={onCountryClick}
        onRegionClick={onRegionClick}
        onPinClick={onPinClick}
        onUnifiedFeatureClick={onUnifiedFeatureClick}
        onRouteClick={onRouteClick}
        onMoveEnd={handleMapMoveEnd}
        onBearingChange={handleMapBearingChange}
        onViewportChange={onMapViewportChange}
        sheetHeightPx={sheetHeightPx}
        cameraIntent={state.camera}
        longPressHandlers={longPress}
        activityTrack={activityTrack}
        mapBaseStyle={state.mapBaseStyle}
        nationalTopo={nationalTopo}
        slopeLayer={slope.layer}
        distanceMarkers={distanceMarkers}
        layerVisibility={effectiveLayerVisibility}
        communityHeatmapGeo={communityHeatmapGeo}
        personalHeatmapGeo={personalHeatmapGeo}
        bikePoisGeo={bikePoisGeo}
        savedPlacesGeo={savedPlacesGeo}
        firesGeo={firesGeo}
        surfacesGeo={surfacesGeo}
        highlightsGeo={highlightsGeo}
        rerouteGeometry={navGuidance.guidance.detourGeoJson}
        accessRouteGeometry={navGuidance.guidance.accessRouteGeoJson}
        offlineCoverage={offlineCoverageGeoJson}
        showOfflineCoverage={coverageVisible}
        onUserPan={(bearing) => {
          setHasInteracted(true);
          if (detent === 'full') {
            setDetentState('peek');
            useExplorerStore.getState().setDetent('peek');
          }
          navGuidance.onUserMapPan(bearing);
        }}
        plannerDraft={state.plannerDraft ?? null}
        plannerLineHidden={Boolean(state.plannerLineHidden)}
        plannerMapPick={Boolean(state.plannerMapPick)}
        profileCursor={state.profileCursor ?? null}
        highlightedSegment={state.highlightedSegment ?? null}
        explorerMode={explorerMode}
        activePreset={state.activePreset ?? 'hiking'}
        activeSport={activity?.sport ?? null}
        radarTileTemplate={radarTileTemplate}
        unifiedGeojson={unifiedGeojson}
        onUnifiedLayerEvict={handleUnifiedLayerEvict}
        activeCategory={category}
        poiItineraries={
          overlayMode === 'poi-routing' && poiRoutePlan
            ? [poiRoutePlan.recommended, ...poiRoutePlan.alternatives]
            : isGpsLive && activeGuidedItinerary
              ? [activeGuidedItinerary]
              : null
        }
        selectedItineraryId={
          overlayMode === 'poi-routing'
            ? selectedItineraryId
            : isGpsLive && activeGuidedItinerary
              ? activeGuidedItinerary.id
              : null
        }
        showItineraryAlternatives={overlayMode === 'poi-routing' && showRouteAlternativesOnMap}
        onSelectItinerary={(id) => {
          haptic('tab');
          setSelectedItineraryId(id);
        }}
        onMapActivityChange={handleMapActivityChange}
      />

      {/* Countdown before entering GPS_ACTIVE */}
      {pendingStart ? (
        <Countdown
          key={`${pendingStart.sport}:${pendingStart.selection?.variantId ?? 'base'}`}
          onDone={confirmStart}
          onCancel={cancelStart}
        />
      ) : null}

      {/* Explore Mode: Minimal Top Chrome + 3-Detent Apple Liquid Glass Drawer */}
      {!isGpsLive ? (
        <>
          <ExplorerMapChrome
            locationLabel={locationLabel}
            canGoBack={effectiveScaleLevel > 0}
            onBack={effectiveScaleLevel > 0 ? handleGoUp : undefined}
            onOpenSearch={() => {
              setHasInteracted(true);
              setOverlayMode('search');
              setDetentState('full');
            }}
            bearingDeg={bearingDeg}
            onCompassClick={() => {
              haptic('compass');
              if (navGuidance.guidance.orientation.userPanned) {
                navGuidance.recenter();
                return;
              }
              navGuidance.setOrientationMode(state.northUp ? 'course-up' : 'north-up');
            }}
            onLocateClick={() => {
              haptic('compass');
              requestPosition({ flyTo: true, fromUserGesture: true, highAccuracy: true });
              if (me && state.locationPermission === 'granted') {
                useExplorerStore
                  .getState()
                  .setCamera({ type: 'reveal', center: [me.lng, me.lat], zoom: 13 });
              }
            }}
            locateState={
              isLocatingDevice
                ? 'locating'
                : state.locationPermission === 'granted' && me
                  ? 'granted'
                  : state.locationPermission === 'denied'
                    ? 'denied'
                    : 'prompt'
            }
            locationPermissionBanner={{
              visible:
                !initialScene &&
                !locationBannerDismissed &&
                (state.locationPermission !== 'granted' || Boolean(locationErrorInfo)),
              locating: isLocatingDevice,
              status: state.locationPermission,
              errorTitle: locationErrorInfo?.titleFr ?? null,
              errorHint: locationErrorInfo?.instructionsFr ?? null,
              onRequestLocation: () => {
                haptic('compass');
                requestPosition({ flyTo: true, fromUserGesture: true, highAccuracy: true });
              },
              onDismiss: () => {
                setLocationBannerDismissed(true);
                setLocationErrorInfo(null);
              },
            }}
            mapBaseStyle={state.mapBaseStyle ?? 'relief'}
            hasNationalTopo={Boolean(nationalTopo)}
            nationalTopoLabel={nationalTopo?.label ?? null}
            onSelectBaseStyle={(style) => state.setMapBaseStyle(style)}
            offline={!online}
            offlinePending={offlineQueue}
            loadingPhase={loadingSummary.phase}
            loadingLabel={loadingSummary.label}
            islandToast={islandToast}
            onDismissIsland={state.dismissToast}
            onOpenSavedPlaces={() => {
              haptic('sheet-open');
              setHasInteracted(true);
              setOverlayMode('saved');
            }}
            savedPlacesCount={state.savedPlaces?.length ?? 0}
          />

          <ExplorerGlassDrawer
            detent={detent}
            onDetentChange={handleDetentChange}
            activeCategory={category}
            onCategoryChange={handleCategoryChange}
            categoryTitle={CATEGORY_TITLES[category]}
            lenses={activeLenses}
            activeLensIndex={activeLensIndex}
            onLensChange={handleLensChange}
            renderLens={renderLens}
            onOpenSportLaunch={() => {
              haptic('sheet-open');
              setHasInteracted(true);
              setOverlayMode('sport');
              setDetentState('mid');
            }}
            categoryBadges={categoryBadges}
            overlayView={overlayView}
            floatingLeftAction={floatingLeftAction}
            bottomRightFilter={bottomRightFilter}
            hudContrast={state.hudContrast ?? 'standard'}
          />
        </>
      ) : null}

      {/* GPS Active / SOS Mode: Slim Live Map Controls + Dynamic Island + Full TBT Terrain Drawer */}
      {isGpsLive && activity ? (
        <>
          <ExplorerMapChrome
            compactLive
            locationLabel={locationLabel}
            canGoBack={false}
            onOpenSearch={() => {}}
            bearingDeg={bearingDeg}
            onCompassClick={() => {
              haptic('compass');
              if (navGuidance.guidance.orientation.userPanned) {
                navGuidance.recenter();
                return;
              }
              navGuidance.setOrientationMode(state.northUp ? 'course-up' : 'north-up');
            }}
            onLocateClick={() => {
              haptic('compass');
              navGuidance.recenter();
              requestPosition({ flyTo: true, fromUserGesture: true, highAccuracy: true });
            }}
            locateState={
              isLocatingDevice
                ? 'locating'
                : state.locationPermission === 'granted' && me
                  ? 'granted'
                  : state.locationPermission === 'denied'
                    ? 'denied'
                    : 'prompt'
            }
            mapBaseStyle={state.mapBaseStyle ?? 'relief'}
            hasNationalTopo={Boolean(nationalTopo)}
            nationalTopoLabel={nationalTopo?.label ?? null}
            onSelectBaseStyle={(style) => state.setMapBaseStyle(style)}
            offline={!online}
            offlinePending={offlineQueue}
            loadingPhase={loadingSummary.phase}
            loadingLabel={loadingSummary.label}
            islandToast={islandToast}
            onDismissIsland={state.dismissToast}
          />

          <ExplorerGpsDrawer
            activity={activity}
            mode={explorerMode}
            units={unitsForCountry}
            contrast={state.hudContrast ?? 'standard'}
            autoPauseEnabled={state.autoPauseEnabled !== false}
            gpsAccuracyM={gpsMeta.accuracyM}
            isDeadReckoning={gpsMeta.deadReckoning}
            locationPermission={state.locationPermission}
            onRequestLocation={() =>
              requestPosition({ flyTo: false, fromUserGesture: true, highAccuracy: true })
            }
            safetyCorridor={state.safetyCorridor}
            emergencyNumber={emergencyPrimaryNumber}
            sportLabel={activity.selection?.variantLabel ?? SPORT_LABELS[activity.sport] ?? 'Sortie'}
            currentCoords={me ? [me.lng, me.lat] : state.center}
            currentAltitudeM={liveTelemetry.altitudeM ?? activePlaceElevationM}
            currentSpeedKmh={liveTelemetry.speedKmh}
            turnByTurn={liveTurnByTurn}
            reroute={liveReroute}
            onRetryReroute={navGuidance.retryReroute}
            hasArrived={hasArrivedLive}
            onAcceptArrival={() => {
              haptic('activity-start');
              setActiveGuidedItinerary(null);
              state.stopActivity();
            }}
            audioMuted={navGuidance.guidance.audioPrefs.channel === 'muted'}
            onToggleAudio={() =>
              navGuidance.setAudioPrefs({
                ...navGuidance.guidance.audioPrefs,
                channel: navGuidance.guidance.audioPrefs.channel === 'muted' ? 'all' : 'muted',
              })
            }
            climbCard={liveClimbCard}
            beaconActive={Boolean(beaconSessionId)}
            beaconShareUrl={beaconShareUrl}
            onToggleBeacon={handleToggleBeacon}
            onDropWaypoint={handleDropWaypoint}
            onCapturePhoto={handleCapturePhoto}
            onOpenReport={() => setSafetyReportOpen(true)}
            onTogglePause={() =>
              state.updateActivity({ paused: !activity.paused, autoPaused: false })
            }
            onMarkWaypoint={() => {
              handleDropWaypoint({ kind: 'note', label: 'Repère' });
            }}
            onStopActivity={() => {
              setActiveGuidedItinerary(null);
              state.stopActivity();
            }}
            onContrastChange={(c) => state.setHudContrast(c)}
            onToggleAutoPause={(enabled) => state.setAutoPauseEnabled(enabled)}
            onTriggerSos={() => {
              haptic('sos-armed');
              state.triggerSos();
            }}
            onConfirmSos={handleConfirmSos}
            onCancelSos={() => {
              haptic('tab');
              state.cancelSos();
            }}
          />
        </>
      ) : null}

      {/* Saved Places & GPX Import Drawer */}
      {overlayMode === 'saved' ? (
        <SavedPlacesDrawer
          places={state.savedPlaces ?? []}
          syncedToCloud={Boolean(user)}
          onSelectPlace={(savedPlace) => {
            haptic('pin');
            setOverlayMode('none');
            setHasInteracted(true);
            if (savedPlace.kind === 'route') {
              const rawRouteId = savedPlace.id.replace(/^route-/, '');
              onRouteClick(rawRouteId, savedPlace.name, [savedPlace.lng, savedPlace.lat]);
              return;
            }
            onPinClick({
              id: savedPlace.id,
              kind: savedPlace.subtype ?? savedPlace.kind,
              subtype: savedPlace.subtype,
              name: savedPlace.name,
              sub: savedPlace.eleM != null ? `${Math.round(savedPlace.eleM)} m` : undefined,
              lat: savedPlace.lat,
              lon: savedPlace.lng,
            });
          }}
          onRouteToPlace={(savedPlace) => {
            handlePlanRouteToPoi({
              id: savedPlace.id,
              kind: savedPlace.subtype ?? savedPlace.kind,
              subtype: savedPlace.subtype,
              name: savedPlace.name,
              lat: savedPlace.lat,
              lon: savedPlace.lng,
            });
          }}
          onRemovePlace={(savedPlace) => {
            haptic('tab');
            toggleSavedPlaceSynced({
              id: savedPlace.id,
              name: savedPlace.name,
              kind: savedPlace.kind,
              subtype: savedPlace.subtype,
              lat: savedPlace.lat,
              lng: savedPlace.lng,
              eleM: savedPlace.eleM ?? null,
              areaLabel: savedPlace.areaLabel ?? null,
            });
          }}
          onImportGpxFile={handleImportGpxFile}
          onClose={() => setOverlayMode('none')}
        />
      ) : null}

      {/* Safety Report Modal (accessible from Hazards lens, Route Detail, and Live GPS HUD) */}
      <SafetyReportModal
        open={safetyReportOpen}
        coords={me ? [me.lng, me.lat] : state.center}
        placeName={locationLabel}
        onClose={() => setSafetyReportOpen(false)}
        onSubmitted={() => {
          void reportsQuery.refetch();
          useExplorerStore.getState().showToast({
            title: 'Signalement enregistré',
            tone: 'good',
          });
        }}
        onSubmitOffline={handleOfflineReportSubmit}
      />

      {/* Portaled Bouteille à la mer creation modal */}
      {bottleModalOpen ? (
        <BottleLaunchModal
          open={bottleModalOpen}
          countryIso={activeGeo}
          countryName={locationLabel}
          initialCoords={state.center}
          initialPlaceLabel={locationLabel}
          onClose={() => setBottleModalOpen(false)}
          onLaunched={() => {
            useExplorerStore.getState().showToast({
              title: 'Bouteille lancée',
              tone: 'good',
            });
            void socialMapQuery.refetch();
          }}
        />
      ) : null}

      {/* Lazy-loaded Stories Viewer */}
      {activeStoryViewer ? (
        <StoriesViewer
          users={activeStoryViewer}
          startUser={0}
          onClose={() => setActiveStoryViewer(null)}
        />
      ) : null}

      <Link className="xp-attribution" href="/mentions-legales">
        © OpenStreetMap · OpenFreeMap · Natural Earth · AWS Terrain · MET Norway · Wikidata
      </Link>
    </div>
  );
}

export default function ExplorerV2(props: ExplorerV2Props) {
  return (
    <ExplorerErrorBoundary>
      <ExplorerV2Inner {...props} />
    </ExplorerErrorBoundary>
  );
}

export { SCENES };
