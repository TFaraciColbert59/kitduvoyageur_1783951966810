'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Bike,
  Bookmark,
  Compass,
  Download,
  Eye,
  EyeOff,
  Footprints,
  Loader2,
  MapPin,
  Mountain,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Route,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import {
  ebikeSupportedForSport,
  ROUTE_SPORTS,
  SURFACE_PREFERENCES,
  type RouteRoutingOptions,
  type RouteSport,
  type SurfacePreference,
} from '@/features/adventure-prep/routeProfiles';
import {
  appendRoutePoint,
  applyRouteShapeMode,
  createRouteDraft,
  defaultSpeedKmHForSport,
  estimateDurationMinutesForSpeed,
  gpxFromRouteDraft,
  insertRoutePointOptimal,
  lineStringFromLegs,
  lineStringFromPoints,
  lineStringFromSections,
  manualRouteSection,
  normalizeRoutePoints,
  removePointFromSections,
  removeRoutePoint,
  reorderRoutePoint,
  reverseRouteState,
  routeSectionsCoverPoints,
  routeTotals,
  syncManualSectionsToPoints,
  updateRoutePointMeta,
  type RouteDraft,
  type RouteGeometry,
  type RouteRevisionPoint,
  type RouteSection,
  type RouteShapeMode,
  type WaypointInsertMode,
  type WaypointSemanticKind,
} from '@/features/adventure-prep/routeRevision';
import type { RouteLeg } from '@/features/adventure-prep/engine/routing';
import {
  deleteSavedRoute,
  loadSavedRoutes,
  saveRouteToLibrary,
  type SavedRouteItem,
} from '@/features/routes/library/routeLibrary';
import { useExplorerStore } from '../state/store';
import { haptic } from '../state/haptics';
import type { MapPin as ExplorerMapPin } from '../map/MapStage';

type PlannerDetent = 'peek' | 'mid' | 'full';

const SPORT_META: Record<RouteSport, { label: string; short: string }> = {
  marche: { label: 'Rando / Marche', short: 'Rando' },
  route: { label: 'Vélo route', short: 'Route' },
  gravel: { label: 'Gravel', short: 'Gravel' },
  vtt: { label: 'VTT', short: 'VTT' },
  enduro: { label: 'Enduro', short: 'Enduro' },
};

const SURFACE_LABELS: Record<SurfacePreference, string> = {
  balanced: 'Équilibré',
  prefer_paved: 'Asphalte',
  prefer_unpaved: 'Chemins',
  prefer_trails: 'Sentiers',
};

const WAYPOINT_TYPES: Array<{ id: WaypointSemanticKind; label: string }> = [
  { id: 'waypoint', label: 'Passage' },
  { id: 'water', label: 'Point d’eau' },
  { id: 'refuge', label: 'Refuge' },
  { id: 'bivouac', label: 'Bivouac' },
  { id: 'viewpoint', label: 'Point de vue' },
  { id: 'summit', label: 'Sommet' },
  { id: 'access', label: 'Accès / Gare' },
  { id: 'danger', label: 'Vigilance' },
];

interface EditorSnapshot {
  sport: RouteSport;
  points: RouteRevisionPoint[];
  sections: RouteSection[];
  options: RouteRoutingOptions;
  shapeMode: RouteShapeMode;
}

interface GeocodeSuggestion {
  label: string;
  lat: number;
  lon: number;
}

export interface ExplorerRoutePlannerHudProps {
  /** Nearby POIs currently loaded in Explorer for 1-tap waypoint insertion. */
  nearbyPois?: ExplorerMapPin[];
  /** Current map center `[lng, lat]` used as default anchor for auto-loop generation. */
  mapCenter: [number, number];
  /** User's GPS coords `[lng, lat]` if known. */
  userCoords?: [number, number] | null;
  /** Called when the user closes the planner HUD to return to Explore mode. */
  onClose: () => void;
  /** Called when the user launches the drafted route into Pre-Flight / GPS guidance. */
  onLaunchGuidance: (draft: RouteDraft, title: string) => void;
  /** Called to fly camera to a newly selected/generated point. */
  onFocusCoords?: (coords: [number, number], zoom?: number) => void;
}

function nextPlannerDetent(current: PlannerDetent): PlannerDetent {
  if (current === 'peek') return 'mid';
  if (current === 'mid') return 'full';
  return 'peek';
}

