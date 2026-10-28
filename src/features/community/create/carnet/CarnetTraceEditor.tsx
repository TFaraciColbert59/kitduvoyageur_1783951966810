'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '@/styles/carnet-trace.css';
import type { LayerGroup, Map as LeafletMap, Polyline } from 'leaflet';
import { Search, Trash2, Undo2, Pencil } from 'lucide-react';
import { leafletTiles } from '@/components/map/engine/leafletTiles';
import { dayColor, type DayTrace } from '@/features/carnet/trace/days';
import { replaceEndpoints, type LonLat } from '@/features/carnet/trace/geometry';
import { searchAddress, snapDrawnLine, snapWaypoints, type AddressMatch } from '@/features/carnet/trace/snapTrace';

export interface CarnetTraceEditorProps {
  days: DayTrace[];
  activeDay: number;
  /** `null` efface le tracé du jour. */
  onChange: (day: number, trace: DayTrace | null) => void;
}

const MIN_DRAWN_POINTS = 4;
const HISTORY_LIMIT = 10;

type LeafletModule = typeof import('leaflet');

function pinHtml(label: string, color: string): string {
  return `<span class="lkdv-tr-pin" style="background:${color}">${label}</span>`;
}

/**
 * Carte d'édition du tracé d'un carnet : on dessine la journée au doigt, le
 * dessin est simplifié puis accroché au chemin le plus proche par le routeur ;
 * une adresse permet de refixer le départ ou l'arrivée. Chaque jour a sa
 * couleur et ses bornes (J1 → ✓) sur la carte.
 */
