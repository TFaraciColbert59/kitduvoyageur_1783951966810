'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  SMOOTH_MAPLIBRE_OPTIONS,
  applySmoothMapPhysics,
  createMapStyle,
} from '@/components/map/engine/createMapStyle';
import { prefersReducedMotion } from '@/components/map/engine/camera';
import { getIncidentMeta } from '@/features/carnet/detail/momentTypes';
import {
  cameraForScale,
  fitIntentForMode,
  paddingForViewport,
  type MapScale,
} from '@/features/compte/map/camera';
import { filterTracksForMode, mapModeConfig } from '@/features/compte/map/modes';
import { resolveMapZoomConfig, type MapZoomBand } from '@/features/compte/map/zoomHierarchy';
import {
  boundsOf as boundsOfPoints,
  parseTraceSegments,
  simplifyTrack,
} from '@/features/compte/map/geometry';
import type {
  CompteMapMode,
  CompteMapPayload,
  MapMassif,
  MapTrack,
  TrackPoint,
} from '@/features/compte/map/types';
import { carnetMapSummary } from '@/features/compte/map/a11y';
import type {
  Club3DBaseStyle,
  ClubMapOutingTrack,
  ClubMapSelection,
  ClubRichMapPayload,
  ClubZoomStage,
} from './clubMapTypes';
import { snapPointAlongTrack } from './clubTrackGeometry';
import {
  CLUB_MAX_PITCH,
  applyClub3DStyleMode,
  attachClubDemFallback,
  attachOpenFreeMapLibertyEnhancement,
  clubSkyForMode,
  createClub3DStyle,
  getClubBaseAttribution,
  isLngLatOccludedOnGlobe,
  syncClubProjectionAndTerrain,
  type ClubDemProvider,
} from './createClub3DStyle';
import {
  buildActiveSlopeData,
  buildCountryAreaGeoJSON,
  buildMassifSilhouettesGeoJSON,
  buildOutingTracksGeoJSON,
  buildPostsClusterGeoJSON,
  buildUpcomingBadgesGeoJSON,
  computeStoryBloomItems,
  filterRichPayloadByPole,
  getClubStageConfig,
  resolveClubZoomStage,
  type StoryBloomItem,
} from './clubZoomHierarchy';
import {
  flyToCountryCamera,
  flyToMassifCamera,
  flyToMicroSpotCamera,
  flyToOutingCamera,
  startClubDroneFlyover,
  startSummit360Panorama,
  type NearbyAlpinePeak,
} from './clubCameraChoreography';
import { createClubThreePillarsLayer, type ClubThreePillarsController } from './clubThreePillarsLayer';
import { ClubMapAttribution, ClubMapHud } from './ClubMapHud';
import { ClubMapCallout } from './ClubMapCallout';
import { ClubMapFallback } from './ClubMapFallback';
import { ClubMapState } from './ClubMapState';
import { ClubOutingScrubberHud } from './ClubOutingScrubberHud';
import './club-map.css';

const DEFAULT_CENTER: [number, number] = [6.35, 45.35];

export type ClubMapAuthState = 'loading' | 'guest' | 'owner' | 'error';

export interface ClubMapContext {
  mode: CompteMapMode;
  outingId?: string | null;
}

/** Cible de recentrage externe (fiche carnet) : coordonnées réelles uniquement. */
export interface ClubMapFocus {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface ClubMapAction {
  kind: 'open-outing' | 'open-massif' | 'open-member' | 'open-kit' | 'open-post' | 'rsvp-outing';
  id: string;
  outingId?: string;
}

export interface ClubMapProps {
  authState: ClubMapAuthState;
  context: ClubMapContext;
  /** Quand la valeur change, la caméra vole vers ce point. */
  focus?: ClubMapFocus | null;
  /**
   * `carnet` : la carte d'une fiche carnet ne peint QUE le tracé du carnet.
   */
  variant?: 'compte' | 'carnet';
  /** Trace GeoJSON du carnet (LineString, Feature, ou liste de points). */
  trace?: unknown | null;
  emptyTitle?: string;
  emptyHint?: string;
  homeFocus?: { lat: number; lng: number } | null;
  activeDay?: number | null;
  livePosition?: { lat: number; lng: number } | null;
  publicZone?: { centerLat: number; centerLng: number; radiusMeters?: number } | null;
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    type?: string;
    badge?: string;
    incidentType?: string;
  }>;
  dayTraces?: Array<{ day: number; coordinates: Array<[number, number]> }>;
  onDayPick?: (day: number) => void;
  onMarkerPick?: (id: string) => void;
  contextMode?: boolean;
  /** Données dédiées au club (court-circuite `/api/compte/map`). */
  clubData?: CompteMapPayload | null;
  // --- Nouvelles props Carte 3D Cinématique ---
  richClubData?: ClubRichMapPayload | null;
  selection?: ClubMapSelection;
  onSelect?: (sel: ClubMapSelection) => void;
  activePoleId?: string | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: (next?: boolean) => void;
  isOutdoor?: boolean;
  onAction?: (action: ClubMapAction) => void;
}

type LegacySelected =
  | { kind: 'outing'; id: string }
  | { kind: 'massif'; id: string }
  | { kind: 'carnet'; id: string }
  | { kind: 'poi'; id: string };

type LegacyResolved =
  | { kind: 'outing'; data: MapTrack; position: TrackPoint }
  | { kind: 'massif'; data: MapMassif; position: TrackPoint }
  | {
      kind: 'carnet';
      data: CompteMapPayload['carnets'][number];
      position: TrackPoint;
    }
  | { kind: 'poi'; data: CompteMapPayload['pois'][number]; position: TrackPoint };

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function tracksCollection(tracks: MapTrack[]) {
  return {
    type: 'FeatureCollection' as const,
    features: tracks.map((track) => ({
      type: 'Feature' as const,
      properties: {
        id: track.id,
        year: track.year ?? 0,
        kitId: track.kitId ?? '',
        participants: track.participantsCount,
        visibility: track.visibility,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: track.coordinates.map((point) => [point.lng, point.lat]),
      },
    })),
  };
}

function pointsCollection(rows: Array<{ id: string; position: TrackPoint; importance?: number }>) {
  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        importance: row.importance ?? 1,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [row.position.lng, row.position.lat],
      },
    })),
  };
}

function carnetTraceCollection(segments: TrackPoint[][]) {
  return {
    type: 'FeatureCollection' as const,
    features: segments
      .filter((segment) => segment.length >= 2)
      .map((segment, index) => ({
        type: 'Feature' as const,
        properties: { id: `carnet-trace-${index}` },
        geometry: {
          type: 'LineString' as const,
          coordinates: segment.map((point) => [point.lng, point.lat]),
        },
      })),
  };
}

function resolveLegacySelected(data: CompteMapPayload, selected: LegacySelected): LegacyResolved | null {
  if (selected.kind === 'outing') {
    const track = data.tracks.find((entry) => entry.id === selected.id);
    return track ? { kind: 'outing', data: track, position: track.start } : null;
  }
  if (selected.kind === 'massif') {
    const massif = data.massifs.find((entry) => entry.id === selected.id);
    return massif ? { kind: 'massif', data: massif, position: massif.center } : null;
  }
  if (selected.kind === 'carnet') {
    const carnet = data.carnets.find((entry) => entry.id === selected.id);
    return carnet ? { kind: 'carnet', data: carnet, position: carnet.position } : null;
  }
  const poi = data.pois.find((entry) => entry.id === selected.id);
  return poi ? { kind: 'poi', data: poi, position: poi.position } : null;
}

async function fetchCompteMap(): Promise<CompteMapPayload> {
  const response = await fetch('/api/compte/map');
  if (response.status === 401) throw new Error('unauthorized');
  if (!response.ok) throw new Error(`map_http_${response.status}`);
  return (await response.json()) as CompteMapPayload;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

function ensureSource(
  map: MapLibreMap,
  id: string,
  data: unknown,
  extra?: { lineMetrics?: boolean; cluster?: boolean; clusterMaxZoom?: number; clusterRadius?: number },
) {
  if (!map.isStyleLoaded()) return;
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data as never);
    return;
  }
  map.addSource(id, {
    type: 'geojson',
    data: data as never,
    ...(extra ?? {}),
  });
}

function ensureLayer(map: MapLibreMap, id: string, create: () => void) {
  if (!map.isStyleLoaded()) return;
  if (!map.getLayer(id)) create();
}

function bottomBarOverlap(container: HTMLElement): number {
  if (typeof document === 'undefined') return 0;
  const mapBottom = container.getBoundingClientRect().bottom;
  const webBar = document.querySelector<HTMLElement>('.lkdv-floating-tabbar-surface');
  let barTop = Number.POSITIVE_INFINITY;
  if (webBar && webBar.offsetParent !== null) barTop = webBar.getBoundingClientRect().top;
  const nativeHeight = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--lkv-native-bar-height') || '',
  );
  if (
    document.documentElement.hasAttribute('data-native-glass-nav') &&
    Number.isFinite(nativeHeight)
  ) {
    barTop = Math.min(barTop, window.innerHeight - nativeHeight);
  }
  if (!Number.isFinite(barTop)) return 0;
  if (barTop < 80) return 0;
  return Math.max(0, Math.round(mapBottom - barTop) + 8);
}

function withBarInset<T extends { bottom: number }>(padding: T, container: HTMLElement): T {
  return { ...padding, bottom: padding.bottom + bottomBarOverlap(container) };
}

function fitBoundsSafely(
  map: MapLibreMap,
  bounds: [[number, number], [number, number]],
  options: Parameters<MapLibreMap['fitBounds']>[1],
) {
  const rect = map.getContainer().getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return;
  if (!bounds.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))) return;
  const padding = options?.padding;
  if (padding && typeof padding === 'object') {
    const horizontal = (padding.left ?? 0) + (padding.right ?? 0);
    const vertical = (padding.top ?? 0) + (padding.bottom ?? 0);
    if (rect.width - horizontal < 8 || rect.height - vertical < 8) return;
  }
  try {
    map.fitBounds(bounds, options);
  } catch {
    /* Carte non mesurable à cet instant */
  }
}

function serializeSelection(sel: ClubMapSelection): string {
  if (!sel) return 'null';
  if (sel.kind === 'post') return `post:${sel.id}:${sel.outingId ?? ''}`;
  if (sel.kind === 'pokedex') return `pokedex:${sel.id}:${sel.outingId}`;
  if (sel.kind === 'kit') return `kit:${sel.id}:${sel.outingId ?? ''}`;
  if (sel.kind === 'massif') return `massif:${sel.id}`;
  return `${sel.kind}:${sel.id}`;
}

function createInitialBadgeElement(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'lkdv-club-avatar-initial';
  span.textContent = text.slice(0, 2).toUpperCase();
  return span;
}

