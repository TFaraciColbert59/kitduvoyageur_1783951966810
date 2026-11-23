'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import './workspace/map/map.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MlMap,
  MapMouseEvent,
  MapTouchEvent,
  Marker,
} from 'maplibre-gl';
import { ATLAS_TILES, createMapStyle } from '@/components/map/engine/createMapStyle';
import { createLiveMap, leaseWebGL, loadMaplibre, webglSupport, type ArbiterLease } from '@/components/map/engine/liveMapCore';
import { animationDuration, prefersReducedMotion } from '@/components/map/engine/camera';
import type { MapBase } from '@/features/compas/engine/mapStyle';
import { simplify, smooth, type LngLat } from '@/features/community/create/carnet/traceEngine';
import type { RouteCorridorPoi } from '../routeAnalysis';
import type { PointRole } from '../pointInsertion';
import { dayColorIndex, sectionDayMap, slopeLensSegments, surfaceLensSegments } from '../mapGeometry';
import { layersForSport, type SportLayerId } from '../mapLayers';
import { LONG_PRESS_MS, TAP_TOLERANCE_PX, insertionThresholdM, pressDown, pressElapsed, pressMove, type PressState } from '../mapGesture';
import { boundsOf, focusOffsetPx, framePadding, framingTarget } from '../mapFraming';
import { fetchPreviewPath } from '../routePreview';
import { readTilePack, TILE_STYLE_URL } from '../offlineTiles';
import { OPENFREEMAP_CREDIT, prepareVectorBase } from '@/components/map/engine/standardBase';
import { HIKING_ZOOM, addPointGate, isUnverifiedSection, readLastKnown, startView, writeLastKnown, type StartKind } from '../mapStart';
import { activePointsOf } from '../pointOrder';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  RouteVariant,
} from '../types';
import { useRouteViewMode } from './workspace/expertMode';
import { MapOverlays, type LegendDay, type LensLegendItem, type MapLens } from './workspace/map/MapOverlays';
import {
  DAY_COLOR_TOKENS,
  POI_COLOR_TOKENS,
  POI_DEFAULT_COLOR_TOKEN,
  SLOPE_COLOR_TOKENS,
  SURFACE_COLOR_TOKENS,
  readToken,
  readTokens,
} from './workspace/map/mapTokens';
import { PointRoleMenu } from './workspace/map/PointRoleMenu';
import { useLivePosition } from './workspace/map/useLivePosition';
import { useSheetHeight } from './workspace/map/useSheetHeight';
import { useOptionalRouteWorkspace } from './workspace/WorkspaceContext';
import { useRouteEntry } from './workspace/start/RouteEntryContext';

const HOLDER = 'route-map' as const;

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;


const SLOPE_LABEL: Record<string, string> = {
  flat: 'Moins de 5 %',
  moderate: '5 à 10 %',
  sustained: '10 à 15 %',
  steep: 'Plus de 15 %',
  unknown: 'Pente inconnue',
};
const SURFACE_LABEL: Record<string, string> = {
  paved: 'Revêtue',
  unpaved: 'Piste',
  trail: 'Sentier',
  rock: 'Rocher',
  unknown: 'Surface inconnue',
};

export interface RouteCollabMapProps {
  points: readonly CollaborativeRoutePoint[];
  sections: readonly CollaborativeRouteSection[];
  base: MapBase;
  fitTrigger?: number;
  focusCoord?: [number, number] | null;
  comparedVariant?: RouteVariant | null;
  hoveredCoord?: [number, number] | null;
  selectedPointId?: string | null;
  selectedSectionId?: string | null;
  analysisPois?: readonly RouteCorridorPoi[];
  focusedPoiId?: string | null;
  canEdit?: boolean;
  /** Mode dessin au doigt / souris (comme le tiroir de création Communauté). */
  drawingMode?: boolean;
  /** Mode édition directe des points par glisser-déposer sur la carte. */
  editingMode?: boolean;
  /** Repli sans atelier : ajoute un point en fin de liste. Avec l'atelier, la pose passe par `placePoint`. */
  onMapClickAddPoint?: (lat: number, lon: number) => void;
  onFreehandDrawComplete?: (coords: readonly [number, number][]) => void;
  onDragPoint?: (pointId: string, lat: number, lon: number) => void;
  onSelectPoint?: (pointId: string) => void;
  onSelectSection?: (sectionId: string) => void;
  onSelectPoi?: (poi: RouteCorridorPoi) => void;
  onMapError: (reason: string) => void;
}

type AnyMapEvent = MapMouseEvent | MapTouchEvent;

interface LineDrag {
  sectionId: string;
  from: [number, number];
  to: [number, number];
  startX: number;
  startY: number;
  moved: boolean;
  pos: [number, number] | null;
  timer: number | null;
  abort: AbortController | null;
}

function poiColorKey(poi: RouteCorridorPoi): string {
  return poi.rawCategory === 'bike_shop' || poi.rawCategory === 'bike_repair' || poi.rawCategory === 'ebike_charging'
    ? 'bike_workshop'
    : poi.category;
}

