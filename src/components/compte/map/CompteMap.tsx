'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { resolveMapZoomConfig, type MapZoomBand } from '@/features/compte/map/zoomHierarchy';
import {
  boundsOf as boundsOfPoints,
  parseTraceSegments,
  simplifyTrack,
} from '@/features/compte/map/geometry';
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

const DEFAULT_CENTER: [number, number] = [2.35, 46.6];

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
  /**
   * `carnet` : la carte d'une fiche carnet ne peint QUE le tracé du carnet.
   * Aucune donnée du compte n'est demandée ni affichée (le visiteur n'est pas
   * le propriétaire), et l'état « connecte-toi » n'a pas de sens ici.
   */
  variant?: 'compte' | 'carnet';
  /** Trace GeoJSON du carnet (LineString, Feature, ou liste de points). */
  trace?: unknown | null;
  /** État vide honnête, affiché seulement si le carnet n'a réellement aucune trace. */
  emptyTitle?: string;
  emptyHint?: string;
  /** Jour actif sur la fiche carnet (filtrage visuel optionnel de la trace). */
  activeDay?: number | null;
  /** Position GPS live (participant en partage direct). */
  livePosition?: { lat: number; lng: number } | null;
  /** Zone approximative floue (visiteur). */
  publicZone?: { centerLat: number; centerLng: number; radiusMeters?: number } | null;
  /** Marqueurs d'étapes, nuits ou moments du carnet. */
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    type?: string;
    badge?: string;
  }>;
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

function pointsCollection(rows: Array<{ id: string; position: TrackPoint; importance?: number }>) {
  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        importance: row.importance ?? 1,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [row.position.lng, row.position.lat],
      },
    })),
  };
}

