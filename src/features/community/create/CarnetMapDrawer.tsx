'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, CalendarDays, Settings2, Trash2, ImagePlus, Loader2, WifiOff, PenLine, Route, Type, AlignLeft, Flag, Check, Magnet, Undo2, Eraser, LocateFixed, Maximize2, Mountain } from 'lucide-react';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { createClient } from '@/lib/supabase/client';
import { createDefaults, createSchemas, type CarnetFormValues } from './engine/createSchemas';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { PlaceSearch } from './shared/PlaceSearch';
import { insertCommunityPost } from './upload';
import { elevationGain, formatDistance, joinLines, joinSegments, lengthKm, pickWaypoints, removeSpurs, sampleAlong, smooth, type LngLat } from './carnet/traceEngine';
import { useCarnetDaysBridge } from './carnet/carnetDaysBridge';
import './carnet-map-drawer.css';

type Moment = { id: string; label: string; note: string; media?: string; lng: number; lat: number };
type Day = { id: string; label: string; lng: number; lat: number; moments: Moment[] };

const DEFAULT_CENTER: [number, number] = [6.87, 45.92];
const MAX_TRACE_POINTS = 2000;
const MAX_DAYS = 60;
const MAX_MOMENTS = 50;
/** Le routeur accepte 12 points de passage par requête (`MAX_ROUTE_POINTS`). */
const ROUTE_MAX_POINTS = 12;
/** Un point brut tous les 5 px de doigt : assez fin pour la forme, léger pour le routeur. */
const SAMPLE_PX = 5;
/** Le tracé s'accroche par morceaux de ~110 px pendant le geste. */
const CHUNK_PX = 110;
/** Précision du doigt pour réduire un morceau en points de passage. */
const WAYPOINT_PX = 12;
/** En dessous, pas de routage : le morceau est trop court pour changer de chemin. */
const MIN_ROUTE_M = 12;
/** Une requête au plus par seconde (limite du site : 60 par minute). */
const MIN_ROUTE_INTERVAL_MS = 1000;
const ROUTE_TIMEOUT_MS = 9000;