export function RouteCollabMap({
  points,
  sections,
  base,
  fitTrigger = 0,
  focusCoord = null,
  comparedVariant = null,
  hoveredCoord = null,
  selectedPointId = null,
  selectedSectionId = null,
  analysisPois = [],
  focusedPoiId = null,
  canEdit = false,
  drawingMode = false,
  editingMode = false,
  onMapClickAddPoint,
  onFreehandDrawComplete,
  onDragPoint,
  onSelectPoint,
  onSelectSection,
  onSelectPoi,
  onMapError,
}: RouteCollabMapProps) {
  const ws = useOptionalRouteWorkspace();
  const entry = useRouteEntry();
  const { expert } = useRouteViewMode();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null);
  const dragMarkersRef = useRef<Marker[]>([]);
  const liveMarkerRef = useRef<Marker | null>(null);
  const strokeRef = useRef<{ pointerId: number; points: LngLat[] } | null>(null);
  const [ready, setReady] = useState(false);
  const sheetHeight = useSheetHeight(rootEl);

  const [lens, setLens] = useState<MapLens>('days');
  const [menu, setMenu] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null);
  const [dragInfo, setDragInfo] = useState<string | null>(null);
  const [startKind, setStartKind] = useState<StartKind | null>(null);
  const [offlineBase, setOfflineBase] = useState(false);
  const [legendFocus, setLegendFocus] = useState<{ stageId: string; nonce: number } | null>(null);
  const sport = ws?.workspace.sport ?? 'marche';
  const sportLayers = useMemo(() => layersForSport(sport), [sport]);
  const [activeLayers, setActiveLayers] = useState<ReadonlySet<SportLayerId>>(
    () => new Set(sportLayers.map((l) => l.id)),
  );
  useEffect(() => {
    setActiveLayers(new Set(sportLayers.map((l) => l.id)));
  }, [sportLayers]);
  const live = useLivePosition();

  const effLens: MapLens = expert ? lens : 'days';

  // 2.10 : hors ligne sans tracé en mémoire, la carte lit la copie téléchargée (le pack), pas un état vide.
  const online = ws?.online ?? true;
  const pack = ws?.verifiedPack ?? null;
  const usePack = !online && pack != null && sections.length === 0 && pack.revision.sections.length > 0;
  const effPoints = usePack ? pack.revision.points : points;
  const effSections = usePack ? pack.revision.sections : sections;
  const liveStages = ws?.workspace.stages;
  const effStages = useMemo(
    () => (usePack ? pack.revision.stages : (liveStages ?? [])),
    [usePack, pack, liveStages],
  );

  const palette = useMemo(() => readTokens(DAY_COLOR_TOKENS), []);
  const dayMap = useMemo(
    () => sectionDayMap(effPoints, effSections, effStages),
    [effPoints, effSections, effStages],
  );
  const legendDays: LegendDay[] = useMemo(
    () =>
      effStages
        .slice()
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .map((st) => {
          const secs = effSections.filter((s) => dayMap.get(s.id) === st.dayNumber);
          return {
            stageId: st.id,
            day: st.dayNumber,
            color: palette[dayColorIndex(st.dayNumber, palette.length)],
            distanceKm: secs.length > 0 ? Number(secs.reduce((a, s) => a + s.distanceKm, 0).toFixed(1)) : null,
          };
        }),
    [effStages, effSections, dayMap, palette],
  );
  const lensLegend: LensLegendItem[] = useMemo(() => {
    if (effLens === 'slope') {
      return ['flat', 'moderate', 'sustained', 'steep', 'unknown'].map((k) => ({
        label: SLOPE_LABEL[k],
        color: readToken(SLOPE_COLOR_TOKENS[k]),
      }));
    }
    if (effLens === 'surface') {
      return ['paved', 'unpaved', 'trail', 'rock', 'unknown'].map((k) => ({
        label: SURFACE_LABEL[k],
        color: readToken(SURFACE_COLOR_TOKENS[k]),
      }));
    }
    return [];
  }, [effLens]);

  // Dernières valeurs lues par les gestionnaires MapLibre (installés une seule fois).
  const latest = useRef({
    ws,
    points: effPoints,
    sections: effSections,
    canEdit,
    drawingMode,
    editingMode,
    selectedSectionId,
    analysisPois,
    onMapClickAddPoint,
    onFreehandDrawComplete,
    onDragPoint,
    onSelectPoint,
    onSelectSection,
    onSelectPoi,
    onMapError,
    sport,
  });
  latest.current = {
    ws,
    points: effPoints,
    sections: effSections,
    canEdit,
    drawingMode,
    editingMode,
    selectedSectionId,
    analysisPois,
    onMapClickAddPoint,
    onFreehandDrawComplete,
    onDragPoint,
    onSelectPoint,
    onSelectSection,
    onSelectPoi,
    onMapError,
    sport,
  };

  /* ---------- Pose d'un point (2.2, 2.3) ---------- */
  const place = useCallback((role: PointRole, lat: number, lon: number) => {
    const L = latest.current;
    const map = mapRef.current;
    const latR = Number(lat.toFixed(5));
    const lonR = Number(lon.toFixed(5));
    if (!L.ws) {
      L.onMapClickAddPoint?.(latR, lonR);
      return;
    }
    // Sous le zoom minimal, le toucher zoome au lieu de poser un point : deux points y seraient à des dizaines de km.
    const gate = addPointGate(map?.getZoom());
    if (!gate.ok && map) {
      map.easeTo({ center: [lonR, latR], zoom: gate.zoomTo, duration: animationDuration(400, prefersReducedMotion()) });
      L.ws.setStatusMessage(gate.message);
      return;
    }
    const thresholdM = insertionThresholdM(latR, map?.getZoom() ?? 12);
    writeLastKnown(typeof window !== 'undefined' ? window.localStorage : null, { lon: lonR, lat: latR });
    void L.ws.placePoint({ role, lat: latR, lon: lonR, thresholdM });
  }, []);

  /* ---------- Initialisation de la carte (une fois) ---------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: MlMap | null = null;
    let lease: ArbiterLease | null = null;

    (async () => {
      try {
        const support = webglSupport();
        if (support !== 'ok') {
          if (!cancelled) latest.current.onMapError(support === 'unsupported' ? 'WebGL indisponible sur ce navigateur' : 'Contexte WebGL dégradé');
          return;
        }

        // 2.1 : le moteur de la carte vivante du Compas (`liveMapCore`), un seul contexte WebGL vivant (ADR-002).
        lease = await leaseWebGL(HOLDER, {
          isCancelled: () => cancelled,
          onReleased: () => latest.current.onMapError('Carte libérée : une autre vue 3D est ouverte'),
          onLost: () => latest.current.onMapError('Contexte WebGL perdu'),
        });
        if (cancelled) {
          lease.release();
          lease = null;
          return;
        }

        const maplibre = await loadMaplibre();
        if (cancelled) return;
        maplibreRef.current = maplibre;

        const L = latest.current;
        const first = L.points[0];
        const anchor = entry.trip?.anchor ?? null;
        // Cadrage de départ : tracé, ancre du voyage, dernière position connue, sinon repère neutre à zoom de randonnée.
        const start = startView({
          first,
          anchor,
          lastKnown: readLastKnown(typeof window !== 'undefined' ? window.localStorage : null),
        });
        const { center, zoom } = start;
        setStartKind(start.kind);

        // Style de carte du Compas : mêmes fonds (Relief, Clair, Satellite) que la carte vivante, en Mercator.
        instance = createLiveMap(maplibre, {
          container,
          base,
          center,
          zoom,
          title: 'Carte de l’itinéraire',
          style: createMapStyle(base, { withTiles: true, projection: 'mercator' }),
        });
        lease.watch(instance);
        const map = instance;

        // Position déjà autorisée : la carte s'y place. La permission n'est JAMAIS demandée au chargement.
        if (start.kind === 'neutral' && typeof navigator !== 'undefined' && navigator.geolocation && navigator.permissions?.query) {
          navigator.permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((st) => {
              if (cancelled || st.state !== 'granted') return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (cancelled || latest.current.points.length > 0) return;
                  const here = { lon: pos.coords.longitude, lat: pos.coords.latitude };
                  writeLastKnown(window.localStorage, here);
                  map.jumpTo({ center: [here.lon, here.lat], zoom: HIKING_ZOOM });
                  setStartKind('located');
                },
                () => undefined,
                { timeout: 8000, maximumAge: 600000 },
              );
            })
            .catch(() => undefined);
        }

        map.on('error', () => {
          /* Erreurs de tuiles hors ligne silencieuses si WebGL tourne */
        });

        /* --- Toucher = point, appui long = menu --- */
        const press: { state: PressState | null; timer: number | null; lngLat: { lat: number; lng: number } | null; suppressUntil: number } = {
          state: null,
          timer: null,
          lngLat: null,
          suppressUntil: 0,
        };
        const clearPress = () => {
          if (press.timer != null) window.clearTimeout(press.timer);
          press.timer = null;
          press.state = null;
        };
        const openMenuAt = (e: AnyMapEvent) => {
          const cur = latest.current;
          if (!cur.canEdit || cur.drawingMode) return;
          press.suppressUntil = Date.now() + 600;
          setMenu({ x: e.point.x, y: e.point.y, lat: e.lngLat.lat, lon: e.lngLat.lng });
        };
        const onDown = (e: AnyMapEvent) => {
          const cur = latest.current;
          if (!cur.canEdit || cur.drawingMode) return;
          const touches = (e.originalEvent as TouchEvent | MouseEvent | undefined) as TouchEvent | undefined;
          if (touches && 'touches' in touches && touches.touches && touches.touches.length > 1) {
            clearPress();
            return;
          }
          clearPress();
          press.state = pressDown(e.point.x, e.point.y, Date.now());
          press.lngLat = { lat: e.lngLat.lat, lng: e.lngLat.lng };
          const pointSnap = { x: e.point.x, y: e.point.y };
          press.timer = window.setTimeout(() => {
            const next = press.state ? pressElapsed(press.state, Date.now()) : null;
            if (!next || !press.lngLat) return;
            press.state = next;
            // Un appui long sur un point ou une ligne n'ouvre pas le menu de pose.
            const hit = map.queryRenderedFeatures([pointSnap.x, pointSnap.y], {
              layers: ['rcw-points-circle', 'rcw-pois-circle'],
            });
            if (hit.length > 0) return;
            press.suppressUntil = Date.now() + 600;
            setMenu({ x: pointSnap.x, y: pointSnap.y, lat: press.lngLat.lat, lon: press.lngLat.lng });
          }, LONG_PRESS_MS);
        };
        const onMove = (e: AnyMapEvent) => {
          if (press.state) {
            press.state = pressMove(press.state, e.point.x, e.point.y);
            if (press.state.moved && press.timer != null) {
              window.clearTimeout(press.timer);
              press.timer = null;
            }
          }
        };
        map.on('mousedown', onDown);
        map.on('touchstart', onDown);
        map.on('mousemove', onMove);
        map.on('touchmove', onMove);
        map.on('mouseup', clearPress);
        map.on('touchend', clearPress);
        map.on('touchcancel', clearPress);
        map.on('dragstart', clearPress);
        map.on('zoomstart', clearPress);
        map.on('contextmenu', (e) => openMenuAt(e));

        map.on('click', (ev) => {
          const cur = latest.current;
          if (cur.drawingMode || !cur.canEdit) return;
          if (Date.now() < press.suppressUntil) return;
          const features = map.queryRenderedFeatures(ev.point, {
            layers: ['rcw-points-circle', 'rcw-sections-hit', 'rcw-pois-circle'],
          });
          if (features.length > 0) return;
          place('waypoint', ev.lngLat.lat, ev.lngLat.lng);
        });

        /* --- Profil lié à la carte : la souris sur le tracé déplace le curseur du profil (2.6) --- */
        let lastHover = 0;
        map.on('mousemove', (ev) => {
          const cur = latest.current;
          if (!cur.ws || cur.drawingMode) return;
          const now = Date.now();
          if (now - lastHover < 70) return;
          lastHover = now;
          cur.ws.cursorFromCoord([ev.lngLat.lng, ev.lngLat.lat]);
        });
        map.on('mouseout', () => latest.current.ws?.cursorFromCoord(null));

        map.on('load', () => {
          if (cancelled) return;
          const c = {
            surface: readToken('--lkv-surface'),
            warn: readToken('--lkv-warning'),
            info: readToken('--lkv-info'),
            ink: readToken('--lkv-forest-900'),
            forest: readToken('--lkv-forest-500'),
            danger: readToken('--lkv-danger'),
            sage: readToken('--lkv-sage-500'),
          };

          map.addSource('rcw-sections', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-sections-halo',
            type: 'line',
            source: 'rcw-sections',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['case', ['==', ['get', 'selected'], true], c.warn, c.surface],
              'line-width': ['case', ['==', ['get', 'selected'], true], 11, 8],
              // Une ligne droite non vérifiée n'a pas de cadre plein : elle ne doit pas ressembler à un chemin tracé.
              'line-opacity': ['case', ['==', ['get', 'unverified'], true], 0, 0.85],
            },
          });
          map.addLayer({
            id: 'rcw-sections-day',
            type: 'line',
            source: 'rcw-sections',
            filter: ['all', ['!=', ['get', 'mode'], 'manual'], ['!=', ['get', 'unverified'], true]],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 4.5 },
          });
          map.addLayer({
            id: 'rcw-sections-manual',
            type: 'line',
            source: 'rcw-sections',
            // Tracé à la main ou ligne droite pas (encore) calculée par le routeur : pointillé « non vérifié ».
            filter: ['any', ['==', ['get', 'mode'], 'manual'], ['==', ['get', 'unverified'], true]],
            paint: { 'line-color': c.warn, 'line-width': 4, 'line-dasharray': [2, 2] },
          });
          map.addSource('rcw-lens', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-lens-line',
            type: 'line',
            source: 'rcw-lens',
            layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
          });
          map.addLayer({
            id: 'rcw-sections-hit',
            type: 'line',
            source: 'rcw-sections',
            paint: { 'line-color': c.ink, 'line-width': 18, 'line-opacity': 0 },
          });

          // Tracé libre en cours de dessin au doigt
          map.addSource('rcw-live-draw', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-live-draw-line',
            type: 'line',
            source: 'rcw-live-draw',
            paint: { 'line-color': c.info, 'line-width': 4, 'line-dasharray': [1.5, 1.5] },
          });

          map.addSource('rcw-variant', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-variant-line',
            type: 'line',
            source: 'rcw-variant',
            paint: { 'line-color': c.info, 'line-width': 4.5, 'line-dasharray': [3, 2] },
          });

          // Glisser la ligne (2.4) : halo du chemin réel + point déposé
          map.addSource('rcw-drag-halo', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-drag-halo-wide',
            type: 'line',
            source: 'rcw-drag-halo',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': c.forest, 'line-width': 16, 'line-opacity': 0.28 },
          });
          map.addLayer({
            id: 'rcw-drag-halo-line',
            type: 'line',
            source: 'rcw-drag-halo',
            filter: ['==', ['get', 'kind'], 'routed'],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': c.ink, 'line-width': 4 },
          });
          map.addLayer({
            id: 'rcw-drag-halo-straight',
            type: 'line',
            source: 'rcw-drag-halo',
            filter: ['==', ['get', 'kind'], 'straight'],
            paint: { 'line-color': c.warn, 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
          });
          map.addSource('rcw-drag-point', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-drag-point-dot',
            type: 'circle',
            source: 'rcw-drag-point',
            paint: {
              'circle-radius': 9,
              'circle-color': c.ink,
              'circle-stroke-width': 3,
              'circle-stroke-color': c.surface,
            },
          });

          // Points d'intérêt des calques (Analyser, calques selon le sport)
          map.addSource('rcw-pois', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-pois-circle',
            type: 'circle',
            source: 'rcw-pois',
            paint: {
              'circle-radius': ['case', ['==', ['get', 'focused'], true], 8.5, 5.5],
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': c.surface,
            },
          });

          map.addSource('rcw-points', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-points-circle',
            type: 'circle',
            source: 'rcw-points',
            paint: {
              'circle-radius': ['case', ['==', ['get', 'selected'], true], 9, 6.5],
              'circle-color': ['case', ['==', ['get', 'selected'], true], c.warn, c.ink],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': c.surface,
            },
          });

          map.addSource('rcw-hover', { type: 'geojson', data: EMPTY_FC as never });
          map.addLayer({
            id: 'rcw-hover-dot',
            type: 'circle',
            source: 'rcw-hover',
            paint: {
              'circle-radius': 8,
              'circle-color': c.danger,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': c.surface,
            },
          });

          map.on('click', 'rcw-points-circle', (ev) => {
            if (latest.current.drawingMode) return;
            const ptId = ev.features?.[0]?.properties?.id;
            if (typeof ptId === 'string') latest.current.onSelectPoint?.(ptId);
          });

          map.on('click', 'rcw-sections-hit', (ev) => {
            const cur = latest.current;
            if (cur.drawingMode) return;
            if (map.queryRenderedFeatures(ev.point, { layers: ['rcw-points-circle'] }).length > 0) return;
            const secId = ev.features?.[0]?.properties?.id;
            if (typeof secId === 'string') {
              cur.onSelectSection?.(secId);
              // Le toucher sur la ligne pose aussi le curseur du profil (tactile : pas de survol).
              cur.ws?.cursorFromCoord([ev.lngLat.lng, ev.lngLat.lat]);
            }
          });

          map.on('click', 'rcw-pois-circle', (ev) => {
            if (latest.current.drawingMode) return;
            const poiId = ev.features?.[0]?.properties?.id;
            if (typeof poiId === 'string') {
              const found = latest.current.analysisPois.find((p) => p.id === poiId);
              if (found) latest.current.onSelectPoi?.(found);
            }
          });

          /* --- Glisser la ligne pour la déformer (2.4) --- */
          let drag: LineDrag | null = null;
          const clearDragLayers = () => {
            (map.getSource('rcw-drag-halo') as GeoJSONSource | undefined)?.setData(EMPTY_FC as never);
            (map.getSource('rcw-drag-point') as GeoJSONSource | undefined)?.setData(EMPTY_FC as never);
          };
          const endDrag = (commit: boolean) => {
            const d = drag;
            drag = null;
            window.removeEventListener('mouseup', onWindowUp);
            window.removeEventListener('touchend', onWindowUp);
            window.removeEventListener('touchcancel', onWindowUp);
            if (!d) return;
            if (d.timer != null) window.clearTimeout(d.timer);
            d.abort?.abort();
            clearDragLayers();
            setDragInfo(null);
            if (commit && d.moved && d.pos) {
              void latest.current.ws?.dragSectionLine(d.sectionId, Number(d.pos[1].toFixed(5)), Number(d.pos[0].toFixed(5)));
            }
          };
          function onWindowUp() {
            endDrag(true);
          }
          const showStraight = (d: LineDrag) => {
            if (!d.pos) return;
            (map.getSource('rcw-drag-halo') as GeoJSONSource | undefined)?.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { kind: 'straight' },
                  geometry: { type: 'LineString', coordinates: [d.from, d.pos, d.to] },
                },
              ],
            });
          };
          const schedulePreview = (d: LineDrag) => {
            if (d.timer != null) return;
            d.timer = window.setTimeout(async () => {
              d.timer = null;
              if (drag !== d || !d.pos) return;
              d.abort?.abort();
              const ctl = new AbortController();
              d.abort = ctl;
              setDragInfo('Calcul du chemin réel…');
              const cur = latest.current;
              const res = await fetchPreviewPath(
                [d.from, d.pos, d.to],
                cur.sport,
                cur.ws?.workspace.routingOptions,
                ctl.signal,
              );
              if (ctl.signal.aborted || drag !== d) return;
              if (res) {
                (map.getSource('rcw-drag-halo') as GeoJSONSource | undefined)?.setData({
                  type: 'FeatureCollection',
                  features: [
                    { type: 'Feature', properties: { kind: 'routed' }, geometry: { type: 'LineString', coordinates: res.coordinates } },
                  ],
                });
                setDragInfo(`Chemin réel : ${res.distanceKm.toLocaleString('fr-FR')} km${res.provider ? ` · ${res.provider}` : ''}`);
              } else {
                showStraight(d);
                setDragInfo('Chemin réel indisponible : ligne droite en attendant le calcul.');
              }
            }, 220);
          };
          const startLineDrag = (ev: AnyMapEvent & { features?: Array<{ properties?: Record<string, unknown> | null }> }) => {
            const cur = latest.current;
            if (!cur.canEdit || cur.drawingMode || !cur.ws) return;
            const touches = (ev.originalEvent as TouchEvent | MouseEvent | undefined) as TouchEvent | undefined;
            if (touches && 'touches' in touches && touches.touches && touches.touches.length > 1) return;
            const secId = ev.features?.[0]?.properties?.id;
            if (typeof secId !== 'string') return;
            // Une ligne se déforme une fois choisie : on touche d'abord (sélection), puis on glisse. Une ligne non
            // choisie reste de la carte : le glissé la fait défiler comme partout ailleurs.
            if (!(cur.selectedSectionId === secId || cur.editingMode)) return;
            const ordered = activePointsOf({ points: cur.points });
            const sec = cur.sections.find((s) => s.id === secId);
            const a = ordered.find((p) => p.id === sec?.fromPointId);
            const b = ordered.find((p) => p.id === sec?.toPointId);
            if (!sec || !a || !b) return;
            if (map.queryRenderedFeatures(ev.point, { layers: ['rcw-points-circle'] }).length > 0) return;
            ev.preventDefault();
            drag = {
              sectionId: secId,
              from: [a.lon, a.lat],
              to: [b.lon, b.lat],
              startX: ev.point.x,
              startY: ev.point.y,
              moved: false,
              pos: null,
              timer: null,
              abort: null,
            };
            window.addEventListener('mouseup', onWindowUp);
            window.addEventListener('touchend', onWindowUp);
            window.addEventListener('touchcancel', onWindowUp);
          };
          const moveLineDrag = (ev: AnyMapEvent) => {
            const d = drag;
            if (!d) return;
            if (!d.moved && Math.hypot(ev.point.x - d.startX, ev.point.y - d.startY) <= TAP_TOLERANCE_PX) return;
            d.moved = true;
            d.pos = [ev.lngLat.lng, ev.lngLat.lat];
            (map.getSource('rcw-drag-point') as GeoJSONSource | undefined)?.setData({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: d.pos } }],
            });
            showStraight(d);
            schedulePreview(d);
          };
          map.on('mousedown', 'rcw-sections-hit', startLineDrag as never);
          map.on('touchstart', 'rcw-sections-hit', startLineDrag as never);
          map.on('mousemove', moveLineDrag);
          map.on('touchmove', moveLineDrag);
          map.on('mouseenter', 'rcw-sections-hit', () => {
            const cur = latest.current;
            map.getCanvas().style.cursor = cur.canEdit && !cur.drawingMode ? 'pointer' : '';
          });
          map.on('mouseleave', 'rcw-sections-hit', () => {
            map.getCanvas().style.cursor = '';
          });

          mapRef.current = map;
          setReady(true);
        });
      } catch (err) {
        if (!cancelled) {
          latest.current.onMapError(err instanceof Error ? err.message : 'Initialisation MapLibre impossible');
        }
      }
    })();

    return () => {
      cancelled = true;
      lease?.release();
      lease = null;
      dragMarkersRef.current.forEach((m) => m.remove());
      dragMarkersRef.current = [];
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
      instance?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // La carte n'est créée qu'une fois ; ses gestionnaires lisent `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Désactiver le pan carte pendant le dessin au doigt
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (drawingMode) {
      map.dragPan.disable();
    } else {
      map.dragPan.enable();
    }
  }, [drawingMode, ready]);

  // Mode édition directe : marqueurs déplaçables au doigt/souris (comme TracePaneV2)
  useEffect(() => {
    const map = mapRef.current;
    const ml = maplibreRef.current;
    dragMarkersRef.current.forEach((m) => m.remove());
    dragMarkersRef.current = [];
    if (!map || !ml || !ready || !editingMode || !canEdit) return;

    effPoints.forEach((pt, idx) => {
      const el = document.createElement('div');
      el.className = 'rcw-drag-handle';
      el.title = `Glisser pour déplacer ${pt.name || `point ${idx + 1}`}`;
      el.textContent = String(idx + 1);
      const marker = new ml.Marker({ element: el, draggable: true })
        .setLngLat([pt.lon, pt.lat])
        .addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        latest.current.onDragPoint?.(pt.id, Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5)));
      });
      dragMarkersRef.current.push(marker);
    });

    return () => {
      dragMarkersRef.current.forEach((m) => m.remove());
      dragMarkersRef.current = [];
    };
  }, [effPoints, editingMode, canEdit, ready]);

  // Fond de carte piloté depuis le sélecteur haut-droite (Plan / Relief / Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const mode of ['osm', 'topo', 'satellite'] as const) {
      const id = `atlas-tile-${mode}`;
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', mode === base && !offlineBase ? 'visible' : 'none');
      }
    }
  }, [base, ready, offlineBase]);

  // 2.10 : hors ligne, avec une copie du corridor sur l'appareil, le fond est celui qui a été téléchargé (tuiles
  // vectorielles d'OpenFreeMap, servies par le service worker) ; en ligne, le fond choisi revient.
  const workspaceId = ws?.workspace.id ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const ids = (): string[] => (map.getStyle?.()?.layers ?? []).map((l) => l.id).filter((id) => id.startsWith('ofm-'));
    if (online || !workspaceId || !readTilePack(workspaceId)) {
      for (const id of ids()) map.setLayoutProperty(id, 'visibility', 'none');
      setOfflineBase(false);
      return;
    }
    if (ids().length > 0) {
      for (const id of ids()) map.setLayoutProperty(id, 'visibility', 'visible');
      setOfflineBase(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(TILE_STYLE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const plan = prepareVectorBase(await res.json(), true);
        if (!plan || cancelled || mapRef.current !== map) return;
        if (plan.glyphs && !map.getGlyphs()) map.setGlyphs(plan.glyphs);
        if (plan.sprite && map.getSprite().length === 0) map.setSprite(plan.sprite);
        for (const [id, source] of Object.entries(plan.sources)) if (!map.getSource(id)) map.addSource(id, source);
        const before = map.getLayer('rcw-sections-halo') ? 'rcw-sections-halo' : undefined;
        for (const layer of plan.layers) if (!map.getLayer(layer.id)) map.addLayer(layer, before);
        setOfflineBase(true);
      } catch {
        // Style illisible hors ligne : la carte garde son fond et le tracé reste lisible.
        if (!cancelled) setOfflineBase(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, ready, workspaceId]);

  // Points d'intérêt visibles : ceux des calques cochés pour ce sport, plus celui qu'on regarde (2.7).
  const visiblePois = useMemo(() => {
    if (!ws) return analysisPois;
    return analysisPois.filter(
      (p) => p.id === focusedPoiId || sportLayers.some((l) => activeLayers.has(l.id) && l.match(p)),
    );
  }, [ws, analysisPois, focusedPoiId, sportLayers, activeLayers]);

  // Mise à jour en direct des sections (une couleur par jour), points, variante et POIs
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const colorOf = (sectionId: string): string => {
      const day = dayMap.get(sectionId);
      return palette[dayColorIndex(day ?? 1, palette.length)];
    };
    (map.getSource('rcw-sections') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: effSections.map((s) => ({
        type: 'Feature',
        properties: {
          id: s.id,
          mode: s.mode,
          unverified: isUnverifiedSection(s),
          selected: s.id === selectedSectionId,
          color: colorOf(s.id),
          day: dayMap.get(s.id) ?? null,
        },
        geometry: s.geometry,
      })),
    });

    (map.getSource('rcw-points') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: effPoints.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, name: p.name ?? p.kind, selected: p.id === selectedPointId },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      })),
    });

    (map.getSource('rcw-variant') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: (comparedVariant?.replacements ?? []).map((r) => ({
        type: 'Feature',
        properties: { sectionId: r.sectionId },
        geometry: r.geometry,
      })),
    });

    (map.getSource('rcw-pois') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: visiblePois.map((poi) => ({
        type: 'Feature',
        properties: {
          id: poi.id,
          name: poi.name,
          category: poi.category,
          focused: poi.id === focusedPoiId,
          color: readToken(POI_COLOR_TOKENS[poiColorKey(poi)] ?? POI_DEFAULT_COLOR_TOKEN),
        },
        geometry: { type: 'Point', coordinates: [poi.lon, poi.lat] },
      })),
    });
  }, [effPoints, effSections, dayMap, palette, comparedVariant, selectedPointId, selectedSectionId, visiblePois, focusedPoiId, ready]);

  // Lentilles Pente et Surface (expert) : la ligne prend la couleur de la donnée, « inconnu » reste gris.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const showLens = effLens !== 'days';
    if (map.getLayer('rcw-lens-line')) map.setLayoutProperty('rcw-lens-line', 'visibility', showLens ? 'visible' : 'none');
    for (const id of ['rcw-sections-day']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showLens ? 'none' : 'visible');
    }
    const src = map.getSource('rcw-lens') as GeoJSONSource | undefined;
    if (!src) return;
    if (!showLens) {
      src.setData(EMPTY_FC as never);
      return;
    }
    const segs = effLens === 'slope' ? slopeLensSegments(effSections) : surfaceLensSegments(effSections);
    const tokens = effLens === 'slope' ? SLOPE_COLOR_TOKENS : SURFACE_COLOR_TOKENS;
    src.setData({
      type: 'FeatureCollection',
      features: segs.map((s) => ({
        type: 'Feature',
        properties: { sectionId: s.sectionId, bucket: s.bucket, color: readToken(tokens[s.bucket] ?? tokens.unknown) },
        geometry: { type: 'LineString', coordinates: s.coordinates },
      })),
    });
  }, [effLens, effSections, ready]);

  /* ---------- Cadrage qui suit le tiroir (2.8) ---------- */
  const openStageId = ws
    ? ws.subDrawer === 'stage'
      ? ws.selectedStageId
      : ws.overlayDetail?.kind === 'day'
        ? ws.overlayDetail.stageId
        : null
    : null;
  const fitSignature = `${effPoints.length}/${effSections.length}/${comparedVariant?.id ?? ''}/${fitTrigger}/${openStageId ?? ''}/${sheetHeight}/${legendFocus?.nonce ?? 0}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const stageId = legendFocus?.stageId ?? openStageId;
    const target = framingTarget({ points: effPoints, sections: effSections, stages: effStages }, stageId);
    const coords = target.coords.slice();
    for (const r of comparedVariant?.replacements ?? []) for (const c of r.geometry.coordinates) coords.push([c[0], c[1]]);
    const b = boundsOf(coords);
    const h = containerRef.current?.clientHeight ?? 0;
    const duration = animationDuration(350, prefersReducedMotion());
    const pad = framePadding(h, sheetHeight);
    if (!b) return;
    if (b.minLon < b.maxLon || b.minLat < b.maxLat) {
      const bounds: LngLatBoundsLike = [
        [b.minLon, b.minLat],
        [b.maxLon, b.maxLat],
      ];
      map.fitBounds(bounds, { padding: pad, maxZoom: 15, duration });
    } else if (effPoints.length > 0) {
      map.easeTo({ center: [b.minLon, b.minLat], zoom: Math.max(map.getZoom(), 13), offset: focusOffsetPx(sheetHeight, h), duration });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignature, ready]);

  // Glissement doux vers le point ou POI sélectionné depuis le tiroir, au milieu de la partie visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusCoord) return;
    const h = containerRef.current?.clientHeight ?? 0;
    map.easeTo({
      center: focusCoord,
      offset: focusOffsetPx(sheetHeight, h),
      duration: animationDuration(320, prefersReducedMotion()),
    });
    // La hauteur du tiroir ne doit pas relancer ce glissement : elle relance le cadrage ci-dessus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCoord, ready]);

  // Curseur du profil ou point survolé : un seul point rouge sur le tracé (2.6)
  const profileReadout = ws?.profileReadout ?? null;
  const cursorCoord = useMemo<[number, number] | null>(
    () => hoveredCoord ?? (profileReadout ? [profileReadout.lon, profileReadout.lat] : null),
    [hoveredCoord, profileReadout],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('rcw-hover') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: cursorCoord
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: cursorCoord } }]
        : [],
    });
  }, [cursorCoord, ready]);

  /* ---------- Position en direct (2.9) ---------- */
  const firstFixRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    const ml = maplibreRef.current;
    if (!map || !ml || !ready) return;
    if (live.state !== 'on' || !live.fix) {
      if (live.state === 'off') {
        liveMarkerRef.current?.remove();
        liveMarkerRef.current = null;
        firstFixRef.current = true;
      }
      return;
    }
    const { lat, lon, heading } = live.fix;
    if (!liveMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'rcw-live-dot';
      el.setAttribute('aria-hidden', 'true');
      liveMarkerRef.current = new ml.Marker({ element: el, rotationAlignment: 'map' }).setLngLat([lon, lat]).addTo(map);
    }
    const marker = liveMarkerRef.current;
    marker.setLngLat([lon, lat]);
    const el = marker.getElement();
    el.dataset.heading = heading != null ? 'true' : 'false';
    marker.setRotation(heading ?? 0);
    if (firstFixRef.current) {
      firstFixRef.current = false;
      map.easeTo({
        center: [lon, lat],
        zoom: Math.max(map.getZoom(), 14),
        offset: focusOffsetPx(sheetHeight, containerRef.current?.clientHeight ?? 0),
        duration: animationDuration(400, prefersReducedMotion()),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.state, live.fix, ready]);

  /* ---------- Dessin libre au doigt / souris ---------- */
  const updateLiveDraw = (pts: LngLat[]) => {
    const src = mapRef.current?.getSource('rcw-live-draw') as GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features:
        pts.length >= 2
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }]
          : [],
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingMode || !canEdit || !mapRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lngLat = mapRef.current.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    const pt: LngLat = [Number(lngLat.lng.toFixed(5)), Number(lngLat.lat.toFixed(5))];
    strokeRef.current = { pointerId: e.pointerId, points: [pt] };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    updateLiveDraw([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== e.pointerId || !mapRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lngLat = mapRef.current.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    const pt: LngLat = [Number(lngLat.lng.toFixed(5)), Number(lngLat.lat.toFixed(5))];
    stroke.points.push(pt);
    updateLiveDraw(stroke.points);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== e.pointerId) return;
    strokeRef.current = null;
    updateLiveDraw([]);
    if (stroke.points.length >= 2 && latest.current.onFreehandDrawComplete) {
      const cleaned = smooth(simplify(stroke.points, 0.00025));
      if (cleaned.length >= 2) {
        latest.current.onFreehandDrawComplete(cleaned);
      }
    }
  };

  const onPickRole = (role: PointRole) => {
    const m = menu;
    setMenu(null);
    if (m) place(role, m.lat, m.lon);
  };

  const toggleLayer = useCallback((id: SportLayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const tileInfo = ATLAS_TILES[base];

  return (
    <div
      ref={setRootEl}
      className="xp-map"
      data-testid="route-collab-map"
      data-offline={online ? 'false' : 'true'}
      data-offline-base={offlineBase ? 'true' : 'false'}
      data-lens={effLens}
      style={{
        ...(drawingMode ? { cursor: 'crosshair', touchAction: 'none' } : null),
        ['--rcw-sheet-h' as string]: `${sheetHeight}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {ws ? (
        <MapOverlays
          lens={effLens}
          onLens={setLens}
          lensLegend={lensLegend}
          legendDays={legendDays}
          onFocusStage={(stageId) => {
            ws.setSelectedStageId(stageId);
            setLegendFocus({ stageId, nonce: (legendFocus?.nonce ?? 0) + 1 });
          }}
          activeLayers={activeLayers}
          onToggleLayer={toggleLayer}
          live={live}
          dragInfo={dragInfo}
          startKind={startKind}
        />
      ) : null}
      {menu ? (
        <PointRoleMenu
          x={menu.x}
          y={menu.y}
          width={containerRef.current?.clientWidth ?? 320}
          height={containerRef.current?.clientHeight ?? 480}
          onPick={onPickRole}
          onClose={() => setMenu(null)}
        />
      ) : null}
      <div
        className="xp-attribution"
        aria-hidden="true"
        style={{ top: 'auto', bottom: 8, pointerEvents: 'none' }}
      >
        {offlineBase ? OPENFREEMAP_CREDIT.short : tileInfo.short}
      </div>
    </div>
  );
}

export default RouteCollabMap;
