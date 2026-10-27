'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import {
  applyOverlaySelection,
  captureOverlayFocus,
  restoreOverlayFocus,
  type OverlayFocus,
} from '@/features/compte/map/overlaySelection';
import type {
  CompteMapMode,
  CompteMapPayload,
  MapMassif,
  MapTrack,
  TrackPoint,
} from '@/features/compte/map/types';
import {
  clusterByScreenDistance,
  isInsideViewport,
  isOverlayEntryVisible,
  resolveMapZoomConfig,
  resolveNativeLayerVisibility,
  simplifyCoordinates,
  type MapOverlayKind,
  type MapZoomConfig,
  type MassifCluster,
} from '@/features/compte/map/zoomHierarchy';
import { CompteMapAttribution, CompteMapHud } from './CompteMapHud';
import { CompteMapCallout } from './CompteMapCallout';
import { CompteMapFallback } from './CompteMapFallback';
import { CompteMapState } from './CompteMapState';
import './compte-map.css';

const DEFAULT_CENTER: [number, number] = [2.5, 46.5];

/**
 * `useLayoutEffect` côté navigateur, `useEffect` au rendu serveur : le composant
 * est un Client Component mais Next le prérend, et React avertit quand un
 * layout effect s'exécute sur le serveur. L'ordre des hooks reste identique.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

const MAP_ICON = {
  peak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 19 6.5-11 4 6 2.5-4L21 19H3Z"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z"/></svg>',
  shelter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/></svg>',
  tent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 20 9-16 9 16H3ZM12 4v16M8 20l4-7 4 7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5ZM4 19.5A2.5 2.5 0 0 1 6.5 17H19"/></svg>',
};

const CINEMATIC_EASE = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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

/**
 * Deux configurations de zoom ne diffèrent « à l'écran » que par ces champs.
 *
 * `setZoomConfig` est appelé à chaque frame de zoom : renvoyer l'objet précédent
 * quand rien de visible ne change garde son identité stable et empêche les
 * effets natifs (source GeoJSON, layout, paint) de tourner à 60 fps. Les champs
 * omis (`massifs`, `clusterRadiusPx`, `viewportMarginPx`) ne changent qu'aux
 * seuils de bande, où `band` change déjà.
 */
function sameZoomPresentation(previous: MapZoomConfig, next: MapZoomConfig): boolean {
  return (
    previous.band === next.band &&
    previous.trackWidth === next.trackWidth &&
    previous.casing === next.casing &&
    previous.glow === next.glow &&
    previous.pois === next.pois &&
    previous.carnets === next.carnets &&
    previous.endpoints === next.endpoints
  );
}