export function ClubMap({
  authState,
  context,
  focus = null,
  variant = 'compte',
  trace = null,
  emptyTitle,
  emptyHint,
  homeFocus = null,
  activeDay = null,
  livePosition = null,
  publicZone = null,
  markers = [],
  dayTraces,
  onDayPick,
  onMarkerPick,
  contextMode = false,
  clubData,
  richClubData = null,
  selection,
  onSelect,
  activePoleId = null,
  isFullscreen,
  onToggleFullscreen,
  isOutdoor,
  onAction,
}: ClubMapProps) {
  const onDayPickRef = useRef(onDayPick);
  const onMarkerPickRef = useRef(onMarkerPick);
  const onSelectRef = useRef(onSelect);
  const onToggleFullscreenRef = useRef(onToggleFullscreen);
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onDayPickRef.current = onDayPick;
    onMarkerPickRef.current = onMarkerPick;
    onSelectRef.current = onSelect;
    onToggleFullscreenRef.current = onToggleFullscreen;
    onActionRef.current = onAction;
  }, [onDayPick, onMarkerPick, onSelect, onToggleFullscreen, onAction]);

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const hierarchyMarkerRefs = useRef<Array<{ marker: Marker; lng: number; lat: number }>>([]);
  const carnetMarkerRefs = useRef<Marker[]>([]);
  const pillarsCtrlRef = useRef<ClubThreePillarsController | null>(null);
  const droneStopRef = useRef<(() => void) | null>(null);
  const summit360StopRef = useRef<(() => void) | null>(null);
  const hasInitialRichFramedRef = useRef<string | null>(null);
  const lastFlySelectionKeyRef = useRef<string>('null');

  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [legacySelected, setLegacySelected] = useState<LegacySelected | null>(null);
  const [internalRichSelection, setInternalRichSelection] = useState<ClubMapSelection>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState<MapScale>('massif');
  const [tileMode, setTileMode] = useState<'satellite' | 'topo'>(
    variant === 'carnet' ? 'topo' : 'satellite',
  );
  const [style3DMode, setStyle3DMode] = useState<Club3DBaseStyle>('topo3d');
  const [demProvider, setDemProvider] = useState<ClubDemProvider>('mapterhorn');
  const [zoomStage, setZoomStage] = useState<ClubZoomStage>('massif');
  const [bearing, setBearing] = useState(0);
  const [solarHour, setSolarHour] = useState<number | null>(null);
  const [scrubberProgress, setScrubberProgress] = useState(0);
  const [isDronePlaying, setIsDronePlaying] = useState(false);
  const [isSummit360Active, setIsSummit360Active] = useState(false);
  const [pillarsEnabled, setPillarsEnabled] = useState(true);
  const [online, setOnline] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [zoomBand, setZoomBand] = useState<MapZoomBand>('region');
  const [detectedOutdoor, setDetectedOutdoor] = useState(false);
  const [detectedFullscreen, setDetectedFullscreen] = useState(false);

  const isCarnet = variant === 'carnet';
  const isRichClubMode = !isCarnet && Boolean(richClubData);
  const activeSelection = selection !== undefined ? selection : internalRichSelection;
  const effectiveOutdoor = isOutdoor ?? detectedOutdoor;
  const effectiveFullscreen = isFullscreen ?? detectedFullscreen;

  const style3DModeRef = useRef(style3DMode);
  const demProviderRef = useRef(demProvider);
  const activeSelectionRef = useRef(activeSelection);
  useEffect(() => {
    style3DModeRef.current = style3DMode;
    demProviderRef.current = demProvider;
    activeSelectionRef.current = activeSelection;
  }, [style3DMode, demProvider, activeSelection]);

  const selectRich = useCallback(
    (next: ClubMapSelection) => {
      if (selection === undefined) {
        setInternalRichSelection(next);
      }
      onSelectRef.current?.(next);
    },
    [selection],
  );

  // Détecte automatiquement `.phone.outdoor` et `.phone.mapbig` si les props ne sont pas passées
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const phone = document.getElementById('phone');
    if (!phone) return;
    const sync = () => {
      setDetectedOutdoor(phone.classList.contains('outdoor'));
      setDetectedFullscreen(phone.classList.contains('mapbig'));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(phone, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const filteredRichData = useMemo(() => {
    if (!richClubData) return null;
    return filterRichPayloadByPole(richClubData, activePoleId);
  }, [richClubData, activePoleId]);

  const filteredRichDataRef = useRef(filteredRichData);
  useEffect(() => {
    filteredRichDataRef.current = filteredRichData;
  }, [filteredRichData]);

  // Sortie active déduite de la sélection (outing, ou outingId porté par post/pokedex/kit)
  const activeOuting = useMemo<ClubMapOutingTrack | null>(() => {
    if (!filteredRichData || !activeSelection) return null;
    if (activeSelection.kind === 'outing') {
      return filteredRichData.outings.find((o) => o.id === activeSelection.id) ?? null;
    }
    if (
      (activeSelection.kind === 'post' ||
        activeSelection.kind === 'pokedex' ||
        activeSelection.kind === 'kit') &&
      activeSelection.outingId
    ) {
      return filteredRichData.outings.find((o) => o.id === activeSelection.outingId) ?? null;
    }
    return null;
  }, [filteredRichData, activeSelection]);

  const storyBloomItems = useMemo<StoryBloomItem[]>(() => {
    if (!filteredRichData || !activeOuting) return [];
    return computeStoryBloomItems(filteredRichData, activeOuting);
  }, [filteredRichData, activeOuting]);

  const effectiveZoomStage = useMemo<ClubZoomStage>(() => {
    if (!isRichClubMode) return 'massif';
    if (activeOuting) return 'trail';
    return zoomStage;
  }, [isRichClubMode, activeOuting, zoomStage]);

  const stageConfig = useMemo(
    () => getClubStageConfig(effectiveZoomStage, Boolean(activeOuting)),
    [effectiveZoomStage, activeOuting],
  );

  // Stop Drone / 360 cleanly when outing changes or map unmounts
  const stopChoreography = useCallback(() => {
    if (droneStopRef.current) {
      droneStopRef.current();
      droneStopRef.current = null;
    }
    if (summit360StopRef.current) {
      summit360StopRef.current();
      summit360StopRef.current = null;
    }
    setIsDronePlaying(false);
    setIsSummit360Active(false);
  }, []);

  // Carnet geometry
  const traceSegments = useMemo(
    () =>
      isCarnet
        ? parseTraceSegments(trace)
            .map((segment) => simplifyTrack(segment, 4000))
            .filter((segment) => segment.length >= 2)
        : [],
    [isCarnet, trace],
  );
  const tracePoints = useMemo(() => traceSegments.flat(), [traceSegments]);
  const traceBounds = useMemo(
    () => (tracePoints.length >= 2 ? boundsOfPoints(tracePoints) : null),
    [tracePoints],
  );

  // Legacy data fallback
  const hasClubData = clubData !== undefined;
  const config = mapModeConfig(context.mode);
  const query = useQuery<CompteMapPayload, Error>({
    queryKey: ['club-map'],
    queryFn: fetchCompteMap,
    enabled: !isRichClubMode && !hasClubData && authState === 'owner' && online && !isCarnet,
    staleTime: 60_000,
    retry: 1,
  });
  const legacyData = hasClubData ? (clubData ?? undefined) : query.data;
  const unauthorized = query.error?.message === 'unauthorized';
  const yearTracks = useMemo(
    () =>
      legacyData
        ? year
          ? legacyData.tracks.filter((track) => track.year === year)
          : legacyData.tracks
        : [],
    [legacyData, year],
  );
  const visibleLegacyTracks = useMemo(
    () =>
      legacyData ? filterTracksForMode(yearTracks, context.mode, context.outingId) : [],
    [legacyData, yearTracks, context.mode, context.outingId],
  );
  const resolvedLegacy = useMemo(
    () => (legacyData && legacySelected ? resolveLegacySelected(legacyData, legacySelected) : null),
    [legacyData, legacySelected],
  );

  useEffect(() => {
    const onYear = (event: Event) => {
      const value = (event as CustomEvent<number | null>).detail;
      setYear(typeof value === 'number' ? value : null);
    };
    window.addEventListener('lkdv:compte-map-year', onYear);
    return () => window.removeEventListener('lkdv:compte-map-year', onYear);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Initialisation unique de MapLibre GL JS (carnet 2D/topo OU club 3D cinématique)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!hasWebGL()) {
      setFallback(true);
      setReady(true);
      return;
    }

    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const initialStyle = isCarnet
      ? createMapStyle('satellite')
      : createClub3DStyle('topo3d', {
          projection: 'mercator',
          isOutdoor: effectiveOutdoor,
        });

    const instance = new MapLibreMap({
      container: containerRef.current,
      style: initialStyle,
      center: DEFAULT_CENTER,
      zoom: isCarnet ? 6.1 : 8.2,
      minZoom: 1.2,
      maxZoom: 18,
      maxPitch: isCarnet ? 70 : CLUB_MAX_PITCH,
      pitch: isCarnet ? 0 : 48,
      bearing: isCarnet ? 0 : -14,
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
      attributionControl: false,
      renderWorldCopies: false,
      locale: { 'Map.Title': isCarnet ? 'Carte du carnet' : 'Carte 3D du club' },
      ...SMOOTH_MAPLIBRE_OPTIONS,
    });

    applySmoothMapPhysics(instance);
    if (!isCarnet) {
      try {
        instance.touchZoomRotate?.enableRotation?.();
        instance.touchPitch?.enable?.();
        instance.dragRotate?.enable?.();
      } catch {
        /* ignore */
      }
    }

    mapRef.current = instance;
    setMap(instance);
    (window as unknown as { __lkdvCompteMapInstance?: MapLibreMap }).__lkdvCompteMapInstance =
      instance;
    (window as unknown as { __lkdvCompteMap3D?: MapLibreMap }).__lkdvCompteMap3D = instance;

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => instance.resize()) : null;
    observer?.observe(containerRef.current);

    let demCleanup: (() => void) | null = null;
    let ofmCleanup: (() => void) | null = null;

    const timeout = window.setTimeout(() => setStyleFailed(true), 5000);

    instance.on('style.load', () => {
      window.clearTimeout(timeout);
      setStyleFailed(false);
      setReady(true);

      if (!isCarnet) {
        try {
          instance.setSky(clubSkyForMode(style3DModeRef.current));
        } catch {
          /* ignore */
        }
        syncClubProjectionAndTerrain(
          instance,
          instance.getZoom(),
          demProviderRef.current,
          style3DModeRef.current,
        );
        demCleanup = attachClubDemFallback(instance, (nextDem) => {
          setDemProvider(nextDem);
        });
        ofmCleanup = attachOpenFreeMapLibertyEnhancement(
          instance,
          () => style3DModeRef.current === 'topo3d' || style3DModeRef.current === 'dusk',
        );
      }
    });

    const syncZoomAndBearing = () => {
      const z = instance.getZoom();
      setZoomBand(resolveMapZoomConfig(z).band);
      setZoomStage(resolveClubZoomStage(z, activeSelectionRef.current));
      setScale(z < 4 ? 'globe' : z < 11 ? 'massif' : 'sentier');
      setBearing(instance.getBearing());
      if (!isCarnet && instance.isStyleLoaded()) {
        syncClubProjectionAndTerrain(
          instance,
          z,
          demProviderRef.current,
          style3DModeRef.current,
        );
      }
    };

    const syncRotate = () => {
      setBearing(instance.getBearing());
    };

    instance.on('zoom', syncZoomAndBearing);
    instance.on('rotate', syncRotate);
    instance.on('move', () => {
      if (isCarnet) return;
      for (const entry of hierarchyMarkerRefs.current) {
        const occluded = isLngLatOccludedOnGlobe(instance, entry.lng, entry.lat);
        entry.marker.getElement().style.display = occluded ? 'none' : '';
      }
    });

    return () => {
      window.clearTimeout(timeout);
      observer?.disconnect();
      demCleanup?.();
      ofmCleanup?.();
      stopChoreography();
      if (pillarsCtrlRef.current) {
        try {
          if (instance.getLayer(pillarsCtrlRef.current.layer.id)) {
            instance.removeLayer(pillarsCtrlRef.current.layer.id);
          }
        } catch {
          /* ignore */
        }
        pillarsCtrlRef.current.dispose();
        pillarsCtrlRef.current = null;
      }
      mapRef.current = null;
      instance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCarnet]);

  // Carnet toggle tileMode
  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    for (const layer of ['atlas-tile-satellite', 'atlas-tile-topo']) {
      if (!map.getLayer(layer)) continue;
      const wanted = layer === 'atlas-tile-topo' ? 'topo' : 'satellite';
      map.setLayoutProperty(layer, 'visibility', tileMode === wanted ? 'visible' : 'none');
    }
  }, [map, ready, isCarnet, tileMode]);

  // Synchronise style 3D + mode plein soleil + curseur solaire SunCalc
  useEffect(() => {
    if (!map || !ready || isCarnet) return;
    const center = filteredRichData?.center ?? DEFAULT_CENTER;
    applyClub3DStyleMode(map, style3DMode, {
      isOutdoor: effectiveOutdoor,
      solarHour,
      center,
    });
  }, [map, ready, isCarnet, style3DMode, effectiveOutdoor, solarHour, filteredRichData?.center]);

  // Synchronise le zoomStage quand une sortie est sélectionnée/désélectionnée
  useEffect(() => {
    if (!map || !ready || isCarnet) return;
    setZoomStage(resolveClubZoomStage(map.getZoom(), activeSelection));
  }, [map, ready, isCarnet, activeSelection]);

  // =========================================================================
  // MOTEUR CARTE 3D CLUB (`richClubData`)
  // =========================================================================
  useEffect(() => {
    if (!map || !ready || !isRichClubMode || !filteredRichData) return;

    const activeOutingId = activeOuting?.id ?? null;

    // 1. Country & Massif silhouettes
    ensureSource(map, 'club-country-area', buildCountryAreaGeoJSON(filteredRichData));
    ensureLayer(map, 'club-country-fill', () => {
      map.addLayer({
        id: 'club-country-fill',
        type: 'fill',
        source: 'club-country-area',
        paint: { 'fill-color': '#5B7F55', 'fill-opacity': 0.16 },
      });
    });
    ensureLayer(map, 'club-country-line', () => {
      map.addLayer({
        id: 'club-country-line',
        type: 'line',
        source: 'club-country-area',
        paint: { 'line-color': '#17402C', 'line-width': 1.6, 'line-opacity': 0.4 },
      });
    });

    ensureSource(map, 'club-massif-silhouettes', buildMassifSilhouettesGeoJSON(filteredRichData));
    ensureLayer(map, 'club-massif-silhouettes-fill', () => {
      map.addLayer({
        id: 'club-massif-silhouettes-fill',
        type: 'fill',
        source: 'club-massif-silhouettes',
        paint: { 'fill-color': '#2f6b45', 'fill-opacity': 0.16 },
      });
    });
    ensureLayer(map, 'club-massif-silhouettes-line', () => {
      map.addLayer({
        id: 'club-massif-silhouettes-line',
        type: 'line',
        source: 'club-massif-silhouettes',
        paint: {
          'line-color': '#17402C',
          'line-width': 1.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.48,
        },
      });
    });

    // 2. Tous les tracés de sorties en 3D drapée
    ensureSource(
      map,
      'club-tracks',
      buildOutingTracksGeoJSON(filteredRichData.outings, activeOutingId),
    );
    ensureLayer(map, 'club-tracks-hit', () => {
      map.addLayer({
        id: 'club-tracks-hit',
        type: 'line',
        source: 'club-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 26, 'line-opacity': 0.01 },
      });
      map.on('click', 'club-tracks-hit', (ev: MapLayerMouseEvent) => {
        const id = ev.features?.[0]?.properties?.id;
        if (id) {
          selectRich({ kind: 'outing', id: String(id) });
        }
      });
      map.on('mouseenter', 'club-tracks-hit', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'club-tracks-hit', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    ensureLayer(map, 'club-tracks-casing', () => {
      map.addLayer({
        id: 'club-tracks-casing',
        type: 'line',
        source: 'club-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 5.5, 'line-opacity': 0.78 },
      });
    });

    ensureLayer(map, 'club-tracks-live-glow', () => {
      map.addLayer({
        id: 'club-tracks-live-glow',
        type: 'line',
        source: 'club-tracks',
        filter: ['==', ['get', 'status'], 'live'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#34d399',
          'line-width': 11,
          'line-blur': 6,
          'line-opacity': 0.58,
        },
      });
    });

    ensureLayer(map, 'club-tracks-completed', () => {
      map.addLayer({
        id: 'club-tracks-completed',
        type: 'line',
        source: 'club-tracks',
        filter: ['==', ['get', 'status'], 'completed'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#17402C', 'line-width': 3.2, 'line-opacity': 0.92 },
      });
    });

    ensureLayer(map, 'club-tracks-upcoming', () => {
      map.addLayer({
        id: 'club-tracks-upcoming',
        type: 'line',
        source: 'club-tracks',
        filter: ['==', ['get', 'status'], 'upcoming'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e09f3e',
          'line-width': 3.4,
          'line-dasharray': [2.2, 1.8],
          'line-opacity': 0.95,
        },
      });
    });

    ensureLayer(map, 'club-tracks-live', () => {
      map.addLayer({
        id: 'club-tracks-live',
        type: 'line',
        source: 'club-tracks',
        filter: ['==', ['get', 'status'], 'live'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#10b981', 'line-width': 4, 'line-opacity': 0.98 },
      });
    });

    // 3. Source mono-feature dédiée `club-active-slope` (`lineMetrics: true`)
    const slopeData = activeOuting ? buildActiveSlopeData(activeOuting) : null;
    ensureSource(
      map,
      'club-active-slope',
      slopeData ? slopeData.geojson : EMPTY_FC,
      { lineMetrics: true },
    );
    ensureLayer(map, 'club-active-slope-casing', () => {
      map.addLayer({
        id: 'club-active-slope-casing',
        type: 'line',
        source: 'club-active-slope',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': 0.92 },
      });
    });
    ensureLayer(map, 'club-active-slope-line', () => {
      map.addLayer({
        id: 'club-active-slope-line',
        type: 'line',
        source: 'club-active-slope',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2f6b45', 'line-width': 5, 'line-opacity': 0.98 },
      });
    });

    if (
      slopeData?.gradientExpression &&
      slopeData.geojson.features.length > 0 &&
      map.getLayer('club-active-slope-line')
    ) {
      try {
        map.setPaintProperty(
          'club-active-slope-line',
          'line-gradient',
          slopeData.gradientExpression as never,
        );
      } catch {
        /* Fallback sur line-color si gradient indisponible */
      }
    }

    // 4. Badges J-x sur départs à venir
    ensureSource(map, 'club-upcoming-badges', buildUpcomingBadgesGeoJSON(filteredRichData.outings));
    ensureLayer(map, 'club-upcoming-badges-bg', () => {
      map.addLayer({
        id: 'club-upcoming-badges-bg',
        type: 'circle',
        source: 'club-upcoming-badges',
        paint: {
          'circle-radius': 11,
          'circle-color': '#e09f3e',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.8,
        },
      });
      map.on('click', 'club-upcoming-badges-bg', (ev: MapLayerMouseEvent) => {
        const id = ev.features?.[0]?.properties?.id;
        if (id) selectRich({ kind: 'outing', id: String(id) });
      });
    });
    ensureLayer(map, 'club-upcoming-badges-label', () => {
      map.addLayer({
        id: 'club-upcoming-badges-label',
        type: 'symbol',
        source: 'club-upcoming-badges',
        layout: {
          'text-field': ['get', 'badge'] as never,
          'text-font': ['Noto Sans Regular'],
          'text-size': 8.5,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });
    });

    // 5. Clusters WebGL natifs des posts (`cluster: true`)
    ensureSource(
      map,
      'club-posts',
      buildPostsClusterGeoJSON(filteredRichData.posts),
      { cluster: true, clusterMaxZoom: 12.2, clusterRadius: 42 },
    );
    ensureLayer(map, 'club-posts-clusters', () => {
      map.addLayer({
        id: 'club-posts-clusters',
        type: 'circle',
        source: 'club-posts',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#2f6b45',
            10,
            '#17402C',
            30,
            '#c89a3b',
          ] as never,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 22] as never,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.92,
        },
      });
      map.on('click', 'club-posts-clusters', (ev: MapLayerMouseEvent) => {
        const feature = ev.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const src = map.getSource('club-posts') as GeoJSONSource | undefined;
        if (src && feature && typeof clusterId === 'number' && feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates as [number, number];
          src
            .getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              map.easeTo({
                center: coords,
                zoom: Math.min(14, zoom + 0.5),
                duration: prefersReducedMotion() ? 0 : 500,
              });
            })
            .catch(() => undefined);
        }
      });
      map.on('mouseenter', 'club-posts-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'club-posts-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    });
    ensureLayer(map, 'club-posts-cluster-count', () => {
      map.addLayer({
        id: 'club-posts-cluster-count',
        type: 'symbol',
        source: 'club-posts',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['concat', '📷 ', ['to-string', ['get', 'point_count']]] as never,
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });
    });
    ensureLayer(map, 'club-posts-unclustered', () => {
      map.addLayer({
        id: 'club-posts-unclustered',
        type: 'circle',
        source: 'club-posts',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 6.5,
          'circle-color': '#38bdf8',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      });
      map.on('click', 'club-posts-unclustered', (ev: MapLayerMouseEvent) => {
        const props = ev.features?.[0]?.properties;
        if (props?.id) {
          selectRich({
            kind: 'post',
            id: String(props.id),
            outingId: props.outingId ? String(props.outingId) : undefined,
          });
        }
      });
      map.on('mouseenter', 'club-posts-unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'club-posts-unclustered', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // 6. Bille lumineuse 3D synchronisée avec le scrubber & le drone
    ensureSource(map, 'club-scrubber-orb', EMPTY_FC);
    ensureLayer(map, 'club-scrubber-orb-halo', () => {
      map.addLayer({
        id: 'club-scrubber-orb-halo',
        type: 'circle',
        source: 'club-scrubber-orb',
        paint: {
          'circle-radius': 14,
          'circle-color': '#f5c451',
          'circle-opacity': 0.45,
          'circle-blur': 0.5,
        },
      });
    });
    ensureLayer(map, 'club-scrubber-orb-core', () => {
      map.addLayer({
        id: 'club-scrubber-orb-core',
        type: 'circle',
        source: 'club-scrubber-orb',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#e09f3e',
          'circle-stroke-width': 3,
        },
      });
    });

    // 7. Piliers lumineux 3D Three.js
    if (!pillarsCtrlRef.current) {
      pillarsCtrlRef.current = createClubThreePillarsLayer('club-three-pillars');
      if (!map.getLayer('club-three-pillars')) {
        map.addLayer(pillarsCtrlRef.current.layer);
      }
    }
    pillarsCtrlRef.current.setEnabled(pillarsEnabled);
    pillarsCtrlRef.current.setPillars(
      stageConfig.showStoryBloom
        ? storyBloomItems.map((item) => ({
            id: item.id,
            lng: item.lng,
            lat: item.lat,
            ele: item.ele,
            color: item.color,
            heightM: item.kind === 'summit' ? 230 : 155,
          }))
        : [],
    );

    // 8. Morphing de visibilité & opacité selon l'échelle courante
    const setVis = (id: string, visible: boolean) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVis('club-country-fill', stageConfig.showCountryTint);
    setVis('club-country-line', stageConfig.showCountryTint);
    setVis('club-massif-silhouettes-fill', stageConfig.showMassifSilhouettes);
    setVis('club-massif-silhouettes-line', stageConfig.showMassifSilhouettes);

    setVis('club-tracks-hit', stageConfig.showTracks3D);
    setVis('club-tracks-casing', stageConfig.showTracks3D);
    setVis('club-tracks-live-glow', stageConfig.showTracks3D);
    setVis('club-tracks-completed', stageConfig.showTracks3D);
    setVis('club-tracks-upcoming', stageConfig.showTracks3D);
    setVis('club-tracks-live', stageConfig.showTracks3D);

    const hasSlope = Boolean(stageConfig.showActiveSlope && activeOuting);
    setVis('club-active-slope-casing', hasSlope);
    setVis('club-active-slope-line', hasSlope);

    setVis('club-upcoming-badges-bg', stageConfig.showUpcomingBadges);
    setVis('club-upcoming-badges-label', stageConfig.showUpcomingBadges);

    setVis('club-posts-clusters', stageConfig.showPostClusters);
    setVis('club-posts-cluster-count', stageConfig.showPostClusters);
    setVis('club-posts-unclustered', stageConfig.showPostClusters);

    const dimOp = stageConfig.dimInactiveTracksOpacity;
    if (map.getLayer('club-tracks-casing')) {
      map.setPaintProperty(
        'club-tracks-casing',
        'line-opacity',
        activeOutingId ? ['case', ['==', ['get', 'id'], activeOutingId], 0.85, dimOp * 0.6] : 0.76,
      );
    }
    if (map.getLayer('club-tracks-completed')) {
      map.setPaintProperty(
        'club-tracks-completed',
        'line-opacity',
        activeOutingId ? ['case', ['==', ['get', 'id'], activeOutingId], 0.0, dimOp] : 0.92,
      );
    }
    if (map.getLayer('club-tracks-upcoming')) {
      map.setPaintProperty(
        'club-tracks-upcoming',
        'line-opacity',
        activeOutingId ? ['case', ['==', ['get', 'id'], activeOutingId], 0.0, dimOp] : 0.95,
      );
    }
    if (map.getLayer('club-tracks-live')) {
      map.setPaintProperty(
        'club-tracks-live',
        'line-opacity',
        activeOutingId ? ['case', ['==', ['get', 'id'], activeOutingId], 0.0, dimOp] : 0.98,
      );
    }
    if (map.getLayer('club-tracks-live-glow')) {
      map.setPaintProperty(
        'club-tracks-live-glow',
        'line-opacity',
        activeOutingId ? ['case', ['==', ['get', 'id'], activeOutingId], 0.0, dimOp * 0.6] : 0.58,
      );
    }
  }, [
    map,
    ready,
    isRichClubMode,
    filteredRichData,
    activeOuting,
    stageConfig,
    storyBloomItems,
    pillarsEnabled,
    selectRich,
  ]);

  // Synchronise la bille 3D sur la trace sélectionnée
  useEffect(() => {
    if (!map || !ready || !isRichClubMode) return;
    if (!activeOuting) {
      ensureSource(map, 'club-scrubber-orb', EMPTY_FC);
      return;
    }
    const pt = snapPointAlongTrack(activeOuting.coords, scrubberProgress);
    ensureSource(map, 'club-scrubber-orb', {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [pt[0], pt[1]] },
        },
      ],
    });
  }, [map, ready, isRichClubMode, activeOuting, scrubberProgress]);

  // Marqueurs DOM hiérarchiques : Planétaire (blason + pays), Pays (capsules massifs),
  // Massif/Sentier (membres live + cascade Story Bloom) avec culling d'horizon globe.
  useEffect(() => {
    if (!map || !ready || !isRichClubMode || !filteredRichData) return;

    for (const item of hierarchyMarkerRefs.current) item.marker.remove();
    hierarchyMarkerRefs.current = [];

    const addMarker = (el: HTMLElement, lng: number, lat: number, anchorMode: 'center' | 'bottom' = 'center') => {
      const occluded = isLngLatOccludedOnGlobe(map, lng, lat);
      // Wrapper neutre sans transform/animation CSS afin de ne jamais écraser le translate3d(x,y) de MapLibre
      const host = document.createElement('div');
      host.className = 'lkdv-club-marker-host';
      host.style.display = occluded ? 'none' : '';
      host.append(el);
      const marker = new Marker({ element: host, anchor: anchorMode })
        .setLngLat([lng, lat])
        .addTo(map);
      hierarchyMarkerRefs.current.push({ marker, lng, lat });
    };

    // 1. Planétaire : Blason pulsant du club + pilule Pays interactive
    if (stageConfig.showCountryPill) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lkdv-club-country-pill';
      const flag = filteredRichData.countrySummary.code === 'FR' ? '🇫🇷' : '🏔️';
      const crest = document.createElement('span');
      crest.className = 'lkdv-club-country-crest';
      crest.textContent = filteredRichData.clubName.slice(0, 2).toUpperCase();
      const label = document.createElement('span');
      label.textContent = `${flag} ${filteredRichData.countrySummary.name} · ${filteredRichData.countrySummary.outings} sorties · ${filteredRichData.countrySummary.members} membres`;
      btn.append(crest, label);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectRich({ kind: 'country', id: filteredRichData.countrySummary.code });
        flyToCountryCamera(map, filteredRichData.center);
      });
      addMarker(btn, filteredRichData.center[0], filteredRichData.center[1]);
    }

    // 2. Pays : Capsules Massifs agrégées
    if (stageConfig.showMassifCapsules) {
      for (const massif of filteredRichData.massifs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lkdv-club-massif-capsule';
        if (activeSelection?.kind === 'massif' && activeSelection.id === massif.id) {
          btn.classList.add('is-selected');
        }
        const name = document.createElement('span');
        name.textContent = massif.name;
        const count = document.createElement('b');
        count.textContent = `${massif.outings} sortie${massif.outings > 1 ? 's' : ''}`;
        btn.append(name, count);
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectRich({ kind: 'massif', id: massif.id, name: massif.name });
          flyToMassifCamera(map, massif.center);
        });
        addMarker(btn, massif.center[0], massif.center[1]);
      }
    }

    // 3. Massif / Sentier : Membres en partage live (avatars cerclés)
    if (stageConfig.showLiveMembers) {
      for (const member of filteredRichData.liveMembers) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `lkdv-club-live-member${member.fuzzy ? ' is-fuzzy' : ''}`;
        btn.title = `${member.name} (@${member.handle}) · ${member.role}`;
        btn.setAttribute('aria-label', `${member.name}, en partage live`);
        if (member.avatarUrl) {
          const img = document.createElement('img');
          img.src = member.avatarUrl;
          img.alt = member.name;
          img.className = 'lkdv-club-member-img';
          img.onerror = () => {
            img.replaceWith(createInitialBadgeElement(member.name));
          };
          btn.append(img);
        } else {
          btn.append(createInitialBadgeElement(member.name));
        }
        const dot = document.createElement('span');
        dot.className = 'lkdv-club-member-dot';
        btn.append(dot);
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectRich({ kind: 'member', id: member.id });
          flyToMicroSpotCamera(map, [member.lng, member.lat]);
        });
        addMarker(btn, member.lng, member.lat);
      }
    }

    // 4. Story Bloom en cascade (stagger: 55 ms) sur la sortie active
    if (stageConfig.showStoryBloom && storyBloomItems.length > 0) {
      for (const item of storyBloomItems) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `lkdv-club-bloom-pin is-${item.kind}`;
        btn.style.animationDelay = `${item.staggerMs}ms`;
        btn.style.setProperty('--bloom-accent', item.color);
        btn.title = `${item.title} · ${item.subtitle}`;
        btn.setAttribute('aria-label', `${item.title} : ${item.subtitle}`);

        const ico = document.createElement('span');
        ico.className = 'lkdv-club-bloom-ico';
        ico.textContent = item.emoji;

        const lbl = document.createElement('span');
        lbl.className = 'lkdv-club-bloom-label';
        lbl.textContent = item.title;

        btn.append(ico, lbl);
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (item.kind === 'pokedex') {
            selectRich({ kind: 'pokedex', id: item.sourceId, outingId: item.outingId });
          } else if (item.kind === 'kit') {
            selectRich({ kind: 'kit', id: item.sourceId, outingId: item.outingId });
          } else if (item.kind === 'post') {
            selectRich({ kind: 'post', id: item.sourceId, outingId: item.outingId });
          } else if (item.kind === 'member') {
            selectRich({ kind: 'member', id: item.sourceId });
          } else {
            selectRich({ kind: 'outing', id: item.outingId });
          }
          flyToMicroSpotCamera(map, [item.lng, item.lat]);
        });
        addMarker(btn, item.lng, item.lat, 'bottom');
      }
    }

    return () => {
      for (const item of hierarchyMarkerRefs.current) item.marker.remove();
      hierarchyMarkerRefs.current = [];
    };
  }, [
    map,
    ready,
    isRichClubMode,
    filteredRichData,
    stageConfig,
    storyBloomItems,
    activeSelection,
    selectRich,
  ]);

  // Cadrage initial de la carte 3D du club
  useEffect(() => {
    if (!map || !ready || !isRichClubMode || !filteredRichData) return;
    if (hasInitialRichFramedRef.current === filteredRichData.clubId) return;
    hasInitialRichFramedRef.current = filteredRichData.clubId;

    if (activeSelection) return;

    const allCoords = filteredRichData.outings.flatMap((o) =>
      o.coords.map(([lng, lat]) => ({ lng, lat })),
    );
    const bounds = boundsOfPoints(allCoords);
    if (bounds) {
      fitBoundsSafely(
        map,
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: withBarInset(
            paddingForViewport(map.getContainer().getBoundingClientRect(), {
              sheetOpen: false,
              mapbig: effectiveFullscreen,
            }),
            map.getContainer(),
          ),
          maxZoom: 9.8,
          pitch: 46,
          bearing: -14,
          duration: prefersReducedMotion() ? 0 : 900,
          essential: true,
        },
      );
    } else {
      map.flyTo({
        center: filteredRichData.center,
        zoom: 8.6,
        pitch: 46,
        bearing: -14,
        duration: prefersReducedMotion() ? 0 : 900,
        essential: true,
      });
    }
  }, [map, ready, isRichClubMode, filteredRichData, activeSelection, effectiveFullscreen]);

  // Réagit aux changements externes de `selection` (Haut -> Carte) et déclenche le vol 3D
  useEffect(() => {
    if (!map || !ready || !isRichClubMode || !filteredRichData) return;
    const key = serializeSelection(activeSelection);
    if (key === lastFlySelectionKeyRef.current) return;
    lastFlySelectionKeyRef.current = key;

    stopChoreography();
    if (!activeSelection) return;

    if (activeSelection.kind === 'country') {
      flyToCountryCamera(map, filteredRichData.center);
    } else if (activeSelection.kind === 'massif') {
      const massif = filteredRichData.massifs.find(
        (m) => m.id === activeSelection.id || m.name === activeSelection.name,
      );
      if (massif) flyToMassifCamera(map, massif.center);
    } else if (activeSelection.kind === 'outing') {
      const outing = filteredRichData.outings.find((o) => o.id === activeSelection.id);
      if (outing) {
        setScrubberProgress(0.5);
        flyToOutingCamera(map, outing, { isFullscreen: effectiveFullscreen });
      }
    } else if (activeSelection.kind === 'post') {
      const post = filteredRichData.posts.find((p) => p.id === activeSelection.id);
      if (post) flyToMicroSpotCamera(map, [post.lng, post.lat]);
    } else if (activeSelection.kind === 'pokedex') {
      const pkx = filteredRichData.pokedex.find((p) => p.id === activeSelection.id);
      if (pkx) flyToMicroSpotCamera(map, [pkx.lng, pkx.lat]);
    } else if (activeSelection.kind === 'kit') {
      const kit = filteredRichData.kits.find((k) => k.id === activeSelection.id);
      if (kit) flyToMicroSpotCamera(map, [kit.lng, kit.lat]);
    } else if (activeSelection.kind === 'member') {
      const member = filteredRichData.liveMembers.find((m) => m.id === activeSelection.id);
      if (member) flyToMicroSpotCamera(map, [member.lng, member.lat]);
    }
  }, [map, ready, isRichClubMode, filteredRichData, activeSelection, effectiveFullscreen, stopChoreography]);

  // Événement global "Live Camp" si déclenché par le runtime
  useEffect(() => {
    if (!isRichClubMode) return;
    const onLiveCamp = () => {
      const dataNow = filteredRichDataRef.current;
      if (!dataNow) return;
      const targetOuting =
        dataNow.outings.find((o) => o.status === 'live') ??
        dataNow.outings.find((o) => o.status === 'upcoming') ??
        dataNow.outings[0];
      if (targetOuting) {
        selectRich({ kind: 'outing', id: targetOuting.id });
      } else if (dataNow.liveMembers[0]) {
        selectRich({ kind: 'member', id: dataNow.liveMembers[0].id });
      }
    };
    window.addEventListener('lkdv:club-live-camp', onLiveCamp);
    return () => window.removeEventListener('lkdv:club-live-camp', onLiveCamp);
  }, [isRichClubMode, selectRich]);

  // Clic vide sur la carte -> ferme le callout / sélection
  useEffect(() => {
    if (!map) return;
    const close = (event: { point: { x: number; y: number } }) => {
      if (isRichClubMode) {
        const hitLayers = [
          'club-tracks-hit',
          'club-upcoming-badges-bg',
          'club-upcoming-badges-label',
          'club-posts-clusters',
          'club-posts-unclustered',
        ].filter((layer) => Boolean(map.getLayer(layer)));
        const hits = map.queryRenderedFeatures(event.point as never, { layers: hitLayers });
        if (hits.length === 0) selectRich(null);
        return;
      }
      const hits = map.queryRenderedFeatures(event.point as never, {
        layers: ['compte-track-starts-dot', 'compte-carnets-dot', 'compte-pois-dot'].filter(
          (layer) => Boolean(map.getLayer(layer)),
        ),
      });
      if (hits.length === 0) setLegacySelected(null);
    };
    map.on('click', close);
    return () => {
      map.off('click', close);
    };
  }, [map, isRichClubMode, selectRich]);

  // =========================================================================
  // MOTEUR FALLBACK LEGACY (`clubData` / `/api/compte/map`)
  // =========================================================================
  useEffect(() => {
    if (!map || !ready || isCarnet || isRichClubMode || !legacyData) return;

    ensureSource(map, 'compte-tracks', tracksCollection(visibleLegacyTracks));
    ensureLayer(map, 'compte-tracks-casing', () => {
      map.addLayer({
        id: 'compte-tracks-casing',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.68 },
      });
    });
    ensureLayer(map, 'compte-tracks-glow', () => {
      map.addLayer({
        id: 'compte-tracks-glow',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#5B7F55', 'line-width': 7, 'line-opacity': 0.35, 'line-blur': 4 },
      });
    });
    ensureLayer(map, 'compte-tracks-line', () => {
      map.addLayer({
        id: 'compte-tracks-line',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#17402C', 'line-width': 3, 'line-opacity': 0.9 },
      });
    });

    ensureSource(
      map,
      'compte-track-starts',
      pointsCollection(
        visibleLegacyTracks.map((track) => ({
          id: track.id,
          position: track.start,
          importance: track.km >= 25 ? 3 : track.km >= 12 ? 2 : 1,
        })),
      ),
    );
    ensureLayer(map, 'compte-track-starts-dot', () => {
      map.addLayer({
        id: 'compte-track-starts-dot',
        type: 'circle',
        source: 'compte-track-starts',
        paint: {
          'circle-radius': 5,
          'circle-color': '#17402C',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
        },
      });
      map.on('click', 'compte-track-starts-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setLegacySelected({ kind: 'outing', id: String(id) });
      });
    });

    ensureSource(
      map,
      'compte-carnets',
      pointsCollection(
        legacyData.carnets.map((carnet) => ({
          id: carnet.id,
          position: carnet.position,
          importance: 2,
        })),
      ),
    );
    ensureLayer(map, 'compte-carnets-dot', () => {
      map.addLayer({
        id: 'compte-carnets-dot',
        type: 'circle',
        source: 'compte-carnets',
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#C89A3B',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
        },
      });
      map.on('click', 'compte-carnets-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setLegacySelected({ kind: 'carnet', id: String(id) });
      });
    });

    ensureSource(
      map,
      'compte-pois',
      pointsCollection(
        legacyData.pois.map((poi) => ({
          id: poi.id,
          position: poi.position,
          importance: poi.day ? 2 : 1,
        })),
      ),
    );
    ensureLayer(map, 'compte-pois-dot', () => {
      map.addLayer({
        id: 'compte-pois-dot',
        type: 'circle',
        source: 'compte-pois',
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#4B6B7C',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1,
        },
      });
      map.on('click', 'compte-pois-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setLegacySelected({ kind: 'poi', id: String(id) });
      });
    });

    const layers = mapModeConfig(context.mode).layers;
    const visibility: Array<[string, boolean]> = [
      ['compte-carnets-dot', layers.carnets],
      ['compte-pois-dot', layers.pois],
      ['compte-track-starts-dot', layers.outingPins],
      ['compte-tracks-casing', layers.tracks !== 'none'],
      ['compte-tracks-glow', layers.tracks !== 'none'],
      ['compte-tracks-line', layers.tracks !== 'none'],
    ];
    for (const [layer, visible] of visibility) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
      }
    }
  }, [map, ready, isCarnet, isRichClubMode, legacyData, visibleLegacyTracks, context.mode]);

  useEffect(() => {
    if (!map || !ready || isCarnet || isRichClubMode || !legacyData) return;
    for (const marker of markerRefs.current) marker.remove();
    markerRefs.current = [];
    if (!config.layers.massifs) return;

    for (const massif of legacyData.massifs) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-map-massif';
      element.dataset.massifId = massif.id;
      element.dataset.importance =
        massif.outings >= 5 ? 'high' : massif.outings >= 2 ? 'medium' : 'low';
      element.dataset.outings = String(massif.outings);
      element.setAttribute('aria-label', `${massif.name}, ${massif.outings} sorties`);
      const count = document.createElement('b');
      count.textContent = String(massif.outings);
      const name = document.createElement('span');
      name.className = 'lkdv-map-massif-name';
      name.textContent = massif.name;
      element.append(count, name);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setLegacySelected({ kind: 'massif', id: massif.id });
      });
      markerRefs.current.push(
        new Marker({ element, anchor: 'center' })
          .setLngLat([massif.center.lng, massif.center.lat])
          .addTo(map),
      );
    }
  }, [map, ready, isCarnet, isRichClubMode, legacyData, config.layers.massifs]);

  useEffect(() => {
    if (!map || !legacyData || !ready || isCarnet || isRichClubMode) return;
    const intent = fitIntentForMode(context.mode, legacyData, context.outingId);
    if (!intent) return;
    fitBoundsSafely(
      map,
      [
        [intent.bounds[0], intent.bounds[1]],
        [intent.bounds[2], intent.bounds[3]],
      ],
      {
        padding: withBarInset(
          paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: context.mode !== 'overview',
            mapbig: effectiveFullscreen,
          }),
          map.getContainer(),
        ),
        maxZoom: intent.maxZoom,
        pitch: context.mode === 'sortie' ? 45 : 0,
        duration: prefersReducedMotion() ? 0 : context.mode === 'sortie' ? 1200 : 800,
        essential: true,
      },
    );
  }, [map, legacyData, ready, isCarnet, isRichClubMode, context.mode, context.outingId, effectiveFullscreen]);

  // =========================================================================
  // MOTEUR CARNET (`variant="carnet"`)
  // =========================================================================
  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    if (!map.isStyleLoaded()) {
      const onStyle = () => {
        ensureSource(map, 'compte-carnet-trace', carnetTraceCollection(traceSegments));
      };
      map.once('styledata', onStyle);
      return () => {
        map.off('styledata', onStyle);
      };
    }
    ensureSource(map, 'compte-carnet-trace', carnetTraceCollection(traceSegments));
    ensureLayer(map, 'compte-carnet-trace-casing', () => {
      map.addLayer({
        id: 'compte-carnet-trace-casing',
        type: 'line',
        source: 'compte-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.68 },
      });
    });
    ensureLayer(map, 'compte-carnet-trace-glow', () => {
      map.addLayer({
        id: 'compte-carnet-trace-glow',
        type: 'line',
        source: 'compte-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#5B7F55', 'line-width': 7, 'line-opacity': 0.35, 'line-blur': 4 },
      });
    });
    ensureLayer(map, 'compte-carnet-trace-line', () => {
      map.addLayer({
        id: 'compte-carnet-trace-line',
        type: 'line',
        source: 'compte-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#17402C', 'line-width': 3, 'line-opacity': 0.9 },
      });
    });
    const visible = tracePoints.length >= 2 && !(dayTraces && dayTraces.length > 0) ? 'visible' : 'none';
    for (const layer of [
      'compte-carnet-trace-casing',
      'compte-carnet-trace-glow',
      'compte-carnet-trace-line',
    ]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visible);
    }
  }, [map, ready, isCarnet, traceSegments, tracePoints.length, dayTraces]);

  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    if (!map.isStyleLoaded()) return;
    const collection = {
      type: 'FeatureCollection' as const,
      features: (dayTraces ?? []).map((t) => ({
        type: 'Feature' as const,
        properties: { day: t.day },
        geometry: { type: 'LineString' as const, coordinates: t.coordinates },
      })),
    };
    ensureSource(map, 'compte-carnet-days', collection);
    const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
    ensureLayer(map, 'compte-carnet-days-casing', () => {
      map.addLayer({
        id: 'compte-carnet-days-casing',
        type: 'line',
        source: 'compte-carnet-days',
        layout,
        paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.68 },
      });
    });
    ensureLayer(map, 'compte-carnet-days-glow', () => {
      map.addLayer({
        id: 'compte-carnet-days-glow',
        type: 'line',
        source: 'compte-carnet-days',
        layout,
        paint: { 'line-color': '#5B7F55', 'line-width': 7, 'line-opacity': 0.35, 'line-blur': 4 },
      });
    });
    ensureLayer(map, 'compte-carnet-days-line', () => {
      map.addLayer({
        id: 'compte-carnet-days-line',
        type: 'line',
        source: 'compte-carnet-days',
        layout,
        paint: { 'line-color': '#17402C', 'line-width': 3, 'line-opacity': 0.9 },
      });
    });
    ensureLayer(map, 'compte-carnet-days-hit', () => {
      map.addLayer({
        id: 'compte-carnet-days-hit',
        type: 'line',
        source: 'compte-carnet-days',
        layout,
        paint: { 'line-color': '#FFFFFF', 'line-width': 22, 'line-opacity': 0.01 },
      });
    });
    const wanted = dayTraces && dayTraces.length > 0 ? 'visible' : 'none';
    for (const layer of [
      'compte-carnet-days-casing',
      'compte-carnet-days-glow',
      'compte-carnet-days-line',
      'compte-carnet-days-hit',
    ]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', wanted);
    }
    const emphasise = (base: number, dim: number) =>
      activeDay && activeDay > 0 ? ['case', ['==', ['get', 'day'], activeDay], base, dim] : base;
    for (const [layer, base, dim] of [
      ['compte-carnet-days-casing', 0.68, 0.25],
      ['compte-carnet-days-glow', 0.35, 0.1],
      ['compte-carnet-days-line', 0.9, 0.3],
    ] as const) {
      if (map.getLayer(layer)) {
        map.setPaintProperty(layer, 'line-opacity', emphasise(base, dim) as never);
      }
    }
  }, [map, ready, isCarnet, dayTraces, activeDay]);

  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    const layer = 'compte-carnet-days-hit';
    if (!map.getLayer(layer)) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const day = Number(event.features?.[0]?.properties?.day);
      if (Number.isFinite(day) && day > 0) onDayPickRef.current?.(day);
    };
    map.on('click', layer, onClick);
    return () => {
      map.off('click', layer, onClick);
    };
  }, [map, ready, isCarnet, dayTraces]);

  useEffect(() => {
    if (!map || !ready || !isCarnet || traceBounds || !homeFocus) return;
    if (!Number.isFinite(homeFocus.lat) || !Number.isFinite(homeFocus.lng)) return;
    map.flyTo({
      center: [homeFocus.lng, homeFocus.lat],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      duration: prefersReducedMotion() ? 0 : 700,
      essential: true,
    });
  }, [map, ready, isCarnet, traceBounds, homeFocus]);

  useEffect(() => {
    if (!map || !ready || !isCarnet || !traceBounds) return;
    fitBoundsSafely(
      map,
      [
        [traceBounds[0], traceBounds[1]],
        [traceBounds[2], traceBounds[3]],
      ],
      {
        padding: withBarInset(
          paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: false,
            mapbig: map.getContainer().clientHeight > 500,
          }),
          map.getContainer(),
        ),
        maxZoom: 14,
        pitch: 45,
        bearing: -18,
        duration: prefersReducedMotion() ? 0 : 1100,
        essential: true,
      },
    );
  }, [map, ready, isCarnet, traceBounds]);

  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    for (const m of carnetMarkerRefs.current) m.remove();
    carnetMarkerRefs.current = [];

    for (const marker of markers) {
      const clickable = Boolean(marker.id.startsWith('moment-') && onMarkerPickRef.current);
      const el = document.createElement(clickable ? 'button' : 'div');
      if (clickable) (el as HTMLButtonElement).type = 'button';
      el.className = 'lkdv-carnet-map-marker';
      el.dataset.markerType = marker.type ?? 'poi';
      el.dataset.markerId = marker.id;
      el.title = marker.title;
      if (clickable) {
        el.setAttribute('aria-label', marker.title);
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          onMarkerPickRef.current?.(marker.id);
        });
      }
      if (marker.type === 'inc') {
        const incMeta = getIncidentMeta(marker.incidentType);
        el.classList.add('is-incident');
        el.style.color = incMeta.color;
        el.style.borderColor = incMeta.color;
        el.style.background = '#ffffff';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '13');
        svg.setAttribute('height', '13');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.2');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', incMeta.svgPath);
        svg.appendChild(path);
        el.appendChild(svg);
      } else if (marker.badge) {
        el.classList.add('has-badge');
        const badge = document.createElement('span');
        badge.className = 'lkdv-map-night-badge';
        badge.textContent = marker.badge;
        el.appendChild(badge);
      }
      carnetMarkerRefs.current.push(
        new Marker({ element: el, anchor: 'center' })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map),
      );
    }

    if (livePosition) {
      const el = document.createElement('div');
      el.className = 'lkdv-carnet-live-marker';
      carnetMarkerRefs.current.push(
        new Marker({ element: el, anchor: 'center' })
          .setLngLat([livePosition.lng, livePosition.lat])
          .addTo(map),
      );
    }
    if (publicZone) {
      const el = document.createElement('div');
      el.className = 'lkdv-carnet-public-zone';
      carnetMarkerRefs.current.push(
        new Marker({ element: el, anchor: 'center' })
          .setLngLat([publicZone.centerLng, publicZone.centerLat])
          .addTo(map),
      );
    }

    return () => {
      for (const m of carnetMarkerRefs.current) m.remove();
      carnetMarkerRefs.current = [];
    };
  }, [map, ready, isCarnet, markers, livePosition, publicZone]);

  // =========================================================================
  // ANCRE DU CALLOUT (mode riche ET mode legacy)
  // =========================================================================
  const resolvedRichCallout = useMemo(() => {
    if (!isRichClubMode || !filteredRichData || !activeSelection) return null;
    if (activeSelection.kind === 'country') {
      return {
        kind: 'country' as const,
        data: filteredRichData.countrySummary,
        lngLat: filteredRichData.center,
      };
    }
    if (activeSelection.kind === 'massif') {
      const m = filteredRichData.massifs.find((x) => x.id === activeSelection.id);
      return m ? { kind: 'rich-massif' as const, data: m, lngLat: m.center } : null;
    }
    if (activeSelection.kind === 'outing') {
      const o = filteredRichData.outings.find((x) => x.id === activeSelection.id);
      return o
        ? {
            kind: 'rich-outing' as const,
            data: o,
            lngLat: [o.peak[0], o.peak[1]] as [number, number],
          }
        : null;
    }
    if (activeSelection.kind === 'post') {
      const p = filteredRichData.posts.find((x) => x.id === activeSelection.id);
      return p ? { kind: 'post' as const, data: p, lngLat: [p.lng, p.lat] as [number, number] } : null;
    }
    if (activeSelection.kind === 'pokedex') {
      const pkx = filteredRichData.pokedex.find((x) => x.id === activeSelection.id);
      return pkx
        ? { kind: 'pokedex' as const, data: pkx, lngLat: [pkx.lng, pkx.lat] as [number, number] }
        : null;
    }
    if (activeSelection.kind === 'kit') {
      const k = filteredRichData.kits.find((x) => x.id === activeSelection.id);
      return k ? { kind: 'kit' as const, data: k, lngLat: [k.lng, k.lat] as [number, number] } : null;
    }
    if (activeSelection.kind === 'member') {
      const m = filteredRichData.liveMembers.find((x) => x.id === activeSelection.id);
      return m ? { kind: 'member' as const, data: m, lngLat: [m.lng, m.lat] as [number, number] } : null;
    }
    return null;
  }, [isRichClubMode, filteredRichData, activeSelection]);

  const calloutTargetLngLat = useMemo<[number, number] | null>(() => {
    if (resolvedRichCallout) return resolvedRichCallout.lngLat;
    if (resolvedLegacy) return [resolvedLegacy.position.lng, resolvedLegacy.position.lat];
    return null;
  }, [resolvedRichCallout, resolvedLegacy]);

  useEffect(() => {
    if (!map || !calloutTargetLngLat) {
      setAnchor(null);
      return;
    }
    const update = () => {
      if (!isCarnet && isLngLatOccludedOnGlobe(map, calloutTargetLngLat[0], calloutTargetLngLat[1])) {
        setAnchor(null);
        return;
      }
      const point = map.project(calloutTargetLngLat);
      const rect = map.getContainer().getBoundingClientRect();
      const padX = Math.min(118, Math.max(24, rect.width * 0.32));
      const minY = Math.min(118, Math.max(48, rect.height * 0.28));
      const maxY = Math.max(minY, rect.height - 92);
      const clampedX = Math.max(padX, Math.min(Math.max(padX, rect.width - padX), point.x));
      const clampedY = Math.max(minY, Math.min(maxY, point.y));
      setAnchor({ x: clampedX, y: clampedY });
    };
    update();
    map.on('move', update);
    map.on('zoom', update);
    return () => {
      map.off('move', update);
      map.off('zoom', update);
    };
  }, [map, isCarnet, calloutTargetLngLat]);

  useEffect(() => {
    if (!map || !focus) return;
    if (!Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) return;
    map.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? 10,
      duration: prefersReducedMotion() ? 0 : 900,
      essential: true,
    });
  }, [map, focus]);

  // =========================================================================
  // HANDLERS HUD & CHORÉGRAPHIE 3D
  // =========================================================================
  const handleToggleFullscreen = useCallback(() => {
    const next = !effectiveFullscreen;
    if (onToggleFullscreenRef.current) {
      onToggleFullscreenRef.current(next);
    } else if (typeof window !== 'undefined') {
      (window as unknown as { __lkdvCompteAct?: (a: string) => void }).__lkdvCompteAct?.('mapbig');
    }
  }, [effectiveFullscreen]);

  const handleScale = useCallback(
    (next: MapScale) => {
      if (!map) return;
      setScale(next);
      const carnetFocus =
        isCarnet && traceBounds
          ? {
              lng: (traceBounds[0] + traceBounds[2]) / 2,
              lat: (traceBounds[1] + traceBounds[3]) / 2,
            }
          : null;
      const focusPt = carnetFocus ??
        resolvedLegacy?.position ??
        legacyData?.tracks[0]?.start ??
        legacyData?.massifs[0]?.center ?? { lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] };
      const pose = cameraForScale(next, focusPt);
      map.flyTo({
        center: pose.center,
        zoom: pose.zoom,
        pitch: pose.pitch,
        bearing: pose.bearing,
        duration: prefersReducedMotion() ? 0 : next === 'globe' ? 1800 : 1200,
        essential: true,
      });
    },
    [map, resolvedLegacy, legacyData, isCarnet, traceBounds],
  );

  const handleZoomStage = useCallback(
    (stage: ClubZoomStage) => {
      if (!map || !filteredRichData) return;
      stopChoreography();
      const center = filteredRichData.center;
      const reduced = prefersReducedMotion();
      if (stage === 'planetary') {
        selectRich(null);
        map.flyTo({
          center,
          zoom: 2.9,
          pitch: 12,
          bearing: 0,
          duration: reduced ? 0 : 1600,
          essential: true,
        });
      } else if (stage === 'country') {
        selectRich({ kind: 'country', id: filteredRichData.countrySummary.code });
        flyToCountryCamera(map, center);
      } else if (stage === 'massif') {
        const target =
          filteredRichData.massifs[0]?.center ?? center;
        map.flyTo({
          center: target,
          zoom: 9.6,
          pitch: 52,
          bearing: -16,
          duration: reduced ? 0 : 1200,
          essential: true,
        });
      } else {
        const targetOuting =
          activeOuting ??
          filteredRichData.outings.find((o) => o.status === 'live') ??
          filteredRichData.outings[0];
        if (targetOuting) {
          selectRich({ kind: 'outing', id: targetOuting.id });
        }
      }
    },
    [map, filteredRichData, activeOuting, selectRich, stopChoreography],
  );

  const handleRecenter = useCallback(() => {
    if (!map) return;
    stopChoreography();
    if (isCarnet && traceBounds) {
      fitBoundsSafely(
        map,
        [
          [traceBounds[0], traceBounds[1]],
          [traceBounds[2], traceBounds[3]],
        ],
        {
          padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: false,
            mapbig: map.getContainer().clientHeight > 500,
          }),
          maxZoom: 14,
          duration: prefersReducedMotion() ? 0 : 900,
          essential: true,
        },
      );
      return;
    }
    if (isRichClubMode && filteredRichData) {
      if (activeOuting) {
        flyToOutingCamera(map, activeOuting, { isFullscreen: effectiveFullscreen });
        return;
      }
      const allCoords = filteredRichData.outings.flatMap((o) =>
        o.coords.map(([lng, lat]) => ({ lng, lat })),
      );
      const b = boundsOfPoints(allCoords);
      if (b) {
        fitBoundsSafely(
          map,
          [
            [b[0], b[1]],
            [b[2], b[3]],
          ],
          {
            padding: withBarInset(
              paddingForViewport(map.getContainer().getBoundingClientRect(), {
                sheetOpen: false,
                mapbig: effectiveFullscreen,
              }),
              map.getContainer(),
            ),
            maxZoom: 10.5,
            pitch: 48,
            bearing: -14,
            duration: prefersReducedMotion() ? 0 : 900,
            essential: true,
          },
        );
      }
      return;
    }
    if (!legacyData?.bounds) return;
    const bounds = legacyData.bounds;
    fitBoundsSafely(
      map,
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      {
        padding: withBarInset(
          paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: context.mode !== 'overview',
            mapbig: effectiveFullscreen,
          }),
          map.getContainer(),
        ),
        maxZoom: 11,
        duration: prefersReducedMotion() ? 0 : 900,
        essential: true,
      },
    );
  }, [
    map,
    isCarnet,
    traceBounds,
    isRichClubMode,
    filteredRichData,
    activeOuting,
    legacyData,
    context.mode,
    effectiveFullscreen,
    stopChoreography,
  ]);

  const handleLayers = useCallback(() => {
    if (!map) return;
    if (isRichClubMode) {
      const order: Club3DBaseStyle[] = ['topo3d', 'ign-ortho', 'ign-topo', 'dusk'];
      const next = order[(order.indexOf(style3DMode) + 1) % order.length];
      setStyle3DMode(next);
      return;
    }
    const next = tileMode === 'satellite' ? 'topo' : 'satellite';
    if (map.getLayer('atlas-tile-satellite')) {
      map.setLayoutProperty(
        'atlas-tile-satellite',
        'visibility',
        next === 'satellite' ? 'visible' : 'none',
      );
    }
    if (map.getLayer('atlas-tile-topo')) {
      map.setLayoutProperty('atlas-tile-topo', 'visibility', next === 'topo' ? 'visible' : 'none');
    }
    setTileMode(next);
  }, [map, isRichClubMode, style3DMode, tileMode]);

  const handleResetNorth = useCallback(() => {
    if (!map) return;
    stopChoreography();
    map.easeTo({
      bearing: 0,
      pitch: map.getZoom() < 5.5 ? 0 : 48,
      duration: prefersReducedMotion() ? 0 : 500,
    });
  }, [map, stopChoreography]);

  const handleZoomIn = useCallback(() => {
    map?.zoomIn({ duration: prefersReducedMotion() ? 0 : 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    map?.zoomOut({ duration: prefersReducedMotion() ? 0 : 300 });
  }, [map]);

  const handleToggleDrone = useCallback(() => {
    if (!map || !activeOuting) return;
    if (isDronePlaying) {
      stopChoreography();
      return;
    }
    stopChoreography();
    setIsDronePlaying(true);
    droneStopRef.current = startClubDroneFlyover({
      map,
      outing: activeOuting,
      startProgress: scrubberProgress >= 0.96 ? 0 : scrubberProgress,
      onRequestFullscreen: (next) => {
        if (onToggleFullscreenRef.current) {
          onToggleFullscreenRef.current(next);
        } else if (next && !effectiveFullscreen) {
          (window as unknown as { __lkdvCompteAct?: (a: string) => void }).__lkdvCompteAct?.('mapbig');
        }
      },
      onProgress: (p) => setScrubberProgress(p),
      onStop: () => {
        droneStopRef.current = null;
        setIsDronePlaying(false);
      },
    });
  }, [map, activeOuting, isDronePlaying, scrubberProgress, effectiveFullscreen, stopChoreography]);

  const handleToggleSummit360 = useCallback(() => {
    if (!map || !activeOuting) return;
    if (isSummit360Active) {
      stopChoreography();
      return;
    }
    stopChoreography();
    setIsSummit360Active(true);
    summit360StopRef.current = startSummit360Panorama({
      map,
      peak: activeOuting.peak,
      onBearingChange: (b) => setBearing(b),
      onStop: () => {
        summit360StopRef.current = null;
        setIsSummit360Active(false);
      },
    });
  }, [map, activeOuting, isSummit360Active, stopChoreography]);

  const handleScrub = useCallback(
    (nextProgress: number) => {
      if (!map || !activeOuting) return;
      if (isDronePlaying) stopChoreography();
      setScrubberProgress(nextProgress);
      const pt = snapPointAlongTrack(activeOuting.coords, nextProgress);
      map.easeTo({
        center: [pt[0], pt[1]],
        duration: prefersReducedMotion() ? 0 : 120,
      });
    },
    [map, activeOuting, isDronePlaying, stopChoreography],
  );

  const handleFocusSummitPeak = useCallback(
    (pk: NearbyAlpinePeak) => {
      if (!map || !activeOuting) return;
      if (summit360StopRef.current) {
        summit360StopRef.current();
        summit360StopRef.current = null;
      }
      map.easeTo({
        center: [activeOuting.peak[0], activeOuting.peak[1]],
        zoom: 13.7,
        pitch: CLUB_MAX_PITCH,
        bearing: pk.bearing,
        duration: prefersReducedMotion() ? 0 : 750,
      });
    },
    [map, activeOuting],
  );

  const dispatchAction = useCallback(
    (
      action: ClubMapAction,
      legacyFallback?: { type: string; id: string; title?: string; subtitle?: string },
    ) => {
      if (onActionRef.current) {
        onActionRef.current(action);
        return;
      }
      if (action.kind === 'open-outing') {
        const clubOpenOuting = (window as unknown as { __lkdvClubMapOpenOuting?: (id: string) => void })
          .__lkdvClubMapOpenOuting;
        if (clubOpenOuting) {
          clubOpenOuting(action.id);
          return;
        }
      }
      if (action.kind === 'open-massif') {
        const clubOpenMassif = (window as unknown as { __lkdvClubMapOpenMassif?: (id: string) => void })
          .__lkdvClubMapOpenMassif;
        if (clubOpenMassif) {
          clubOpenMassif(action.id);
          return;
        }
      }
      if (legacyFallback) {
        window.dispatchEvent(new CustomEvent('lkdv:club-map-action', { detail: legacyFallback }));
      }
    },
    [],
  );

  const handleLegacyOpen = useCallback(
    (kind: LegacyResolved['kind'], id: string) => {
      if (kind === 'carnet') {
        router.push(`/carnets/${encodeURIComponent(id)}`);
        return;
      }
      if (kind === 'massif') {
        const clubOpenMassif = (window as unknown as { __lkdvClubMapOpenMassif?: (id: string) => void })
          .__lkdvClubMapOpenMassif;
        if (clubOpenMassif) clubOpenMassif(id);
        else window.__lkdvOpenSlot?.('souvenirs');
        return;
      }
      const clubOpenOuting = (window as unknown as { __lkdvClubMapOpenOuting?: (id: string) => void })
        .__lkdvClubMapOpenOuting;
      if (clubOpenOuting) clubOpenOuting(id);
      else window.__lkdvCompteMapOpenOuting?.(id);
    },
    [router],
  );

  const showGuest = !isCarnet && !isRichClubMode && !hasClubData && (authState === 'guest' || unauthorized);
  const showError =
    !isCarnet &&
    !isRichClubMode &&
    !hasClubData &&
    !fallback &&
    !styleFailed &&
    (authState === 'error' || (query.isError && !unauthorized));
  const showEmpty =
    !isCarnet &&
    !isRichClubMode &&
    !hasClubData &&
    !fallback &&
    !styleFailed &&
    ready &&
    authState === 'owner' &&
    Boolean(legacyData) &&
    (legacyData?.tracks.length ?? 0) === 0;
  const showNeutral =
    !isCarnet &&
    !isRichClubMode &&
    !hasClubData &&
    !fallback &&
    !styleFailed &&
    ready &&
    authState === 'owner' &&
    config.dimmed &&
    Boolean(config.emptyTitle);
  const showCarnetEmpty = isCarnet && !fallback && !styleFailed && ready && tracePoints.length < 2;
  const carnetEmptyTitle = emptyTitle ?? 'Aucun tracé enregistré pour ce carnet.';
  const carnetEmptyHint = emptyHint ?? 'L’auteur n’a pas joint de trace GPS à ce carnet.';
  const regionLabel = isRichClubMode || hasClubData ? 'Carte 3D du club' : isCarnet ? 'Carte du carnet' : 'Carte de tes sorties';

  const hasScrubberVisible = Boolean(isRichClubMode && activeOuting && ready && !fallback && !contextMode);
  const attributionText = isRichClubMode ? getClubBaseAttribution(style3DMode, demProvider) : undefined;

  return (
    <div
      className="lkdv-map-root"
      role="region"
      aria-label={regionLabel}
      data-zoom-band={zoomBand}
      data-zoom-stage={effectiveZoomStage}
      data-style-mode={isRichClubMode ? style3DMode : undefined}
      data-outdoor={effectiveOutdoor ? 'true' : undefined}
      data-has-scrubber={hasScrubberVisible ? 'true' : undefined}
      data-map-mode={context.mode}
      data-map-outing={context.outingId ?? activeOuting?.id ?? ''}
      data-map-ready={ready ? 'true' : 'false'}
      data-map-style-failed={styleFailed ? 'true' : 'false'}
      data-map-empty={
        isRichClubMode
          ? (filteredRichData?.outings.length ?? 0) === 0
            ? 'true'
            : 'false'
          : legacyData && legacyData.tracks.length === 0
            ? 'true'
            : 'false'
      }
      data-map-dimmed={config.dimmed ? 'true' : 'false'}
      data-map-fallback={fallback ? 'true' : 'false'}
      data-map-variant={variant}
      data-map-context={contextMode ? 'true' : 'false'}
      data-map-trace={isCarnet ? (tracePoints.length >= 2 ? 'true' : 'false') : 'account'}
      data-offline={!online ? 'true' : 'false'}
    >
      <div ref={containerRef} className="lkdv-map-canvas" />
      <p className="sr-only" aria-live="polite">
        {isCarnet
          ? carnetMapSummary(tracePoints.length, carnetEmptyTitle, carnetEmptyHint)
          : filteredRichData
            ? `Carte 3D de ${filteredRichData.clubName} : ${filteredRichData.outings.length} sorties, ${filteredRichData.massifs.length} massifs.`
            : legacyData
              ? `Carte de tes sorties : ${legacyData.stats.outings} sorties, ${legacyData.stats.km} kilomètres.`
              : 'Carte en chargement.'}
      </p>

      {!ready && !styleFailed && !fallback ? (
        <div className="lkdv-map-loading" aria-hidden="true" />
      ) : null}

      {(fallback || styleFailed) && !isCarnet ? (
        <ClubMapFallback
          tracks={legacyData?.tracks ?? []}
          massifs={legacyData?.massifs ?? []}
        />
      ) : null}

      {(fallback || styleFailed) && isCarnet ? (
        <ClubMapState
          kind="neutral"
          title="Carte indisponible."
          hint={
            online
              ? 'Le fond de carte ne répond pas. Le tracé reste lisible dans les tiroirs.'
              : 'Tu es hors ligne : le fond de carte reviendra avec la connexion.'
          }
        />
      ) : null}

      {showGuest ? <ClubMapState kind="guest" /> : null}
      {showError ? <ClubMapState kind="error" onRetry={() => query.refetch()} /> : null}

      {showEmpty && legacyData ? (
        legacyData.stats.outings > 0 ? (
          <ClubMapState
            kind="no-tracks"
            count={legacyData.stats.outings}
            onOpenOutings={() => window.__lkdvOpenSlot?.('souvenirs')}
          />
        ) : (
          <ClubMapState kind="empty" />
        )
      ) : null}

      {showNeutral ? (
        <ClubMapState kind="neutral" title={config.emptyTitle} hint={config.emptyHint} />
      ) : null}

      {showCarnetEmpty ? (
        <ClubMapState kind="neutral" title={carnetEmptyTitle} hint={carnetEmptyHint} />
      ) : null}

      {ready &&
      !fallback &&
      (isRichClubMode ||
        hasClubData ||
        (isCarnet && tracePoints.length >= 2) ||
        (!isCarnet &&
          authState === 'owner' &&
          legacyData &&
          legacyData.tracks.length > 0 &&
          !query.isError)) ? (
        <ClubMapHud
          hidden={contextMode}
          config={config}
          scale={scale}
          onScale={handleScale}
          onRecenter={handleRecenter}
          onLayers={handleLayers}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showLayers={!isCarnet}
          zoomStage={isRichClubMode ? effectiveZoomStage : undefined}
          onZoomStage={isRichClubMode ? handleZoomStage : undefined}
          styleMode={isRichClubMode ? style3DMode : undefined}
          onStyleMode={isRichClubMode ? setStyle3DMode : undefined}
          bearing={bearing}
          onResetNorth={!isCarnet ? handleResetNorth : undefined}
          isFullscreen={effectiveFullscreen}
          onToggleFullscreen={!isCarnet ? handleToggleFullscreen : undefined}
        />
      ) : null}

      {hasScrubberVisible && activeOuting ? (
        <ClubOutingScrubberHud
          outing={activeOuting}
          progress={scrubberProgress}
          onScrub={handleScrub}
          isDronePlaying={isDronePlaying}
          onToggleDrone={handleToggleDrone}
          isSummit360Active={isSummit360Active}
          onToggleSummit360={handleToggleSummit360}
          solarHour={solarHour}
          onSolarHourChange={setSolarHour}
          pillarsEnabled={pillarsEnabled}
          onTogglePillars={() => setPillarsEnabled((prev) => !prev)}
          bearing={bearing}
          onFocusPeak={handleFocusSummitPeak}
          onCloseOuting={() => {
            stopChoreography();
            selectRich(null);
          }}
        />
      ) : null}

      {anchor &&
      resolvedRichCallout &&
      !fallback &&
      !isDronePlaying &&
      !(effectiveFullscreen && onAction && resolvedRichCallout.kind === 'post') ? (
        <div className="lkdv-map-callout-anchor" style={{ left: anchor.x, top: anchor.y }}>
          {resolvedRichCallout.kind === 'country' ? (
            <ClubMapCallout
              kind="country"
              data={resolvedRichCallout.data}
              onClose={() => selectRich(null)}
              onOpen={() => {
                if (map && filteredRichData) flyToCountryCamera(map, filteredRichData.center);
              }}
            />
          ) : resolvedRichCallout.kind === 'rich-massif' ? (
            <ClubMapCallout
              kind="rich-massif"
              data={resolvedRichCallout.data}
              onClose={() => selectRich(null)}
              onOpen={(id) => dispatchAction({ kind: 'open-massif', id }, { type: 'massif', id })}
            />
          ) : resolvedRichCallout.kind === 'rich-outing' ? (
            <ClubMapCallout
              kind="rich-outing"
              data={resolvedRichCallout.data}
              onClose={() => {
                stopChoreography();
                selectRich(null);
              }}
              onOpen={(id) =>
                dispatchAction(
                  { kind: 'open-outing', id, outingId: id },
                  { type: 'outing', id, title: resolvedRichCallout.data.title },
                )
              }
              onStartDrone={handleToggleDrone}
            />
          ) : resolvedRichCallout.kind === 'post' ? (
            <ClubMapCallout
              kind="post"
              data={resolvedRichCallout.data}
              onClose={() => selectRich(null)}
              onOpen={(id) =>
                dispatchAction(
                  { kind: 'open-post', id, outingId: resolvedRichCallout.data.outingId },
                  {
                    type: 'post',
                    id,
                    title: resolvedRichCallout.data.spot,
                    subtitle: resolvedRichCallout.data.authorName,
                  },
                )
              }
            />
          ) : resolvedRichCallout.kind === 'pokedex' ? (
            <ClubMapCallout
              kind="pokedex"
              data={resolvedRichCallout.data}
              onClose={() => selectRich(null)}
              onOpen={(outingId) =>
                dispatchAction(
                  { kind: 'open-outing', id: outingId, outingId },
                  {
                    type: 'pokedex',
                    id: outingId,
                    title: resolvedRichCallout.data.commonName,
                    subtitle: resolvedRichCallout.data.outingTitle,
                  },
                )
              }
            />
          ) : resolvedRichCallout.kind === 'kit' ? (
            <ClubMapCallout
              kind="kit"
              data={resolvedRichCallout.data}
              onClose={() => selectRich(null)}
              onOpen={(id) =>
                dispatchAction(
                  { kind: 'open-kit', id, outingId: resolvedRichCallout.data.outingId },
                  {
                    type: 'kit',
                    id,
                    title: resolvedRichCallout.data.title,
                  },
                )
              }
            />
          ) : (
            <ClubMapCallout
              kind="member"
              data={resolvedRichCallout.data}
              onClose={() => selectRich(null)}
              onOpen={(id) =>
                dispatchAction(
                  { kind: 'open-member', id },
                  { type: 'member', id, title: resolvedRichCallout.data.name },
                )
              }
            />
          )}
        </div>
      ) : null}

      {anchor && !resolvedRichCallout && resolvedLegacy && !fallback ? (
        <div className="lkdv-map-callout-anchor" style={{ left: anchor.x, top: anchor.y }}>
          {resolvedLegacy.kind === 'outing' ? (
            <ClubMapCallout
              kind="outing"
              data={resolvedLegacy.data}
              onClose={() => setLegacySelected(null)}
              onOpen={(id) => handleLegacyOpen('outing', id)}
            />
          ) : resolvedLegacy.kind === 'massif' ? (
            <ClubMapCallout
              kind="massif"
              data={resolvedLegacy.data}
              onClose={() => setLegacySelected(null)}
              onOpen={(id) => handleLegacyOpen('massif', id)}
            />
          ) : resolvedLegacy.kind === 'carnet' ? (
            <ClubMapCallout
              kind="carnet"
              data={resolvedLegacy.data}
              onClose={() => setLegacySelected(null)}
              onOpen={(id) => handleLegacyOpen('carnet', id)}
            />
          ) : (
            <ClubMapCallout
              kind="poi"
              data={resolvedLegacy.data}
              onClose={() => setLegacySelected(null)}
              onOpen={(id) => handleLegacyOpen('poi', id)}
            />
          )}
        </div>
      ) : null}

      {ready ? (
        <ClubMapAttribution text={attributionText} hasScrubber={hasScrubberVisible} />
      ) : null}
      {!online ? <div className="lkdv-map-offline">Hors ligne</div> : null}
    </div>
  );
}

export default ClubMap;
