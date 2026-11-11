'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  Download,
  Grip,
  Loader2,
  LocateFixed,
  PenLine,
  Redo2,
  Route,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  elevationGain,
  joinLines,
  lengthKm,
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);
  const editMarkers = useRef<Marker[]>([]);
  const drawRef = useRef<{ pointerId: number; points: LngLat[]; drawing: boolean } | null>(null);
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
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [, bumpHistory] = useState(0);
  const [elevations, setElevations] = useState<number[]>([]);
  const [gainState, setGainState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [importOpen, setImportOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionOption[] | null>(null);
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
      map = new MapLibreMap({
        container: containerRef.current,
        style: createMapStyle('topo'),
        center: DEFAULT_CENTER,
        zoom: 6,
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

  // ── Tracé au doigt ───────────────────────────────────────────────────────
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing || !mapRef.current) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = mapRef.current.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    drawRef.current = { pointerId: event.pointerId, points: [[point.lng, point.lat]], drawing: true };
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
    const point = mapRef.current.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    const last = current.points[current.points.length - 1];
    if (last && Math.hypot(last[0] - point.lng, last[1] - point.lat) < 0.00002) return;
    current.points.push([point.lng, point.lat]);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drawRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drawRef.current = null;
    const pixelTolerance = 0.00012;
    const simplified = simplify(smooth(current.points, 2), pixelTolerance);
    if (simplified.length < 2) return;
    const next = joinLines((form.getValues('trace') ?? []) as LngLat[], simplified);
    setTrace(next);
    haptic('medium');
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

  const loadSessions = async () => {
    if (!user) return;
    setImportOpen(true);
    if (sessions) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        // RGPD : la trace brute de ses propres sorties se lit sur la vue
        // participant, plus sur la table (colonne retirée au rôle authenticated).
        .from('hike_sessions_participant')
        .select('id, title, started_at, positions_geojson')
        .eq('user_id', user.id)
        .not('positions_geojson', 'is', null)
        .order('started_at', { ascending: false })
        .limit(8);
      setSessions(Array.isArray(data) ? (data as SessionOption[]) : []);
    } catch {
      setSessions([]);
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
        <div className="lkdv-cv2c-rcards" role="group" aria-label="Point de départ du tracé">
          <button
            type="button"
            className="lkdv-cv2c-rcard"
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
              <PenLine size={18} aria-hidden="true" />
            </span>
            <span className="lkdv-cv2c-rcard-text">
              <b>Tracer sur la carte</b>
              <small>Dessine ton parcours au doigt.</small>
            </span>
          </button>
          <button
            type="button"
            className="lkdv-cv2c-rcard"
            onClick={() => {
              fileInputRef.current?.click();
              haptic('selection');
            }}
          >
            <span className="lkdv-cv2c-rcard-icon">
              <Upload size={18} aria-hidden="true" />
            </span>
            <span className="lkdv-cv2c-rcard-text">
              <b>Importer un GPX</b>
              <small>Depuis ta montre ou une application.</small>
            </span>
          </button>
          <button
            type="button"
            className="lkdv-cv2c-rcard"
            onClick={() => {
              void loadSessions();
              haptic('selection');
            }}
          >
            <span className="lkdv-cv2c-rcard-icon">
              <Download size={18} aria-hidden="true" />
            </span>
            <span className="lkdv-cv2c-rcard-text">
              <b>Une sortie enregistrée</b>
              <small>Reprendre une trace de ton suivi (hike_sessions).</small>
            </span>
          </button>
        </div>
      </div>

      <div className="lkdv-cv2c-map" data-hscroll>
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
        <div className="lkdv-cv2c-map-actions">
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-pressed={drawing}
            onClick={() => {
              const next = !drawing;
              setDrawing(next);
              if (next) setEditing(false);
              haptic('selection');
            }}
          >
            <PenLine size={13} aria-hidden="true" />
            {drawing ? 'Terminer' : 'Tracer'}
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-pressed={editing}
            aria-label="Éditer le tracé : déplacer les points"
            onClick={() => {
              const next = !editing;
              setEditing(next);
              if (next) setDrawing(false);
              setSelectedSegment(null);
              haptic('selection');
            }}
          >
            <Grip size={13} aria-hidden="true" />
            Éditer
          </button>
          <button type="button" className="lkdv-cv2c-map-btn" onClick={() => void centerOnMyPosition()}>
            <LocateFixed size={13} aria-hidden="true" />
            Ma position
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Annuler le dernier geste"
            disabled={historyRef.current.past.length === 0}
            onClick={undo}
          >
            <Undo2 size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Rétablir le geste annulé"
            disabled={historyRef.current.future.length === 0}
            onClick={redo}
          >
            <Redo2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="lkdv-cv2c-map-help">
        <Route size={11} aria-hidden="true" />{' '}
        {drawing
          ? 'Trace avec le doigt, puis touche Terminer.'
          : editing
            ? 'Glisse un repère (départ, arrivée ou point intermédiaire) pour ajuster.'
            : 'Touche le tracé pour choisir un segment, ou glisse le départ et l’arrivée.'}
        {trace.length > 1 ? ' Annuler et rétablir restent disponibles.' : ''}
      </p>

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

      {trace.length > 1 ? (
        <details className="lkdv-cv2c-point-list">
          <summary className="lkdv-cv2-field-hint">Liste des points ({trace.length})</summary>
          <ol>
            {trace
              .filter((_, index) => index % Math.max(1, Math.round(trace.length / 20)) === 0)
              .map(([lng, lat], index) => (
                <li key={`${index}-${lng}-${lat}`}>
                  {lat.toFixed(4)}° N · {lng.toFixed(4)}° E
                </li>
              ))}
          </ol>
        </details>
      ) : null}
      <div className="lkdv-cv2c-inline-add">
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--sm" onClick={() => fileInputRef.current?.click()}>
          <Upload size={12} aria-hidden="true" /> Importer un GPX
        </button>
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--sm" onClick={() => void loadSessions()}>
          <Download size={12} aria-hidden="true" /> Sortie enregistrée
        </button>
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--sm"
          onClick={() => {
            if (trace.length === 0) return;
            setTrace([]);
            setSelectedSegment(null);
            haptic('medium');
          }}
        >
          <Trash2 size={12} aria-hidden="true" /> Effacer
        </button>
      </div>
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
          {sessions === null ? (
            <p className="lkdv-cv2-field-hint">Chargement de tes sorties…</p>
          ) : sessions.length === 0 ? (
            <p className="lkdv-cv2-field-hint">Aucune sortie enregistrée avec une trace.</p>
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
