'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  SMOOTH_MAPLIBRE_OPTIONS,
  applySmoothMapPhysics,
  createMapStyle,
} from '@/components/map/engine/createMapStyle';
import {
  ArrowLeftRight,
  Check,
  Download,
  Loader2,
  Magnet,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Navigation,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Route,
  Search,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { Reorder } from 'framer-motion';
import { toast } from 'sonner';
import { useFormContext } from 'react-hook-form';
import {
  elevationGain,
  haversineKm,
  joinLines,
  joinSegments,
  lengthKm,
  pickWaypoints,
  removeSpurs,
  sampleAlong,
  simplify,
  smooth,
  type LngLat,
} from '@/features/community/create/carnet/traceEngine';
import {
  createTraceHistory,
  deleteTraceSegment,
  moveTracePoint,
  traceCommit,
  traceRedo,
  traceSegmentCount,
  traceUndo,
  type TraceHistory,
} from '../../shared/traceEditing';
import { createClient } from '@/lib/supabase/client';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetDayV2, CarnetFormValuesV2 } from '../engine/createSchemasV2';
import { parseGeoJsonTrace, readTraceFile } from './gpx';
import {
  carnetDayDateV2,
  carnetEndDateForDaysV2,
  normalizeCarnetDayV2,
  syncCarnetDaysV2,
} from './daySync';
import { dayTraceColor } from './dayTraceColors';

const DEFAULT_CENTER: [number, number] = [6.87, 45.92];
const MAX_POINTS = 2000;
const SAMPLE_PX = 5;
const WAYPOINT_PX = 14;
const ROUTE_MAX_POINTS = 8;
const MIN_ROUTE_M = 12;
const MAX_STROKE_KM = 35;
const MAX_DETOUR = 9.0;
const ROUTE_ATTEMPT_TIMEOUT_MS = 4500;
const TAP_MAX_PX = 8;
const ANCHOR_SNAP_PX = 48;
const DAY_LONG_PRESS_MS = 380;

export interface TraceSegmentV2 {
  id: string;
  points: LngLat[];
  mode: 'chemin' | 'libre';
}

interface StrokeState {
  pointerId: number;
  raw: LngLat[];
  snapped: LngLat[];
  pendingFrom: number;
  anchored: boolean;
  magnet: boolean;
  free: boolean;
  routedChunks: number;
  inFlight: AbortController | null;
  ended: boolean;
  pendingPx: number;
  totalPx: number;
  lastPx: [number, number];
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;

/** Couleur d'un jeton CSS, lue au runtime avec repli fiable pour WebGL. */
function cssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function lineFeature(points: LngLat[]) {
  return points.length >= 2
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: points },
      }
    : null;
}

function endsFeature(points: LngLat[]) {
  const features: unknown[] = [];
  if (points[0]) {
    features.push({
      type: 'Feature',
      properties: { kind: 'start' },
      geometry: { type: 'Point', coordinates: points[0] },
    });
  }
  if (points.length > 1) {
    features.push({
      type: 'Feature',
      properties: { kind: 'end' },
      geometry: { type: 'Point', coordinates: points[points.length - 1] },
    });
  }
  return features;
}

/** Segments cliquables : un `LineString` par paire de points (maquette `.seg-hit`). */
function segmentsFeature(points: LngLat[]) {
  const features: unknown[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    features.push({
      type: 'Feature',
      properties: { index },
      geometry: {
        type: 'LineString',
        coordinates: [points[index], points[index + 1]],
      },
    });
  }
  return features;
}

function sameTrace(a: readonly LngLat[], b: readonly LngLat[]): boolean {
  return (
    a.length === b.length &&
    a.every(([lng, lat], index) => b[index]?.[0] === lng && b[index]?.[1] === lat)
  );
}

interface SessionOption {
  id: string;
  title: string | null;
  started_at: string | null;
  positions_geojson: string | null;
}

/**
 * Tracé du carnet (`Carnet#6-10`) sur la **vraie carte topo MapLibre** de la
 * pile existante (`createMapStyle('topo')`, worker local, une seule instance
 * WebGL) : tracé au doigt, annuler/rétablir, départ et arrivée déplaçables,
 * « Ma position », import GPX ou sortie enregistrée (`hike_sessions`), profil
 * d'altitude réel (`/api/elevation`).
 *
 * FID-051 : les 3 cartes de point de départ de la maquette ouvrent ces gestes.
 * FID-068 : édition du tracé (supprimer un segment, déplacer un point
 * intermédiaire) et historique de 50 pas, partagé avec la suppression dans
 * `shared/traceEditing`.
 */
export interface TracePaneV2Props {
  user: { id: string } | null;
  mode?: 'carnet' | 'sortie';
  onResolveStartAddress?: (label: string) => void;
}