function tracksCollection(tracks: MapTrack[], simplified = false) {
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
        massifId: track.massifId ?? '',
      },
      geometry: {
        type: 'LineString' as const,
        // Monde/Pays : 20 sommets suffisent et allègent chaque frame. Région et
        // Lieu gardent la trace native complète pour ne pas perdre le trait.
        coordinates: (simplified ? simplifyCoordinates(track.coordinates) : track.coordinates).map(
          (point) => [point.lng, point.lat]
        ),
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

function isMarkerClick(event: MapLayerMouseEvent): boolean {
  const target = event.originalEvent?.target as HTMLElement | null;
  return Boolean(target?.closest?.('.maplibregl-marker, .lkdv-map-overlay'));
}

export function CompteMap({ authState, context, focus = null }: CompteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  /** Sélection courante, lisible depuis les callbacks de l'overlay (rebuilds). */
  const selectedRef = useRef<Selected | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState<MapScale>('globe');
  const [zoomConfig, setZoomConfig] = useState(() => resolveMapZoomConfig(3));
  /**
   * Bande courante, lisible *synchroniquement* par l'overlay DOM.
   *
   * Le handler `zoom` met ce ref à jour avant d'appeler `setZoomConfig` : le
   * `place()` de l'overlay (même événement, enregistré après) filtre donc les
   * entrées sur la bande de la frame, sans dépendre du rendu React ni
   * reconstruire l'overlay à chaque franchissement de seuil.
   */
  const zoomConfigRef = useRef<MapZoomConfig>(zoomConfig);
  /** Focus clavier à reposer après une reconstruction de l'overlay. */
  const overlayFocusRef = useRef<OverlayFocus | null>(null);
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
    instance.on('zoom', () => {
      const zoom = instance.getZoom();
      // Le ref d'abord : l'overlay lit la bande dans son propre handler `zoom`,
      // enregistré après celui-ci, sans attendre le re-rendu React.
      const nextZoomConfig = resolveMapZoomConfig(zoom);
      zoomConfigRef.current = nextZoomConfig;
      // Mise à jour fonctionnelle : à l'intérieur d'une même bande, la config
      // précédente est renvoyée telle quelle. Son identité reste stable, donc
      // les effets qui recopient la source GeoJSON, le layout et le paint ne
      // tournent plus à chaque frame (seuls les franchissements de seuil les
      // déclenchent). Le ref, lui, est toujours la config de la frame.
      setZoomConfig((previous) =>
        sameZoomPresentation(previous, nextZoomConfig) ? previous : nextZoomConfig
      );
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

    ensureSource(
      map,
      'compte-tracks',
      tracksCollection(visibleTracks, zoomConfig.trackSimplified)
    );
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
        if (isMarkerClick(event)) return;
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
        if (isMarkerClick(event)) return;
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
        if (isMarkerClick(event)) return;
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
        if (isMarkerClick(event)) return;
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelected({ kind: 'poi', id: String(id) });
      });
    });

    const layers = mapModeConfig(context.mode).layers;
    // Les couches natives suivent la même bande que l'overlay : sans ce
    // croisement, les cercles POI resteraient dessinés (et cliquables) à toutes
    // les échelles, et les départs/arrivées visibles en Monde/Pays.
    const native = resolveNativeLayerVisibility(
      { pois: layers.pois, outingPins: layers.outingPins, tracks: layers.tracks !== 'none' },
      zoomConfig
    );
    const visibility: Array<[string, boolean]> = [
      ['compte-carnets-halo', false],
      ['compte-carnets-dot', false],
      ['compte-pois-halo', native.pois],
      ['compte-pois-hit', native.pois],
      ['compte-pois-dot', native.pois],
      ['compte-track-starts-dot', native.trackStarts],
      ['compte-track-ends-dot', native.trackEnds],
      ['compte-tracks-casing', native.casing],
      ['compte-tracks-glow', native.glow],
      ['compte-tracks-line', layers.tracks !== 'none'],
    ];
    for (const [layer, visible] of visibility) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
      }
    }
  }, [map, ready, data, visibleTracks, context.mode, zoomConfig]);

  useEffect(() => {
    if (!map) return;
    const close = (event: { point: { x: number; y: number }; originalEvent?: Event }) => {
      const target = event.originalEvent?.target as HTMLElement | null;
      if (target?.closest?.('.maplibregl-marker, .lkdv-map-overlay')) return;
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
    const container = map.getContainer();
    let overlay = container.querySelector<HTMLDivElement>('.lkdv-map-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'lkdv-map-overlay';
      container.appendChild(overlay);
    }
    // Focus capturé par le cleanup de l'instance précédente (changement de
    // données, de mode ou de couches). Il est reposé après la reconstruction.
    let pendingFocus = overlayFocusRef.current;
    overlayFocusRef.current = null;
    overlay.innerHTML = '';

    type Entry = {
      element: HTMLButtonElement;
      lng: number;
      lat: number;
      anchor: string;
      /** Type de point : décide de la règle de bande appliquée dans `place`. */
      kind: MapOverlayKind;
    };
    type MassifEntry = { massif: MapMassif; point: { x: number; y: number } };
    const entries: Entry[] = [];

    /** Cadre l'ensemble des massifs d'un agrégat : même padding que la fiche. */
    const fitMassifGroup = (massifs: MapMassif[]) => {
      // Une fiche ouverte masquerait le groupe cadré : on la referme d'abord.
      setSelected(null);
      const lngs = massifs.map((massif) => massif.center.lng);
      const lats = massifs.map((massif) => massif.center.lat);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(bounds, {
        padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
          sheetOpen: false,
          mapbig: map.getContainer().clientHeight > 500,
        }),
        maxZoom: 12,
        duration: prefersReducedMotion() ? 0 : 1200,
        easing: CINEMATIC_EASE,
        essential: true,
      });
    };

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
      overlay.appendChild(element);
      entries.push({ element, lng: poi.position.lng, lat: poi.position.lat, anchor: 'translate(-50%, -50%)', kind: 'poi' });
    }

    if (config.layers.carnets) for (const carnet of data.carnets) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'lkdv-map-carnet';
      element.dataset.carnetId = carnet.id;
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
      overlay.appendChild(element);
      entries.push({ element, lng: carnet.position.lng, lat: carnet.position.lat, anchor: 'translate(-50%, -50%)', kind: 'carnet' });
    }

    const root = overlay;
    // Les agrégats restent avant les POI/carnets dans le DOM, comme avant.
    const massifAnchor = root.firstChild;
    // Entrées d'agrégats : remplacées seulement quand la partition change.
    let massifEntries: Entry[] = [];
    const groupEntries = new Map<string, Entry>();
    let clusterSignature = '';
    let syncedZoom = Number.NaN;

    const groupKey = (cluster: MassifCluster<MassifEntry>) =>
      cluster.items
        .map((entry) => entry.massif.id)
        .sort()
        .join(',');

    const placeMassifNode = (element: HTMLButtonElement) => {
      if (massifAnchor) root.insertBefore(element, massifAnchor);
      else root.appendChild(element);
    };

    const createMassifEntry = (cluster: MassifCluster<MassifEntry>): Entry => {
      if (cluster.items.length > 1) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'lkdv-map-cluster';
        element.dataset.clusterCount = String(cluster.items.length);
        element.setAttribute('aria-label', `Voir les ${cluster.items.length} massifs proches`);
        element.title = `Voir les ${cluster.items.length} massifs proches`;
        element.textContent = String(cluster.items.length);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          fitMassifGroup(cluster.items.map((entry) => entry.massif));
        });
        placeMassifNode(element);
        const entry: Entry = {
          element,
          // Ancre renseignée par syncClusters : le centre du groupe est un point
          // écran, pas encore une coordonnée géographique.
          lng: 0,
          lat: 0,
          anchor: 'translate(-50%, -50%)',
          kind: 'massif',
        };
        groupEntries.set(groupKey(cluster), entry);
        return entry;
      }

      const massif = cluster.items[0].massif;
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
      placeMassifNode(element);
      const entry: Entry = {
        element,
        lng: massif.center.lng,
        lat: massif.center.lat,
        anchor: 'translate(-50%, -100%)',
        kind: 'massif',
      };
      groupEntries.set(groupKey(cluster), entry);
      return entry;
    };

    /**
     * Recalcule la partition à chaque changement d'échelle, puis reconstruit le
     * DOM uniquement si les groupes ont changé (`clusterSignature`). Un pur
     * déplacement ne modifie aucune distance écran : la partition est
     * identique, seules les ancres suivent la carte, donc on sort tôt.
     *
     * La bande est lue dans `zoomConfigRef`, pas capturée à la construction de
     * l'effet : un franchissement de seuil ne démonte donc plus l'overlay (donc
     * ne perd ni sélection ni focus), il change seulement la partition.
     */
    const syncClusters = () => {
      if (!config.layers.massifs) return;
      const zoom = map.getZoom();
      if (zoom === syncedZoom) return;
      syncedZoom = zoom;

      const projected: MassifEntry[] = data.massifs.map((massif) => ({
        massif,
        point: map.project([massif.center.lng, massif.center.lat]),
      }));
      // Les agrégats ne sont calculés que sur les bandes `clustered` (Monde,
      // Pays) ; ailleurs chaque massif garde exactement son bouton et son clic.
      const band = zoomConfigRef.current;
      const clusters: MassifCluster<MassifEntry>[] =
        band.massifs === 'clustered'
          ? clusterByScreenDistance(projected, (entry) => entry.point, band.clusterRadiusPx)
          : projected.map((entry) => ({
              id: entry.massif.id,
              items: [entry],
              x: entry.point.x,
              y: entry.point.y,
            }));
      const signature = clusters.map(groupKey).sort().join('|');

      if (signature !== clusterSignature) {
        // Les boutons remplacés peuvent porter le focus : on le retrouve par
        // type/id après reconstruction (un massif absorbé dans un agrégat ne
        // peut pas être refocalisé, `restoreOverlayFocus` renvoie alors false).
        const focused = captureOverlayFocus(root);
        clusterSignature = signature;
        for (const entry of massifEntries) entry.element.remove();
        groupEntries.clear();
        massifEntries = clusters.map(createMassifEntry);
        pendingFocus = focused ?? pendingFocus;
      }

      // Une ancre d'agrégat est un point écran : la reprojeter à chaque échelle
      // garde le groupe centré sur ses membres (les singletons ne bougent pas).
      for (const cluster of clusters) {
        const entry = groupEntries.get(groupKey(cluster));
        if (!entry || cluster.items.length < 2) continue;
        const center = map.unproject([cluster.x, cluster.y]);
        entry.lng = center.lng;
        entry.lat = center.lat;
      }
    };

    /**
     * Place (ou masque) une entrée. L'appartenance au cadre est calculée avec la
     * marge extérieure de la bande (`viewportMarginPx`) ; la bande décide ensuite
     * si ce type de point existe du tout (voir `isOverlayEntryVisible`).
     */
    const positionEntry = (entry: Entry, width: number, height: number, band: MapZoomConfig) => {
      const point = map.project([entry.lng, entry.lat]);
      const inside = isInsideViewport(point, { width, height }, band.viewportMarginPx);
      const visible = isOverlayEntryVisible(entry.kind, band, inside);
      entry.element.style.display = visible ? '' : 'none';
      entry.element.style.transform = `translate(${point.x}px, ${point.y}px) ${entry.anchor}`;
    };

    const place = () => {
      syncClusters();
      const width = container.clientWidth;
      const height = container.clientHeight;
      // La bande vient du ref, tenu par le handler `zoom` de la carte : elle est
      // déjà à jour pour cette frame, sans re-rendu React ni rebuild de l'overlay.
      // Elle est la seule autorité de présence et de taille des marqueurs, côté
      // DOM (`isOverlayEntryVisible`) comme côté CSS (`[data-zoom-band]` dans
      // compte-map.css) : le seuil `is-far` a disparu.
      const band = zoomConfigRef.current;
      for (const entry of massifEntries) positionEntry(entry, width, height, band);
      for (const entry of entries) positionEntry(entry, width, height, band);

      // Après toute reconstruction (données, mode, couches) comme à chaque
      // pose : la sélection est reposée inconditionnellement. C'est le seul
      // point qui couvre aussi les modes où les massifs sont désactivés
      // (`syncClusters` sort tôt et ne réappliquait donc jamais la sélection).
      applyOverlaySelection(root, selectedRef.current);
      if (pendingFocus) {
        restoreOverlayFocus(root, pendingFocus);
        pendingFocus = null;
      }
    };
    // Première pose : si la caméra a démarré sans événement `zoom`, l'état React
    // peut décrire une autre bande que la carte. La carte fait foi.
    zoomConfigRef.current = resolveMapZoomConfig(map.getZoom());
    place();
    map.on('move', place);
    map.on('zoom', place);
    map.on('resize', place);

    return () => {
      map.off('move', place);
      map.off('zoom', place);
      map.off('resize', place);
      // Mémorise le focus avant que les boutons disparaissent avec l'overlay.
      if (overlay) overlayFocusRef.current = captureOverlayFocus(overlay);
      overlay?.remove();
    };
  }, [
    map,
    ready,
    data,
    config.layers.massifs,
    config.layers.pois,
    config.layers.carnets,
  ]);

  useIsomorphicLayoutEffect(() => {
    // Layout effect : le ref est à jour avant l'effet passif de l'overlay, qui
    // peut reconstruire ses boutons dans la même passe (changement de données
    // ou de mode) et doit alors réappliquer la sélection courante.
    selectedRef.current = selected;
    if (!map || !ready) return;
    applyOverlaySelection(map.getContainer(), selected);
  }, [map, ready, selected]);

  useEffect(() => {
    if (!map || !ready) return;
    const trackId = selected?.kind === 'outing' ? selected.id : null;
    const massifId = selected?.kind === 'massif' ? selected.id : null;
    const match = trackId
      ? ['==', ['get', 'id'], trackId]
      : massifId
        ? ['==', ['get', 'massifId'], massifId]
        : null;
    const line = (selectedValue: any, idle: any): any =>
      match ? ['case', match, selectedValue, idle] : idle;
    // La largeur de bande ne remplace jamais la sélection : elle fournit la
    // valeur « idle » de l'expression `case`, la valeur sélectionnée gagne.
    const bandWidth = zoomConfig.trackWidth;
    if (map.getLayer('compte-tracks-line')) {
      map.setPaintProperty('compte-tracks-line', 'line-color', line('#C89A3B', '#17402C'));
      map.setPaintProperty('compte-tracks-line', 'line-width', line(5, bandWidth));
      map.setPaintProperty('compte-tracks-line', 'line-opacity', line(1, 0.9));
    }
    // La visibilité de casing/glow est possédée par l'effet de visibilité des
    // couches, qui compose le mode (`layers.tracks`) et la bande (`zoomConfig`).
    // La réécrire ici avec la bande seule ré-affichait ces couches dans les
    // modes sans traces (prets/compte/reseau) dès que le zoom passait 6.5.
    if (map.getLayer('compte-tracks-casing')) {
      map.setPaintProperty('compte-tracks-casing', 'line-width', line(9, bandWidth + 3.5));
      map.setPaintProperty('compte-tracks-casing', 'line-opacity', line(0.95, 0.78));
    }
    if (map.getLayer('compte-tracks-glow')) {
      map.setPaintProperty('compte-tracks-glow', 'line-width', line(14, bandWidth + 7));
      map.setPaintProperty('compte-tracks-glow', 'line-opacity', line(0.4, 0.24));
    }
  }, [map, ready, selected, zoomConfig]);

  useEffect(() => {
    if (!map || !ready || !resolved) return;
    const reduced = prefersReducedMotion();
    if (resolved.kind === 'outing') {
      map.fitBounds(
        [
          [resolved.data.bounds[0], resolved.data.bounds[1]],
          [resolved.data.bounds[2], resolved.data.bounds[3]],
        ],
        {
          padding: paddingForViewport(map.getContainer().getBoundingClientRect(), {
            sheetOpen: false,
            mapbig: map.getContainer().clientHeight > 500,
          }),
          maxZoom: 14,
          duration: reduced ? 0 : 1500,
          easing: CINEMATIC_EASE,
          essential: true,
        }
      );
      return;
    }
    map.flyTo({
      center: [resolved.position.lng, resolved.position.lat],
      zoom: resolved.kind === 'massif' ? 10.5 : 14,
      duration: reduced ? 0 : 1600,
      curve: 1.42,
      speed: 0.72,
      easing: CINEMATIC_EASE,
      essential: true,
    });
  }, [map, ready, resolved]);

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
        duration: reduced ? 0 : context.mode === 'sortie' ? 1600 : 1300,
        easing: CINEMATIC_EASE,
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
      data-zoom-band={zoomConfig.band}
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