export function CarnetTraceEditor({ days, activeDay, onChange }: CarnetTraceEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const liveRef = useRef<Polyline | null>(null);
  const drawnRef = useRef<LonLat[]>([]);
  const historyRef = useRef<Map<number, Array<DayTrace | null>>>(new Map());
  const pendingStartRef = useRef<LonLat | null>(null);
  const requestRef = useRef(0);
  const fittedRef = useRef<number | null>(null);
  const addressId = useId();

  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [picked, setPicked] = useState<AddressMatch | null>(null);

  const current = days.find((trace) => trace.day === activeDay) ?? null;

  const remember = useCallback(
    (previous: DayTrace | null) => {
      const stack = historyRef.current.get(activeDay) ?? [];
      stack.push(previous);
      if (stack.length > HISTORY_LIMIT) stack.shift();
      historyRef.current.set(activeDay, stack);
    },
    [activeDay],
  );

  /* --- Carte ---------------------------------------------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [45.2, 5.9],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });
      const tiles = leafletTiles('osm');
      L.tileLayer(tiles.url, { ...tiles.options, keepBuffer: 4 }).addTo(map);
      L.control.attribution({ prefix: false }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 120);
      setReady(true);
    });
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(container);
    return () => {
      cancelled = true;
      observer.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
  }, []);

  /* --- Tracés de tous les jours --------------------------------------------- */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const bounds: Array<[number, number]> = [];

    for (const trace of days) {
      if (trace.coords.length < 2) continue;
      const latlngs = trace.coords.map(([lon, lat]) => [lat, lon] as [number, number]);
      const color = dayColor(trace.day);
      const active = trace.day === activeDay;
      L.polyline(latlngs, { color: '#ffffff', weight: active ? 9 : 7, opacity: 0.9, lineCap: 'round' }).addTo(layer);
      L.polyline(latlngs, {
        color,
        weight: active ? 6 : 4,
        opacity: active ? 1 : 0.75,
        lineCap: 'round',
        dashArray: trace.snapped ? undefined : '6 8',
      }).addTo(layer);
      const first = latlngs[0] as [number, number];
      const last = latlngs[latlngs.length - 1] as [number, number];
      L.marker(first, { icon: L.divIcon({ className: 'lkdv-tr-pin-wrap', html: pinHtml(`J${trace.day}`, color), iconSize: [30, 22], iconAnchor: [15, 11] }), interactive: false }).addTo(layer);
      L.marker(last, { icon: L.divIcon({ className: 'lkdv-tr-pin-wrap', html: pinHtml('✓', color), iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(layer);
      if (active || fittedRef.current === null) bounds.push(...latlngs);
    }

    if (bounds.length > 1 && fittedRef.current !== activeDay) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 15 });
        fittedRef.current = activeDay;
      } catch {
        /* bornes dégénérées : la vue actuelle suffit */
      }
    }
  }, [ready, days, activeDay]);

  /* --- Dessin au doigt -------------------------------------------------------- */
  const finishDrawing = useCallback(async () => {
    const L = leafletRef.current;
    liveRef.current?.remove();
    liveRef.current = null;
    const points = drawnRef.current;
    drawnRef.current = [];
    if (!L || points.length < MIN_DRAWN_POINTS) {
      setNote('Trace plus longue : fais glisser ton doigt sur le chemin.');
      return;
    }
    const token = ++requestRef.current;
    setBusy('Accrochage au chemin…');
    setNote(null);
    const previous = current;
    const result = await snapDrawnLine(points);
    if (token !== requestRef.current) return;
    remember(previous);
    onChange(activeDay, {
      day: activeDay,
      coords: result.coords,
      waypoints: result.waypoints,
      snapped: result.snapped,
      distanceKm: result.distanceKm,
      endLabel: null,
    });
    setBusy(null);
    setDrawing(false);
    setNote(
      result.snapped
        ? `${result.distanceKm.toLocaleString('fr-FR')} km · accroché aux chemins`
        : 'Routage indisponible : ton dessin est gardé tel quel, sans accrochage.',
    );
  }, [activeDay, current, onChange, remember]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !container || !L || !drawing) return;

    map.dragging.disable();
    container.style.touchAction = 'none';
    container.dataset.drawing = 'true';
    let active = false;

    const point = (event: PointerEvent): LonLat => {
      const latlng = map.mouseEventToLatLng(event as unknown as MouseEvent);
      return [latlng.lng, latlng.lat];
    };
    const onDown = (event: PointerEvent) => {
      active = true;
      container.setPointerCapture?.(event.pointerId);
      drawnRef.current = [point(event)];
      liveRef.current?.remove();
      liveRef.current = L.polyline([], { color: dayColor(activeDay), weight: 5, opacity: 0.9, dashArray: '2 8', lineCap: 'round' }).addTo(map);
    };
    const onMove = (event: PointerEvent) => {
      if (!active) return;
      const next = point(event);
      drawnRef.current.push(next);
      liveRef.current?.addLatLng([next[1], next[0]]);
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      void finishDrawing();
    };

    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
    return () => {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      map.dragging.enable();
      container.style.touchAction = '';
      delete container.dataset.drawing;
    };
  }, [ready, drawing, activeDay, finishDrawing]);

  /* --- Adresse : refixer le départ ou l'arrivée ---------------------------------- */
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchAddress(text, undefined, controller.signal).then((found) => {
        if (!controller.signal.aborted) setMatches(found);
      });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const fixEndpoint = useCallback(
    async (role: 'start' | 'end') => {
      if (!picked) return;
      const spot: LonLat = [picked.lon, picked.lat];
      mapRef.current?.flyTo([picked.lat, picked.lon], Math.max(mapRef.current.getZoom(), 13), { duration: 0.6 });
      const previousEnd = days.find((trace) => trace.day === activeDay - 1)?.coords.at(-1) ?? null;
      let base: LonLat[] | null = null;

      if (current && current.waypoints.length >= 2) {
        base = replaceEndpoints(current.waypoints, role === 'start' ? { start: spot } : { end: spot });
      } else if (role === 'start') {
        pendingStartRef.current = spot;
        setNote('Départ fixé. Choisis maintenant l’adresse d’arrivée.');
        return;
      } else {
        const start = pendingStartRef.current ?? previousEnd;
        if (start) base = [start, spot];
      }
      if (!base) {
        setNote('Fixe d’abord le départ, ou dessine la journée.');
        return;
      }
      const token = ++requestRef.current;
      setBusy('Accrochage au chemin…');
      const result = await snapWaypoints(base);
      if (token !== requestRef.current) return;
      remember(current);
      onChange(activeDay, {
        day: activeDay,
        coords: result.coords,
        waypoints: result.waypoints,
        snapped: result.snapped,
        distanceKm: result.distanceKm,
        endLabel: role === 'end' ? picked.name : current?.endLabel ?? null,
      });
      pendingStartRef.current = null;
      setBusy(null);
      setPicked(null);
      setQuery('');
      setMatches([]);
      setAddressOpen(false);
      setNote(
        result.snapped
          ? `${result.distanceKm.toLocaleString('fr-FR')} km · recalé sur « ${picked.name} »`
          : 'Routage indisponible : les points sont posés mais le tracé n’est pas accroché.',
      );
    },
    [activeDay, current, days, onChange, picked, remember],
  );

  const undo = () => {
    const stack = historyRef.current.get(activeDay) ?? [];
    if (stack.length === 0) return;
    const previous = stack.pop() ?? null;
    historyRef.current.set(activeDay, stack);
    onChange(activeDay, previous);
    setNote(null);
  };

  const canUndo = (historyRef.current.get(activeDay)?.length ?? 0) > 0;

  return (
    <div className="lkdv-tr" data-drawing={drawing ? 'true' : 'false'}>
      <div ref={containerRef} className="lkdv-tr-map" role="img" aria-label={`Carte du jour ${activeDay}`} data-ready={ready ? 'true' : 'false'} />

      <div className="lkdv-tr-tools" role="toolbar" aria-label="Outils du tracé">
        <button type="button" aria-label="Dessiner le jour au doigt" aria-pressed={drawing} data-testid="trace-draw" onClick={() => setDrawing((on) => !on)}>
          <Pencil size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Annuler la dernière modification" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Effacer le tracé du jour" disabled={!current} onClick={() => { remember(current); onChange(activeDay, null); setNote(null); }}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Fixer par adresse" aria-pressed={addressOpen} data-testid="trace-address" onClick={() => setAddressOpen((open) => !open)}>
          <Search size={18} aria-hidden="true" />
        </button>
      </div>

      {addressOpen ? (
        <div className="lkdv-tr-addr" role="group" aria-label="Fixer par adresse">
          <label htmlFor={addressId} className="sr-only">
            Adresse
          </label>
          <input id={addressId} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPicked(null); }} placeholder="Adresse, village, refuge…" autoFocus />
          {matches.length > 0 && !picked ? (
            <ul>
              {matches.map((match) => (
                <li key={match.id}>
                  <button type="button" onClick={() => { setPicked(match); setQuery(match.name); }}>
                    <b>{match.name}</b>
                    <small>{match.context}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {picked ? (
            <div className="lkdv-tr-roles">
              <button type="button" onClick={() => void fixEndpoint('start')} data-testid="address-start">Départ ici</button>
              <button type="button" onClick={() => void fixEndpoint('end')} data-testid="address-end">Arrivée ici</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {busy || note || drawing ? (
        <p className="lkdv-tr-status" role="status" aria-live="polite">
          {busy ?? note ?? 'Dessine ta journée au doigt sur la carte.'}
        </p>
      ) : null}
    </div>
  );
}

export default CarnetTraceEditor;