export function TracePaneV2({
  user,
  mode = 'carnet',
  onResolveStartAddress,
}: TracePaneV2Props) {
  const form = useFormContext<CarnetFormValuesV2>();
  const watchedTrace = form.watch('trace');
  const watchedDays = form.watch('days');
  const nbJours = form.watch('nbJours') || 1;
  const watchedStartDate = form.watch('startDate');
  const watchedSortieDate = form.watch('date' as never) as unknown as string | undefined;
  const startDate = watchedStartDate || watchedSortieDate || '';
  const globalTrace = React.useMemo(() => (watchedTrace ?? []) as LngLat[], [watchedTrace]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const ensuredDays = React.useMemo(
    () =>
      watchedDays && watchedDays.length > 0
        ? watchedDays
        : syncCarnetDaysV2([], Math.max(1, nbJours), startDate),
    [nbJours, startDate, watchedDays],
  );
  const safeDayIndex = Math.max(0, Math.min(ensuredDays.length - 1, selectedDayIndex));
  const trace = React.useMemo(() => {
    if (ensuredDays[safeDayIndex]) {
      const dayTrace = (ensuredDays[safeDayIndex].trace ?? []) as LngLat[];
      if (dayTrace.length > 0 || safeDayIndex > 0) return dayTrace;
    }
    return ((ensuredDays[0]?.trace ?? globalTrace) as LngLat[]);
  }, [ensuredDays, globalTrace, safeDayIndex]);
  const watchedStartLat = form.watch('startLat');
  const watchedStartLng = form.watch('startLng');
  const watchedMeetingLat = form.watch('meetingLat' as never) as unknown as number | null | undefined;
  const watchedMeetingLng = form.watch('meetingLng' as never) as unknown as number | null | undefined;
  const startLat = watchedStartLat ?? watchedMeetingLat ?? null;
  const startLng = watchedStartLng ?? watchedMeetingLng ?? null;
  const watchedDestination = form.watch('destination');
  const watchedLocation = form.watch('location' as never) as unknown as string | undefined;
  const destination = watchedDestination || watchedLocation || '';
  const onResolveStartAddressRef = useRef(onResolveStartAddress);
  onResolveStartAddressRef.current = onResolveStartAddress;
  const hadTraceRef = useRef(globalTrace.length >= 2);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);
  const editMarkers = useRef<Marker[]>([]);
  const drawRef = useRef<StrokeState | null>(null);
  const pointersRef = useRef(new Map<number, [number, number]>());
  const pinchRef = useRef<{ cx: number; cy: number; dist: number } | null>(null);
  const liveFrameRef = useRef<number | null>(null);
  const lastAutofocusKey = useRef<string>('');
  const lastGeocodedDestRef = useRef<string>('');
  /**
   * FID-068 — historique **unique** du tracé (50 pas, `shared/traceEditing`) :
   * un geste validé = une entrée (tracé au doigt, import, point déplacé,
   * segment supprimé), jamais une image de pointeur.
   */
  const historyRef = useRef<TraceHistory>(createTraceHistory(trace));
  const drawingRef = useRef(false);
  const magnetRef = useRef(true);
  const traceRef = useRef<LngLat[]>(trace);
  traceRef.current = trace;
  const didInitialCenter = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [magnet, setMagnet] = useState(true);
  magnetRef.current = magnet;
  const [snapState, setSnapState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);
  const [troncons, setTroncons] = useState<TraceSegmentV2[]>(() =>
    trace.length >= 2 ? [{ id: 'init', points: trace, mode: 'chemin' }] : [],
  );
  const tronconsRef = useRef<TraceSegmentV2[]>(troncons);
  tronconsRef.current = troncons;
  const tronconsByTargetRef = useRef<Record<string, TraceSegmentV2[]>>({});
  const prevTargetKeyRef = useRef<string>(selectedDayIndex >= 0 ? `day-${selectedDayIndex}` : 'global');
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [, bumpHistory] = useState(0);
  const [elevations, setElevations] = useState<number[]>([]);
  const [gainState, setGainState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [importOpen, setImportOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionOption[] | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [mapFocused, setMapFocused] = useState(false);
  const [liveDraftKm, setLiveDraftKm] = useState(0);
  const [dayJiggleMode, setDayJiggleMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const traceRootRef = useRef<HTMLDivElement | null>(null);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const dayTabsRef = useRef<HTMLDivElement | null>(null);
  const dayLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const { haptic } = useHapticFeedback();

  const centerAndLockMap = useCallback(() => {
    setMapFocused(true);
    const targetEl = mapWrapRef.current ?? containerRef.current;
    if (!targetEl || typeof targetEl.scrollIntoView !== 'function') return;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      targetEl.scrollIntoView({
        block: 'center',
        behavior: reduced ? 'auto' : 'smooth',
      });
    } catch {
      /* ignore */
    }
  }, []);

  const clearDayLongPress = useCallback(() => {
    if (dayLongPressRef.current) {
      clearTimeout(dayLongPressRef.current);
      dayLongPressRef.current = null;
    }
    dayPointerStartRef.current = null;
  }, []);

  const startDayLongPress = useCallback(
    (e: React.PointerEvent) => {
      if (ensuredDays.length <= 1) return;
      clearDayLongPress();
      dayPointerStartRef.current = { x: e.clientX, y: e.clientY };
      dayLongPressRef.current = setTimeout(() => {
        setDayJiggleMode(true);
        haptic('medium');
        dayLongPressRef.current = null;
      }, DAY_LONG_PRESS_MS);
    },
    [clearDayLongPress, ensuredDays.length, haptic],
  );

  const handleDayPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dayPointerStartRef.current || !dayLongPressRef.current) return;
      const dx = Math.abs(e.clientX - dayPointerStartRef.current.x);
      const dy = Math.abs(e.clientY - dayPointerStartRef.current.y);
      if (dx > 8 || dy > 8) {
        clearDayLongPress();
      }
    },
    [clearDayLongPress],
  );

  useEffect(() => {
    if (!dayJiggleMode) return;
    const onOutsidePointer = (e: PointerEvent) => {
      if (dayTabsRef.current && !dayTabsRef.current.contains(e.target as Node)) {
        setDayJiggleMode(false);
      }
    };
    document.addEventListener('pointerdown', onOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', onOutsidePointer, true);
  }, [dayJiggleMode]);

  useEffect(() => {
    if (ensuredDays.length <= 1 && dayJiggleMode) {
      setDayJiggleMode(false);
    }
  }, [dayJiggleMode, ensuredDays.length]);

  // Sortie du focus carte dès qu'on touche à côté du bloc carte
  useEffect(() => {
    if (!mapFocused && !drawing && !editing) return;
    const onOutsideMapTouch = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (traceRootRef.current && !traceRootRef.current.contains(target)) {
        setMapFocused(false);
        setDrawing(false);
        setEditing(false);
      }
    };
    document.addEventListener('pointerdown', onOutsideMapTouch, true);
    return () => document.removeEventListener('pointerdown', onOutsideMapTouch, true);
  }, [drawing, editing, mapFocused]);

  const applyOrderedDays = useCallback(
    (nextRawDays: CarnetDayV2[], nextSelectedIdx: number) => {
      const renumbered = nextRawDays.map((d, i) => ({
        ...normalizeCarnetDayV2(d),
        dayNumber: i + 1,
        date: carnetDayDateV2(startDate, i),
      }));
      const nextCount = Math.max(1, renumbered.length);
      form.setValue('nbJours', nextCount, { shouldDirty: true, shouldValidate: true });
      form.setValue('days', renumbered, { shouldDirty: true, shouldValidate: true });
      if (startDate) {
        form.setValue('endDate', carnetEndDateForDaysV2(startDate, nextCount), {
          shouldDirty: true,
        });
      }
      const dayTraces = renumbered
        .map((d) => (d.trace ?? []) as LngLat[])
        .filter((pts) => pts.length >= 2);
      if (dayTraces.length > 0) {
        const combined = joinSegments(dayTraces, MAX_POINTS);
        form.setValue('trace', combined, { shouldDirty: true, shouldValidate: true });
      }
      setSelectedDayIndex(nextSelectedIdx);
    },
    [form, startDate],
  );

  const handleReorderDays = useCallback(
    (newOrder: CarnetDayV2[]) => {
      const activeId = selectedDayIndex >= 0 ? ensuredDays[selectedDayIndex]?.id : null;
      const nextIdx = activeId ? newOrder.findIndex((d) => d.id === activeId) : -1;
      applyOrderedDays(newOrder, nextIdx);
      haptic('selection');
    },
    [applyOrderedDays, ensuredDays, haptic, selectedDayIndex],
  );

  const removeDayAt = useCallback(
    (removeIdx: number) => {
      if (ensuredDays.length <= 1) return;
      const filtered = ensuredDays.filter((_, idx) => idx !== removeIdx);
      const nextSelected =
        selectedDayIndex === -1
          ? -1
          : selectedDayIndex >= filtered.length
            ? filtered.length - 1
            : selectedDayIndex > removeIdx
              ? selectedDayIndex - 1
              : selectedDayIndex;
      applyOrderedDays(filtered, nextSelected);
      haptic('medium');
    },
    [applyOrderedDays, ensuredDays, haptic, selectedDayIndex],
  );

  const fitTraceBounds = useCallback((points: readonly LngLat[]) => {
    const map = mapRef.current;
    if (!map || points.length < 2) return;
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    try {
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 14.5, duration: 380 },
      );
    } catch {
      /* ignore */
    }
  }, []);

  // Resynchronise les tronçons et l'historique uniquement quand on change d'onglet
  // (Global / J1 / J2...) ou qu'une trace externe arrive (import GPX, recherche randonnée, effacement).
  useEffect(() => {
    if (drawRef.current) return;
    const targetKey = selectedDayIndex >= 0 ? `day-${selectedDayIndex}` : 'global';
    const joinedCurrent = joinSegments(
      tronconsRef.current.map((item) => item.points),
      MAX_POINTS,
    );
    const tabChanged = prevTargetKeyRef.current !== targetKey;
    const externalTraceChanged = !sameTrace(joinedCurrent, trace);
    if (tabChanged || externalTraceChanged) {
      prevTargetKeyRef.current = targetKey;
      const storedForTab = tronconsByTargetRef.current[targetKey];
      const storedJoined = storedForTab
        ? joinSegments(
            storedForTab.map((item) => item.points),
            MAX_POINTS,
          )
        : [];
      const synced: TraceSegmentV2[] =
        storedForTab && storedForTab.length > 0 && sameTrace(storedJoined, trace)
          ? storedForTab
          : trace.length >= 2
            ? [{ id: `sync-${targetKey}`, points: trace, mode: 'chemin' }]
            : [];
      tronconsByTargetRef.current[targetKey] = synced;
      tronconsRef.current = synced;
      setTroncons(synced);
      setSelectedSegment(null);
      if (!tabChanged && externalTraceChanged && trace.length >= 2) {
        fitTraceBounds(trace);
      }
    }
    if (!sameTrace(historyRef.current.present, trace)) {
      historyRef.current = createTraceHistory(trace);
      bumpHistory((tick) => tick + 1);
    }
  }, [fitTraceBounds, selectedDayIndex, trace]);

  const syncStartCoordinates = useCallback(
    (lng: number, lat: number, resolveAddr = false) => {
      const rLat = Number(lat.toFixed(6));
      const rLng = Number(lng.toFixed(6));
      form.setValue('startLng', rLng, { shouldDirty: true });
      form.setValue('startLat', rLat, { shouldDirty: true });
      if (mode === 'sortie') {
        form.setValue('meetingLng' as never, rLng as never, {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue('meetingLat' as never, rLat as never, {
          shouldDirty: true,
          shouldValidate: true,
        });
        if (resolveAddr && onResolveStartAddressRef.current) {
          void fetch(
            `/api/geocode?lat=${encodeURIComponent(rLat)}&lon=${encodeURIComponent(rLng)}`,
          )
            .then((res) => (res.ok ? res.json() : null))
            .then(
              (
                payload: { matches?: Array<{ name?: string; context?: string }> } | null,
              ) => {
                const first = payload?.matches?.[0];
                if (!first?.name) return;
                const ctx = first.context?.trim();
                const label = ctx && ctx !== first.name ? `${first.name}, ${ctx}` : first.name;
                onResolveStartAddressRef.current?.(label);
              },
            )
            .catch(() => {
              /* ignore */
            });
        }
      }
    },
    [form, mode],
  );

  const writeTraceTarget = useCallback(
    (clipped: LngLat[]) => {
      if (selectedDayIndex >= 0) {
        const currentStartDate =
          form.getValues('startDate') ||
          ((form.getValues('date' as never) as unknown as string) ?? '');
        const baseDays = syncCarnetDaysV2(
          form.getValues('days') ?? [],
          Math.max(selectedDayIndex + 1, form.getValues('nbJours') || 1),
          currentStartDate,
        );
        const nextDays = baseDays.map((day, idx) =>
          idx === selectedDayIndex ? { ...day, trace: clipped } : day,
        );
        form.setValue('days', nextDays, { shouldDirty: true, shouldValidate: true });
        const combined = joinSegments(
          nextDays
            .map((day) => (day.trace ?? []) as LngLat[])
            .filter((pts) => pts.length > 0),
          MAX_POINTS,
        );
        const effectiveGlobal = combined.length >= 2 ? combined : clipped;
        form.setValue('trace', effectiveGlobal, {
          shouldDirty: true,
          shouldValidate: true,
        });
        if (effectiveGlobal[0]) {
          syncStartCoordinates(effectiveGlobal[0][0], effectiveGlobal[0][1], true);
        }
      } else {
        form.setValue('trace', clipped, { shouldDirty: true, shouldValidate: true });
        if (clipped[0]) {
          syncStartCoordinates(clipped[0][0], clipped[0][1], true);
        }
      }
    },
    [form, selectedDayIndex, syncStartCoordinates],
  );

  const setTrace = useCallback(
    (next: LngLat[]) => {
      const clipped = next.slice(0, MAX_POINTS);
      const history = traceCommit(historyRef.current, clipped);
      if (history !== historyRef.current) {
        historyRef.current = history;
        bumpHistory((tick) => tick + 1);
      }
      writeTraceTarget(history.present);
    },
    [writeTraceTarget],
  );

  const undo = useCallback(() => {
    const next = traceUndo(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    bumpHistory((tick) => tick + 1);
    writeTraceTarget(next.present);
    setSelectedSegment(null);
    haptic('light');
  }, [haptic, writeTraceTarget]);

  const redo = useCallback(() => {
    const next = traceRedo(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    bumpHistory((tick) => tick + 1);
    writeTraceTarget(next.present);
    setSelectedSegment(null);
    haptic('light');
  }, [haptic, writeTraceTarget]);

  const removeSegment = useCallback(
    (index: number) => {
      const current = traceRef.current;
      const next = deleteTraceSegment(current, index);
      if (sameTrace(current, next)) return;
      setTrace(next);
      setSelectedSegment(null);
      haptic('medium');
    },
    [haptic, setTrace],
  );

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  // ── Carte ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;
    try {
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const initialCenter: [number, number] =
        startLng != null && startLat != null
          ? [startLng, startLat]
          : trace.length > 0
            ? trace[0]
            : DEFAULT_CENTER;
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo', { projection: 'mercator' }),
        center: initialCenter,
        zoom: (startLng != null && startLat != null) || trace.length > 0 ? 13 : 12,
        minZoom: 2,
        maxZoom: 18,
        attributionControl: false,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        ...SMOOTH_MAPLIBRE_OPTIONS,
      });
      applySmoothMapPhysics(map, { lockRotation: true });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    const resizeTimer = window.setTimeout(() => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    }, 420);
    const ro =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => {
            try {
              map.resize();
            } catch {
              /* ignore */
            }
          })
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);

    map.on('load', () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
      const forest = cssToken('--lkv-forest-900', '#17402c');
      const paper = cssToken('--lkv-surface-paper', '#ffffff');
      const inverted = cssToken('--lkv-text-inverted', '#ffffff');
      const accent = cssToken('--lkv-secondary', '#40916c');
      map.addSource('cv2c-carnet-days', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('cv2c-carnet-trace', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('cv2c-carnet-draft', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('cv2c-carnet-ends', { type: 'geojson', data: EMPTY_FC as never });
      map.addLayer({
        id: 'cv2c-carnet-days-casing',
        type: 'line',
        source: 'cv2c-carnet-days',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': inverted,
          'line-width': ['+', ['coalesce', ['get', 'width'], 4], 3],
          'line-opacity': ['coalesce', ['get', 'opacity'], 0.9],
        },
      });
      map.addLayer({
        id: 'cv2c-carnet-days-line',
        type: 'line',
        source: 'cv2c-carnet-days',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], forest],
          'line-width': ['coalesce', ['get', 'width'], 4],
          'line-opacity': ['coalesce', ['get', 'opacity'], 0.95],
        },
      });
      map.addLayer({
        id: 'cv2c-carnet-casing',
        type: 'line',
        source: 'cv2c-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': inverted, 'line-width': 8 },
      });
      map.addLayer({
        id: 'cv2c-carnet-line',
        type: 'line',
        source: 'cv2c-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': forest, 'line-width': 4 },
      });
      map.addLayer({
        id: 'cv2c-carnet-draft-line',
        type: 'line',
        source: 'cv2c-carnet-draft',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': accent, 'line-width': 4, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'cv2c-carnet-points',
        type: 'circle',
        source: 'cv2c-carnet-ends',
        paint: {
          'circle-radius': 7,
          'circle-color': ['match', ['get', 'kind'], 'start', paper, forest],
          'circle-stroke-color': ['match', ['get', 'kind'], 'start', forest, paper],
          'circle-stroke-width': 3,
        },
      });
      // FID-068 — segments cliquables (maquette `.seg-hit`, largeur 22 px) et
      // surbrillance du segment sélectionné, sur les jetons du tiroir.
      map.addSource('cv2c-carnet-segments', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('cv2c-carnet-selected', { type: 'geojson', data: EMPTY_FC as never });
      map.addLayer({
        id: 'cv2c-carnet-segment-hit',
        type: 'line',
        source: 'cv2c-carnet-segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': accent, 'line-width': 26, 'line-opacity': 0 },
      });
      map.addLayer({
        id: 'cv2c-carnet-segment-selected',
        type: 'line',
        source: 'cv2c-carnet-selected',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': accent, 'line-width': 6, 'line-opacity': 0.55 },
      });
      setReady(true);
    });
    return () => {
      window.clearTimeout(resizeTimer);
      if (liveFrameRef.current != null) {
        cancelAnimationFrame(liveFrameRef.current);
        liveFrameRef.current = null;
      }
      drawRef.current?.inFlight?.abort();
      ro?.disconnect();
      startMarker.current?.remove();
      endMarker.current?.remove();
      startMarker.current = null;
      endMarker.current = null;
      editMarkers.current.forEach((marker) => marker.remove());
      editMarkers.current = [];
      try {
        map.remove();
      } catch {
        /* jsdom / WebGL indisponible : rien à libérer */
      }
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  /** Tolérance en degrés correspondant à `px` pixels au zoom courant de la carte. */
  const pixelTolerance = useCallback((px: number): number => {
    const map = mapRef.current;
    if (!map) return 0.00018;
    try {
      const a = map.unproject([0, 0]);
      const b = map.unproject([px, px]);
      const delta = Math.max(Math.abs(b.lng - a.lng), Math.abs(b.lat - a.lat));
      return Number.isFinite(delta) && delta > 0 ? delta : 0.00018;
    } catch {
      return 0.00018;
    }
  }, []);

  /** Écarte les points de passage intermédiaires trop proches (< `minMeters`) qui parasitent le routeur. */
  const filterSpacedWaypoints = useCallback((pts: readonly LngLat[], minMeters = 32): LngLat[] => {
    if (pts.length <= 2) return [...pts];
    const out: LngLat[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i += 1) {
      const prev = out[out.length - 1];
      const next = pts[pts.length - 1];
      if (
        haversineKm(prev, pts[i]) * 1000 >= minMeters &&
        haversineKm(pts[i], next) * 1000 >= minMeters
      ) {
        out.push(pts[i]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }, []);

  /** Interroge `/api/route` pour une liste de points de passage et vérifie la cohérence du détour. */
  const requestSnappedWaypoints = useCallback(
    async (waypoints: readonly LngLat[], parentSignal?: AbortSignal): Promise<LngLat[] | null> => {
      if (waypoints.length < 2 || parentSignal?.aborted) return null;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), ROUTE_ATTEMPT_TIMEOUT_MS);
      const onParentAbort = () => controller.abort();
      parentSignal?.addEventListener('abort', onParentAbort, { once: true });
      try {
        const from = waypoints[0];
        const to = waypoints[waypoints.length - 1];
        const encoded = waypoints.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
        const res = await fetch(`/api/route?points=${encodeURIComponent(encoded)}&mode=pieton&snap=1`, {
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as {
          geometry?: LngLat[];
          legs?: Array<{ geometry?: LngLat[] }>;
        };
        const rawCoords: LngLat[] = Array.isArray(payload.geometry)
          ? payload.geometry
          : Array.isArray(payload.legs)
            ? payload.legs.flatMap((leg) => (Array.isArray(leg.geometry) ? leg.geometry : []))
            : [];
        const cleaned = removeSpurs(rawCoords);
        if (cleaned.length < 2) return null;
        const airKm = Math.max(0.015, lengthKm(waypoints));
        const routedKm = lengthKm(cleaned);
        const startDriftKm = haversineKm(from, cleaned[0]);
        const endDriftKm = haversineKm(to, cleaned[cleaned.length - 1]);
        const maxSnapDriftKm = Math.max(3.0, airKm * 1.6);
        if (
          routedKm / airKm <= MAX_DETOUR &&
          startDriftKm <= maxSnapDriftKm &&
          endDriftKm <= maxSnapDriftKm
        ) {
          return cleaned;
        }
        return null;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timer);
        parentSignal?.removeEventListener('abort', onParentAbort);
      }
    },
    [],
  );

  /**
   * Routage multi-étapes résilient (4 niveaux avec timeout indépendant par tentative) :
   * 1. Points de passage clés simplifiés au zoom courant ;
   * 2. [départ, milieu, arrivée] ;
   * 3. [départ, arrivée] direct sur le réseau routier/sentiers ;
   * 4. Sous-segments par paires si le tracé comporte un virage complexe.
   */
  const fetchSnappedRoute = useCallback(
    async (chunk: readonly LngLat[], signal?: AbortSignal): Promise<LngLat[] | null> => {
      if (chunk.length < 2) return null;
      try {
        const tol = pixelTolerance(WAYPOINT_PX);
        const rawWaypoints = pickWaypoints(chunk, ROUTE_MAX_POINTS, tol);
        const waypoints = filterSpacedWaypoints(
          rawWaypoints.length >= 2 ? rawWaypoints : [chunk[0], chunk[chunk.length - 1]],
          32,
        );
        const primary = await requestSnappedWaypoints(waypoints, signal);
        if (primary) return primary;

        if (!signal?.aborted && chunk.length >= 3) {
          const mid = chunk[Math.floor(chunk.length / 2)];
          const threePts = filterSpacedWaypoints([chunk[0], mid, chunk[chunk.length - 1]], 28);
          if (threePts.length === 3) {
            const viaMid = await requestSnappedWaypoints(threePts, signal);
            if (viaMid) return viaMid;
          }
        }

        if (!signal?.aborted) {
          const direct = await requestSnappedWaypoints(
            [chunk[0], chunk[chunk.length - 1]],
            signal,
          );
          if (direct) return direct;
        }

        if (!signal?.aborted && chunk.length >= 4) {
          const mid = chunk[Math.floor(chunk.length / 2)];
          const [legA, legB] = await Promise.all([
            requestSnappedWaypoints([chunk[0], mid], signal),
            requestSnappedWaypoints([mid, chunk[chunk.length - 1]], signal),
          ]);
          if (legA && legB) {
            return joinLines(legA, legB, 2);
          }
          if (legA) return joinLines(legA, [mid, chunk[chunk.length - 1]], 2);
          if (legB) return joinLines([chunk[0], mid], legB, 2);
        }
        return null;
      } catch {
        return null;
      }
    },
    [filterSpacedWaypoints, pixelTolerance, requestSnappedWaypoints],
  );
  // Chaque jour possède sa propre couleur distincte visible en permanence sur la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const forestFallback = cssToken('--cv2-accent', '#17402c');
    const activeColor = selectedDayIndex >= 0 ? dayTraceColor(selectedDayIndex) : forestFallback;
    const dayFeatures = ensuredDays
      .map((day, idx) => {
        const pts = (day.trace ?? []) as LngLat[];
        if (pts.length < 2) return null;
        if (selectedDayIndex === idx) return null;
        return {
          type: 'Feature' as const,
          properties: {
            dayIndex: idx,
            color: dayTraceColor(idx),
            opacity: selectedDayIndex === -1 ? 0.95 : 0.38,
            width: selectedDayIndex === -1 ? 4.5 : 3.2,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: pts,
          },
        };
      })
      .filter((feat): feat is NonNullable<typeof feat> => feat !== null);

    (map.getSource('cv2c-carnet-days') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: dayFeatures,
    } as never);

    const hasLayerApi =
      typeof map.getLayer === 'function' && typeof map.setPaintProperty === 'function';
    if (hasLayerApi && map.getLayer('cv2c-carnet-line')) {
      map.setPaintProperty('cv2c-carnet-line', 'line-color', activeColor);
      map.setPaintProperty('cv2c-carnet-line', 'line-width', selectedDayIndex >= 0 ? 4.8 : 4);
      // En mode Global, si chaque jour possède déjà son tracé coloré, on évite
      // que le tracé combiné monochrome ne masque les couleurs par jour.
      map.setPaintProperty(
        'cv2c-carnet-line',
        'line-opacity',
        selectedDayIndex === -1 && dayFeatures.length > 0 ? 0.12 : 1,
      );
    }
    if (hasLayerApi && map.getLayer('cv2c-carnet-casing')) {
      map.setPaintProperty(
        'cv2c-carnet-casing',
        'line-opacity',
        selectedDayIndex === -1 && dayFeatures.length > 0 ? 0.15 : 1,
      );
    }
    if (hasLayerApi && map.getLayer('cv2c-carnet-draft-line')) {
      map.setPaintProperty('cv2c-carnet-draft-line', 'line-color', activeColor);
    }

    const line = lineFeature(trace);
    (map.getSource('cv2c-carnet-trace') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: line ? [line] : [],
    } as never);
    (map.getSource('cv2c-carnet-ends') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: endsFeature(trace),
    } as never);
    (map.getSource('cv2c-carnet-segments') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: segmentsFeature(trace),
    } as never);
    const selected =
      selectedSegment != null && trace[selectedSegment] && trace[selectedSegment + 1]
        ? [
            {
              type: 'Feature',
              properties: { index: selectedSegment },
              geometry: {
                type: 'LineString',
                coordinates: [trace[selectedSegment], trace[selectedSegment + 1]],
              },
            },
          ]
        : [];
    (map.getSource('cv2c-carnet-selected') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: selected,
    } as never);

    startMarker.current?.remove();
    endMarker.current?.remove();
    startMarker.current = null;
    endMarker.current = null;
    if (trace.length > 0) {
      const start = new Marker({ draggable: true, color: activeColor }).setLngLat(trace[0]).addTo(map);
      start.on('dragend', () => {
        const position = start.getLngLat();
        const current = traceRef.current;
        if (current.length === 0) return;
        const newStart: LngLat = [position.lng, position.lat];
        haptic('selection');
        if (!magnetRef.current || current.length < 2) {
          setTrace([newStart, ...current.slice(1)]);
          return;
        }
        const anchorIdx = Math.min(current.length - 1, Math.max(1, Math.floor(current.length * 0.25)));
        setSnapState('loading');
        void fetchSnappedRoute([newStart, current[anchorIdx]]).then((snapped) => {
          setSnapState('idle');
          if (snapped && snapped.length >= 2) {
            setTrace(joinLines(snapped, current.slice(anchorIdx), 2));
          } else {
            setTrace([newStart, ...current.slice(1)]);
          }
        });
      });
      startMarker.current = start;
      if (trace.length > 1) {
        const end = new Marker({ draggable: true, color: activeColor }).setLngLat(trace[trace.length - 1]).addTo(map);
        end.on('dragend', () => {
          const position = end.getLngLat();
          const current = traceRef.current;
          if (current.length === 0) return;
          const newEnd: LngLat = [position.lng, position.lat];
          haptic('selection');
          if (!magnetRef.current || current.length < 2) {
            setTrace([...current.slice(0, -1), newEnd]);
            return;
          }
          const anchorIdx = Math.max(
            0,
            current.length - 1 - Math.max(1, Math.floor(current.length * 0.25)),
          );
          setSnapState('loading');
          void fetchSnappedRoute([current[anchorIdx], newEnd]).then((snapped) => {
            setSnapState('idle');
            if (snapped && snapped.length >= 2) {
              setTrace(joinLines(current.slice(0, anchorIdx + 1), snapped, 2));
            } else {
              setTrace([...current.slice(0, -1), newEnd]);
            }
          });
        });
        endMarker.current = end;
      }
    } else if (startLat != null && startLng != null) {
      const rdvMarker = new Marker({ draggable: true, color: activeColor })
        .setLngLat([startLng, startLat])
        .addTo(map);
      rdvMarker.on('dragend', () => {
        const pos = rdvMarker.getLngLat();
        haptic('selection');
        syncStartCoordinates(pos.lng, pos.lat, true);
      });
      startMarker.current = rdvMarker;
    }
  }, [
    ensuredDays,
    fetchSnappedRoute,
    haptic,
    ready,
    selectedDayIndex,
    selectedSegment,
    setTrace,
    startLat,
    startLng,
    syncStartCoordinates,
    trace,
  ]);

  // En mode Sortie, quand aucun tracé n'est en cours et que le crayon n'est pas actif,
  // un simple tap sur la carte place ou déplace le point de rendez-vous / départ.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || mode !== 'sortie') return;
    const onMapClick = (event: { lngLat: { lng: number; lat: number } }) => {
      if (drawingRef.current || traceRef.current.length >= 2) return;
      haptic('selection');
      syncStartCoordinates(event.lngLat.lng, event.lngLat.lat, true);
    };
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [haptic, mode, ready, syncStartCoordinates]);

  // Cadrage initial unique (sans jamais déplacer la caméra pendant le tracé ou changement d'onglet).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || didInitialCenter.current) return;
    if (trace.length >= 2) {
      didInitialCenter.current = true;
      fitTraceBounds(trace);
      return;
    }
    const target: [number, number] | null =
      trace.length > 0
        ? trace[0]
        : startLng != null && startLat != null
          ? [startLng, startLat]
          : null;
    if (!target) return;
    didInitialCenter.current = true;
    const key = `${target[0].toFixed(5)},${target[1].toFixed(5)}`;
    lastAutofocusKey.current = key;
    const curZoom = typeof map.getZoom === 'function' ? map.getZoom() : 12;
    map.easeTo?.({ center: target, zoom: Math.max(curZoom, 13), duration: 360 });
  }, [fitTraceBounds, ready, startLat, startLng, trace]);

  // Recentrage explicite uniquement quand un lieu de destination / départ est choisi ailleurs (hors dessin).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || drawingRef.current) return;
    if (startLng == null || startLat == null) return;
    if (traceRef.current.length > 0) return;
    const key = `${startLng.toFixed(5)},${startLat.toFixed(5)}`;
    if (lastAutofocusKey.current !== key) {
      lastAutofocusKey.current = key;
      const curZoom = typeof map.getZoom === 'function' ? map.getZoom() : 12;
      map.easeTo?.({ center: [startLng, startLat], zoom: Math.max(curZoom, 13), duration: 420 });
    }
  }, [ready, startLat, startLng]);

  // Si la destination a été saisie en texte (ex: dans l'aperçu Hero) sans coordonnées GPS,
  // on géocode automatiquement la destination pour centrer la carte à l'échelle des sentiers.
  useEffect(() => {
    if (!ready || traceRef.current.length > 0 || (startLat != null && startLng != null)) return;
    const cleanDest = (destination ?? '').trim();
    if (cleanDest.length < 2 || lastGeocodedDestRef.current === cleanDest) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(cleanDest)}&limit=1`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          matches?: Array<{ lat?: number; lon?: number; lng?: number }>;
        };
        const hit = payload.matches?.[0];
        const lat = Number(hit?.lat);
        const lng = Number(hit?.lon ?? hit?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          lastGeocodedDestRef.current = cleanDest;
          form.setValue('startLat', lat, { shouldDirty: false });
          form.setValue('startLng', lng, { shouldDirty: false });
          if (traceRef.current.length === 0) {
            mapRef.current?.easeTo({ center: [lng, lat], zoom: 13, duration: 420 });
          }
        }
      } catch {
        /* ignore */
      }
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [destination, form, ready, startLat, startLng]);

  // FID-068 — appui sur le tracé : sélectionne le segment (comme `.seg-hit`).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const onSegmentClick = (event: MapLayerMouseEvent) => {
      if (drawingRef.current) return;
      const index = Number(event.features?.[0]?.properties?.index);
      if (!Number.isInteger(index)) return;
      setSelectedSegment((current) => (current === index ? null : index));
      haptic('selection');
    };
    const onEnter = () => {
      if (!drawingRef.current) map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', 'cv2c-carnet-segment-hit', onSegmentClick);
    map.on('mouseenter', 'cv2c-carnet-segment-hit', onEnter);
    map.on('mouseleave', 'cv2c-carnet-segment-hit', onLeave);
    return () => {
      map.off('click', 'cv2c-carnet-segment-hit', onSegmentClick);
      map.off('mouseenter', 'cv2c-carnet-segment-hit', onEnter);
      map.off('mouseleave', 'cv2c-carnet-segment-hit', onLeave);
      map.getCanvas().style.cursor = '';
    };
  }, [haptic, ready]);

  // FID-068 — en mode Éditer, chaque point intermédiaire (échantillonné au-delà
  // de 40 repères) devient une poignée déplaçable (maquette `.tp-handle`) qui se
  // ré-accroche aux sentiers si l'aimant est actif.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    editMarkers.current.forEach((marker) => marker.remove());
    editMarkers.current = [];
    if (!editing || trace.length < 3) return;
    const stride = Math.max(1, Math.ceil((trace.length - 2) / 36));
    const handleIndices: number[] = [];
    for (let index = 1; index < trace.length - 1; index += stride) {
      handleIndices.push(index);
    }
    handleIndices.forEach((index, handlePos) => {
      const prevIdx = handlePos > 0 ? handleIndices[handlePos - 1] : 0;
      const nextIdx =
        handlePos < handleIndices.length - 1 ? handleIndices[handlePos + 1] : trace.length - 1;
      const marker = new Marker({ draggable: true }).setLngLat(trace[index]).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        const current = traceRef.current;
        const newMid: LngLat = [position.lng, position.lat];
        haptic('selection');
        if (!magnetRef.current || !current[prevIdx] || !current[nextIdx]) {
          const moved = moveTracePoint(current, index, newMid);
          if (!sameTrace(current, moved)) setTrace(moved);
          return;
        }
        setSnapState('loading');
        void fetchSnappedRoute([current[prevIdx], newMid, current[nextIdx]]).then((snapped) => {
          setSnapState('idle');
          if (snapped && snapped.length >= 2) {
            const spliced = joinSegments(
              [current.slice(0, prevIdx + 1), snapped, current.slice(nextIdx)],
              MAX_POINTS,
            );
            if (!sameTrace(current, spliced)) setTrace(spliced);
          } else {
            const moved = moveTracePoint(current, index, newMid);
            if (!sameTrace(current, moved)) setTrace(moved);
          }
        });
      });
      editMarkers.current.push(marker);
    });
    return () => {
      editMarkers.current.forEach((marker) => marker.remove());
      editMarkers.current = [];
    };
  }, [editing, fetchSnappedRoute, haptic, ready, setTrace, trace]);

  // Un segment supprimé (ou un tracé remplacé) invalide la sélection.
  useEffect(() => {
    if (selectedSegment != null && selectedSegment >= traceSegmentCount(trace)) {
      setSelectedSegment(null);
    }
  }, [selectedSegment, trace]);

  const commitTroncons = useCallback(
    (nextTroncons: TraceSegmentV2[]) => {
      const targetKey = selectedDayIndex >= 0 ? `day-${selectedDayIndex}` : 'global';
      tronconsByTargetRef.current[targetKey] = nextTroncons;
      tronconsRef.current = nextTroncons;
      setTroncons(nextTroncons);
      const joined = joinSegments(
        nextTroncons.map((item) => item.points),
        MAX_POINTS,
      );
      setTrace(joined);
    },
    [selectedDayIndex, setTrace],
  );

  const renderDraftLive = useCallback(() => {
    if (liveFrameRef.current != null) return;
    liveFrameRef.current = requestAnimationFrame(() => {
      liveFrameRef.current = null;
      const source = mapRef.current?.getSource('cv2c-carnet-draft') as GeoJSONSource | undefined;
      const stroke = drawRef.current;
      if (!stroke) {
        source?.setData(EMPTY_FC as never);
        setLiveDraftKm(0);
        return;
      }
      const tail = stroke.snapped[stroke.snapped.length - 1];
      const pending = tail ? [tail, ...stroke.raw.slice(stroke.pendingFrom)] : stroke.raw;
      const previewPts =
        stroke.snapped.length >= 2 ? joinLines(stroke.snapped, pending, 1) : pending;
      setLiveDraftKm(previewPts.length >= 2 ? lengthKm(previewPts) : 0);
      if (!source) return;
      const feat = lineFeature(previewPts);
      source.setData({
        type: 'FeatureCollection',
        features: feat ? [feat] : [],
      } as never);
    });
  }, []);

  const snapTronconToRoads = useCallback(
    async (segId: string, gesturePoints: readonly LngLat[], targetKey: string) => {
      setSnapState('loading');
      const snapped = await fetchSnappedRoute(gesturePoints);
      const currentTargetKey = selectedDayIndex >= 0 ? `day-${selectedDayIndex}` : 'global';
      const existingList =
        currentTargetKey === targetKey
          ? tronconsRef.current
          : (tronconsByTargetRef.current[targetKey] ?? []);
      const hasSeg = existingList.some((item) => item.id === segId);
      if (!hasSeg) {
        setSnapState('idle');
        return;
      }
      if (snapped && snapped.length >= 2) {
        const updated = existingList.map((item) =>
          item.id === segId ? { ...item, points: snapped, mode: 'chemin' as const } : item,
        );
        tronconsByTargetRef.current[targetKey] = updated;
        if (currentTargetKey === targetKey) {
          commitTroncons(updated);
        }
        setSnapState('idle');
      } else {
        const updated = existingList.map((item) =>
          item.id === segId ? { ...item, mode: 'libre' as const } : item,
        );
        tronconsByTargetRef.current[targetKey] = updated;
        if (currentTargetKey === targetKey) {
          commitTroncons(updated);
        }
        setSnapState('error');
      }
    },
    [commitTroncons, fetchSnappedRoute, selectedDayIndex],
  );

  const cancelStroke = useCallback(() => {
    const stroke = drawRef.current;
    if (!stroke) return;
    stroke.inFlight?.abort();
    drawRef.current = null;
    setLiveDraftKm(0);
    renderDraftLive();
    setSnapState('idle');
  }, [renderDraftLive]);

  const finishStroke = useCallback(
    (pointerId?: number) => {
      const stroke = drawRef.current;
      if (!stroke || stroke.ended) return;
      if (pointerId != null && stroke.pointerId !== pointerId) return;
      stroke.ended = true;
      drawRef.current = null;
      setLiveDraftKm(0);
      renderDraftLive();

      const existingEnd = traceRef.current[traceRef.current.length - 1];
      // Si l'utilisateur fait un simple tap (< 8 px) alors qu'un tracé existe déjà,
      // on relie automatiquement la fin du tracé existant à ce nouveau point de passage !
      if (stroke.totalPx <= TAP_MAX_PX && existingEnd && !stroke.anchored) {
        stroke.anchored = true;
        stroke.snapped = [existingEnd];
        stroke.pendingFrom = 0;
      }

      // Cas 1 : simple appui/tap sans tracé existant -> pose le point de départ sur la carte
      if (!stroke.anchored && stroke.raw.length === 1 && traceRef.current.length === 0) {
        setTrace([stroke.raw[0]]);
        setSnapState('idle');
        haptic('selection');
        toast.success('Point de départ posé — touche un autre point ou glisse pour tracer');
        return;
      }

      const anchorPt = stroke.anchored ? stroke.snapped[0] : null;
      const gesturePoints: LngLat[] =
        anchorPt && stroke.raw.length > 0 ? [anchorPt, ...stroke.raw] : [...stroke.raw];
      if (gesturePoints.length < 2) {
        setSnapState('idle');
        return;
      }

      const strokeKm = lengthKm(gesturePoints);
      if (strokeKm > MAX_STROKE_KM) {
        setSnapState('idle');
        haptic('error');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('lkdv-create-island', {
              detail: {
                title: `Tracé trop long (max ${MAX_STROKE_KM} km d’un coup)`,
                subtitle: 'Trace par étapes plus courtes ou importe un GPX.',
              },
            }),
          );
        }
        return;
      }

      const tol = pixelTolerance(3);
      const initialPoints =
        gesturePoints.length > 2 ? simplify(smooth(gesturePoints, 2), tol) : gesturePoints;
      const safeInitial = initialPoints.length >= 2 ? initialPoints : gesturePoints;
      const segId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const shouldSnap = stroke.magnet && lengthKm(gesturePoints) * 1000 >= MIN_ROUTE_M;
      const nextSeg: TraceSegmentV2 = {
        id: segId,
        points: safeInitial,
        mode: shouldSnap ? 'chemin' : 'libre',
      };
      const baseTroncons =
        tronconsRef.current.length === 1 && tronconsRef.current[0].points.length < 2
          ? []
          : tronconsRef.current;
      const nextTroncons = [...baseTroncons, nextSeg];
      const targetKey = selectedDayIndex >= 0 ? `day-${selectedDayIndex}` : 'global';
      // Validation immédiate (0 ms) pour afficher la trace et la distance sans jamais bloquer le coup de crayon suivant
      commitTroncons(nextTroncons);
      haptic('medium');

      if (shouldSnap) {
        void snapTronconToRoads(segId, gesturePoints, targetKey);
      } else {
        setSnapState('idle');
      }
    },
    [
      commitTroncons,
      haptic,
      pixelTolerance,
      renderDraftLive,
      selectedDayIndex,
      setTrace,
      snapTronconToRoads,
    ],
  );

  useEffect(() => {
    const onWindowPointerEnd = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (drawRef.current && drawRef.current.pointerId === event.pointerId) {
        finishStroke(event.pointerId);
      }
    };
    window.addEventListener('pointerup', onWindowPointerEnd, true);
    window.addEventListener('pointercancel', onWindowPointerEnd, true);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerEnd, true);
      window.removeEventListener('pointercancel', onWindowPointerEnd, true);
    };
  }, [finishStroke]);

  const pinchState = () => {
    const [a, b] = [...pointersRef.current.values()];
    return {
      cx: (a[0] + b[0]) / 2,
      cy: (a[1] + b[1]) / 2,
      dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
    };
  };

  const applyPinch = () => {
    const map = mapRef.current;
    const previous = pinchRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!map || !previous || !rect) return;
    const next = pinchState();
    map.panBy([previous.cx - next.cx, previous.cy - next.cy], { animate: false });
    map.zoomTo(map.getZoom() + Math.log2(next.dist / previous.dist) * 1.35, {
      animate: false,
      around: map.unproject([next.cx - rect.left, next.cy - rect.top]),
    });
    pinchRef.current = next;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing || !mapRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointersRef.current.size >= 2) {
      if (drawRef.current && !drawRef.current.ended) cancelStroke();
      pinchRef.current = pinchState();
      return;
    }
    if (drawRef.current) {
      finishStroke(drawRef.current.pointerId);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const px: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    const point = mapRef.current.unproject(px);
    const startPt: LngLat = [point.lng, point.lat];
    const existingEnd = traceRef.current[traceRef.current.length - 1];
    let shouldAnchor = false;
    if (existingEnd) {
      if (traceRef.current.length === 1) {
        shouldAnchor = true;
      } else {
        try {
          const endPx = mapRef.current.project(existingEnd);
          const distPx = Math.hypot(px[0] - endPx.x, px[1] - endPx.y);
          shouldAnchor = distPx <= ANCHOR_SNAP_PX;
        } catch {
          shouldAnchor = false;
        }
      }
    }
    drawRef.current = {
      pointerId: event.pointerId,
      raw: [startPt],
      snapped: shouldAnchor && existingEnd ? [existingEnd] : [startPt],
      pendingFrom: shouldAnchor && existingEnd ? 0 : 1,
      anchored: shouldAnchor && Boolean(existingEnd),
      magnet,
      free: false,
      routedChunks: 0,
      inFlight: null,
      ended: false,
      pendingPx: 0,
      totalPx: 0,
      lastPx: px,
    };
    setSnapState('idle');
    renderDraftLive();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optionnelle */
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]);
    }
    if (pinchRef.current && pointersRef.current.size >= 2) {
      applyPinch();
      return;
    }
    const current = drawRef.current;
    if (!current || current.pointerId !== event.pointerId || current.ended || !mapRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const px: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    const stepPx = Math.hypot(px[0] - current.lastPx[0], px[1] - current.lastPx[1]);
    if (stepPx < SAMPLE_PX || current.raw.length >= MAX_POINTS) return;
    const point = mapRef.current.unproject(px);
    current.raw.push([point.lng, point.lat]);
    current.pendingPx += stepPx;
    current.totalPx += stepPx;
    current.lastPx = px;
    renderDraftLive();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const current = drawRef.current;
    if (current && current.pointerId === event.pointerId && !current.ended) {
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* capture optionnelle */
      }
      finishStroke(event.pointerId);
    }
  };

  const onMapWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    // Tant que la carte n'est pas en mode dessin et qu'on fait un vrai coup de scroll vertical,
    // on laisse le drawer défiler et on relâche le focus de la carte.
    if (!drawing && !event.ctrlKey && Math.abs(event.deltaY) >= 24) {
      if (mapFocused) setMapFocused(false);
      return;
    }
    if (!drawing && !mapFocused) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const nextZoom = Math.max(2, Math.min(18, mapRef.current.getZoom() - event.deltaY * 0.006));
    mapRef.current.zoomTo(nextZoom, {
      animate: false,
      around: mapRef.current.unproject([event.clientX - rect.left, event.clientY - rect.top]),
    });
  };

  // Bloque le scroll natif iOS du drawer uniquement quand le crayon ou le focus carte est actif.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isLocked = drawing || editing || mapFocused;
    if (!isLocked) return;
    const onTouchMove = (e: TouchEvent) => {
      if (drawing) {
        e.preventDefault();
      }
      e.stopPropagation();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [drawing, editing, mapFocused]);

  // Tant que le crayon ou un bouton de la carte n'est pas activé, on laisse le scroll du drawer
  // traverser la carte. Dès qu'on active un bouton de la carte, la carte prend la main.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (drawing) {
      map.dragPan?.disable?.();
      map.dragRotate?.disable?.();
      map.doubleClickZoom?.disable?.();
      map.touchZoomRotate?.disable?.();
      map.boxZoom?.disable?.();
      map.touchPitch?.disable?.();
    } else if (!mapFocused && !editing) {
      map.dragPan?.disable?.();
      map.dragRotate?.disable?.();
      map.doubleClickZoom?.disable?.();
      map.touchZoomRotate?.disable?.();
      map.boxZoom?.disable?.();
      map.touchPitch?.disable?.();
    } else {
      map.doubleClickZoom?.enable?.();
      map.boxZoom?.enable?.();
      applySmoothMapPhysics(map, { lockRotation: true });
    }
  }, [drawing, editing, mapFocused, ready]);

  // ── Distance, dénivelé, profil ───────────────────────────────────────────
  const km = lengthKm(trace);
  const displayKm = km + liveDraftKm;
  const fullCarnetTrace = globalTrace.length >= 2 ? globalTrace : trace;
  const totalKm = lengthKm(fullCarnetTrace);
  useEffect(() => {
    const maxKm = mode === 'sortie' ? 500 : 10_000;
    if (fullCarnetTrace.length >= 2) {
      hadTraceRef.current = true;
      const roundedKm =
        totalKm > 0 && totalKm < 1
          ? Math.max(0.05, Math.round(totalKm * 100) / 100)
          : Math.round(totalKm * 10) / 10;
      form.setValue('distanceKm', Math.min(maxKm, roundedKm), {
        shouldDirty: totalKm > 0,
      });
    } else if (hadTraceRef.current || mode === 'carnet') {
      hadTraceRef.current = false;
      form.setValue('distanceKm', 0, { shouldDirty: false });
    }
  }, [form, fullCarnetTrace.length, mode, totalKm]);

  useEffect(() => {
    if (fullCarnetTrace.length < 2) {
      setElevations([]);
      setGainState('idle');
      if (hadTraceRef.current || mode === 'carnet') {
        form.setValue('deniveleM', 0);
        if (mode === 'sortie') {
          form.setValue('elevationGainM' as never, 0 as never);
          form.setValue('elevationLossM' as never, 0 as never);
          form.setValue('maxAltitudeM' as never, null as never);
        }
      }
      return;
    }
    const profileSource = trace.length >= 2 ? trace : fullCarnetTrace;
    const profileKm = lengthKm(profileSource);
    const controller = new AbortController();
    setGainState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const count = Math.max(2, Math.min(100, Math.round(profileKm * 8) + 2));
        const samples = sampleAlong(profileSource, count);
        const points = samples.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
        const response = await fetch(`/api/elevation?points=${points}`, { signal: controller.signal });
        if (!response.ok) throw new Error('elevation');
        const payload = (await response.json()) as { elevations?: Array<number | null> };
        const values = Array.isArray(payload.elevations) ? payload.elevations : [];
        const numericVals = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        setElevations(values.map((value) => (typeof value === 'number' ? value : 0)));

        const primaryStats = elevationGain(values);
        let totalGain = primaryStats.gain;
        let totalLoss = primaryStats.loss;
        let maxAlt = numericVals.length > 0 ? Math.round(Math.max(...numericVals)) : null;

        if (profileSource !== fullCarnetTrace) {
          const totalCount = Math.max(2, Math.min(100, Math.round(totalKm * 8) + 2));
          const totalSamples = sampleAlong(fullCarnetTrace, totalCount);
          const totalPts = totalSamples.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
          const totalRes = await fetch(`/api/elevation?points=${totalPts}`, { signal: controller.signal });
          if (totalRes.ok) {
            const totalPayload = (await totalRes.json()) as { elevations?: Array<number | null> };
            if (Array.isArray(totalPayload.elevations)) {
              const totStats = elevationGain(totalPayload.elevations);
              totalGain = totStats.gain;
              totalLoss = totStats.loss;
              const totNums = totalPayload.elevations.filter(
                (v): v is number => typeof v === 'number' && Number.isFinite(v),
              );
              if (totNums.length > 0) maxAlt = Math.round(Math.max(...totNums));
            }
          }
        }
        form.setValue('deniveleM', Math.min(30_000, totalGain), { shouldDirty: true });
        if (mode === 'sortie') {
          form.setValue('elevationGainM' as never, Math.min(20_000, totalGain) as never, {
            shouldDirty: true,
            shouldValidate: true,
          });
          form.setValue('elevationLossM' as never, Math.min(30_000, totalLoss) as never, {
            shouldDirty: true,
          });
          form.setValue('maxAltitudeM' as never, maxAlt as never, {
            shouldDirty: true,
          });
        }
        setGainState('idle');
      } catch {
        if (!controller.signal.aborted) setGainState('error');
      }
    }, 550);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form, fullCarnetTrace, km, totalKm, trace]);

  /** Répartit le tracé global en N segments journaliers égaux sur J1..JN. */
  const splitGlobalTraceIntoDays = useCallback(() => {
    if (globalTrace.length < 2 || ensuredDays.length < 2) return;
    const dayCount = ensuredDays.length;
    const total = lengthKm(globalTrace);
    if (total <= 0) return;
    const dense = sampleAlong(globalTrace, Math.max(dayCount * 16, Math.min(400, globalTrace.length * 2)));
    const step = Math.max(1, Math.floor((dense.length - 1) / dayCount));
    const nextDays = ensuredDays.map((day, idx) => {
      const startIdx = idx * step;
      const endIdx = idx === dayCount - 1 ? dense.length : Math.min(dense.length, (idx + 1) * step + 1);
      const dayPts = dense.slice(startIdx, endIdx);
      const safePts = dayPts.length >= 2 ? dayPts : [dense[0], dense[dense.length - 1]];
      tronconsByTargetRef.current[`day-${idx}`] = [
        { id: `split-day-${idx}`, points: safePts, mode: 'chemin' },
      ];
      return { ...day, trace: safePts };
    });
    form.setValue('days', nextDays, { shouldDirty: true, shouldValidate: true });
    haptic('success');
    toast.success(`Tracé réparti sur ${dayCount} jours (J1 à J${dayCount})`);
  }, [ensuredDays, form, globalTrace, haptic]);

  // ── « Ma position » ──────────────────────────────────────────────────────
  const centerOnMyPosition = async () => {
    try {
      const position = await getCurrentGeoPosition({ enableHighAccuracy: true, timeout: 10_000 });
      const point: LngLat = [position.longitude, position.latitude];
      if (trace.length === 0) setTrace([point]);
      mapRef.current?.flyTo({ center: point, zoom: 12, duration: 700 });
      syncStartCoordinates(position.longitude, position.latitude, true);
      haptic('success');
    } catch {
      setGainState('error');
    }
  };

  // ── Imports ──────────────────────────────────────────────────────────────
  const onImportFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const points = await readTraceFile(file);
      if (points.length < 2) {
        setGainState('error');
        return;
      }
      setTrace(points);
      if (points[0]) {
        mapRef.current?.easeTo({ center: points[0], zoom: 11, duration: 420 });
      }
      haptic('success');
    } catch {
      setGainState('error');
    }
  };

  const loadSessions = async (searchQuery?: string) => {
    if (!user) return;
    setImportOpen(true);
    setSessionsLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from('hike_sessions_participant')
        .select('id, title, started_at, positions_geojson')
        .not('positions_geojson', 'is', null)
        .order('started_at', { ascending: false })
        .limit(20);
      const term = searchQuery !== undefined ? searchQuery.trim() : sessionSearch.trim();
      if (term) {
        query = query.ilike('title', `%${term}%`);
      }
      const { data } = await query;
      setSessions(Array.isArray(data) ? (data as SessionOption[]) : []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const elevationPath = (() => {
    if (elevations.length < 2) return '';
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    const range = Math.max(1, max - min);
    return elevations
      .map((value, index) => {
        const x = (index / (elevations.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  })();

  const isMapInteractive = drawing || editing || mapFocused;
  const formattedDistanceLabel =
    displayKm > 0
      ? displayKm < 1
        ? `${Math.max(0.01, displayKm).toFixed(2).replace('.', ',')} km`
        : `${displayKm.toFixed(1).replace('.', ',')} km`
      : '—';

  return (
    <div ref={traceRootRef} className="lkdv-cv2c-kit">
      {/* FID-051 — les **3 cartes de point de départ** de la maquette
          (HTML L2984-2987 : `Tracer sur la carte`, `Importer un GPX`,
          `Une sortie enregistrée`). Les commandes historiques (Tracer / GPX /
          Sortie enregistrée / Effacer) restent sous la carte. */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Point de départ du tracé</span>
        <div className="lkdv-cv2c-rcards lkdv-cv2c-rcards--grid3" role="group" aria-label="Point de départ du tracé">
          <button
            type="button"
            className="lkdv-cv2c-rcard lkdv-cv2c-rcard--compact"
            onClick={() => {
              setDrawing(true);
              setEditing(false);
              setSelectedSegment(null);
              haptic('selection');
              if (mapRef.current && mapRef.current.getZoom() < 11.5) {
                mapRef.current.easeTo({ zoom: 13, duration: 340 });
              }
              centerAndLockMap();
            }}
          >
            <span className="lkdv-cv2c-rcard-icon">
              <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="lkdv-cv2c-rcard-text">
              <b>Tracer sur la carte</b>
            </span>
          </button>
          <button
            type="button"
            className="lkdv-cv2c-rcard lkdv-cv2c-rcard--compact"
            onClick={() => {
              fileInputRef.current?.click();
              haptic('selection');
              centerAndLockMap();
            }}
          >
            <span className="lkdv-cv2c-rcard-icon">
              <Upload size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="lkdv-cv2c-rcard-text">
              <b>Importer un GPX</b>
            </span>
          </button>
          <button
            type="button"
            className="lkdv-cv2c-rcard lkdv-cv2c-rcard--compact"
            onClick={() => {
              void loadSessions();
              haptic('selection');
              centerAndLockMap();
            }}
          >
            <span className="lkdv-cv2c-rcard-icon">
              <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="lkdv-cv2c-rcard-text">
              <b>Rechercher une sortie</b>
            </span>
          </button>
        </div>
      </div>

      {/* Sélecteur de tracé par jour (interconnecté avec l'étape 3 Jours/Moments + appui long iOS jiggle pour réordonner/supprimer) */}
      <div
        ref={dayTabsRef}
        className={`lkdv-cv2c-day-tabs ${dayJiggleMode ? 'is-jiggle' : ''}`}
        role="tablist"
        aria-label="Choisir le tracé par jour"
      >
        <Reorder.Group
          as="div"
          axis="x"
          values={ensuredDays}
          onReorder={handleReorderDays}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          {ensuredDays.map((day, idx) => {
            const dPts = (day.trace ?? []) as LngLat[];
            const dKm = lengthKm(dPts);
            const color = dayTraceColor(idx);
            const isActive = safeDayIndex === idx;
            return (
              <Reorder.Item
                as="div"
                key={day.id}
                value={day}
                dragListener={dayJiggleMode}
                style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
                animate={
                  dayJiggleMode
                    ? {
                        rotate: [0, -1.6, 1.6, -1.6, 1.6, 0],
                        transition: { duration: 0.34, repeat: Infinity, ease: 'easeInOut' },
                      }
                    : { rotate: 0 }
                }
                whileDrag={{ scale: 1.08, zIndex: 20, boxShadow: '0 10px 24px rgba(0,0,0,0.22)' }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`lkdv-cv2c-day-tab ${isActive ? 'is-active' : ''}`}
                  style={
                    isActive
                      ? {
                          borderColor: color,
                          background: `color-mix(in srgb, ${color} 12%, #ffffff)`,
                          color: '#0f172a',
                        }
                      : undefined
                  }
                  onPointerDown={startDayLongPress}
                  onPointerMove={handleDayPointerMove}
                  onPointerUp={clearDayLongPress}
                  onPointerCancel={clearDayLongPress}
                  onContextMenu={(e) => {
                    if (ensuredDays.length > 1) e.preventDefault();
                  }}
                  onClick={() => {
                    if (dayJiggleMode) return;
                    setSelectedDayIndex(idx);
                    haptic('selection');
                    centerAndLockMap();
                    if (mapRef.current && dPts.length >= 2) {
                      const lngs = dPts.map((p) => p[0]);
                      const lats = dPts.map((p) => p[1]);
                      mapRef.current.fitBounds(
                        [
                          [Math.min(...lngs), Math.min(...lats)],
                          [Math.max(...lngs), Math.max(...lats)],
                        ],
                        { padding: 48, maxZoom: 14, duration: 360 },
                      );
                    }
                  }}
                >
                  <span
                    className="lkdv-cv2c-day-dot"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  J{idx + 1}
                  {dKm > 0.1 ? ` (${dKm.toFixed(1)} km)` : ''}
                </button>
                {dayJiggleMode && ensuredDays.length > 1 ? (
                  <button
                    type="button"
                    className="lkdv-photo-thumb-remove lkdv-photo-thumb-minus"
                    aria-label={`Supprimer le jour ${idx + 1}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDayAt(idx);
                    }}
                  >
                    <Minus size={11} strokeWidth={2.75} aria-hidden="true" />
                  </button>
                ) : null}
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        {dayJiggleMode ? (
          <button
            type="button"
            className="lkdv-photo-jiggle-done"
            onClick={() => {
              setDayJiggleMode(false);
              haptic('light');
            }}
            aria-label="Terminer la réorganisation des jours"
            title="Terminer"
          >
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        ) : ensuredDays.length < (mode === 'sortie' ? 30 : 60) ? (
          <button
            type="button"
            className="lkdv-cv2c-day-tab lkdv-cv2c-day-tab--add"
            aria-label="Ajouter un jour au tracé"
            title="Ajouter un jour"
            onClick={() => {
              const nextCount = ensuredDays.length + 1;
              const nextDays = syncCarnetDaysV2(ensuredDays, nextCount, startDate);
              form.setValue('nbJours', nextCount, { shouldDirty: true, shouldValidate: true });
              form.setValue('days', nextDays, { shouldDirty: true, shouldValidate: true });
              if (startDate) {
                form.setValue('endDate', carnetEndDateForDaysV2(startDate, nextCount), {
                  shouldDirty: true,
                });
              }
              setSelectedDayIndex(nextCount - 1);
              haptic('selection');
              centerAndLockMap();
            }}
          >
            <Plus size={12} aria-hidden="true" /> J{ensuredDays.length + 1}
          </button>
        ) : null}
      </div>

      <div
        ref={mapWrapRef}
        className={`lkdv-cv2c-map ${isMapInteractive ? 'is-focused' : 'is-scroll-passthrough'}`}
        data-hscroll=""
        {...(isMapInteractive ? { 'data-no-swipe': '', 'data-vaul-no-drag': '' } : {})}
        style={{
          ...(expanded ? { height: '54dvh', minHeight: 340 } : { height: 288, minHeight: 288 }),
          touchAction: isMapInteractive ? 'none' : 'pan-y',
        }}
      >
        <div
          ref={containerRef}
          className="lkdv-cv2c-map-canvas"
          aria-label="Carte du tracé du carnet"
          data-hscroll=""
          {...(isMapInteractive ? { 'data-no-swipe': '', 'data-vaul-no-drag': '' } : {})}
          style={{
            touchAction: isMapInteractive ? 'none' : 'pan-y',
            minHeight: 288,
            cursor: drawing ? 'crosshair' : undefined,
          }}
          onPointerDownCapture={onPointerDown}
          onPointerMoveCapture={onPointerMove}
          onPointerUpCapture={onPointerUp}
          onPointerCancelCapture={onPointerUp}
          onWheel={onMapWheel}
        />
        {!ready && !failed ? (
          <span className="lkdv-cv2c-map-status">
            <Loader2 size={11} className="lkdv-cv2c-spin" aria-hidden="true" /> Carte…
          </span>
        ) : null}
        {failed ? (
          <span className="lkdv-cv2c-map-status" role="status">
            Carte indisponible
          </span>
        ) : null}
        <div className="lkdv-cv2c-map-actions lkdv-cv2c-map-actions--compte" role="group" aria-label="Contrôles de la carte">
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-pressed={drawing}
            aria-label={drawing ? 'Terminer le tracé' : 'Tracer sur la carte'}
            title={drawing ? 'Terminer le tracé' : 'Tracer sur la carte'}
            onClick={() => {
              const next = !drawing;
              setDrawing(next);
              if (next) {
                setEditing(false);
                if (mapRef.current && mapRef.current.getZoom() < 11.5) {
                  mapRef.current.easeTo({ zoom: 13, duration: 340 });
                }
              }
              centerAndLockMap();
              haptic('selection');
            }}
          >
            <Pencil size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-pressed={magnet}
            aria-label={magnet ? 'Aimant aux sentiers activé' : 'Tracé libre'}
            title={magnet ? 'Aimant aux sentiers' : 'Tracé libre'}
            onClick={() => {
              setMagnet((value) => !value);
              centerAndLockMap();
              haptic('selection');
            }}
          >
            <Magnet size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-pressed={editing}
            aria-label="Éditer le tracé : déplacer les points"
            title="Éditer les points"
            onClick={() => {
              const next = !editing;
              setEditing(next);
              if (next) setDrawing(false);
              setSelectedSegment(null);
              centerAndLockMap();
              haptic('selection');
            }}
          >
            <Move size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-pressed={expanded}
            aria-label={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
            title={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
            onClick={() => {
              setExpanded((value) => !value);
              centerAndLockMap();
              haptic('light');
            }}
          >
            {expanded ? <Minimize2 size={17} strokeWidth={1.75} aria-hidden="true" /> : <Maximize2 size={17} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Ma position"
            title="Ma position"
            onClick={() => {
              centerAndLockMap();
              void centerOnMyPosition();
            }}
          >
            <Navigation size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Annuler le dernier geste"
            title="Annuler"
            disabled={historyRef.current.past.length === 0}
            onClick={() => {
              centerAndLockMap();
              undo();
            }}
          >
            <Undo2 size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Rétablir le geste annulé"
            title="Rétablir"
            disabled={historyRef.current.future.length === 0}
            onClick={() => {
              centerAndLockMap();
              redo();
            }}
          >
            <Redo2 size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {trace.length > 0 ? (
            <button
              type="button"
              className="lkdv-cv2c-map-btn"
              aria-label="Effacer le tracé"
              title="Effacer le tracé"
              onClick={() => {
                commitTroncons([]);
                setSelectedSegment(null);
                setSnapState('idle');
                centerAndLockMap();
                haptic('medium');
              }}
            >
              <Trash2 size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {snapState === 'loading' || snapState === 'error' || drawing || editing ? (
        <p className="lkdv-cv2c-map-help">
          <Route size={11} aria-hidden="true" />{' '}
          {snapState === 'loading'
            ? 'Accrochage aux routes et sentiers…'
            : snapState === 'error'
              ? 'Zone hors sentier : tronçon libre lissé.'
              : drawing
                ? magnet
                  ? trace.length === 1
                    ? 'Départ posé : touche un autre point ou glisse sur un chemin pour tracer.'
                    : 'Mode Tracé (Aimant actif) : glisse le long d’un chemin ou touche point par point.'
                  : 'Mode Tracé libre : glisse ou touche point par point.'
                : 'Mode Édition : glisse le départ, l’arrivée ou un point intermédiaire (ré-accrochage auto).'}
        </p>
      ) : null}

      {troncons.length > 0 ? (
        <div className="lkdv-cv2c-hrail" role="list" aria-label="Tronçons du tracé">
          {troncons.map((seg, idx) => (
            <div
              key={seg.id}
              role="listitem"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 999,
                background: 'var(--cv2-field-bg)',
                boxShadow: 'inset 0 0 0 0.5px var(--cv2-field-border)',
                font: '500 12px/1.2 var(--font-sans)',
              }}
            >
              <span>
                T{idx + 1} · {lengthKm(seg.points).toFixed(1).replace('.', ',')} km ·{' '}
                {seg.mode === 'chemin' ? 'Chemin' : 'Libre'}
              </span>
              <button
                type="button"
                className="lkdv-cv2c-chip-x"
                aria-label={`Inverser le tronçon ${idx + 1}`}
                onClick={() => {
                  const next = troncons.map((item) =>
                    item.id === seg.id ? { ...item, points: [...item.points].reverse() } : item,
                  );
                  commitTroncons(next);
                  haptic('selection');
                }}
              >
                <ArrowLeftRight size={11} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="lkdv-cv2c-chip-x"
                aria-label={`Supprimer le tronçon ${idx + 1}`}
                onClick={() => {
                  const next = troncons.filter((item) => item.id !== seg.id);
                  commitTroncons(next);
                  haptic('medium');
                }}
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {trace.length > 1 ? (
        <div className="lkdv-cv2c-inline-add" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {selectedSegment != null ? (
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => removeSegment(selectedSegment)}
            >
              <Trash2 size={12} aria-hidden="true" /> Supprimer le segment {selectedSegment + 1}
            </button>
          ) : (
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => removeSegment(trace.length - 2)}
            >
              <Trash2 size={12} aria-hidden="true" /> Retirer le dernier segment
            </button>
          )}
          {selectedDayIndex === -1 && globalTrace.length >= 2 && ensuredDays.length > 1 ? (
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={splitGlobalTraceIntoDays}
            >
              <Route size={12} aria-hidden="true" /> Répartir sur J1–J{ensuredDays.length}
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/geo+json,application/json"
        className="lkdv-cv2c-sr-only"
        aria-label="Importer un fichier GPX"
        onChange={(event) => {
          void onImportFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {importOpen ? (
        <div className="lkdv-cv2c-story-tools">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <input
              type="search"
              className="lkdv-cv2-input"
              placeholder="Rechercher une sortie…"
              value={sessionSearch}
              onChange={(e) => {
                setSessionSearch(e.target.value);
                void loadSessions(e.target.value);
              }}
              aria-label="Rechercher une sortie"
              style={{ flex: 1 }}
            />
            {sessionsLoading ? <Loader2 size={15} className="lkdv-cv2c-spin" aria-hidden="true" /> : null}
          </div>
          {sessionsLoading && !sessions ? (
            <p className="lkdv-cv2-field-hint">Chargement de tes sorties…</p>
          ) : !sessions || sessions.length === 0 ? (
            <p className="lkdv-cv2-field-hint">Aucune sortie enregistrée trouvée.</p>
          ) : (
            <ul className="lkdv-cv2c-product-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className="lkdv-cv2c-product-row"
                    onClick={() => {
                      const points = parseGeoJsonTrace(session.positions_geojson);
                      if (points.length >= 2) {
                        setTrace(points);
                        syncStartCoordinates(points[0][0], points[0][1], true);
                        if (mapRef.current) {
                          mapRef.current.easeTo({ center: points[0], zoom: 11, duration: 420 });
                        }
                        haptic('success');
                        setImportOpen(false);
                      }
                    }}
                  >
                    <b>{session.title || 'Sortie enregistrée'}</b>
                    <small>
                      {session.started_at
                        ? new Date(session.started_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : ''}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--sm" onClick={() => setImportOpen(false)}>
            Fermer
          </button>
        </div>
      ) : null}

      <div className="lkdv-cv2c-metric-row">
        <span className="lkdv-cv2c-metric">
          <span>Distance</span>
          <b>{formattedDistanceLabel}</b>
        </span>
        <span className="lkdv-cv2c-metric">
          <span>Dénivelé</span>
          <b>
            {gainState === 'loading' ? (
              <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
            ) : (
              <>{form.watch('deniveleM') > 0 ? `+${form.watch('deniveleM')} m` : '—'}</>
            )}
          </b>
        </span>
      </div>
      {elevationPath ? (
        /* FID-051 : « Profil d'altitude » **encadré** (maquette `.card2 prof`,
           HTML L3029) au lieu d'une simple surface. */
        <div className="lkdv-cv2-card lkdv-cv2c-elevation-card">
          <span className="lkdv-cv2-field-label">Profil d’altitude</span>
          <span className="lkdv-cv2c-elevation" aria-label="Profil d’altitude du tracé">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
              <polyline
                points={elevationPath}
                fill="none"
                stroke="var(--lkv-forest-900)"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
        </div>
      ) : null}
      {gainState === 'error' ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          Relèvement indisponible : le tracé reste enregistré, distance et dénivelé peuvent être saisis à la main.
        </p>
      ) : null}
    </div>
  );
}

export default TracePaneV2;
