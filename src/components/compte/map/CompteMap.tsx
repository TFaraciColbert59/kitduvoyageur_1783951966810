'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { prefersReducedMotion } from '@/components/map/engine/camera';
import {
  cameraForScale,
  fitIntentForMode,
  paddingForViewport,
  type MapScale,
} from '@/features/compte/map/camera';
import { filterTracksForMode, mapModeConfig } from '@/features/compte/map/modes';
import type {
  CompteMapMode,
  CompteMapPayload,
  MapMassif,
  MapTrack,
  TrackPoint,
} from '@/features/compte/map/types';
import { CompteMapAttribution, CompteMapHud } from './CompteMapHud';
import { CompteMapCallout } from './CompteMapCallout';
import { CompteMapFallback } from './CompteMapFallback';
import { CompteMapState } from './CompteMapState';
import './compte-map.css';

const DEFAULT_CENTER: [number, number] = [2.5, 46.5];

const MAP_ICON = {
  peak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 19 6.5-11 4 6 2.5-4L21 19H3Z"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z"/></svg>',
  shelter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/></svg>',
  tent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 20 9-16 9 16H3ZM12 4v16M8 20l4-7 4 7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5ZM4 19.5A2.5 2.5 0 0 1 6.5 17H19"/></svg>',
};

function poiIcon(label: string): string {
  const value = label.toLowerCase();
  if (/(lac|étang|etang|source|rivière|riviere|cascade)/.test(value)) return MAP_ICON.water;
  if (/(refuge|cabane|chalet|abri|bergerie|auberge)/.test(value)) return MAP_ICON.shelter;
  if (/(bivouac|tente|camp)/.test(value)) return MAP_ICON.tent;
  if (/(col|sommet|mont|pic|crête|crete|dôme|dome|cime)/.test(value)) return MAP_ICON.peak;
  return MAP_ICON.pin;
}


export type CompteMapAuthState = 'loading' | 'guest' | 'owner' | 'error';

export interface CompteMapContext {
  mode: CompteMapMode;
  outingId?: string | null;
}

/** Cible de recentrage externe (fiche carnet) : coordonnées réelles uniquement. */
export interface CompteMapFocus {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface CompteMapProps {
  authState: CompteMapAuthState;
  context: CompteMapContext;
  /** Quand la valeur change, la caméra vole vers ce point. */
  focus?: CompteMapFocus | null;
}

type Selected =
  | { kind: 'outing'; id: string }
  | { kind: 'massif'; id: string }
  | { kind: 'carnet'; id: string }
  | { kind: 'poi'; id: string };

type Resolved =
  | { kind: 'outing'; data: MapTrack; position: TrackPoint }
  | { kind: 'massif'; data: MapMassif; position: TrackPoint }
  | {
      kind: 'carnet';
      data: CompteMapPayload['carnets'][number];
      position: TrackPoint;
    }
  | { kind: 'poi'; data: CompteMapPayload['pois'][number]; position: TrackPoint };

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

function pointsCollection(
  rows: Array<{ id: string; position: TrackPoint }>
) {
  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => ({
      type: 'Feature' as const,
      properties: { id: row.id },
      geometry: {
        type: 'Point' as const,
        coordinates: [row.position.lng, row.position.lat],
      },
    })),
  };
}

function resolveSelected(data: CompteMapPayload, selected: Selected): Resolved | null {
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
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function ensureSource(
  map: MapLibreMap,
  id: string,
  data: ReturnType<typeof tracksCollection> | ReturnType<typeof pointsCollection>
) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(id, { type: 'geojson', data });
}

function ensureLayer(map: MapLibreMap, id: string, create: () => void) {
  if (!map.getLayer(id)) create();
}