function resolvePlannerDragDetent(
  current: PlannerDetent,
  deltaY: number,
  velocityY: number,
): PlannerDetent {
  const pulledUp = deltaY < -36 || velocityY < -0.4;
  const pulledDown = deltaY > 36 || velocityY > 0.4;
  if (pulledUp) {
    if (current === 'peek') return deltaY < -190 ? 'full' : 'mid';
    return 'full';
  }
  if (pulledDown) {
    if (current === 'full') return deltaY > 210 ? 'peek' : 'mid';
    return 'peek';
  }
  return current;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '0 min';
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Apple Liquid Glass Route Planner HUD fused directly into Explorer.
 * Toggled by the top-right Pencil button (`mode === 'PLAN'`) over the exact same
 * 3D MapLibre canvas — swaps the Explore HUD cleanly into a 3-detent route studio.
 */
export function ExplorerRoutePlannerHud({
  nearbyPois = [],
  mapCenter,
  userCoords = null,
  onClose,
  onLaunchGuidance,
  onFocusCoords,
}: ExplorerRoutePlannerHudProps) {
  const storeDraft = useExplorerStore((s) => s.plannerDraft ?? null);
  const storeTitle = useExplorerStore((s) => s.plannerTitle ?? '');
  const storeLibraryId = useExplorerStore((s) => s.plannerLibraryId ?? null);
  const storeMapPick = useExplorerStore((s) => s.plannerMapPick ?? true);
  const storeLineHidden = useExplorerStore((s) => s.plannerLineHidden ?? false);
  const storeRoutingOptions = useExplorerStore((s) => s.plannerRoutingOptions);

  const [detent, setDetent] = useState<PlannerDetent>('peek');
  const [title, setTitle] = useState<string>(() => storeTitle.trim() || 'Nouvel itinéraire');
  const [libraryId, setLibraryId] = useState<string | null>(() =>
    storeLibraryId === '__open__' ? null : storeLibraryId,
  );
  const [sport, setSport] = useState<RouteSport>(() => storeDraft?.sport ?? 'marche');
  const [points, setPoints] = useState<RouteRevisionPoint[]>(() =>
    storeDraft?.points?.length ? storeDraft.points : [],
  );
  const [sections, setSections] = useState<RouteSection[]>(() => storeDraft?.sections ?? []);
  const [geometry, setGeometry] = useState<RouteGeometry | null>(
    () => storeDraft?.geometry ?? null,
  );
  const [distanceKm, setDistanceKm] = useState<number | null>(() => storeDraft?.distanceKm ?? null);
  const [durationMin, setDurationMin] = useState<number | null>(
    () => storeDraft?.durationMin ?? null,
  );
  const [provider, setProvider] = useState<string | null>(() => storeDraft?.provider ?? null);
  const [options, setOptions] = useState<RouteRoutingOptions>(() => storeRoutingOptions ?? {});
  const [shapeMode, setShapeMode] = useState<RouteShapeMode>('one_way');
  const [insertMode, setInsertMode] = useState<WaypointInsertMode>('append');
  const [speedKmH, setSpeedKmH] = useState<number>(() =>
    defaultSpeedKmHForSport(storeDraft?.sport ?? 'marche', false),
  );
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [editingMetaIndex, setEditingMetaIndex] = useState<number | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<GeocodeSuggestion[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<SavedRouteItem[]>(() => loadSavedRoutes());
  const [activeSubPanel, setActiveSubPanel] = useState<'none' | 'library' | 'loop' | 'prefs'>(() =>
    storeLibraryId === '__open__' ? 'library' : 'none',
  );
  const [loopKm, setLoopKm] = useState<number>(10);
  const [loopBearing, setLoopBearing] = useState<number>(45);
  const [loopBusy, setLoopBusy] = useState(false);

  // Sync mobile bottom nav visibility: visible in peek/mid, hidden in full
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (detent === 'full') {
      document.documentElement.setAttribute('data-explorer-hide-bottom-bar', '1');
    } else {
      document.documentElement.removeAttribute('data-explorer-hide-bottom-bar');
    }
    return () => {
      document.documentElement.removeAttribute('data-explorer-hide-bottom-bar');
    };
  }, [detent]);

  // Grabber pointer drag state (same smooth spring gesture as ExplorerGpsDrawer)
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocityY: number;
    moved: boolean;
  } | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const handleGrabberPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      velocityY: 0,
      moved: false,
    };
  }, []);

  const handleGrabberPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    const dy = e.clientY - drag.lastY;
    drag.velocityY = dy / dt;
    drag.lastY = e.clientY;
    drag.lastT = now;
    const totalDelta = e.clientY - drag.startY;
    if (Math.abs(totalDelta) > 6) drag.moved = true;
    const clamped = Math.max(-90, Math.min(90, totalDelta * 0.45));
    setDragOffsetY(clamped);
  }, []);

  const handleGrabberPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragOffsetY(0);
      if (!drag.moved) {
        haptic('tab');
        setDetent((cur) => nextPlannerDetent(cur));
        return;
      }
      const totalDelta = e.clientY - drag.startY;
      const next = resolvePlannerDragDetent(detent, totalDelta, drag.velocityY);
      if (next !== detent) haptic('tab');
      setDetent(next);
    },
    [detent],
  );

  const pushHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev.slice(-19),
      { sport, points, sections, options, shapeMode },
    ]);
    setRedoStack([]);
  }, [options, points, sections, shapeMode, sport]);

  const computeRoute = useCallback(
    async (
      nextPoints: RouteRevisionPoint[],
      nextSport: RouteSport,
      nextOptions: RouteRoutingOptions,
      nextSections: RouteSection[] = sections,
    ) => {
      if (nextPoints.length < 2) {
        setGeometry(nextPoints.length === 1 ? lineStringFromPoints(nextPoints) : null);
        setDistanceKm(null);
        setDurationMin(null);
        setRoutingError(null);
        return;
      }
      setRoutingBusy(true);
      setRoutingError(null);
      try {
        const manualIndexes = new Set(
          nextSections.filter((s) => s.mode === 'manual').map((s) => s.fromIndex),
        );
        const computedSections: RouteSection[] = [];
        let lastProvider: string | null = null;

        let i = 0;
        while (i < nextPoints.length - 1) {
          if (manualIndexes.has(i)) {
            const existing = nextSections.find(
              (s) => s.mode === 'manual' && s.fromIndex === i,
            );
            computedSections.push(
              existing
                ? syncManualSectionsToPoints([existing], nextPoints)[0]
                : manualRouteSection(i, nextPoints[i], nextPoints[i + 1]),
            );
            i += 1;
            continue;
          }
          let end = i + 1;
          while (end < nextPoints.length - 1 && !manualIndexes.has(end)) {
            end += 1;
          }
          const slice = nextPoints.slice(i, end + 1);
          const params = new URLSearchParams({
            points: slice.map((p) => `${p.lon},${p.lat}`).join(';'),
            sport: nextSport,
          });
          if (nextOptions.ebike && ebikeSupportedForSport(nextSport)) params.set('ebike', '1');
          if (nextOptions.surfacePref && nextOptions.surfacePref !== 'balanced') {
            params.set('surfacePref', nextOptions.surfacePref);
          }
          if (nextOptions.avoidSteps) params.set('avoidSteps', '1');
          if (nextOptions.avoidFerries) params.set('avoidFerries', '1');

          const res = await fetch(`/api/route?${params.toString()}`);
          const payload = (await res.json().catch(() => null)) as {
            legs?: RouteLeg[];
            provider?: string;
            reason?: string;
          } | null;

          if (!res.ok || !payload?.legs?.length) {
            setRoutingError(
              payload?.reason === 'off_network'
                ? 'Zone hors sentier — activez le tracé manuel sur ce tronçon.'
                : 'Calcul indisponible sur ce tronçon (ligne directe affichée).',
            );
            const fallbackGeom = lineStringFromPoints(nextPoints);
            setGeometry(fallbackGeom);
            return;
          }
          lastProvider = payload.provider ?? null;
          payload.legs.forEach((leg, legIdx) => {
            const fromIdx = i + legIdx;
            computedSections.push({
              id: `leg-${fromIdx + 1}`,
              mode: 'routed',
              fromIndex: fromIdx,
              toIndex: fromIdx + 1,
              geometry: lineStringFromLegs([leg]),
              distanceKm: leg.distanceKm,
              durationMin: leg.durationMin,
              provider: lastProvider,
            });
          });
          i = end;
        }

        const mergedGeom = routeSectionsCoverPoints(computedSections, nextPoints.length)
          ? lineStringFromSections(computedSections)
          : lineStringFromPoints(nextPoints);
        const totalDist = computedSections.reduce((sum, sec) => sum + sec.distanceKm, 0);
        const hasManual = computedSections.some((sec) => sec.mode === 'manual');
        const totals = hasManual
          ? null
          : routeTotals(
              computedSections.map((sec) => ({
                distanceKm: sec.distanceKm,
                durationMin: sec.durationMin ?? 0,
                geometry: sec.geometry.coordinates,
              })),
            );
        setSections(computedSections);
        setGeometry(mergedGeom);
        setDistanceKm(Number(totalDist.toFixed(2)));
        setDurationMin(totals ? Math.round(totals.durationMin) : null);
        setProvider(lastProvider);
      } catch {
        setRoutingError('Réseau indisponible pour le calcul d’itinéraire.');
      } finally {
        setRoutingBusy(false);
      }
    },
    [sections],
  );

  // Sync live draft back to ExplorerStore so MapStage renders line + numbered markers immediately
  useEffect(() => {
    const geom =
      geometry ??
      (points.length >= 2
        ? lineStringFromPoints(points)
        : { type: 'LineString' as const, coordinates: [] });
    const draft: RouteDraft =
      points.length >= 2
        ? createRouteDraft({
            tripId: libraryId ?? 'explorer-planner',
            sport,
            points,
            geometry: geom,
            sections: routeSectionsCoverPoints(sections, points.length) ? sections : undefined,
            distanceKm,
            durationMin,
            provider,
            previous: useExplorerStore.getState().plannerDraft ?? null,
          })
        : {
            id: libraryId ?? 'explorer-planner',
            version: 1,
            sport,
            engine: 'lkdv-route-editor/2',
            savedAt: '',
            points,
            geometry: geom,
            sections: [],
            distanceKm: null,
            durationMin: null,
            provider: null,
            warnings: [],
          };
    useExplorerStore.getState().patch({ plannerDraft: draft, plannerTitle: title });
  }, [points, sections, geometry, sport, distanceKm, durationMin, provider, title, libraryId]);

  const addWaypoint = useCallback(
    (lat: number, lon: number, meta?: Partial<RouteRevisionPoint>) => {
      if (points.length >= 12) {
        useExplorerStore.getState().showToast({
          title: 'Maximum 12 étapes atteintes',
          sub: 'Supprimez un point pour en ajouter un autre.',
          tone: 'warn',
        });
        return;
      }
      pushHistory();
      const nextPoints =
        insertMode === 'optimal' && points.length >= 2
          ? insertRoutePointOptimal(points, lat, lon, meta)
          : appendRoutePoint(points, lat, lon, meta);
      setPoints(nextPoints);
      if (nextPoints.length >= 2) {
        void computeRoute(nextPoints, sport, options, []);
      }
    },
    [computeRoute, insertMode, options, points, pushHistory, sport],
  );

  // Direct tap-on-map listener wired to MapStage onMapClick
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ lat?: number; lon?: number }>).detail;
      if (detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lon)) {
        addWaypoint(detail.lat!, detail.lon!);
      }
    };
    window.addEventListener('lkdv:planner-map-pick', handler);
    return () => window.removeEventListener('lkdv:planner-map-pick', handler);
  }, [addWaypoint]);

  const handleSearchPlace = useCallback(async () => {
    const q = placeQuery.trim();
    if (q.length < 2) return;
    setSearchingPlace(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setPlaceResults([]);
        return;
      }
      const json = (await res.json()) as {
        matches?: Array<{ label?: string; name?: string; lat: number; lon: number }>;
      };
      setPlaceResults(
        (json.matches ?? []).slice(0, 5).map((m) => ({
          label: m.label ?? m.name ?? `${m.lat.toFixed(3)}, ${m.lon.toFixed(3)}`,
          lat: m.lat,
          lon: m.lon,
        })),
      );
    } catch {
      setPlaceResults([]);
    } finally {
      setSearchingPlace(false);
    }
  }, [placeQuery]);

  const handleGenerateLoop = useCallback(async () => {
    haptic('activity-start');
    const anchor = points[0]
      ? { lat: points[0].lat, lon: points[0].lon }
      : userCoords
        ? { lat: userCoords[1], lon: userCoords[0] }
        : { lat: mapCenter[1], lon: mapCenter[0] };
    setLoopBusy(true);
    setRoutingError(null);
    try {
      const res = await fetch('/api/explorer/v2/routes/loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: anchor.lat,
          lng: anchor.lon,
          sport,
          targetDistanceKm: loopKm,
          bearingDeg: loopBearing,
          ebike: options.ebike,
          surfacePref: options.surfacePref,
          avoidSteps: options.avoidSteps,
          avoidFerries: options.avoidFerries,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        status?: string;
        geometry?: RouteGeometry;
        waypoints?: Array<{ lat: number; lon: number; name?: string }>;
        actualDistanceKm?: number;
        durationMin?: number;
        provider?: string;
      } | null;
      if (!res.ok || !json || json.status !== 'ready' || !json.geometry) {
        setRoutingError('Aucune boucle routable trouvée ici — déplacez la carte ou réduisez la distance.');
        return;
      }
      pushHistory();
      const nextPoints = normalizeRoutePoints(json.waypoints ?? []);
      setPoints(nextPoints);
      setGeometry(json.geometry);
      setShapeMode('loop');
      setDistanceKm(json.actualDistanceKm ?? null);
      setDurationMin(json.durationMin ?? null);
      setProvider(json.provider ?? null);
      setSections([]);
      onFocusCoords?.([anchor.lon, anchor.lat], 12.5);
      useExplorerStore.getState().showToast({
        title: `Boucle ${json.actualDistanceKm ? json.actualDistanceKm.toFixed(1) : loopKm} km générée`,
        sub: SPORT_META[sport].label,
        tone: 'good',
      });
    } catch {
      setRoutingError('Impossible de générer la boucle pour le moment.');
    } finally {
      setLoopBusy(false);
    }
  }, [loopBearing, loopKm, mapCenter, onFocusCoords, options, points, pushHistory, sport, userCoords]);

  const handleUndo = useCallback(() => {
    const prev = history[history.length - 1];
    if (!prev) return;
    haptic('tab');
    setRedoStack((r) => [...r, { sport, points, sections, options, shapeMode }]);
    setHistory((h) => h.slice(0, -1));
    setSport(prev.sport);
    setPoints(prev.points);
    setSections(prev.sections);
    setOptions(prev.options);
    setShapeMode(prev.shapeMode);
    if (prev.points.length >= 2) {
      void computeRoute(prev.points, prev.sport, prev.options, prev.sections);
    } else {
      setGeometry(prev.points.length === 1 ? lineStringFromPoints(prev.points) : null);
      setDistanceKm(null);
      setDurationMin(null);
    }
  }, [computeRoute, history, options, points, sections, shapeMode, sport]);

  const handleRedo = useCallback(() => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    haptic('tab');
    setHistory((h) => [...h, { sport, points, sections, options, shapeMode }]);
    setRedoStack((r) => r.slice(0, -1));
    setSport(next.sport);
    setPoints(next.points);
    setSections(next.sections);
    setOptions(next.options);
    setShapeMode(next.shapeMode);
    if (next.points.length >= 2) {
      void computeRoute(next.points, next.sport, next.options, next.sections);
    } else {
      setGeometry(next.points.length === 1 ? lineStringFromPoints(next.points) : null);
      setDistanceKm(null);
      setDurationMin(null);
    }
  }, [computeRoute, options, points, redoStack, sections, shapeMode, sport]);

  const handleClear = useCallback(() => {
    if (points.length === 0) return;
    haptic('tab');
    pushHistory();
    setPoints([]);
    setSections([]);
    setGeometry(null);
    setDistanceKm(null);
    setDurationMin(null);
    setRoutingError(null);
  }, [points.length, pushHistory]);

  const etaForSpeed = useMemo(
    () => estimateDurationMinutesForSpeed(distanceKm, speedKmH, 0, sport, Boolean(options.ebike)),
    [distanceKm, options.ebike, speedKmH, sport],
  );

  const displayedDurationMin = etaForSpeed ?? durationMin;

  const buildCurrentDraft = useCallback((): RouteDraft => {
    return createRouteDraft({
      tripId: libraryId ?? 'explorer-planner',
      sport,
      points,
      geometry: geometry ?? lineStringFromPoints(points),
      sections: routeSectionsCoverPoints(sections, points.length) ? sections : undefined,
      distanceKm,
      durationMin: displayedDurationMin,
      provider,
      previous: useExplorerStore.getState().plannerDraft ?? null,
    });
  }, [displayedDurationMin, distanceKm, geometry, libraryId, points, provider, sections, sport]);

  const handleSaveCurrent = useCallback(() => {
    if (points.length < 2) {
      useExplorerStore.getState().showToast({
        title: 'Ajoutez au moins 2 points',
        sub: 'Touchez la carte pour poser un départ et une arrivée.',
        tone: 'warn',
      });
      return;
    }
    haptic('activity-start');
    const draft = buildCurrentDraft();
    const nextList = saveRouteToLibrary({
      id: libraryId ?? undefined,
      name: title.trim() || 'Itinéraire personnel',
      sourceType: 'created',
      draft,
      routingOptions: options,
      shapeMode,
      speedKmH,
      lineHidden: storeLineHidden,
    });
    setLibraryItems(nextList);
    if (!libraryId && nextList[0]) setLibraryId(nextList[0].id);
    useExplorerStore.getState().showToast({
      title: 'Itinéraire enregistré',
      sub: 'Retrouvez-le dans Mes parcours.',
      tone: 'good',
    });
  }, [buildCurrentDraft, libraryId, options, points.length, shapeMode, speedKmH, storeLineHidden, title]);

  const handleExportGpx = useCallback(() => {
    if (points.length < 2) return;
    haptic('tab');
    const gpx = gpxFromRouteDraft(title, points, geometry ?? lineStringFromPoints(points));
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'itineraire').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    useExplorerStore.getState().showToast({ title: 'Fichier GPX téléchargé', tone: 'good' });
  }, [geometry, points, title]);

  const handleLaunch = useCallback(() => {
    if (points.length < 2) return;
    haptic('activity-start');
    const draft = buildCurrentDraft();
    onLaunchGuidance(draft, title.trim() || 'Mon itinéraire');
  }, [buildCurrentDraft, onLaunchGuidance, points.length, title]);

  const handleLoadLibraryItem = useCallback(
    (item: SavedRouteItem) => {
      haptic('tab');
      pushHistory();
      setLibraryId(item.id);
      setTitle(item.name);
      setSport(item.draft.sport);
      setPoints(item.draft.points);
      setSections(item.draft.sections ?? []);
      setGeometry(item.draft.geometry);
      setDistanceKm(item.draft.distanceKm);
      setDurationMin(item.draft.durationMin);
      setProvider(item.draft.provider);
      setOptions(item.routingOptions ?? {});
      setShapeMode(item.shapeMode ?? 'one_way');
      setSpeedKmH(item.speedKmH ?? defaultSpeedKmHForSport(item.draft.sport, false));
      setActiveSubPanel('none');
      const firstPt = item.draft.points[0];
      if (firstPt) onFocusCoords?.([firstPt.lon, firstPt.lat], 12.5);
      useExplorerStore.getState().showToast({ title: `Parcours « ${item.name} » chargé`, tone: 'good' });
    },
    [onFocusCoords, pushHistory],
  );

  const canLaunch = points.length >= 2 && !routingBusy;

  return (
    <motion.section
      className="xp20-planner-hud"
      data-testid="xp20-planner-hud"
      data-detent={detent}
      aria-label="Créateur d’itinéraire sur la carte"
      initial={{ y: 96, opacity: 0 }}
      animate={{ y: dragOffsetY, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
    >
      {/* Grabber Notch (drag or tap to cycle peek → mid → full) */}
      <div
        className="xp20-planner-grab"
        role="button"
        tabIndex={0}
        aria-label={
          detent === 'peek'
            ? 'Déployer le studio itinéraire'
            : detent === 'mid'
              ? 'Ouvrir en plein écran'
              : 'Réduire sur la carte'
        }
        onPointerDown={handleGrabberPointerDown}
        onPointerMove={handleGrabberPointerMove}
        onPointerUp={handleGrabberPointerUp}
        onPointerCancel={handleGrabberPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetent((cur) => nextPlannerDetent(cur));
          }
        }}
      >
        <span aria-hidden="true" />
      </div>

      {/* Always-visible Compact Cockpit Header (peek / mid / full) */}
      <div className="xp20-planner-head">
        <div className="xp20-planner-kpis">
          <div className="xp20-planner-kpi">
            <span className="xp20-planner-kpi-val">
              {routingBusy ? (
                <Loader2 size={14} className="xp20-route-spin" aria-hidden="true" />
              ) : distanceKm != null ? (
                `${distanceKm.toFixed(1)} km`
              ) : (
                '0,0 km'
              )}
            </span>
            <span className="xp20-planner-kpi-lbl">Distance</span>
          </div>
          <span className="xp20-planner-kpi-sep" aria-hidden="true" />
          <div className="xp20-planner-kpi">
            <span className="xp20-planner-kpi-val">{formatDuration(displayedDurationMin)}</span>
            <span className="xp20-planner-kpi-lbl">Durée</span>
          </div>
          <span className="xp20-planner-kpi-sep" aria-hidden="true" />
          <div className="xp20-planner-kpi">
            <span className="xp20-planner-kpi-val">{points.length}</span>
            <span className="xp20-planner-kpi-lbl">{points.length > 1 ? 'Étapes' : 'Étape'}</span>
          </div>
        </div>

        <button
          type="button"
          className="xp20-planner-launch-btn xp20-tactile"
          data-testid="xp20-planner-launch-btn"
          disabled={!canLaunch}
          onClick={handleLaunch}
          aria-label="Lancer le guidage sur cet itinéraire"
        >
          <Play size={14} fill="currentColor" aria-hidden="true" />
          <span>Lancer</span>
        </button>
      </div>

      {/* Quick Action Bar — always reachable with 1 thumb */}
      <div className="xp20-planner-quickbar" role="toolbar" aria-label="Outils de tracé rapides">
        <button
          type="button"
          className={`xp20-planner-chip xp20-tactile${storeMapPick ? ' is-active' : ''}`}
          aria-pressed={storeMapPick}
          onClick={() => {
            haptic('tab');
            useExplorerStore.getState().patch({ plannerMapPick: !storeMapPick });
          }}
        >
          <MapPin size={13} aria-hidden="true" />
          <span>{storeMapPick ? 'Toucher carte : ON' : 'Toucher carte'}</span>
        </button>

        <button
          type="button"
          className="xp20-planner-icon-btn xp20-tactile"
          disabled={history.length === 0}
          onClick={handleUndo}
          aria-label="Annuler le dernier point"
          title="Annuler"
        >
          <Undo2 size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="xp20-planner-icon-btn xp20-tactile"
          disabled={redoStack.length === 0}
          onClick={handleRedo}
          aria-label="Rétablir"
          title="Rétablir"
        >
          <Redo2 size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`xp20-planner-chip xp20-tactile${loopBusy ? ' is-active' : ''}`}
          disabled={loopBusy}
          onClick={() => void handleGenerateLoop()}
          title="Générer une boucle automatique autour de la carte"
        >
          {loopBusy ? (
            <Loader2 size={13} className="xp20-route-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={13} aria-hidden="true" />
          )}
          <span>Boucle</span>
        </button>

        <button
          type="button"
          className="xp20-planner-icon-btn xp20-tactile"
          disabled={points.length < 2}
          onClick={handleSaveCurrent}
          aria-label="Enregistrer cet itinéraire"
          title="Enregistrer"
        >
          <Save size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="xp20-planner-icon-btn xp20-tactile"
          disabled={points.length === 0}
          onClick={handleClear}
          aria-label="Effacer le tracé"
          title="Effacer"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="xp20-planner-icon-btn xp20-tactile"
          onClick={() => {
            haptic('tab');
            setDetent((cur) => (cur === 'peek' ? 'mid' : cur === 'mid' ? 'full' : 'peek'));
          }}
          aria-label={detent === 'peek' ? 'Plus d’options' : 'Ajuster la hauteur'}
          title="Options & étapes"
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
        </button>
      </div>

      {routingError ? (
        <div className="xp20-planner-alert" role="alert">
          {routingError}
        </div>
      ) : null}

      {/* Scrollable Body (revealed in mid & full detents) */}
      {detent !== 'peek' ? (
        <div className="xp20-planner-body">
          {/* Title + Quick Actions (Library / GPX / Hide Line) */}
          <div className="xp20-planner-title-row">
            <input
              type="text"
              className="xp20-planner-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de votre itinéraire"
              aria-label="Nom de l’itinéraire"
            />
            <button
              type="button"
              className={`xp20-planner-icon-btn xp20-tactile${activeSubPanel === 'library' ? ' is-active' : ''}`}
              onClick={() =>
                setActiveSubPanel((p) => (p === 'library' ? 'none' : 'library'))
              }
              aria-label={`Mes parcours enregistrés (${libraryItems.length})`}
              title="Mes parcours"
            >
              <Bookmark size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="xp20-planner-icon-btn xp20-tactile"
              disabled={points.length < 2}
              onClick={handleExportGpx}
              aria-label="Exporter en GPX"
              title="Exporter GPX"
            >
              <Download size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`xp20-planner-icon-btn xp20-tactile${storeLineHidden ? ' is-active' : ''}`}
              onClick={() =>
                useExplorerStore.getState().patch({ plannerLineHidden: !storeLineHidden })
              }
              aria-label={storeLineHidden ? 'Afficher le tracé' : 'Masquer temporairement la ligne'}
              title={storeLineHidden ? 'Afficher la ligne' : 'Masquer la ligne'}
            >
              {storeLineHidden ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>

          {/* Saved Routes Library Panel */}
          {activeSubPanel === 'library' ? (
            <div className="xp20-planner-card">
              <div className="xp20-planner-card-head">
                <strong>Mes parcours ({libraryItems.length})</strong>
                <button
                  type="button"
                  className="xp20-planner-mini-close"
                  onClick={() => setActiveSubPanel('none')}
                  aria-label="Fermer Mes parcours"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
              {libraryItems.length === 0 ? (
                <p className="xp20-planner-empty">
                  Aucun parcours enregistré. Tracez 2 points puis appuyez sur Enregistrer.
                </p>
              ) : (
                <div className="xp20-planner-lib-list">
                  {libraryItems.map((item) => (
                    <div key={item.id} className="xp20-planner-lib-row">
                      <button
                        type="button"
                        className="xp20-planner-lib-open"
                        onClick={() => handleLoadLibraryItem(item)}
                      >
                        <span className="xp20-planner-lib-name">{item.name}</span>
                        <span className="xp20-planner-lib-meta">
                          {SPORT_META[item.draft.sport]?.short ?? item.draft.sport}
                          {item.draft.distanceKm != null
                            ? ` · ${item.draft.distanceKm.toFixed(1)} km`
                            : ''}
                          {' · '}
                          {item.draft.points.length} pts
                        </span>
                      </button>
                      <button
                        type="button"
                        className="xp20-planner-icon-btn"
                        aria-label={`Supprimer ${item.name}`}
                        onClick={() => {
                          setLibraryItems(deleteSavedRoute(item.id));
                          if (libraryId === item.id) setLibraryId(null);
                        }}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Sport Pills + E-Bike */}
          <div className="xp20-planner-section">
            <span className="xp20-planner-eyebrow">Activité de routage</span>
            <div className="xp20-planner-scroll-row" role="radiogroup" aria-label="Activité">
              {ROUTE_SPORTS.map((s) => {
                const active = sport === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`xp20-planner-chip xp20-tactile${active ? ' is-active' : ''}`}
                    onClick={() => {
                      haptic('tab');
                      pushHistory();
                      const nextOpts: RouteRoutingOptions = {
                        ...options,
                        ebike: ebikeSupportedForSport(s) ? options.ebike : false,
                      };
                      setSport(s);
                      setOptions(nextOpts);
                      setSpeedKmH(defaultSpeedKmHForSport(s, Boolean(nextOpts.ebike)));
                      if (points.length >= 2) void computeRoute(points, s, nextOpts, sections);
                    }}
                  >
                    {s === 'marche' ? (
                      <Footprints size={13} aria-hidden="true" />
                    ) : s === 'enduro' ? (
                      <Mountain size={13} aria-hidden="true" />
                    ) : (
                      <Bike size={13} aria-hidden="true" />
                    )}
                    <span>{SPORT_META[s].short}</span>
                  </button>
                );
              })}

              {ebikeSupportedForSport(sport) ? (
                <button
                  type="button"
                  className={`xp20-planner-chip xp20-tactile${options.ebike ? ' is-active' : ''}`}
                  aria-pressed={Boolean(options.ebike)}
                  onClick={() => {
                    haptic('tab');
                    pushHistory();
                    const nextOpts = { ...options, ebike: !options.ebike };
                    setOptions(nextOpts);
                    setSpeedKmH(defaultSpeedKmHForSport(sport, Boolean(nextOpts.ebike)));
                    if (points.length >= 2) void computeRoute(points, sport, nextOpts, sections);
                  }}
                >
                  <Zap size={13} aria-hidden="true" />
                  <span>VAE</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Shape Mode Pills (Aller simple / Boucle / Aller-retour / Inverser) */}
          <div className="xp20-planner-section">
            <span className="xp20-planner-eyebrow">Forme du parcours</span>
            <div className="xp20-planner-scroll-row">
              {(
                [
                  ['one_way', 'Aller simple'],
                  ['loop', 'Fermer boucle'],
                  ['out_and_back', 'Aller-retour'],
                ] as const
              ).map(([modeId, label]) => (
                <button
                  key={modeId}
                  type="button"
                  className={`xp20-planner-chip xp20-tactile${shapeMode === modeId ? ' is-active' : ''}`}
                  aria-pressed={shapeMode === modeId}
                  onClick={() => {
                    haptic('tab');
                    pushHistory();
                    setShapeMode(modeId);
                    const nextPoints = applyRouteShapeMode(points, modeId);
                    setPoints(nextPoints);
                    if (nextPoints.length >= 2) void computeRoute(nextPoints, sport, options, []);
                  }}
                >
                  <Route size={12} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}

              <button
                type="button"
                className="xp20-planner-chip xp20-tactile"
                disabled={points.length < 2}
                onClick={() => {
                  haptic('tab');
                  pushHistory();
                  const rev = reverseRouteState(points, sections);
                  setPoints(rev.points);
                  setSections(rev.sections);
                  void computeRoute(rev.points, sport, options, rev.sections);
                }}
              >
                <ArrowLeftRight size={12} aria-hidden="true" />
                <span>Inverser</span>
              </button>
            </div>
          </div>

          {/* Search a place to add as waypoint + Nearby POIs */}
          <div className="xp20-planner-section">
            <span className="xp20-planner-eyebrow">Ajouter une étape</span>
            <div className="xp20-planner-search-row">
              <Search size={14} className="xp20-planner-search-ico" aria-hidden="true" />
              <input
                type="search"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSearchPlace();
                  }
                }}
                placeholder="Col, village, gare, sommet…"
                aria-label="Rechercher un lieu à ajouter à l’itinéraire"
              />
              <button
                type="button"
                className="xp20-planner-search-go xp20-tactile"
                disabled={searchingPlace || placeQuery.trim().length < 2}
                onClick={() => void handleSearchPlace()}
              >
                {searchingPlace ? '…' : 'Ajouter'}
              </button>
            </div>

            {placeResults.length > 0 ? (
              <div className="xp20-planner-results">
                {placeResults.map((res, idx) => (
                  <button
                    key={`${res.lat}-${res.lon}-${idx}`}
                    type="button"
                    className="xp20-planner-result-item"
                    onClick={() => {
                      haptic('pin');
                      addWaypoint(res.lat, res.lon, { name: res.label });
                      onFocusCoords?.([res.lon, res.lat], 13);
                      setPlaceResults([]);
                      setPlaceQuery('');
                    }}
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span>{res.label}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {nearbyPois.length > 0 ? (
              <div className="xp20-planner-scroll-row" aria-label="Repères proches à insérer">
                {nearbyPois.slice(0, 6).map((poi) => (
                  <button
                    key={`planner-poi-${poi.id}`}
                    type="button"
                    className="xp20-planner-chip xp20-tactile"
                    onClick={() => {
                      haptic('pin');
                      addWaypoint(poi.lat, poi.lon, {
                        name: poi.name,
                        semanticKind:
                          poi.kind === 'water' ||
                          poi.kind === 'refuge' ||
                          poi.kind === 'bivouac' ||
                          poi.kind === 'summit' ||
                          poi.kind === 'viewpoint' ||
                          poi.kind === 'access'
                            ? poi.kind
                            : 'waypoint',
                        poiId: String(poi.id),
                      });
                    }}
                  >
                    <Plus size={11} aria-hidden="true" />
                    <span>{poi.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Custom Loop Builder Card */}
          <div className="xp20-planner-card">
            <div className="xp20-planner-card-head">
              <span className="xp20-planner-card-title">
                <Sparkles size={13} aria-hidden="true" />
                Générateur de boucle
              </span>
              <span className="xp20-planner-card-val">{loopKm} km</span>
            </div>
            <div className="xp20-planner-loop-controls">
              <input
                type="range"
                min={2}
                max={100}
                step={1}
                value={loopKm}
                onChange={(e) => setLoopKm(Number(e.target.value))}
                aria-label="Distance cible de la boucle en kilomètres"
                className="xp20-planner-range"
              />
              <div className="xp20-planner-loop-row">
                <div className="xp20-planner-bearing-pills" role="radiogroup" aria-label="Direction">
                  {(
                    [
                      [0, 'N'],
                      [90, 'E'],
                      [180, 'S'],
                      [270, 'O'],
                    ] as const
                  ).map(([deg, label]) => (
                    <button
                      key={deg}
                      type="button"
                      role="radio"
                      aria-checked={loopBearing === deg}
                      className={`xp20-planner-bearing-btn${loopBearing === deg ? ' is-active' : ''}`}
                      onClick={() => setLoopBearing(deg)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="xp20-planner-loop-go xp20-tactile"
                  disabled={loopBusy}
                  onClick={() => void handleGenerateLoop()}
                >
                  <Compass size={13} aria-hidden="true" />
                  <span>{loopBusy ? 'Calcul…' : 'Générer'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Routing Options & Pace Estimator */}
          <div className="xp20-planner-card">
            <div className="xp20-planner-card-head">
              <span className="xp20-planner-card-title">Revêtement &amp; allure</span>
              <span className="xp20-planner-card-val">{speedKmH.toFixed(1)} km/h</span>
            </div>
            <div className="xp20-planner-scroll-row">
              {SURFACE_PREFERENCES.map((pref) => (
                <button
                  key={pref}
                  type="button"
                  className={`xp20-planner-chip${(options.surfacePref ?? 'balanced') === pref ? ' is-active' : ''}`}
                  onClick={() => {
                    pushHistory();
                    const nextOpts = { ...options, surfacePref: pref };
                    setOptions(nextOpts);
                    if (points.length >= 2) void computeRoute(points, sport, nextOpts, sections);
                  }}
                >
                  {SURFACE_LABELS[pref]}
                </button>
              ))}
            </div>
            <div className="xp20-planner-toggles">
              <label className="xp20-planner-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(options.avoidSteps)}
                  onChange={(e) => {
                    pushHistory();
                    const nextOpts = { ...options, avoidSteps: e.target.checked };
                    setOptions(nextOpts);
                    if (points.length >= 2) void computeRoute(points, sport, nextOpts, sections);
                  }}
                />
                <span>Éviter escaliers</span>
              </label>
              <label className="xp20-planner-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(options.avoidFerries)}
                  onChange={(e) => {
                    pushHistory();
                    const nextOpts = { ...options, avoidFerries: e.target.checked };
                    setOptions(nextOpts);
                    if (points.length >= 2) void computeRoute(points, sport, nextOpts, sections);
                  }}
                />
                <span>Éviter ferries</span>
              </label>
              <button
                type="button"
                className="xp20-planner-chip"
                onClick={() =>
                  setInsertMode((m) => (m === 'append' ? 'optimal' : 'append'))
                }
              >
                {insertMode === 'append' ? 'Insertion : fin' : 'Insertion : auto'}
              </button>
            </div>
            <input
              type="range"
              min={2}
              max={35}
              step={0.5}
              value={speedKmH}
              onChange={(e) => setSpeedKmH(Number(e.target.value))}
              aria-label="Ajuster la vitesse estimée"
              className="xp20-planner-range"
            />
          </div>

          {/* Waypoints List */}
          <div className="xp20-planner-section">
            <div className="xp20-planner-card-head">
              <span className="xp20-planner-eyebrow">Étapes ({points.length}/12)</span>
              {points.length >= 2 ? (
                <button
                  type="button"
                  className="xp20-planner-mini-link"
                  onClick={() => void computeRoute(points, sport, options, sections)}
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  Recalculer
                </button>
              ) : null}
            </div>

            {points.length === 0 ? (
              <p className="xp20-planner-empty">
                Touchez directement la carte 3D ci-dessus pour poser votre départ, ou lancez une boucle automatique.
              </p>
            ) : (
              <div className="xp20-planner-pts">
                {points.map((pt, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === points.length - 1 && points.length > 1;
                  const isManualNext = sections.some(
                    (s) => s.fromIndex === idx && s.mode === 'manual',
                  );
                  return (
                    <div key={pt.id} className="xp20-planner-pt">
                      <div className="xp20-planner-pt-row">
                        <span
                          className={`xp20-planner-pt-badge${isFirst ? ' is-start' : isLast ? ' is-end' : ''}`}
                        >
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          className="xp20-planner-pt-label"
                          onClick={() =>
                            setEditingMetaIndex(editingMetaIndex === idx ? null : idx)
                          }
                        >
                          <strong>
                            {pt.name ||
                              (isFirst ? 'Départ' : isLast ? 'Arrivée' : `Étape ${idx + 1}`)}
                          </strong>
                          <span>
                            {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                          </span>
                        </button>
                        <div className="xp20-planner-pt-actions">
                          <button
                            type="button"
                            className="xp20-planner-mini-btn"
                            disabled={idx === 0}
                            aria-label={`Monter l’étape ${idx + 1}`}
                            onClick={() => {
                              pushHistory();
                              const next = reorderRoutePoint(points, idx, idx - 1);
                              setPoints(next);
                              void computeRoute(next, sport, options, []);
                            }}
                          >
                            <ArrowUp size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="xp20-planner-mini-btn"
                            disabled={idx === points.length - 1}
                            aria-label={`Descendre l’étape ${idx + 1}`}
                            onClick={() => {
                              pushHistory();
                              const next = reorderRoutePoint(points, idx, idx + 1);
                              setPoints(next);
                              void computeRoute(next, sport, options, []);
                            }}
                          >
                            <ArrowDown size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="xp20-planner-mini-btn"
                            aria-label={`Supprimer l’étape ${idx + 1}`}
                            onClick={() => {
                              pushHistory();
                              const nextPoints = removeRoutePoint(points, idx);
                              const nextSections = removePointFromSections(sections, idx);
                              setPoints(nextPoints);
                              setSections(nextSections);
                              void computeRoute(nextPoints, sport, options, nextSections);
                            }}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {editingMetaIndex === idx ? (
                        <div className="xp20-planner-pt-edit">
                          <input
                            type="text"
                            value={pt.name ?? ''}
                            onChange={(e) =>
                              setPoints((prev) =>
                                updateRoutePointMeta(prev, idx, { name: e.target.value }),
                              )
                            }
                            placeholder="Nom de l’étape"
                          />
                          <select
                            value={pt.semanticKind ?? 'waypoint'}
                            onChange={(e) =>
                              setPoints((prev) =>
                                updateRoutePointMeta(prev, idx, {
                                  semanticKind: e.target.value as WaypointSemanticKind,
                                }),
                              )
                            }
                          >
                            {WAYPOINT_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {idx < points.length - 1 ? (
                        <button
                          type="button"
                          className={`xp20-planner-manual-btn${isManualNext ? ' is-manual' : ''}`}
                          aria-pressed={isManualNext}
                          onClick={() => {
                            pushHistory();
                            const nextSections = sections.slice();
                            const existingIdx = nextSections.findIndex((s) => s.fromIndex === idx);
                            if (isManualNext) {
                              if (existingIdx >= 0) nextSections.splice(existingIdx, 1);
                            } else {
                              const manual = manualRouteSection(idx, points[idx], points[idx + 1]);
                              if (existingIdx >= 0) nextSections[existingIdx] = manual;
                              else nextSections.push(manual);
                            }
                            setSections(nextSections);
                            void computeRoute(points, sport, options, nextSections);
                          }}
                        >
                          {isManualNext ? 'Tronçon manuel (ligne directe)' : 'Passer ce tronçon en manuel'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Quit Row inside Full/Mid */}
          <div className="xp20-planner-foot">
            <button
              type="button"
              className="xp20-planner-quit-btn xp20-tactile"
              onClick={onClose}
            >
              <X size={14} aria-hidden="true" />
              <span>Quitter l’éditeur</span>
            </button>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

export default ExplorerRoutePlannerHud;
