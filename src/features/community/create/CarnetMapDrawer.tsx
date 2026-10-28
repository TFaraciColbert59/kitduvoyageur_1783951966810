'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, MapPin, CalendarDays, Settings2, Trash2, ImagePlus, Check, Loader2, WifiOff } from 'lucide-react';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { createClient } from '@/lib/supabase/client';
import { createDefaults, createSchemas, type CarnetFormValues } from './engine/createSchemas';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { PlaceSearch } from './shared/PlaceSearch';
import { insertCommunityPost } from './upload';
import './carnet-map-drawer.css';

type Moment = { id: string; label: string; note: string; media?: string; lng: number; lat: number };
type Day = { id: string; label: string; lng: number; lat: number; moments: Moment[] };

const DEFAULT_CENTER: [number, number] = [6.87, 45.92];
const MAX_TRACE_POINTS = 2000;
const MAX_DAYS = 60;
const MAX_MOMENTS = 50;

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
  const [trace, setTrace] = useState<Array<[number, number]>>([]);
  const [snapState, setSnapState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const traceRef = useRef<Array<[number, number]>>([]);
  const daysRef = useRef<Day[]>([]);
  const markersRef = useRef<Marker[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef(false);
  const routeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { traceRef.current = trace; }, [trace]);
  useEffect(() => () => { routeAbortRef.current?.abort(); }, []);
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
    map.on('load', () => {
      map.addSource('carnet-trace', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
      map.addLayer({ id: 'carnet-trace-casing', type: 'line', source: 'carnet-trace', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.92)', 'line-width': 7, 'line-blur': .4 } });
      map.addLayer({ id: 'carnet-trace-line', type: 'line', source: 'carnet-trace', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#17402C', 'line-width': 3.2, 'line-opacity': .92 } });
    });
    return () => { map.remove(); mapRef.current = null; };
  }, [open]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('carnet-trace') as any;
    source?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: trace }, properties: {} });
  }, [trace]);

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
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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

  const drawStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing) return;
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    setSnapState('idle');
    pointerRef.current = true;
    mapRef.current?.dragPan.disable();
    addTracePoint(event);
  };
  const drawMove = (event: React.PointerEvent<HTMLDivElement>) => { if (drawing && pointerRef.current) addTracePoint(event); };
  const simplify = (points: Array<[number, number]>, tolerance = 0.00012): Array<[number, number]> => {
    if (points.length <= 3) return points;
    const sq = tolerance * tolerance;
    const getSqSegDist = (p: [number, number], a: [number, number], b: [number, number]) => {
      let x = a[0]; let y = a[1]; let dx = b[0] - x; let dy = b[1] - y;
      if (dx !== 0 || dy !== 0) {
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
      }
      dx = p[0] - x; dy = p[1] - y;
      return dx * dx + dy * dy;
    };
    const simplifyStep = (first: number, last: number, out: Array<[number, number]>) => {
      let maxSq = sq; let index = 0;
      for (let i = first + 1; i < last; i += 1) {
        const dist = getSqSegDist(points[i], points[first], points[last]);
        if (dist > maxSq) { index = i; maxSq = dist; }
      }
      if (maxSq > sq) {
        if (index - first > 1) simplifyStep(first, index, out);
        out.push(points[index]);
        if (last - index > 1) simplifyStep(index, last, out);
      }
    };
    const out: Array<[number, number]> = [points[0]];
    simplifyStep(0, points.length - 1, out);
    out.push(points[points.length - 1]);
    return out.slice(0, 14);
  };

  const snapToPath = async () => {
    const raw = traceRef.current;
    if (raw.length < 3) return;
    setSnapState('loading');
    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const simplified = simplify(raw);
      const points = simplified.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
      const response = await fetch(`/api/route?points=${points}&mode=pieton`, { signal: controller.signal });
      const payload = await response.json();
      const legs = Array.isArray(payload.legs) ? payload.legs : [];
      const geometry = legs.flatMap((leg: { geometry?: Array<[number, number]> }) => Array.isArray(leg.geometry) ? leg.geometry : []);
      const safeGeometry = sanitizeTrace(geometry);
      if (!response.ok || safeGeometry.length < 2) throw new Error('route_unavailable');
      setTrace(safeGeometry);
      setSnapState('idle');
    } catch {
      setSnapState('error');
    } finally {
      window.clearTimeout(timer);
      if (routeAbortRef.current === controller) routeAbortRef.current = null;
    }
  };

  const drawEnd = () => {
    pointerRef.current = false;
    mapRef.current?.dragPan.enable();
    void snapToPath();
  };
  const addTracePoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    const safeLng = clampCoordinate(point.lng, -180, 180);
    const safeLat = clampCoordinate(point.lat, -90, 90);
    if (safeLng === null || safeLat === null) return;
    setTrace((current) => current.length >= MAX_TRACE_POINTS ? current : [...current, [safeLng, safeLat]]);
  };

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
  });

  const title = form.watch('title'); const destination = form.watch('destination'); const startDate = form.watch('startDate'); const endDate = form.watch('endDate');
  return (
    <CommunityFormDrawer
      open={open}
      onClose={onClose}
      ariaLabel="Créer un carnet"
      error={submitError}
      footer={
        <div className="lkdv-carnet-footer">
          <div
            className="ig-tabs lkdv-carnet-daybar"
            style={{ '--n': days.length + 2, '--active': active } as React.CSSProperties}
            role="tablist"
            aria-label="Jours du carnet"
          >
            <span className="ig-th" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={active === 0} className={active === 0 ? 'is-active' : ''} onClick={() => { setActive(0); scrollToSlide(0); }} aria-label="Réglages du carnet"><Settings2 size={13} /></button>
            {days.map((day, index) => (
              <button key={day.id} type="button" role="tab" aria-selected={active === index + 1} className={active === index + 1 ? 'is-active' : ''} onClick={() => { setActive(index + 1); scrollToSlide(index + 1); }} aria-label={day.label}>{index + 1}</button>
            ))}
            <button type="button" role="tab" aria-selected={active === days.length + 1} className="lkdv-daybar-add" onClick={addDay} aria-label="Ajouter un jour"><Plus size={14} /></button>
          </div>
        </div>
      }
    >
      <div className="lkdv-carnet-map" ref={mapNode} data-trace-points={trace.length} data-drawing={drawing ? 'true' : 'false'}>
        <button type="button" className={`lkdv-map-draw${drawing ? ' is-on' : ''}`} onClick={() => setDrawing((value) => !value)} aria-label={drawing ? 'Terminer le tracé' : 'Dessiner le tracé'} title={drawing ? 'Terminer le tracé' : 'Dessiner le tracé'}><MapPin size={17} /></button>
        {snapState !== 'idle' ? <span className={`lkdv-snap-status${snapState === 'error' ? ' is-error' : ''}`} aria-label={snapState === 'loading' ? 'Ajustement au chemin' : 'Tracé libre'}>{snapState === 'loading' ? <Loader2 size={14} /> : <WifiOff size={14} />}</span> : null}
        <button type="button" className="lkdv-carnet-submit" onClick={() => void submit()} disabled={submitting} aria-label="Créer le carnet"><Check size={17} /></button>
        <div
          className="lkdv-map-draw-layer"
          data-active={drawing ? 'true' : 'false'}
          onPointerDown={drawStart}
          onPointerMove={drawMove}
          onPointerUp={drawEnd}
          onPointerCancel={drawEnd}
          aria-hidden="true"
        />
        <div className="lkdv-map-fade" aria-hidden="true" />
      </div>
      <div className="lkdv-carnet-slider" ref={scroller}>
        <section className="lkdv-carnet-slide lkdv-carnet-base">
          <input {...form.register('title')} placeholder="Titre du carnet" aria-label="Titre" />
          <PlaceSearch label="Destination" value={destination} onChange={(value) => form.setValue('destination', value, { shouldDirty: true })} placeholder="Destination" />
          <div className="lkdv-date-pills">
            <DatePill value={startDate} label="Début" onChange={(value) => form.setValue('startDate', value, { shouldDirty: true })} />
            <DatePill value={endDate} label="Fin" onChange={(value) => form.setValue('endDate', value, { shouldDirty: true })} />
          </div>
          <textarea {...form.register('description')} placeholder="Récit, idée, points forts…" aria-label="Récit" rows={3} />
        </section>
        {days.map((day, dayIndex) => (
          <section key={day.id} className="lkdv-carnet-slide lkdv-carnet-day" aria-label={day.label}>
            <div className="lkdv-day-moments">
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
            <button type="button" className="lkdv-moment-add" onClick={() => addMoment(day.id)} aria-label="Ajouter un moment"><Plus size={16} /></button>
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
