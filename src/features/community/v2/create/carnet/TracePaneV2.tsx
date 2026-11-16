'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  ArrowLeftRight,
  Download,
  Loader2,
  Magnet,
  Maximize2,
  Minimize2,
  Move,
  Navigation,
  Pencil,
  PenLine,
  Redo2,
  Route,
  Search,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormContext } from 'react-hook-form';
import {
  elevationGain,
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
import type { CarnetFormValuesV2 } from '../engine/createSchemasV2';
import { parseGeoJsonTrace, readTraceFile } from './gpx';

const DEFAULT_CENTER: [number, number] = [6.87, 45.92];
const MAX_POINTS = 2000;
const CHUNK_PX = 48;
const ROUTE_MAX_POINTS = 12;
const MIN_ROUTE_M = 25;
const MAX_DETOUR = 3.5;

export interface TraceSegmentV2 {
  id: string;
  points: LngLat[];
  mode: 'chemin' | 'libre';
}

interface StrokeState {
  pointerId: number;
  raw: LngLat[];
  snapped: LngLat[];
  cursor: number;
  magnet: boolean;
  free: boolean;
  inFlight: boolean;
  pendingPx: number;
  lastPx: [number, number];
  abort: AbortController;
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;

/** Couleur d'un jeton CSS, lue au runtime pour les couches WebGL (aucun littéral). */
function cssToken(name: string): string {
  if (typeof window === 'undefined') return 'transparent';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || 'transparent';
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
export function TracePaneV2({ user }: { user: { id: string } | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const watchedTrace = form.watch('trace');
  const trace = React.useMemo(() => (watchedTrace ?? []) as LngLat[], [watchedTrace]);
  const startLat = form.watch('startLat');
  const startLng = form.watch('startLng');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);
  const editMarkers = useRef<Marker[]>([]);
  const drawRef = useRef<StrokeState | null>(null);
  const lastAutofocusKey = useRef<string>('');
  /**
   * FID-068 — historique **unique** du tracé (50 pas, `shared/traceEditing`) :
   * un geste validé = une entrée (tracé au doigt, import, point déplacé,
   * segment supprimé), jamais une image de pointeur.
   */
  const historyRef = useRef<TraceHistory>(createTraceHistory(trace));
  const drawingRef = useRef(false);
  const lastCenteredLength = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [magnet, setMagnet] = useState(true);
  const [snapState, setSnapState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);
  const [troncons, setTroncons] = useState<TraceSegmentV2[]>(() =>
    trace.length >= 2 ? [{ id: 'init', points: trace, mode: 'chemin' }] : [],
  );
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [, bumpHistory] = useState(0);
  const [elevations, setElevations] = useState<number[]>([]);
  const [gainState, setGainState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [importOpen, setImportOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionOption[] | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { haptic } = useHapticFeedback();

  // Le formulaire reste la source de vérité ; l'historique se resynchronise
  // quand une valeur arrive d'ailleurs (brouillon rouvert, remise à zéro).
  useEffect(() => {
    if (sameTrace(historyRef.current.present, trace)) return;
    historyRef.current = createTraceHistory(trace);
    bumpHistory((tick) => tick + 1);
  }, [trace]);

  const setTrace = useCallback(
    (next: LngLat[]) => {
      const clipped = next.slice(0, MAX_POINTS);
      const history = traceCommit(historyRef.current, clipped);
      if (history !== historyRef.current) {
        historyRef.current = history;
        bumpHistory((tick) => tick + 1);
      }
      form.setValue('trace', history.present, { shouldDirty: true, shouldValidate: true });
    },
    [form],
  );

  const undo = useCallback(() => {
    const next = traceUndo(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    bumpHistory((tick) => tick + 1);
    form.setValue('trace', next.present, { shouldDirty: true, shouldValidate: true });
    setSelectedSegment(null);
    haptic('light');
  }, [form, haptic]);

  const redo = useCallback(() => {
    const next = traceRedo(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    bumpHistory((tick) => tick + 1);
    form.setValue('trace', next.present, { shouldDirty: true, shouldValidate: true });
    setSelectedSegment(null);
    haptic('light');
  }, [form, haptic]);

  const removeSegment = useCallback(
    (index: number) => {
      const current = (form.getValues('trace') ?? []) as LngLat[];
      const next = deleteTraceSegment(current, index);
      if (sameTrace(current, next)) return;
      setTrace(next);
      setSelectedSegment(null);
      haptic('medium');
    },
    [form, haptic, setTrace],
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
        style: createMapStyle('topo'),
        center: initialCenter,
        zoom: (startLng != null && startLat != null) || trace.length > 0 ? 11 : 6,
        minZoom: 2,
        maxZoom: 17,
        attributionControl: false,
        renderWorldCopies: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.on('load', () => {
      const forest = cssToken('--lkv-forest-900');
      const paper = cssToken('--lkv-surface-paper');
      const inverted = cssToken('--lkv-text-inverted');
      map.addSource('cv2c-carnet-trace', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('cv2c-carnet-ends', { type: 'geojson', data: EMPTY_FC as never });
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
      const accent = cssToken('--lkv-secondary');
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

  // Le tracé suit le formulaire (annuler/rétablir, import, tracé au doigt).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
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
      const start = new Marker({ draggable: true }).setLngLat(trace[0]).addTo(map);
      start.on('dragend', () => {
        const position = start.getLngLat();
        const current = (form.getValues('trace') ?? []) as LngLat[];
        if (current.length === 0) return;
        setTrace([[position.lng, position.lat], ...current.slice(1)]);
        haptic('selection');
      });
      startMarker.current = start;
      if (trace.length > 1) {
        const end = new Marker({ draggable: true }).setLngLat(trace[trace.length - 1]).addTo(map);
        end.on('dragend', () => {
          const position = end.getLngLat();
          const current = (form.getValues('trace') ?? []) as LngLat[];
          if (current.length === 0) return;
          setTrace([...current.slice(0, -1), [position.lng, position.lat]]);
          haptic('selection');
        });
        endMarker.current = end;
      }
      // Ne recadrer qu'à l'arrivée d'un nouveau tracé : déplacer un repère (même
      // nombre de points) ne doit pas faire sauter la carte sous le doigt.
      if (trace.length !== lastCenteredLength.current) {
        lastCenteredLength.current = trace.length;
        map.easeTo({ center: trace[0], zoom: Math.max(map.getZoom(), 11), duration: 420 });
      }
    }
  }, [form, haptic, ready, selectedSegment, setTrace, trace]);

  // F2.1 — Autofocus réactif sur startLat/startLng ou trace[0]
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const target: [number, number] | null =
      trace.length > 0
        ? trace[0]
        : startLng != null && startLat != null
          ? [startLng, startLat]
          : null;
    if (!target) return;
    const key = `${target[0].toFixed(5)},${target[1].toFixed(5)}`;
    if (lastAutofocusKey.current !== key) {
      lastAutofocusKey.current = key;
      map.easeTo({ center: target, zoom: Math.max(map.getZoom(), 11), duration: 420 });
    }
  }, [ready, startLat, startLng, trace]);

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
  // de 40 repères) devient une poignée déplaçable (maquette `.tp-handle`).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    editMarkers.current.forEach((marker) => marker.remove());
    editMarkers.current = [];
    if (!editing || trace.length < 3) return;
    const stride = Math.max(1, Math.ceil((trace.length - 2) / 40));
    for (let index = 1; index < trace.length - 1; index += stride) {
      const marker = new Marker({ draggable: true }).setLngLat(trace[index]).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        const current = (form.getValues('trace') ?? []) as LngLat[];
        const moved = moveTracePoint(current, index, [position.lng, position.lat]);
        if (sameTrace(current, moved)) return;
        setTrace(moved);
        haptic('selection');
      });
      editMarkers.current.push(marker);
    }
    return () => {
      editMarkers.current.forEach((marker) => marker.remove());
      editMarkers.current = [];
    };
  }, [editing, form, haptic, ready, setTrace, trace]);

  // Un segment supprimé (ou un tracé remplacé) invalide la sélection.
  useEffect(() => {
    if (selectedSegment != null && selectedSegment >= traceSegmentCount(trace)) {
      setSelectedSegment(null);
    }
  }, [selectedSegment, trace]);

  const commitTroncons = useCallback(
    (nextTroncons: TraceSegmentV2[]) => {
      setTroncons(nextTroncons);
      const joined = joinSegments(
        nextTroncons.map((item) => item.points),
        MAX_POINTS,
      );
      setTrace(joined);
    },
    [setTrace],
  );

  const flushChunk = useCallback(
    async (stroke: StrokeState) => {
      if (stroke.inFlight || stroke.cursor >= stroke.raw.length - 1) return;
      stroke.inFlight = true;
      stroke.pendingPx = 0;
      const startIndex = Math.max(0, stroke.cursor - 1);
      const chunk = stroke.raw.slice(startIndex);
      stroke.cursor = stroke.raw.length;
      const from = stroke.snapped[stroke.snapped.length - 1] ?? chunk[0];
      const pixelTolerance = 0.00012;
      let piece: LngLat[] | null = null;
      let usedRoute = false;

      if (stroke.magnet && lengthKm(chunk) * 1000 >= MIN_ROUTE_M) {
        setSnapState('loading');
        try {
          const waypoints = pickWaypoints([from, ...chunk.slice(1)], ROUTE_MAX_POINTS, pixelTolerance);
          const encoded = waypoints.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
          const res = await fetch(`/api/route?points=${encodeURIComponent(encoded)}&mode=pieton`, {
            signal: stroke.abort.signal,
          });
          if (res.ok) {
            const payload = (await res.json()) as { geometry?: LngLat[] };
            const cleaned = Array.isArray(payload.geometry) ? removeSpurs(payload.geometry) : [];
            const airKm = Math.max(0.02, lengthKm([from, chunk[chunk.length - 1]]));
            const routedKm = lengthKm(cleaned);
            if (cleaned.length >= 2 && routedKm / airKm <= MAX_DETOUR) {
              piece = cleaned;
              usedRoute = true;
            }
          }
        } catch {
          /* repli en tronçon libre */
        }
      }

      if (!piece) {
        if (stroke.magnet && lengthKm(chunk) * 1000 >= MIN_ROUTE_M) {
          stroke.free = true;
        }
        piece = simplify(smooth(chunk, 2), pixelTolerance);
      }

      if (piece.length >= 2) {
        stroke.snapped = stroke.snapped.length <= 1 && usedRoute ? piece : joinLines(stroke.snapped, piece, 2);
      }
      setSnapState(stroke.magnet && stroke.free ? 'error' : 'idle');
      stroke.inFlight = false;
    },
    [],
  );

  // ── Tracé au doigt par tronçons ──────────────────────────────────────────
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing || !mapRef.current) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const px: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    const point = mapRef.current.unproject(px);
    const startPt: LngLat = [point.lng, point.lat];
    drawRef.current = {
      pointerId: event.pointerId,
      raw: [startPt],
      snapped: [startPt],
      cursor: 0,
      magnet,
      free: false,
      inFlight: false,
      pendingPx: 0,
      lastPx: px,
      abort: new AbortController(),
    };
    setSnapState('idle');
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optionnelle */
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drawRef.current;
    if (!current || current.pointerId !== event.pointerId || !mapRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    const point = mapRef.current.unproject(px);
    const last = current.raw[current.raw.length - 1];
    if (last && Math.hypot(last[0] - point.lng, last[1] - point.lat) < 0.00002) return;
    current.raw.push([point.lng, point.lat]);
    current.pendingPx += Math.hypot(px[0] - current.lastPx[0], px[1] - current.lastPx[1]);
    current.lastPx = px;
    if (current.magnet && !current.inFlight && current.pendingPx >= CHUNK_PX) {
      void flushChunk(current);
    }
  };

  const onPointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drawRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drawRef.current = null;
    await flushChunk(current);
    const pixelTolerance = 0.00012;
    const finalPoints =
      current.snapped.length >= 2
        ? current.snapped
        : simplify(smooth(current.raw, 2), pixelTolerance);
    if (finalPoints.length < 2) {
      setSnapState('idle');
      return;
    }
    const mode: 'chemin' | 'libre' = current.magnet && !current.free ? 'chemin' : 'libre';
    const nextSeg: TraceSegmentV2 = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `seg-${Date.now()}`,
      points: finalPoints,
      mode,
    };
    const nextTroncons = [...troncons, nextSeg];
    commitTroncons(nextTroncons);
    haptic('medium');
    toast.success(
      mode === 'chemin'
        ? `Tronçon ${nextTroncons.length} accroché aux sentiers`
        : `Tronçon ${nextTroncons.length} libre ajouté`,
    );
  };

  // Pendant le tracé, la carte ne capte pas le geste : le doigt dessine.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (drawing) {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragPan.enable();
      map.dragRotate.enable();
      map.doubleClickZoom.enable();
    }
  }, [drawing, ready]);

  // ── Distance, dénivelé, profil ───────────────────────────────────────────
  const km = lengthKm(trace);
  useEffect(() => {
    form.setValue('distanceKm', Math.min(10_000, Math.round(km * 10) / 10), {
      shouldDirty: trace.length > 1,
    });
  }, [form, km, trace.length]);

  useEffect(() => {
    if (trace.length < 2) {
      setElevations([]);
      setGainState('idle');
      form.setValue('deniveleM', 0);
      return;
    }
    const controller = new AbortController();
    setGainState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const count = Math.max(2, Math.min(100, Math.round(km * 8) + 2));
        const samples = sampleAlong(trace, count);
        const points = samples.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
        const response = await fetch(`/api/elevation?points=${points}`, { signal: controller.signal });
        if (!response.ok) throw new Error('elevation');
        const payload = (await response.json()) as { elevations?: Array<number | null> };
        const values = Array.isArray(payload.elevations) ? payload.elevations : [];
        const gain = elevationGain(values).gain;
        setElevations(values.map((value) => (typeof value === 'number' ? value : 0)));
        form.setValue('deniveleM', Math.min(30_000, gain), { shouldDirty: true });
        setGainState('idle');
      } catch {
        if (!controller.signal.aborted) setGainState('error');
      }
    }, 650);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form, km, trace]);

  // ── « Ma position » ──────────────────────────────────────────────────────
  const centerOnMyPosition = async () => {
    try {
      const position = await getCurrentGeoPosition({ enableHighAccuracy: true, timeout: 10_000 });
      const point: LngLat = [position.longitude, position.latitude];
      if (trace.length === 0) setTrace([point]);
      mapRef.current?.flyTo({ center: point, zoom: 12, duration: 700 });
      form.setValue('startLat', position.latitude, { shouldDirty: true });
      form.setValue('startLng', position.longitude, { shouldDirty: true });
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

  return (
    <div className="lkdv-cv2c-kit">
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
              const reduced =
                typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              containerRef.current?.scrollIntoView?.({
                block: 'center',
                behavior: reduced ? 'auto' : 'smooth',
              });
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

      <div
        className="lkdv-cv2c-map"
        data-hscroll
        style={expanded ? { height: '54dvh', minHeight: 340 } : undefined}
      >
        <div
          ref={containerRef}
          className="lkdv-cv2c-map-canvas"
          aria-label="Carte du tracé du carnet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
              if (next) setEditing(false);
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
            onClick={() => void centerOnMyPosition()}
          >
            <Navigation size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Annuler le dernier geste"
            title="Annuler"
            disabled={historyRef.current.past.length === 0}
            onClick={undo}
          >
            <Undo2 size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Rétablir le geste annulé"
            title="Rétablir"
            disabled={historyRef.current.future.length === 0}
            onClick={redo}
          >
            <Redo2 size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      {snapState === 'loading' || snapState === 'error' || drawing || editing ? (
        <p className="lkdv-cv2c-map-help">
          <Route size={11} aria-hidden="true" />{' '}
          {snapState === 'loading'
            ? 'Accrochage aux sentiers…'
            : snapState === 'error'
              ? 'Pas de chemin trouvé : tronçon libre lissé.'
              : drawing
                ? magnet
                  ? 'Trace au doigt : accrochage auto aux sentiers.'
                  : 'Trace au doigt en mode libre.'
                : 'Glisse un repère (départ, arrivée ou point intermédiaire) pour ajuster.'}
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
        <div className="lkdv-cv2c-inline-add">
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
                        form.setValue('startLat', points[0][1], { shouldDirty: true });
                        form.setValue('startLng', points[0][0], { shouldDirty: true });
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
          <b>{km > 0 ? `${km.toFixed(1).replace('.', ',')} km` : '—'}</b>
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