type Segment = { id: string; points: LngLat[]; mode: 'chemin' | 'libre' };
type Stroke = {
  pointerId: number;
  /** Points bruts du doigt. */
  raw: LngLat[];
  lastPx: [number, number];
  /** Premier point brut pas encore accroché. */
  pendingFrom: number;
  pendingPx: number;
  /** Partie déjà accrochée (commence à la fin du tracé existant). */
  snapped: LngLat[];
  anchored: boolean;
  magnet: boolean;
  inFlight: AbortController | null;
  ended: boolean;
  free: boolean;
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;

function lineFeature(points: LngLat[], properties: Record<string, string>) {
  return points.length >= 2 ? { type: 'Feature', properties, geometry: { type: 'LineString', coordinates: points } } : null;
}

function pointFeature(point: LngLat, kind: string) {
  return { type: 'Feature', properties: { kind }, geometry: { type: 'Point', coordinates: point } };
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function clampCoordinate(value: number, min: number, max: number): number | null {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null;
}

function sanitizeTrace(points: Array<[number, number]>): Array<[number, number]> {
  return points
    .map(([lng, lat]) => {
      const safeLng = clampCoordinate(lng, -180, 180);
      const safeLat = clampCoordinate(lat, -90, 90);
      return safeLng === null || safeLat === null ? null : [safeLng, safeLat] as [number, number];
    })
    .filter((point): point is [number, number] => point !== null)
    .slice(0, MAX_TRACE_POINTS);
}

function dayLabel(index: number) { return `Jour ${index + 1}`; }

function shortDate(value: string): string {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
}

function DatePill({ value, label, onChange }: { value: string; label: string; onChange: (next: string) => void }) {
  return (
    <label className="lkdv-date-pill">
      <CalendarDays size={14} aria-hidden="true" />
      <span>{shortDate(value) || label}</span>
      <input type="date" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function CarnetMapDrawer({ open, onClose, user, onCreated }: {
  open: boolean; onClose: () => void; user: any; onCreated: (kind: 'carnet', id: string) => void;
}) {
  const form = useForm<CarnetFormValues>({
    resolver: zodResolver(createSchemas.carnet as never),
    defaultValues: createDefaults('carnet'),
  });
  const [days, setDays] = useState<Day[]>([]);
  const [active, setActive] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const trace = useMemo(() => joinSegments(segments.map((segment) => segment.points), MAX_TRACE_POINTS), [segments]);
  const km = useMemo(() => lengthKm(trace), [trace]);
  const [magnet, setMagnet] = useState(true);
  const [snapState, setSnapState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [gain, setGain] = useState<number | null>(null);
  const [gainState, setGainState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [confirmClear, setConfirmClear] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(6);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const traceRef = useRef<Array<[number, number]>>([]);
  const daysRef = useRef<Day[]>([]);
  const markersRef = useRef<Marker[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const pointersRef = useRef(new Map<number, [number, number]>());
  const pinchRef = useRef<{ cx: number; cy: number; dist: number } | null>(null);
  const liveFrame = useRef<number | null>(null);
  const lastRouteAt = useRef(0);
  const publishDays = useCarnetDaysBridge();

  useEffect(() => { traceRef.current = trace; }, [trace]);
  useEffect(() => () => {
    strokeRef.current?.inFlight?.abort();
    strokeRef.current = null;
    if (liveFrame.current !== null) cancelAnimationFrame(liveFrame.current);
  }, []);
  useEffect(() => { daysRef.current = days; }, [days]);

  useEffect(() => {
    if (!open || !mapNode.current || mapRef.current) return;
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const map = new MapLibreMap({
      container: mapNode.current,
      style: createMapStyle('topo'),
      center: DEFAULT_CENTER,
      zoom: 6,
      minZoom: 2,
      maxZoom: 17,
      attributionControl: false,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    map.on('zoomend', () => setZoom(map.getZoom()));
    map.on('load', () => {
      const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
      map.addSource('carnet-trace', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('carnet-live', { type: 'geojson', data: EMPTY_FC as never });
      map.addSource('carnet-ends', { type: 'geojson', data: EMPTY_FC as never });
      map.addLayer({ id: 'carnet-trace-casing', type: 'line', source: 'carnet-trace', layout: round, paint: { 'line-color': 'rgba(255,255,255,.95)', 'line-width': 8 } });
      map.addLayer({ id: 'carnet-trace-line', type: 'line', source: 'carnet-trace', filter: ['==', ['get', 'mode'], 'chemin'], layout: round, paint: { 'line-color': '#17402C', 'line-width': 4 } });
      map.addLayer({ id: 'carnet-trace-free', type: 'line', source: 'carnet-trace', filter: ['==', ['get', 'mode'], 'libre'], layout: round, paint: { 'line-color': '#A05A3C', 'line-width': 3.4, 'line-dasharray': [1.2, 1.4] } });
      map.addLayer({ id: 'carnet-live-casing', type: 'line', source: 'carnet-live', layout: round, paint: { 'line-color': 'rgba(255,255,255,.9)', 'line-width': 7 } });
      map.addLayer({ id: 'carnet-live-snapped', type: 'line', source: 'carnet-live', filter: ['==', ['get', 'kind'], 'snapped'], layout: round, paint: { 'line-color': '#2E7D5B', 'line-width': 4 } });
      map.addLayer({ id: 'carnet-live-pending', type: 'line', source: 'carnet-live', filter: ['==', ['get', 'kind'], 'pending'], layout: round, paint: { 'line-color': '#17402C', 'line-width': 2.6, 'line-opacity': 0.55, 'line-dasharray': [0.6, 1.8] } });
      map.addLayer({ id: 'carnet-ends', type: 'circle', source: 'carnet-ends', paint: { 'circle-radius': 6.5, 'circle-color': ['match', ['get', 'kind'], 'start', '#ffffff', '#17402C'], 'circle-stroke-color': ['match', ['get', 'kind'], 'start', '#17402C', '#ffffff'], 'circle-stroke-width': 3 } });
      setMapReady(true);
    });
    return () => { map.remove(); mapRef.current = null; setMapReady(false); };
  }, [open]);

  // Tracé validé : un trait par tronçon (plein = sur les chemins, tirets = libre), départ et arrivée.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const lines = segments.map((segment) => lineFeature(segment.points, { mode: segment.mode })).filter(Boolean);
    (map.getSource('carnet-trace') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: lines } as never);
    const ends = trace.length === 0 ? [] : [pointFeature(trace[0], 'start'), ...(trace.length > 1 ? [pointFeature(trace[trace.length - 1], 'end')] : [])];
    (map.getSource('carnet-ends') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: ends } as never);
  }, [segments, trace, mapReady]);

  // Distance mesurée sur le tracé ; dénivelé lu sur le relief (au plus 100 échantillons).
  useEffect(() => {
    form.setValue('distanceKm', Math.min(10_000, Math.round(km * 10) / 10), { shouldDirty: trace.length > 1 });
  }, [form, km, trace.length]);
  useEffect(() => {
    if (trace.length < 2) {
      setGain(null);
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
        if (!response.ok) throw new Error('elevation_unavailable');
        const payload = await response.json();
        const { gain: up } = elevationGain(Array.isArray(payload?.elevations) ? payload.elevations : []);
        setGain(up);
        setGainState('idle');
        form.setValue('deniveleM', Math.min(30_000, up), { shouldDirty: true });
      } catch {
        if (!controller.signal.aborted) setGainState('error');
      }
    }, 700);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form, km, trace]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    days.forEach((day, dayIndex) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-day-marker';
      const dayNumber = document.createElement('span');
      dayNumber.textContent = String(dayIndex + 1);
      element.append(dayNumber);
      element.setAttribute('aria-label', day.label);
      element.addEventListener('click', () => { setActive(dayIndex + 1); scrollToSlide(dayIndex + 1); });
      const marker = new Marker({ element, draggable: true }).setLngLat([day.lng, day.lat]).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        const snapped = nearestTrace(position.lng, position.lat);
        setDays((current) => current.map((entry) => entry.id === day.id ? { ...entry, lng: snapped[0], lat: snapped[1] } : entry));
      });
      markersRef.current.push(marker);
      day.moments.forEach((moment, momentIndex) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'lkdv-moment-marker';
        const momentNumber = document.createElement('span');
        momentNumber.textContent = String(momentIndex + 1);
        dot.append(momentNumber);
        dot.setAttribute('aria-label', moment.label);
        dot.addEventListener('click', () => { setActive(dayIndex + 1); scrollToSlide(dayIndex + 1); });
        const momentMarker = new Marker({ element: dot, draggable: true }).setLngLat([moment.lng, moment.lat]).addTo(map);
        momentMarker.on('dragend', () => {
          const position = momentMarker.getLngLat();
          const snapped = nearestTrace(position.lng, position.lat);
          setDays((current) => current.map((entry) => entry.id === day.id ? { ...entry, moments: entry.moments.map((m) => m.id === moment.id ? { ...m, lng: snapped[0], lat: snapped[1] } : m) } : entry));
        });
        markersRef.current.push(momentMarker);
      });
    });
  }, [days]);

  const scrollToSlide = (index: number) => {
    const node = scroller.current;
    if (!node) return;
    const child = node.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const nearestTrace = (lng: number, lat: number): [number, number] => {
    const points = traceRef.current;
    if (points.length === 0) return [lng, lat];
    let best = points[0]; let bestDistance = Number.POSITIVE_INFINITY;
    points.forEach((point) => { const distance = (point[0] - lng) ** 2 + (point[1] - lat) ** 2; if (distance < bestDistance) { bestDistance = distance; best = point; } });
    return best;
  };

  const addDay = () => {
    if (days.length >= MAX_DAYS) return;
    const map = mapRef.current;
    const center = map?.getCenter();
    const snapped = nearestTrace(center?.lng ?? DEFAULT_CENTER[0], center?.lat ?? DEFAULT_CENTER[1]);
    const safeLng = clampCoordinate(snapped[0], -180, 180) ?? DEFAULT_CENTER[0];
    const safeLat = clampCoordinate(snapped[1], -90, 90) ?? DEFAULT_CENTER[1];
    const day: Day = { id: crypto.randomUUID(), label: dayLabel(days.length), lng: safeLng, lat: safeLat, moments: [] };
    setDays((current) => [...current, day]);
    setActive(days.length + 1);
    window.setTimeout(() => scrollToSlide(days.length + 1), 50);
  };

  const addMoment = (dayId: string) => {
    const day = days.find((entry) => entry.id === dayId);
    if (!day || day.moments.length >= MAX_MOMENTS) return;
    const moment: Moment = { id: crypto.randomUUID(), label: 'Moment', note: '', lng: day.lng + .01, lat: day.lat + .01 };
    setDays((current) => current.map((entry) => entry.id === dayId ? { ...entry, moments: [...entry.moments, moment] } : entry));
  };

  const updateMoment = (dayId: string, momentId: string, patch: Partial<Moment>) => {
    setDays((current) => current.map((entry) => entry.id === dayId ? { ...entry, moments: entry.moments.map((m) => m.id === momentId ? { ...m, ...patch } : m) } : entry));
  };

  /** Tolérance (degrés) équivalant à `px` pixels au zoom courant. */
  const pixelTolerance = (px: number) => {
    const map = mapRef.current;
    if (!map) return 0.0001;
    const a = map.unproject([0, 0]);
    const b = map.unproject([px, px]);
    return Math.max(Math.abs(b.lng - a.lng), Math.abs(b.lat - a.lat)) || 0.0001;
  };

  /** Trait en cours : partie accrochée (pleine) et fin du geste en attente (pointillés). */
  const renderLive = () => {
    if (liveFrame.current !== null) return;
    liveFrame.current = requestAnimationFrame(() => {
      liveFrame.current = null;
      const source = mapRef.current?.getSource('carnet-live') as GeoJSONSource | undefined;
      if (!source) return;
      const stroke = strokeRef.current;
      if (!stroke) { source.setData(EMPTY_FC as never); return; }
      const tail = stroke.snapped[stroke.snapped.length - 1];
      const pending = [tail, ...stroke.raw.slice(stroke.pendingFrom)];
      source.setData({ type: 'FeatureCollection', features: [lineFeature(stroke.snapped, { kind: 'snapped' }), lineFeature(pending, { kind: 'pending' })].filter(Boolean) } as never);
    });
  };

  const fetchRoute = async (waypoints: LngLat[], signal: AbortSignal): Promise<LngLat[] | null> => {
    try {
      const points = waypoints.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
      const response = await fetch(`/api/route?points=${points}&mode=pieton`, { signal });
      if (!response.ok) return null;
      const payload = await response.json();
      const legs = Array.isArray(payload?.legs) ? payload.legs : [];
      const geometry = sanitizeTrace(legs.flatMap((leg: { geometry?: Array<[number, number]> }) => (Array.isArray(leg.geometry) ? leg.geometry : [])));
      return geometry.length >= 2 ? removeSpurs(geometry) : null;
    } catch {
      return null;
    }
  };

  const commitStroke = (stroke: Stroke) => {
    if (strokeRef.current !== stroke) return;
    strokeRef.current = null;
    renderLive();
    const points = sanitizeTrace(stroke.snapped);
    // Un simple appui sans tracé existant pose le départ.
    if (points.length >= 2 || (!stroke.anchored && points.length === 1)) {
      setSegments((current) => [...current, { id: crypto.randomUUID(), points, mode: stroke.magnet && !stroke.free ? 'chemin' : 'libre' }]);
      if (typeof navigator !== 'undefined') navigator.vibrate?.(8);
    }
    setSnapState(stroke.magnet && stroke.free ? 'error' : 'idle');
  };

  /**
   * Accroche la partie en attente du geste : points de passage réduits à la
   * forme du geste, routage piéton, retrait des allers-retours. Un détour
   * démesuré ou un réseau absent donne un tronçon libre, lissé.
   */
  const flushChunk = async (stroke: Stroke): Promise<void> => {
    if (stroke.inFlight || strokeRef.current !== stroke) return;
    const end = stroke.raw.length;
    const pending = stroke.raw.slice(stroke.pendingFrom, end);
    if (pending.length > 0) {
      const from = stroke.snapped[stroke.snapped.length - 1];
      const chunk = [from, ...pending];
      stroke.pendingPx = 0;
      let piece: LngLat[] | null = null;
      let routed = false;
      if (stroke.magnet && lengthKm(chunk) * 1000 >= MIN_ROUTE_M) {
        const waypoints = pickWaypoints(chunk, ROUTE_MAX_POINTS, pixelTolerance(WAYPOINT_PX));
        const controller = new AbortController();
        stroke.inFlight = controller;
        setSnapState('loading');
        const wait = MIN_ROUTE_INTERVAL_MS - (Date.now() - lastRouteAt.current);
        if (wait > 0) await sleep(wait);
        lastRouteAt.current = Date.now();
        const timer = window.setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
        const geometry = controller.signal.aborted ? null : await fetchRoute(waypoints, controller.signal);
        window.clearTimeout(timer);
        stroke.inFlight = null;
        if (strokeRef.current !== stroke) return;
        if (geometry && lengthKm(geometry) <= lengthKm(chunk) * 3 + 0.3) {
          piece = geometry;
          routed = true;
        } else {
          stroke.free = true;
        }
      } else if (stroke.magnet) {
        piece = chunk;
      }
      if (!piece) piece = smooth(chunk);
      stroke.snapped = routed && !stroke.anchored && stroke.snapped.length === 1 ? piece : joinLines(stroke.snapped, piece, 2);
      stroke.pendingFrom = end;
      renderLive();
      setSnapState(stroke.magnet && stroke.free ? 'error' : 'idle');
    }
    if (strokeRef.current !== stroke) return;
    if (stroke.raw.length > stroke.pendingFrom && (stroke.ended || stroke.pendingPx >= CHUNK_PX)) {
      await flushChunk(stroke);
      return;
    }
    if (stroke.ended) commitStroke(stroke);
  };

  const cancelStroke = () => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    stroke.inFlight?.abort();
    strokeRef.current = null;
    renderLive();
    setSnapState('idle');
  };

  const layerPoint = (event: React.PointerEvent<HTMLDivElement>): { px: [number, number]; ll: LngLat } | null => {
    const map = mapRef.current;
    if (!map) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const px: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    const point = map.unproject(px);
    const lng = clampCoordinate(point.lng, -180, 180);
    const lat = clampCoordinate(point.lat, -90, 90);
    return lng === null || lat === null ? null : { px, ll: [lng, lat] };
  };

  const pinchState = () => {
    const [a, b] = [...pointersRef.current.values()];
    return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 };
  };

  /** Deux doigts pendant le dessin : déplacer et zoomer la carte sans tracer. */
  const applyPinch = () => {
    const map = mapRef.current;
    const previous = pinchRef.current;
    const rect = mapNode.current?.getBoundingClientRect();
    if (!map || !previous || !rect) return;
    const next = pinchState();
    map.panBy([previous.cx - next.cx, previous.cy - next.cy], { animate: false });
    map.zoomTo(map.getZoom() + Math.log2(next.dist / previous.dist), { animate: false, around: map.unproject([next.cx - rect.left, next.cy - rect.top]) });
    pinchRef.current = next;
  };

  const onDrawDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointersRef.current.size >= 2) {
      // Le second doigt annule le trait commencé : le geste est un déplacement.
      if (strokeRef.current && !strokeRef.current.ended) cancelStroke();
      pinchRef.current = pinchState();
      return;
    }
    if (strokeRef.current) return; // le trait précédent finit de s'accrocher
    const hit = layerPoint(event);
    if (!hit) return;
    const anchor = traceRef.current[traceRef.current.length - 1];
    strokeRef.current = {
      pointerId: event.pointerId,
      raw: [hit.ll],
      lastPx: hit.px,
      pendingFrom: anchor ? 0 : 1,
      pendingPx: 0,
      snapped: anchor ? [anchor] : [hit.ll],
      anchored: Boolean(anchor),
      magnet,
      inFlight: null,
      ended: false,
      free: false,
    };
    renderLive();
  };

  const onDrawMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pinchRef.current && pointersRef.current.size >= 2) { applyPinch(); return; }
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId || stroke.ended) return;
    const hit = layerPoint(event);
    if (!hit) return;
    const dist = Math.hypot(hit.px[0] - stroke.lastPx[0], hit.px[1] - stroke.lastPx[1]);
    if (dist < SAMPLE_PX || stroke.raw.length >= MAX_TRACE_POINTS) return;
    stroke.raw.push(hit.ll);
    stroke.lastPx = hit.px;
    stroke.pendingPx += dist;
    renderLive();
    // Le tracé se colle au chemin pendant le geste, morceau par morceau.
    if (stroke.magnet && !stroke.inFlight && stroke.pendingPx >= CHUNK_PX) void flushChunk(stroke);
  };

  const onDrawUp = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId || stroke.ended) return;
    if (cancelled) { cancelStroke(); return; }
    stroke.ended = true;
    if (!stroke.inFlight) void flushChunk(stroke);
  };

  const onDrawWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!map) return;
    map.zoomTo(map.getZoom() - event.deltaY * 0.0025, { animate: false, around: map.unproject([event.clientX - rect.left, event.clientY - rect.top]) });
  };

  const undoSegment = () => {
    cancelStroke();
    setSegments((current) => current.slice(0, -1));
  };

  const clearTrace = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 2800);
      return;
    }
    cancelStroke();
    setSegments([]);
    setConfirmClear(false);
  };

  const fitTrace = () => {
    const map = mapRef.current;
    const points = traceRef.current;
    if (!map || points.length < 2) return;
    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 56, maxZoom: 15, duration: 600 });
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (position) => mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14, duration: 900 }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // Sélecteur des jours : publié vers la capsule en bas à droite de la carte-drawer quand elle existe.
  const daysApi = useRef({ select: (_index: number) => {}, addDay: () => {} });
  daysApi.current = {
    select: (index: number) => { setActive(index); scrollToSlide(index); },
    addDay,
  };
  useEffect(() => {
    publishDays?.({
      count: days.length,
      active,
      select: (index) => daysApi.current.select(index),
      addDay: () => daysApi.current.addDay(),
    });
  }, [publishDays, days.length, active]);
  useEffect(() => () => publishDays?.(null), [publishDays]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitting(true); setSubmitError(null);
    try {
      if (!user?.id) throw new Error('Connecte-toi pour créer un carnet.');
      const supabase = createClient();
      const { data, error } = await supabase.from('carnets').insert({
        title: values.title.trim() || 'Carnet de voyage',
        destination: values.destination.trim(),
        description: values.description.trim() || [values.destination, values.startDate && values.endDate ? `du ${values.startDate} au ${values.endDate}` : '', values.distanceKm ? `${values.distanceKm} km` : '', values.deniveleM ? `${values.deniveleM} m D+` : ''].filter(Boolean).join(' · '),
        cover_image: '', cover_image_alt: values.title.trim(), start_date: values.startDate || null, end_date: values.endDate || null,
        visibility: values.visibility, author_id: user.id, lieu_depart: values.lieuDepart.trim() || null, lieu_arrivee: values.lieuArrivee.trim() || null,
        distance_km: values.distanceKm, denivele_m: values.deniveleM, nb_nuits: values.nbNuits, nb_voyageurs: values.nbVoyageurs,
        weather: values.weather.trim() || null, route_rating: values.routeRating, tags: values.tags, is_collaborative: values.isCollaborative,
        map_points: { trace, days: days.map((day) => ({ id: day.id, label: day.label, lng: day.lng, lat: day.lat, moments: day.moments.map(({ media, ...moment }) => moment) })) },
      }).select('id').single();
      if (error || !data) throw new Error(error?.message || 'Création du carnet refusée.');
      try { await insertCommunityPost({ authorId: user.id, content: `**${values.title.trim() || 'Carnet'}**\n\n${values.description.trim() || values.destination}`, postType: 'share', audience: values.visibility === 'public' ? 'public' : 'abonnies', linkedCarnetId: data.id, title: values.title.trim() }); } catch { /* best effort */ }
      onCreated('carnet', data.id); onClose();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Création impossible.'); } finally { setSubmitting(false); }
  }, (errors) => {
    // Un envoi incomplet ne reste plus muet : message, et retour aux réglages du carnet.
    const first = Object.values(errors).find((entry) => typeof entry?.message === 'string');
    setSubmitError((first?.message as string | undefined) ?? 'Complète les informations du carnet.');
    setActive(0);
    scrollToSlide(0);
  });

  const title = form.watch('title'); const destination = form.watch('destination'); const startDate = form.watch('startDate'); const endDate = form.watch('endDate');
  return (
    <CommunityFormDrawer
      open={open}
      onClose={onClose}
      ariaLabel="Créer un carnet"
      error={submitError}
      footer={
        <button type="button" className="lkdv-carnet-cta" onClick={() => void submit()} disabled={submitting} aria-label="Créer le carnet">
          {submitting ? <Loader2 size={16} className="lkdv-spin" aria-hidden="true" /> : <Flag size={16} aria-hidden="true" />}
          <span>{submitting ? 'Création…' : 'Créer le carnet'}</span>
        </button>
      }
    >
      <div className="lkdv-carnet-map" ref={mapNode} data-trace-points={trace.length} data-drawing={drawing ? 'true' : 'false'}>
        <button type="button" className={`lkdv-map-draw${drawing ? ' is-on' : ''}`} onClick={() => { if (drawing) cancelStroke(); setDrawing((value) => !value); }} aria-pressed={drawing} aria-label={drawing ? 'Terminer le tracé' : 'Dessiner le tracé'} title={drawing ? 'Terminer le tracé' : 'Dessiner le tracé'}>
          {drawing ? <Check size={16} aria-hidden="true" /> : <PenLine size={16} aria-hidden="true" />}
          <span>{drawing ? 'Terminer' : trace.length > 0 ? 'Continuer' : 'Tracer'}</span>
        </button>
        <div className="lkdv-map-tools" role="toolbar" aria-label="Outils du tracé">
          <button type="button" className={`lkdv-map-tool${magnet ? ' is-on' : ''}`} aria-pressed={magnet} onClick={() => setMagnet((value) => !value)} aria-label="Coller le tracé aux chemins" title={magnet ? 'Collé aux chemins' : 'Tracé libre (hors sentier)'}><Magnet size={17} aria-hidden="true" /></button>
          <button type="button" className="lkdv-map-tool" onClick={undoSegment} disabled={segments.length === 0} aria-label="Annuler le dernier tronçon" title="Annuler le dernier tronçon"><Undo2 size={17} aria-hidden="true" /></button>
          <button type="button" className={`lkdv-map-tool${confirmClear ? ' is-danger' : ''}`} onClick={clearTrace} disabled={segments.length === 0} aria-label={confirmClear ? 'Toucher encore pour effacer le tracé' : 'Effacer le tracé'} title="Effacer le tracé"><Eraser size={17} aria-hidden="true" />{confirmClear ? <span>Effacer ?</span> : null}</button>
        </div>
        <div className="lkdv-map-tools lkdv-map-tools--bottom">
          {trace.length > 1 ? <button type="button" className="lkdv-map-tool" onClick={fitTrace} aria-label="Recentrer sur le tracé" title="Recentrer sur le tracé"><Maximize2 size={16} aria-hidden="true" /></button> : null}
          <button type="button" className="lkdv-map-tool" onClick={locate} aria-label="Me localiser" title="Me localiser"><LocateFixed size={16} aria-hidden="true" /></button>
        </div>
        {!drawing && trace.length === 0 ? <p className="lkdv-map-hint">Touche « Tracer », puis glisse le doigt : le tracé se colle aux chemins au fil du geste.</p> : null}
        {drawing && zoom < 10 ? <p className="lkdv-map-hint is-live">Zoome sur ton départ (deux doigts) : de près, le tracé suit les sentiers.</p> : null}
        {drawing && zoom >= 10 && trace.length === 0 ? <p className="lkdv-map-hint is-live">Touche pour poser le départ, puis glisse ou touche plus loin. Deux doigts pour déplacer la carte.</p> : null}
        {trace.length > 1 || snapState !== 'idle' ? (
          <div className="lkdv-map-stats" aria-live="polite">
            {trace.length > 1 ? <span><Route size={12} aria-hidden="true" />{formatDistance(km)}</span> : null}
            {trace.length > 1 ? <span><Mountain size={12} aria-hidden="true" />{gain !== null ? `${gain} m D+` : gainState === 'loading' ? '… D+' : '— D+'}</span> : null}
            {snapState === 'loading' ? <span className="is-busy"><Loader2 size={12} className="lkdv-spin" aria-hidden="true" />Accrochage…</span> : null}
            {snapState === 'error' ? <span className="is-warn"><WifiOff size={12} aria-hidden="true" />Pas de chemin : tracé libre</span> : null}
          </div>
        ) : null}
        <div
          className="lkdv-map-draw-layer"
          data-active={drawing ? 'true' : 'false'}
          onPointerDown={onDrawDown}
          onPointerMove={onDrawMove}
          onPointerUp={(event) => onDrawUp(event, false)}
          onPointerCancel={(event) => onDrawUp(event, true)}
          onWheel={onDrawWheel}
          aria-hidden="true"
        />
        <div className="lkdv-map-fade" aria-hidden="true" />
      </div>
      {publishDays ? null : (
        <div className="lkdv-carnet-daybar" role="tablist" aria-label="Jours du carnet">
          <button type="button" role="tab" aria-selected={active === 0} className={active === 0 ? 'is-active' : ''} onClick={() => { setActive(0); scrollToSlide(0); }} aria-label="Réglages du carnet"><Settings2 size={14} aria-hidden="true" /><span>Infos</span></button>
          {days.map((day, index) => (
            <button key={day.id} type="button" role="tab" aria-selected={active === index + 1} className={active === index + 1 ? 'is-active' : ''} onClick={() => { setActive(index + 1); scrollToSlide(index + 1); }} aria-label={day.label}><span>J{index + 1}</span></button>
          ))}
          <button type="button" role="tab" aria-selected={active === days.length + 1} className="lkdv-daybar-add" onClick={addDay} aria-label="Ajouter un jour"><Plus size={14} aria-hidden="true" /><span>Jour</span></button>
        </div>
      )}
      <div className="lkdv-carnet-slider" ref={scroller}>
        <section className="lkdv-carnet-slide lkdv-carnet-base">
          <label className="lkdv-cf"><Type size={15} aria-hidden="true" /><input {...form.register('title')} placeholder="Titre du carnet" aria-label="Titre" /></label>
          <PlaceSearch label="Destination" value={destination} onChange={(value) => form.setValue('destination', value, { shouldDirty: true })} onPick={(place) => mapRef.current?.flyTo({ center: [place.lon, place.lat], zoom: 11, duration: 900 })} placeholder="Destination" />
          <div className="lkdv-date-pills">
            <DatePill value={startDate} label="Début" onChange={(value) => form.setValue('startDate', value, { shouldDirty: true })} />
            <DatePill value={endDate} label="Fin" onChange={(value) => form.setValue('endDate', value, { shouldDirty: true })} />
          </div>
          <label className="lkdv-cf lkdv-cf--area"><AlignLeft size={15} aria-hidden="true" /><textarea {...form.register('description')} placeholder="Récit, idée, points forts…" aria-label="Récit" rows={3} /></label>
        </section>
        {days.map((day, dayIndex) => (
          <section key={day.id} className="lkdv-carnet-slide lkdv-carnet-day" aria-label={day.label}>
            <div className="lkdv-day-moments">
              {day.moments.length === 0 ? <p className="lkdv-day-empty">Ajoute un moment : étape, repas, point de vue…</p> : null}
              {day.moments.map((moment, momentIndex) => (
                <div key={moment.id} className="lkdv-moment-row">
                  <span className="lkdv-moment-index">{momentIndex + 1}</span>
                  <input value={moment.label} onChange={(event) => updateMoment(day.id, moment.id, { label: event.target.value })} aria-label={`Nom du moment ${momentIndex + 1}`} />
                  <label className="lkdv-moment-photo" aria-label={`Image du moment ${momentIndex + 1}`}>
                    {moment.media ? <img src={moment.media} alt="" loading="lazy" decoding="async" /> : <ImagePlus size={13} />}
                    <input type="file" accept="image/*,video/*,image/gif" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) updateMoment(day.id, moment.id, { media: URL.createObjectURL(file) }); event.currentTarget.value = ''; }} />
                  </label>
                  <button type="button" className="lkdv-moment-delete" aria-label="Supprimer le moment" onClick={() => { if (moment.media) URL.revokeObjectURL(moment.media); setDays((current) => current.map((entry) => entry.id === day.id ? { ...entry, moments: entry.moments.filter((m) => m.id !== moment.id) } : entry)); }}><Trash2 size={13} /></button>
                  <input className="lkdv-moment-note" value={moment.note} placeholder="Petit commentaire…" aria-label={`Commentaire du moment ${momentIndex + 1}`} onChange={(event) => updateMoment(day.id, moment.id, { note: event.target.value })} />
                </div>
              ))}
            </div>
            <button type="button" className="lkdv-moment-add" onClick={() => addMoment(day.id)} aria-label="Ajouter un moment"><Plus size={16} aria-hidden="true" /><span>Moment</span></button>
          </section>
        ))}
        <section className="lkdv-carnet-slide lkdv-carnet-add">
          <button type="button" onClick={addDay} aria-label="Ajouter un jour"><Plus size={26} /></button>
        </section>
      </div>
    </CommunityFormDrawer>
  );
}

export default CarnetMapDrawer;
