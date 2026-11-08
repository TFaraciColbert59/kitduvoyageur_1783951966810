'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  Download,
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
 */
export function TracePaneV2({ user }: { user: { id: string } | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const watchedTrace = form.watch('trace');
  const trace = React.useMemo(() => (watchedTrace ?? []) as LngLat[], [watchedTrace]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);
  const drawRef = useRef<{ pointerId: number; points: LngLat[]; drawing: boolean } | null>(null);
  const undoStack = useRef<LngLat[][]>([]);
  const redoStack = useRef<LngLat[][]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [elevations, setElevations] = useState<number[]>([]);
  const [gainState, setGainState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [importOpen, setImportOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionOption[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { haptic } = useHapticFeedback();

  const setTrace = useCallback(
    (next: LngLat[]) => {
      const current = (form.getValues('trace') ?? []) as LngLat[];
      if (current !== next) {
        undoStack.current.push(current);
        if (undoStack.current.length > 30) undoStack.current.shift();
        redoStack.current = [];
      }
      form.setValue('trace', next.slice(0, MAX_POINTS), { shouldDirty: true, shouldValidate: true });
    },
    [form],
  );

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
      setReady(true);
    });
    map.on('click', () => undefined);
    return () => {
      startMarker.current?.remove();
      endMarker.current?.remove();
      startMarker.current = null;
      endMarker.current = null;
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
      map.easeTo({ center: trace[0], zoom: Math.max(map.getZoom(), 11), duration: 420 });
    }
  }, [form, haptic, ready, setTrace, trace]);

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
        .from('hike_sessions')
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
              setDrawing((current) => !current);
              haptic('selection');
            }}
          >
            <PenLine size={13} aria-hidden="true" />
            {drawing ? 'Terminer' : 'Tracer'}
          </button>
          <button type="button" className="lkdv-cv2c-map-btn" onClick={() => void centerOnMyPosition()}>
            <LocateFixed size={13} aria-hidden="true" />
            Ma position
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Annuler le dernier trait"
            disabled={undoStack.current.length === 0}
            onClick={() => {
              const previous = undoStack.current.pop();
              if (!previous) return;
              redoStack.current.push(trace);
              form.setValue('trace', previous, { shouldDirty: true, shouldValidate: true });
              haptic('light');
            }}
          >
            <Undo2 size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-map-btn"
            aria-label="Rétablir le trait annulé"
            disabled={redoStack.current.length === 0}
            onClick={() => {
              const next = redoStack.current.pop();
              if (!next) return;
              undoStack.current.push(trace);
              form.setValue('trace', next, { shouldDirty: true, shouldValidate: true });
              haptic('light');
            }}
          >
            <Redo2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="lkdv-cv2c-map-help">
        <Route size={11} aria-hidden="true" /> {drawing ? 'Trace avec le doigt, puis touche Terminer.' : 'Glisse les repères départ/arrivée pour ajuster.'}
        {trace.length > 1 ? ` Départ et arrivée déplaçables.` : ''}
      </p>

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
            undoStack.current.push(trace);
            redoStack.current = [];
            form.setValue('trace', [], { shouldDirty: true, shouldValidate: true });
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