/** Tracé d'un carnet public : un Feature par morceau, jamais recollé. */
function carnetTraceCollection(segments: TrackPoint[][]) {
  return {
    type: 'FeatureCollection' as const,
    features: segments
      .filter((segment) => segment.length >= 2)
      .map((segment, index) => ({
        type: 'Feature' as const,
        properties: { id: `carnet-trace-${index}` },
        geometry: {
          type: 'LineString' as const,
          coordinates: segment.map((point) => [point.lng, point.lat]),
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

/**
 * Hauteur de carte recouverte par la barre du bas (barre web flottante ou
 * barre native iOS), mesurée à l'écran : le cadrage, les fiches et les
 * mentions de la carte se placent au-dessus d'elle.
 */
function bottomBarOverlap(container: HTMLElement): number {
  if (typeof document === 'undefined') return 0;
  const mapBottom = container.getBoundingClientRect().bottom;
  const webBar = document.querySelector<HTMLElement>('.lkdv-floating-tabbar-surface');
  let barTop = Number.POSITIVE_INFINITY;
  if (webBar && webBar.offsetParent !== null) barTop = webBar.getBoundingClientRect().top;
  const nativeHeight = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--lkv-native-bar-height') || ''
  );
  if (
    document.documentElement.hasAttribute('data-native-glass-nav') &&
    Number.isFinite(nativeHeight)
  ) {
    barTop = Math.min(barTop, window.innerHeight - nativeHeight);
  }
  if (!Number.isFinite(barTop)) return 0;
  /* À ≥ 768 la barre flottante n'est pas stylée (dette D-01) : elle est rendue
     en flux en haut de page et ne recouvre pas la carte. Sans ce garde, son
     `top` proche de 0 ajoutait toute la hauteur de l'écran au padding de
     cadrage, et `fitBounds` levait une erreur maplibre sur la fiche carnet. */
  if (barTop < 80) return 0;
  return Math.max(0, Math.round(mapBottom - barTop) + 8);
}

/** Ajoute la hauteur recouverte par la barre du bas au bas du cadrage. */
function withBarInset<T extends { bottom: number }>(padding: T, container: HTMLElement): T {
  return { ...padding, bottom: padding.bottom + bottomBarOverlap(container) };
}

/**
 * `fitBounds` tolérant : maplibre lève dans `cameraForBoxAndBearing` quand le
 * conteneur n'est pas encore mesuré ou quand le padding mange sa taille.
 * On saute alors le cadrage au lieu de faire tomber l'écran.
 */
function fitBoundsSafely(
  map: MapLibreMap,
  bounds: [[number, number], [number, number]],
  options: Parameters<MapLibreMap['fitBounds']>[1]
) {
  const rect = map.getContainer().getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return;
  if (!bounds.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))) return;
  const padding = options?.padding;
  if (padding && typeof padding === 'object') {
    const horizontal = (padding.left ?? 0) + (padding.right ?? 0);
    const vertical = (padding.top ?? 0) + (padding.bottom ?? 0);
    if (rect.width - horizontal < 8 || rect.height - vertical < 8) return;
  }
  try {
    map.fitBounds(bounds, options);
  } catch {
    /* Carte non mesurable à cet instant : le prochain rendu recadrera. */
  }
}

export function CompteMap({
  authState,
  context,
  focus = null,
  variant = 'compte',
  trace = null,
  emptyTitle,
  emptyHint,
  activeDay = null,
  livePosition = null,
  publicZone = null,
  markers = [],
}: CompteMapProps) {
  const router = useRouter();
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
  const [tileMode, setTileMode] = useState<'satellite' | 'topo'>(
    variant === 'carnet' ? 'topo' : 'satellite'
  );
  const [online, setOnline] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [zoomBand, setZoomBand] = useState<MapZoomBand>('world');

  useEffect(() => {
    if (!map) return;
    const onZoom = () => {
      const currentZoom = map.getZoom();
      const nextBand = resolveMapZoomConfig(currentZoom).band;
      setZoomBand(nextBand);
    };
    onZoom();
    map.on('zoom', onZoom);
    return () => {
      map.off('zoom', onZoom);
    };
  }, [map]);

  /* Le carnet s'ouvre sur la carte topo (maquette) ; le toggle reste possible. */
  useEffect(() => {
    if (!map || !ready) return;
    for (const layer of ['atlas-tile-satellite', 'atlas-tile-topo']) {
      if (!map.getLayer(layer)) continue;
      const wanted = layer === 'atlas-tile-topo' ? 'topo' : 'satellite';
      map.setLayoutProperty(layer, 'visibility', tileMode === wanted ? 'visible' : 'none');
    }
  }, [map, ready, tileMode]);

  /* Fiche carnet : la carte ne montre que le tracé du carnet. Un
     MultiLineString reste une liste de morceaux ; on ne l'aplatit jamais en
     une seule ligne, sinon une zone masquée serait recollée à l'écran. */
  const isCarnet = variant === 'carnet';
  const traceSegments = useMemo(
    () =>
      isCarnet
        ? parseTraceSegments(trace)
            .map((segment) => simplifyTrack(segment, 120))
            .filter((segment) => segment.length >= 2)
        : [],
    [isCarnet, trace]
  );
  const tracePoints = useMemo(() => traceSegments.flat(), [traceSegments]);
  const traceBounds = useMemo(
    () => (tracePoints.length >= 2 ? boundsOfPoints(tracePoints) : null),
    [tracePoints]
  );

  const config = mapModeConfig(context.mode);
  const query = useQuery<CompteMapPayload, Error>({
    queryKey: ['compte-map'],
    queryFn: fetchCompteMap,
    enabled: authState === 'owner' && online && !isCarnet,
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
      zoom: 6.1,
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
    (window as unknown as { __lkdvCompteMap3D?: MapLibreMap }).__lkdvCompteMap3D = instance;

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => instance.resize()) : null;
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
          'line-width': 6,
          'line-opacity': 0.68,
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
          'line-width': 7,
          'line-opacity': 0.35,
          'line-blur': 4,
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
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
    });

    ensureSource(
      map,
      'compte-track-starts',
      pointsCollection(
        visibleTracks.map((track) => ({
          id: track.id,
          position: track.start,
          importance: track.km >= 25 ? 3 : track.km >= 12 ? 2 : 1,
        }))
      )
    );
    ensureLayer(map, 'compte-track-starts-dot', () => {
      map.addLayer({
        id: 'compte-track-starts-dot',
        type: 'circle',
        source: 'compte-track-starts',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            ['match', ['get', 'importance'], 3, 2.4, 2, 1.9, 1.5],
            7,
            ['match', ['get', 'importance'], 3, 3.6, 2, 2.9, 2.3],
            11,
            ['match', ['get', 'importance'], 3, 5.2, 2, 4.2, 3.4],
            15,
            ['match', ['get', 'importance'], 3, 7.2, 2, 5.8, 4.6],
          ] as any,
          'circle-color': '#17402C',
          'circle-stroke-color': 'rgba(255, 255, 255, 0.95)',
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.8,
            9,
            1.2,
            15,
            1.8,
          ] as any,
          'circle-opacity': 0.95,
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
      pointsCollection(
        visibleTracks.map((track) => ({
          id: track.id,
          position: track.end,
          importance: 1,
        }))
      )
    );
    ensureLayer(map, 'compte-track-ends-dot', () => {
      map.addLayer({
        id: 'compte-track-ends-dot',
        type: 'circle',
        source: 'compte-track-ends',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            1.2,
            7,
            1.8,
            11,
            2.6,
            15,
            3.5,
          ] as any,
          'circle-color': '#FFFFFF',
          'circle-stroke-color': '#17402C',
          'circle-stroke-width': 1,
          'circle-opacity': 0.85,
        },
      });
    });

    ensureSource(
      map,
      'compte-carnets',
      pointsCollection(
        data.carnets.map((carnet) => ({
          id: carnet.id,
          position: carnet.position,
          importance: 2,
        }))
      )
    );
    ensureLayer(map, 'compte-carnets-dot', () => {
      map.addLayer({
        id: 'compte-carnets-dot',
        type: 'circle',
        source: 'compte-carnets',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            1.8,
            7,
            2.7,
            11,
            4.0,
            15,
            5.5,
          ] as any,
          'circle-color': '#C89A3B',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.8,
            9,
            1.2,
            15,
            1.6,
          ] as any,
          'circle-opacity': 0.95,
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
      pointsCollection(
        data.pois.map((poi) => ({
          id: poi.id,
          position: poi.position,
          importance: poi.day ? 2 : 1,
        }))
      )
    );
    ensureLayer(map, 'compte-pois-dot', () => {
      map.addLayer({
        id: 'compte-pois-dot',
        type: 'circle',
        source: 'compte-pois',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            1.2,
            7,
            1.8,
            11,
            2.6,
            15,
            3.8,
          ] as any,
          'circle-color': '#4B6B7C',
          'circle-stroke-color': 'rgba(255, 255, 255, 0.85)',
          'circle-stroke-width': 0.8,
          'circle-opacity': 0.85,
        },
      });
      map.on('click', 'compte-pois-dot', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelected({ kind: 'poi', id: String(id) });
      });
    });

    const layers = mapModeConfig(context.mode).layers;
    const visibility: Array<[string, boolean]> = [
      ['compte-carnets-dot', layers.carnets],
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

  /* Tracé du carnet : même peinture que les traces du Compte (liseré blanc,
     halo vert, ligne encre), mais la donnée vient de la fiche, pas du compte. */
  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    ensureSource(
      map,
      'compte-carnet-trace',
      carnetTraceCollection(traceSegments) as ReturnType<typeof tracksCollection>
    );
    ensureLayer(map, 'compte-carnet-trace-casing', () => {
      map.addLayer({
        id: 'compte-carnet-trace-casing',
        type: 'line',
        source: 'compte-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.68 },
      });
    });
    ensureLayer(map, 'compte-carnet-trace-glow', () => {
      map.addLayer({
        id: 'compte-carnet-trace-glow',
        type: 'line',
        source: 'compte-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5B7F55',
          'line-width': 7,
          'line-opacity': 0.35,
          'line-blur': 4,
        },
      });
    });
    ensureLayer(map, 'compte-carnet-trace-line', () => {
      map.addLayer({
        id: 'compte-carnet-trace-line',
        type: 'line',
        source: 'compte-carnet-trace',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#17402C', 'line-width': 3, 'line-opacity': 0.9 },
      });
    });
    const visible = tracePoints.length >= 2 ? 'visible' : 'none';
    for (const layer of [
      'compte-carnet-trace-casing',
      'compte-carnet-trace-glow',
      'compte-carnet-trace-line',
    ]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visible);
    }
  }, [map, ready, isCarnet, traceSegments, tracePoints.length]);

  /* Cadrage du tracé du carnet : le parcours remplit la bande carte, en 3D
     (même inclinaison que la carte d'une sortie du Compte). */
  useEffect(() => {
    if (!map || !ready || !traceBounds) return;
    const reduced = prefersReducedMotion();
    fitBoundsSafely(
      map,
      [
        [traceBounds[0], traceBounds[1]],
        [traceBounds[2], traceBounds[3]],
      ],
      {
        padding: withBarInset(
          paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: false,
            mapbig: map.getContainer().clientHeight > 500,
          }),
          map.getContainer()
        ),
        maxZoom: 14,
        pitch: 45,
        bearing: -18,
        duration: reduced ? 0 : 1100,
        essential: true,
      }
    );
  }, [map, ready, traceBounds]);

  useEffect(() => {
    if (!map) return;
    const close = (event: { point: { x: number; y: number } }) => {
      const hits = map.queryRenderedFeatures(event.point as never, {
        layers: ['compte-track-starts-dot', 'compte-carnets-dot', 'compte-pois-dot'].filter(
          (layer) => Boolean(map.getLayer(layer))
        ),
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
    if (!config.layers.massifs) return;

    for (const massif of data.massifs) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-map-massif';
      element.dataset.massifId = massif.id;
      const importance = massif.outings >= 5 ? 'high' : massif.outings >= 2 ? 'medium' : 'low';
      element.dataset.importance = importance;
      element.dataset.outings = String(massif.outings);
      element.setAttribute('aria-label', `${massif.name}, ${massif.outings} sorties`);
      const count = document.createElement('b');
      count.textContent = String(massif.outings);
      element.append(count);
      const name = document.createElement('span');
      name.className = 'lkdv-map-massif-name';
      name.textContent = massif.name;
      element.append(name);
      element.title = `${massif.name} · ${massif.outings} sorties`;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelected({ kind: 'massif', id: massif.id });
      });
      markerRefs.current.push(
        new Marker({ element, anchor: 'center' })
          .setLngLat([massif.center.lng, massif.center.lat])
          .addTo(map)
      );
    }
  }, [map, ready, data, config.layers.massifs]);

  useEffect(() => {
    if (!map || !data || !ready) return;
    const intent = fitIntentForMode(context.mode, data, context.outingId);
    if (!intent) return;
    const reduced = prefersReducedMotion();
    fitBoundsSafely(
      map,
      [
        [intent.bounds[0], intent.bounds[1]],
        [intent.bounds[2], intent.bounds[3]],
      ],
      {
        padding: withBarInset(
          paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: context.mode !== 'overview',
            mapbig: map.getContainer().clientHeight > 500,
          }),
          map.getContainer()
        ),
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
      const carnetFocus =
        isCarnet && traceBounds
          ? {
              lng: (traceBounds[0] + traceBounds[2]) / 2,
              lat: (traceBounds[1] + traceBounds[3]) / 2,
            }
          : null;
      const focus = carnetFocus ??
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
    [map, resolved, data, isCarnet, traceBounds]
  );

  const handleRecenter = useCallback(() => {
    if (!map) return;
    if (isCarnet && traceBounds) {
      fitBoundsSafely(
        map,
        [
          [traceBounds[0], traceBounds[1]],
          [traceBounds[2], traceBounds[3]],
        ],
        {
          padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: false,
            mapbig: map.getContainer().clientHeight > 500,
          }),
          maxZoom: 14,
          duration: prefersReducedMotion() ? 0 : 900,
          essential: true,
        }
      );
      return;
    }
    if (!data?.bounds) return;
    const bounds = data.bounds;
    fitBoundsSafely(
      map,
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      {
        padding: withBarInset(
          paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: context.mode !== 'overview',
            mapbig: map.getContainer().clientHeight > 500,
          }),
          map.getContainer()
        ),
        maxZoom: 11,
        duration: prefersReducedMotion() ? 0 : 900,
        essential: true,
      }
    );
  }, [map, data, context.mode, isCarnet, traceBounds]);

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
      map.setLayoutProperty('atlas-tile-topo', 'visibility', next === 'topo' ? 'visible' : 'none');
    }
    setTileMode(next);
  }, [map, tileMode]);

  const carnetMarkerRefs = useRef<Marker[]>([]);

  useEffect(() => {
    if (!map || !ready || !isCarnet) return;
    for (const m of carnetMarkerRefs.current) m.remove();
    carnetMarkerRefs.current = [];

    for (const marker of markers) {
      const el = document.createElement('div');
      el.className = 'lkdv-carnet-map-marker';
      el.title = marker.title;
      if (marker.badge) {
        el.classList.add('has-badge');
        const badge = document.createElement('span');
        badge.className = 'lkdv-map-night-badge';
        badge.textContent = marker.badge;
        el.appendChild(badge);
        el.setAttribute('aria-label', `${marker.badge} · ${marker.title}`);
      } else {
        const scrub = marker.type === 'scrub';
        el.style.width = scrub ? '14px' : '18px';
        el.style.height = scrub ? '14px' : '18px';
        el.style.borderRadius = '9999px';
        el.style.background =
          marker.type === 'start'
            ? '#FFFFFF'
            : marker.type === 'bivouac' || marker.type === 'refuge' || marker.type === 'end'
              ? '#5B7F55'
              : '#17402C';
        el.style.border = marker.type === 'start' ? '2px solid #17402C' : '2px solid #FFFFFF';
        el.style.boxShadow = scrub
          ? '0 0 0 5px rgba(23,64,44,0.18), 0 2px 6px rgba(0,0,0,0.3)'
          : '0 2px 6px rgba(0,0,0,0.3)';
      }

      const m = new Marker({ element: el, anchor: 'center' })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);
      carnetMarkerRefs.current.push(m);
    }

    if (livePosition) {
      const el = document.createElement('div');
      el.className = 'lkdv-carnet-live-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '9999px';
      el.style.background = '#226148';
      el.style.border = '2.5px solid #FFFFFF';
      el.style.boxShadow = '0 0 0 4px rgba(34,97,72,0.35)';

      const m = new Marker({ element: el, anchor: 'center' })
        .setLngLat([livePosition.lng, livePosition.lat])
        .addTo(map);
      carnetMarkerRefs.current.push(m);
    }

    if (publicZone) {
      const el = document.createElement('div');
      el.className = 'lkdv-carnet-public-zone';
      el.style.width = '48px';
      el.style.height = '48px';
      el.style.borderRadius = '9999px';
      el.style.background = 'rgba(91,127,85,0.2)';
      el.style.border = '1.5px dashed rgba(23,64,44,0.4)';

      const m = new Marker({ element: el, anchor: 'center' })
        .setLngLat([publicZone.centerLng, publicZone.centerLat])
        .addTo(map);
      carnetMarkerRefs.current.push(m);
    }

    return () => {
      for (const m of carnetMarkerRefs.current) m.remove();
      carnetMarkerRefs.current = [];
    };
  }, [map, ready, isCarnet, markers, livePosition, publicZone]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.zoomIn({ duration: prefersReducedMotion() ? 0 : 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.zoomOut({ duration: prefersReducedMotion() ? 0 : 300 });
  }, [map]);

  const handleOpen = useCallback(
    (kind: Resolved['kind'], id: string) => {
      if (kind === 'carnet') {
        router.push(`/carnets/${encodeURIComponent(id)}`);
        return;
      }
      if (kind === 'massif') {
        window.__lkdvOpenSlot?.('souvenirs');
        return;
      }
      window.__lkdvCompteMapOpenOuting?.(id);
    },
    [router]
  );

  const showGuest = !isCarnet && (authState === 'guest' || unauthorized);
  const showError =
    !isCarnet &&
    !fallback &&
    !styleFailed &&
    (authState === 'error' || (query.isError && !unauthorized));
  const showEmpty =
    !isCarnet &&
    !fallback &&
    !styleFailed &&
    ready &&
    authState === 'owner' &&
    Boolean(data) &&
    (data?.tracks.length ?? 0) === 0;
  const showNeutral =
    !isCarnet &&
    !fallback &&
    !styleFailed &&
    ready &&
    authState === 'owner' &&
    config.dimmed &&
    Boolean(config.emptyTitle);
  /* Fiche carnet : état vide seulement quand la base ne porte réellement
     aucune trace — jamais un « connecte-toi » qui n'a pas de sens ici. */
  const showCarnetEmpty = isCarnet && !fallback && !styleFailed && ready && tracePoints.length < 2;

  return (
    <div
      className="lkdv-map-root"
      role="region"
      aria-label="Carte de tes sorties"
      data-zoom-band={zoomBand}
      data-map-mode={context.mode}
      data-map-outing={context.outingId ?? ''}
      data-map-ready={ready ? 'true' : 'false'}
      data-map-style-failed={styleFailed ? 'true' : 'false'}
      data-map-empty={data && data.tracks.length === 0 ? 'true' : 'false'}
      data-map-dimmed={config.dimmed ? 'true' : 'false'}
      data-map-fallback={fallback ? 'true' : 'false'}
      data-map-variant={variant}
      data-map-trace={isCarnet ? (tracePoints.length >= 2 ? 'true' : 'false') : 'account'}
      data-offline={!online ? 'true' : 'false'}
    >
      <div ref={containerRef} className="lkdv-map-canvas" />
      <p className="sr-only" aria-live="polite">
        {isCarnet
          ? tracePoints.length >= 2
            ? `Tracé du carnet : ${tracePoints.length} points géolocalisés.`
            : 'Aucun tracé enregistré pour ce carnet.'
          : data
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
      {showError ? <CompteMapState kind="error" onRetry={() => query.refetch()} /> : null}

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

      {showCarnetEmpty ? (
        <CompteMapState
          kind="neutral"
          title={emptyTitle ?? 'Aucun tracé enregistré pour ce carnet.'}
          hint={emptyHint ?? 'L’auteur n’a pas joint de trace GPS à ce carnet.'}
        />
      ) : null}

      {ready &&
      ((isCarnet && tracePoints.length >= 2) ||
        (!isCarnet &&
          authState === 'owner' &&
          data &&
          data.tracks.length > 0 &&
          !query.isError &&
          !fallback)) ? (
        <CompteMapHud
          config={config}
          scale={scale}
          onScale={handleScale}
          onRecenter={handleRecenter}
          onLayers={handleLayers}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showLayers={!isCarnet}
        />
      ) : null}

      {anchor && resolved && !fallback ? (
        <div className="lkdv-map-callout-anchor" style={{ left: anchor.x, top: anchor.y }}>
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