export function CompteMap({ authState, context, focus = null }: CompteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState<MapScale>('globe');
  const [tileMode, setTileMode] = useState<'satellite' | 'topo'>('satellite');
  const [online, setOnline] = useState(true);
  const [year, setYear] = useState<number | null>(null);

  const config = mapModeConfig(context.mode);
  const query = useQuery<CompteMapPayload, Error>({
    queryKey: ['compte-map'],
    queryFn: fetchCompteMap,
    enabled: authState === 'owner' && online,
    staleTime: 60_000,
    retry: 1,
  });
  const data = query.data;
  const unauthorized = query.error?.message === 'unauthorized';
  const yearTracks = useMemo(
    () => (data ? (year ? data.tracks.filter((track) => track.year === year) : data.tracks) : []),
    [data, year]
  );
  const visibleTracks = useMemo(
    () => (data ? filterTracksForMode(yearTracks, context.mode, context.outingId) : []),
    [data, yearTracks, context.mode, context.outingId]
  );
  const resolved = useMemo(
    () => (data && selected ? resolveSelected(data, selected) : null),
    [data, selected]
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!hasWebGL()) {
      setFallback(true);
      setReady(true);
      return;
    }

    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const instance = new MapLibreMap({
      container: containerRef.current,
      style: createMapStyle('satellite'),
      center: DEFAULT_CENTER,
      zoom: 4.2,
      minZoom: 1.2,
      maxZoom: 18,
      maxPitch: 70,
      attributionControl: false,
      renderWorldCopies: false,
      locale: { 'Map.Title': 'Carte du compte' },
    });
    mapRef.current = instance;
    setMap(instance);
    (window as unknown as { __lkdvCompteMapInstance?: MapLibreMap }).__lkdvCompteMapInstance =
      instance;

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => instance.resize())
        : null;
    observer?.observe(containerRef.current);

    const timeout = window.setTimeout(() => setStyleFailed(true), 4000);
    instance.on('style.load', () => {
      window.clearTimeout(timeout);
      setStyleFailed(false);
      setReady(true);
    });
    instance.on('zoomend', () => {
      const zoom = instance.getZoom();
      setScale(zoom < 4 ? 'globe' : zoom < 11 ? 'massif' : 'sentier');
    });

    return () => {
      window.clearTimeout(timeout);
      observer?.disconnect();
      mapRef.current = null;
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || !ready || !data) return;

    ensureSource(map, 'compte-tracks', tracksCollection(visibleTracks));
    ensureLayer(map, 'compte-tracks-casing', () => {
      map.addLayer({
        id: 'compte-tracks-casing',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 7,
          'line-opacity': 0.82,
        },
      });
    });
    ensureLayer(map, 'compte-tracks-glow', () => {
      map.addLayer({
        id: 'compte-tracks-glow',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5B7F55',
          'line-width': 11,
          'line-opacity': 0.32,
          'line-blur': 7,
        },
      });
    });
    ensureLayer(map, 'compte-tracks-line', () => {
      map.addLayer({
        id: 'compte-tracks-line',
        type: 'line',
        source: 'compte-tracks',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#17402C',
          'line-width': 3.5,
          'line-opacity': 0.96,
        },
      });
    });

    ensureSource(
      map,
      'compte-track-starts',
      pointsCollection(
        visibleTracks.map((track) => ({ id: track.id, position: track.start }))
      )
    );
    ensureLayer(map, 'compte-track-starts-dot', () => {
      map.addLayer({
        id: 'compte-track-starts-dot',
        type: 'circle',
        source: 'compte-track-starts',
        paint: {
          'circle-radius': 6,
          'circle-color': '#17402C',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2.5,
        },
      });
      map.on('click', 'compte-track-starts-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelected({ kind: 'outing', id: String(id) });
      });
    });

    ensureSource(
      map,
      'compte-track-ends',
      pointsCollection(visibleTracks.map((track) => ({ id: track.id, position: track.end })))
    );
    ensureLayer(map, 'compte-track-ends-dot', () => {
      map.addLayer({
        id: 'compte-track-ends-dot',
        type: 'circle',
        source: 'compte-track-ends',
        paint: {
          'circle-radius': 5,
          'circle-color': '#F4FBF3',
          'circle-stroke-color': '#17402C',
          'circle-stroke-width': 2.5,
        },
      });
    });

    ensureSource(
      map,
      'compte-carnets',
      pointsCollection(
        data.carnets.map((carnet) => ({ id: carnet.id, position: carnet.position }))
      )
    );
    ensureLayer(map, 'compte-carnets-halo', () => {
      map.addLayer({
        id: 'compte-carnets-halo',
        type: 'circle',
        source: 'compte-carnets',
        paint: {
          'circle-radius': 12,
          'circle-color': '#C89A3B',
          'circle-opacity': 0.16,
        },
      });
    });
    ensureLayer(map, 'compte-carnets-dot', () => {
      map.addLayer({
        id: 'compte-carnets-dot',
        type: 'circle',
        source: 'compte-carnets',
        paint: {
          'circle-radius': 6,
          'circle-color': '#C89A3B',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2.5,
          'circle-opacity': 1,
        },
      });
      map.on('click', 'compte-carnets-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelected({ kind: 'carnet', id: String(id) });
      });
    });

    ensureSource(
      map,
      'compte-pois',
      pointsCollection(data.pois.map((poi) => ({ id: poi.id, position: poi.position })))
    );
    ensureLayer(map, 'compte-pois-halo', () => {
      map.addLayer({
        id: 'compte-pois-halo',
        type: 'circle',
        source: 'compte-pois',
        paint: {
          'circle-radius': 11,
          'circle-color': '#2F6B45',
          'circle-opacity': 0.14,
        },
      });
    });
    ensureLayer(map, 'compte-pois-hit', () => {
      map.addLayer({
        id: 'compte-pois-hit',
        type: 'circle',
        source: 'compte-pois',
        paint: {
          'circle-radius': 18,
          'circle-color': '#2F6B45',
          'circle-opacity': 0,
        },
      });
      map.on('click', 'compte-pois-hit', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelected({ kind: 'poi', id: String(id) });
      });
    });
    ensureLayer(map, 'compte-pois-dot', () => {
      map.addLayer({
        id: 'compte-pois-dot',
        type: 'circle',
        source: 'compte-pois',
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#2F6B45',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2.5,
        },
      });
      map.on('click', 'compte-pois-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelected({ kind: 'poi', id: String(id) });
      });
    });

    const layers = mapModeConfig(context.mode).layers;
    const visibility: Array<[string, boolean]> = [
      ['compte-carnets-halo', false],
      ['compte-carnets-dot', false],
      ['compte-pois-halo', layers.pois],
      ['compte-pois-hit', layers.pois],
      ['compte-pois-dot', layers.pois],
      ['compte-track-starts-dot', layers.outingPins],
      ['compte-track-ends-dot', layers.tracks !== 'none'],
      ['compte-tracks-casing', layers.tracks !== 'none'],
      ['compte-tracks-glow', layers.tracks !== 'none'],
      ['compte-tracks-line', layers.tracks !== 'none'],
    ];
    for (const [layer, visible] of visibility) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
      }
    }
  }, [map, ready, data, visibleTracks, context.mode]);

  useEffect(() => {
    if (!map) return;
    const close = (event: { point: { x: number; y: number } }) => {
      const hits = map.queryRenderedFeatures(event.point as never, {
        layers: [
          'compte-track-starts-dot',
          'compte-carnets-dot',
          'compte-pois-hit',
          'compte-pois-dot',
        ].filter((layer) => Boolean(map.getLayer(layer))),
      });
      if (hits.length === 0) setSelected(null);
    };
    map.on('click', close);
    return () => {
      map.off('click', close);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !ready || !data) return;
    for (const marker of markerRefs.current) marker.remove();
    markerRefs.current = [];
    const poiEntries: Array<{ element: HTMLElement; lng: number; lat: number }> = [];

    if (config.layers.massifs) for (const massif of data.massifs) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-map-massif';
      element.setAttribute('aria-label', `${massif.name}, ${massif.outings} sorties`);
      element.dataset.massifId = massif.id;
      const icon = document.createElement('span');
      icon.className = 'lkdv-map-massif-ico';
      icon.innerHTML = MAP_ICON.peak;
      const count = document.createElement('b');
      count.textContent = String(massif.outings);
      const label = document.createElement('span');
      label.className = 'lkdv-map-massif-name';
      label.textContent = massif.name;
      element.append(icon, count, label);
      element.title = `${massif.name} · ${massif.outings} sorties`;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelected({ kind: 'massif', id: massif.id });
      });
      markerRefs.current.push(
        new Marker({ element, anchor: 'bottom' })
          .setLngLat([massif.center.lng, massif.center.lat])
          .addTo(map)
      );
    }

    if (config.layers.pois) for (const poi of data.pois) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-map-poi';
      element.dataset.poiId = poi.id;
      element.setAttribute('aria-label', poi.label);
      element.title = poi.label;
      const icon = document.createElement('span');
      icon.className = 'lkdv-map-poi-ico';
      icon.innerHTML = poiIcon(poi.label);
      element.append(icon);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelected({ kind: 'poi', id: poi.id });
      });
      poiEntries.push({ element, lng: poi.position.lng, lat: poi.position.lat });
      markerRefs.current.push(
        new Marker({ element, anchor: 'right' })
          .setLngLat([poi.position.lng, poi.position.lat])
          .addTo(map)
      );
    }

    const carnetElements: Array<{ element: HTMLElement; lng: number; lat: number }> = [];
    if (config.layers.carnets) for (const carnet of data.carnets) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-map-carnet';
      element.setAttribute('aria-label', carnet.title || 'Carnet');
      element.title = carnet.title || 'Carnet';
      const icon = document.createElement('span');
      icon.className = 'lkdv-map-carnet-ico';
      icon.innerHTML = MAP_ICON.book;
      element.append(icon);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelected({ kind: 'carnet', id: carnet.id });
      });
      carnetElements.push({ element, lng: carnet.position.lng, lat: carnet.position.lat });
      markerRefs.current.push(
        new Marker({ element, anchor: 'center' })
          .setLngLat([carnet.position.lng, carnet.position.lat])
          .addTo(map)
      );
    }

    const updatePoiVisibility = () => {
      const zoomVisible = map.getZoom() >= 7;
      const container = map.getContainer();
      const width = container.clientWidth;
      const height = container.clientHeight;
      const show = (entry: { element: HTMLElement; lng: number; lat: number }) => {
        const point = map.project([entry.lng, entry.lat]);
        const inside = point.x > 12 && point.x < width - 12 && point.y > 12 && point.y < height - 12;
        entry.element.style.display = zoomVisible && inside ? '' : 'none';
      };
      poiEntries.forEach(show);
      carnetElements.forEach(show);
    };
    updatePoiVisibility();
    map.on('zoom', updatePoiVisibility);
    map.on('resize', updatePoiVisibility);

    return () => {
      map.off('zoom', updatePoiVisibility);
      map.off('resize', updatePoiVisibility);
      for (const marker of markerRefs.current) marker.remove();
      markerRefs.current = [];
    };
  }, [map, ready, data, config.layers.massifs, config.layers.pois]);

  useEffect(() => {
    if (!map || !ready) return;
    const container = map.getContainer();
    container.querySelectorAll<HTMLElement>('.lkdv-map-massif').forEach((element) => {
      const id = element.dataset.massifId;
      element.classList.toggle('is-selected', selected?.kind === 'massif' && selected.id === id);
    });
  }, [map, ready, selected]);

  useEffect(() => {
    if (!map || !data || !ready) return;
    // Garder la sortie la plus récente lisible, y compris sur la grande carte :
    // les POI, le départ, l'arrivée et le carnet restent dans le cadre.
    const intent = fitIntentForMode(context.mode, data, context.outingId);
    if (!intent) return;
    const reduced = prefersReducedMotion();
    map.fitBounds(
      [
        [intent.bounds[0], intent.bounds[1]],
        [intent.bounds[2], intent.bounds[3]],
      ],
      {
        padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
          sheetOpen: context.mode !== 'overview',
          mapbig: map.getContainer().clientHeight > 500,
        }),
        maxZoom: intent.maxZoom,
        pitch: context.mode === 'sortie' ? 45 : 0,
        duration: reduced ? 0 : context.mode === 'sortie' ? 1200 : 800,
        essential: true,
      }
    );
  }, [map, data, ready, context.mode, context.outingId]);

  useEffect(() => {
    if (!map || !resolved) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const point = map.project([resolved.position.lng, resolved.position.lat]);
      setAnchor({ x: point.x, y: point.y });
    };
    update();
    map.on('move', update);
    map.on('zoom', update);
    return () => {
      map.off('move', update);
      map.off('zoom', update);
    };
  }, [map, resolved]);

  /* Recentrage demandé de l'extérieur (ligne de lieu de la fiche carnet).
     Une coordonnée absente ou non finie ne déplace rien. */
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

  const handleScale = useCallback(
    (next: MapScale) => {
      if (!map) return;
      setScale(next);
      const focus =
        resolved?.position ??
        data?.tracks[0]?.start ??
        data?.massifs[0]?.center ?? { lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] };
      const pose = cameraForScale(next, focus);
      map.flyTo({
        center: pose.center,
        zoom: pose.zoom,
        pitch: pose.pitch,
        bearing: pose.bearing,
        duration: prefersReducedMotion() ? 0 : next === 'globe' ? 1800 : 1200,
        essential: true,
      });
    },
    [map, resolved, data]
  );

  const handleRecenter = useCallback(() => {
    if (!map || !data?.bounds) return;
    const bounds = data.bounds;
    map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      {
        padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
          sheetOpen: context.mode !== 'overview',
          mapbig: map.getContainer().clientHeight > 500,
        }),
        maxZoom: 11,
        duration: prefersReducedMotion() ? 0 : 900,
        essential: true,
      }
    );
  }, [map, data, context.mode]);

  const handleLayers = useCallback(() => {
    if (!map) return;
    const next = tileMode === 'satellite' ? 'topo' : 'satellite';
    if (map.getLayer('atlas-tile-satellite')) {
      map.setLayoutProperty(
        'atlas-tile-satellite',
        'visibility',
        next === 'satellite' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('atlas-tile-topo')) {
      map.setLayoutProperty(
        'atlas-tile-topo',
        'visibility',
        next === 'topo' ? 'visible' : 'none'
      );
    }
    setTileMode(next);
  }, [map, tileMode]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.zoomIn({ duration: prefersReducedMotion() ? 0 : 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.zoomOut({ duration: prefersReducedMotion() ? 0 : 300 });
  }, [map]);

  const handleOpen = useCallback((kind: Resolved['kind'], id: string) => {
    if (kind === 'carnet') {
      window.location.assign(`/carnets/${encodeURIComponent(id)}`);
      return;
    }
    if (kind === 'massif') {
      window.__lkdvOpenSlot?.('souvenirs');
      return;
    }
    window.__lkdvCompteMapOpenOuting?.(id);
  }, []);

  const showGuest = authState === 'guest' || unauthorized;
  const showError =
    !fallback && !styleFailed && (authState === 'error' || (query.isError && !unauthorized));
  const showEmpty =
    !fallback &&
    !styleFailed &&
    ready &&
    authState === 'owner' &&
    Boolean(data) &&
    (data?.tracks.length ?? 0) === 0;
  const showNeutral =
    !fallback &&
    !styleFailed &&
    ready &&
    authState === 'owner' &&
    config.dimmed &&
    Boolean(config.emptyTitle);

  return (
    <div
      className="lkdv-map-root"
      role="region"
      aria-label="Carte de tes sorties"
      data-map-mode={context.mode}
      data-map-outing={context.outingId ?? ''}
      data-map-ready={ready ? 'true' : 'false'}
      data-map-style-failed={styleFailed ? 'true' : 'false'}
      data-map-empty={data && data.tracks.length === 0 ? 'true' : 'false'}
      data-map-dimmed={config.dimmed ? 'true' : 'false'}
      data-map-fallback={fallback ? 'true' : 'false'}
      data-offline={!online ? 'true' : 'false'}
    >
      <div ref={containerRef} className="lkdv-map-canvas" />
      <p className="sr-only" aria-live="polite">
        {data
          ? `Carte de tes sorties : ${data.stats.outings} sorties, ${data.stats.km} kilomètres, ${data.stats.massifs} massifs.`
          : 'Carte en chargement.'}
      </p>

      {!ready && !styleFailed && !fallback ? (
        <div className="lkdv-map-loading" aria-hidden="true" />
      ) : null}

      {fallback || styleFailed ? (
        <CompteMapFallback tracks={data?.tracks ?? []} massifs={data?.massifs ?? []} />
      ) : null}

      {showGuest ? <CompteMapState kind="guest" /> : null}
      {showError ? (
        <CompteMapState kind="error" onRetry={() => query.refetch()} />
      ) : null}

      {showEmpty && data ? (
        data.stats.outings > 0 ? (
          <CompteMapState
            kind="no-tracks"
            count={data.stats.outings}
            onOpenOutings={() => window.__lkdvOpenSlot?.('souvenirs')}
          />
        ) : (
          <CompteMapState kind="empty" />
        )
      ) : null}

      {showNeutral ? (
        <CompteMapState kind="neutral" title={config.emptyTitle} hint={config.emptyHint} />
      ) : null}

      {ready && authState === 'owner' && data && data.tracks.length > 0 && !query.isError && !fallback ? (
        <CompteMapHud
          config={config}
          scale={scale}
          onScale={handleScale}
          onRecenter={handleRecenter}
          onLayers={handleLayers}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
      ) : null}

      {anchor && resolved && !fallback ? (
        <div
          className="lkdv-map-callout-anchor"
          style={{ left: anchor.x, top: anchor.y }}
        >
          {resolved.kind === 'outing' ? (
            <CompteMapCallout
              kind="outing"
              data={resolved.data}
              onClose={() => setSelected(null)}
              onOpen={(id) => handleOpen('outing', id)}
            />
          ) : resolved.kind === 'massif' ? (
            <CompteMapCallout
              kind="massif"
              data={resolved.data}
              onClose={() => setSelected(null)}
              onOpen={(id) => handleOpen('massif', id)}
            />
          ) : resolved.kind === 'carnet' ? (
            <CompteMapCallout
              kind="carnet"
              data={resolved.data}
              onClose={() => setSelected(null)}
              onOpen={(id) => handleOpen('carnet', id)}
            />
          ) : (
            <CompteMapCallout
              kind="poi"
              data={resolved.data}
              onClose={() => setSelected(null)}
              onOpen={(id) => handleOpen('poi', id)}
            />
          )}
        </div>
      ) : null}

      {ready ? <CompteMapAttribution /> : null}
      {!online ? <div className="lkdv-map-offline">Hors ligne</div> : null}
    </div>
  );
}

export default CompteMap;
