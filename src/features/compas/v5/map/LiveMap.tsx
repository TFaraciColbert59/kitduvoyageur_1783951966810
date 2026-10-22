'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import { ATLAS_TILES, createMapStyle } from '@/components/map/engine/createMapStyle';
import { prefersReducedMotion } from '@/components/map/engine/camera';
import { formatNumber } from '@/lib/i18n/format';
import { useTranslation } from '@/lib/i18n/context';
import { plural, type TranslationKey } from '@/lib/i18n/translate';
import type { CompasPoint } from '../../server/getCompasData';
import { MAP_LAYERS, layerOf, visiblePoints, type LayerState, type MapLayer } from '../../engine/mapLayers';
import { MAP_BASES, type MapBase } from '../../engine/mapStyle';
import { V5Icon, type V5IconName } from '../ui/icons';
import type { V5PriceHint, V5StayOption } from '../types';
import {
  boundsOf,
  boundsKey,
  boundsToLngLat,
  buildTripGeometry,
  cameraPadding,
  dayBounds,
  isLatLon,
  mapSummary,
  padBounds,
  placeCallout,
  placeNameOf,
  tripBounds,
  type Bounds,
  type LatLon,
} from './mapModel';
import { computeMapView, type MapView } from './mapView';
import { AltPin, NightPin, PlaceLabel, PoiPin, StepPin } from './markerViews';
import { useDomMarkers, type MarkerLib, type MarkerSpec } from './useDomMarkers';

/* ---------- Contrat ---------- */

export interface LiveMapProps {
  /** Nom du voyage : lu par les lecteurs d'écran avec le résumé de la carte. */
  name: string;
  /** GeoJSON du tracé réel du voyage (`CompasData.routeGeojson`). Null : segments droits entre les étapes. */
  routeGeojson: Record<string, unknown> | null;
  /** [lat, lon] des étapes du voyage (`model.route.coords`) : repli quand le GeoJSON manque, toujours « approximatif ». */
  coords: Array<[number, number]>;
  /** Une étape par jour : son ARRIVÉE. */
  stages: Array<{ day: number; lat: number; lon: number; title: string }>;
  /**
   * Point de départ (pastille « D »). Facultatif : absent, le départ est le début du tracé réel ; sans tracé,
   * pas de pastille « D » (rien n'est inventé).
   */
  origin?: { lat: number; lon: number; title: string } | null;
  nights: Array<{
    day: number;
    chosen: V5StayOption | null;
    alternatives: V5StayOption[];
    booked: boolean;
    priceLabel: string | null;
  }>;
  /** Points utiles (`kind: 'poi'`) du voyage ; les points d'étape sont ignorés (les étapes viennent de `stages`). */
  points: CompasPoint[];
  layers: LayerState;
  onLayers(next: LayerState): void;
  base: MapBase;
  onBase(next: MapBase): void;
  focus: { kind: 'trip' } | { kind: 'day'; day: number };
  /** Zone masquée par les surcouches (tiroir, barre d'onglets), en pixels depuis chaque bord de la carte. */
  inset: { top: number; bottom: number; left: number; right: number };
  onSelectDay(day: number): void;
  onSelectNight(day: number): void;
  onPickAlternative(day: number, optionId: string): void;
  onPoi(point: CompasPoint): void;
  big: boolean;
  onToggleBig(): void;
  emptyText: string;
}

/* ---------- Constantes ---------- */

type MlModule = typeof import('maplibre-gl');

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';
const SOURCE_DAYS = 'v5-days';
const LAYER_HALO = 'v5-days-halo';
const LAYER_LINE = 'v5-days-line';
const LAYER_DASH = 'v5-days-dash';
const LAYER_HIT = 'v5-days-hit';
const BASE_ORDER: ReadonlyArray<MapBase> = ['osm', 'topo', 'satellite'];
const BASE_ICON: Record<MapBase, V5IconName> = { osm: 'map', topo: 'peak', satellite: 'globe' };
const FIT_MAX_ZOOM = 14.5;
const FLY_MS = 900;
const FALLBACK_CENTER: [number, number] = [2.35, 46.6];

const BASE_LABEL: Record<MapBase, TranslationKey> = {
  osm: 'compas.v5.carte.baseOsm',
  topo: 'compas.v5.carte.baseTopo',
  satellite: 'compas.v5.carte.baseSatellite',
};

const LAYER_LABEL: Record<Exclude<MapLayer, 'profil'>, TranslationKey> = {
  etapes: 'compas.v5.carte.layerEtapes',
  resto: 'compas.v5.carte.layerResto',
  commerce: 'compas.v5.carte.layerCommerce',
  sante: 'compas.v5.carte.layerSante',
  hebergement: 'compas.v5.carte.layerHebergement',
  transport: 'compas.v5.carte.layerTransport',
  water: 'compas.v5.carte.layerWater',
  refuge: 'compas.v5.carte.layerRefuge',
  camping: 'compas.v5.carte.layerCamping',
  toilets: 'compas.v5.carte.layerToilets',
  viewpoint: 'compas.v5.carte.layerViewpoint',
  peak: 'compas.v5.carte.layerPeak',
  parking: 'compas.v5.carte.layerParking',
};

const LAYER_ICON: Record<Exclude<MapLayer, 'profil'>, V5IconName> = {
  etapes: 'route',
  resto: 'cup',
  commerce: 'cart',
  sante: 'cross',
  hebergement: 'bed',
  transport: 'bus',
  water: 'drop',
  refuge: 'house',
  camping: 'tent',
  toilets: 'flag',
  viewpoint: 'eye',
  peak: 'peak',
  parking: 'park',
};

const POI_ICON: Record<string, V5IconName> = {
  water: 'drop',
  refuge: 'house',
  peak: 'peak',
  camping: 'tent',
  hebergement: 'bed',
  commerce: 'cart',
  sante: 'cross',
  viewpoint: 'eye',
  parking: 'park',
  transport: 'bus',
  resto: 'cup',
  toilets: 'flag',
};

/** Les calques qui se voient sur la carte (le profil d'altitude n'est pas un objet de carte). */
const PANEL_LAYERS = MAP_LAYERS.map((l) => l.id).filter((id): id is Exclude<MapLayer, 'profil'> => id !== 'profil');

const EMPTY_VIEW: MapView = { lod: 'low', poiIds: [], labels: [], alts: {}, key: '' };

/* ---------- Petits utilitaires ---------- */

/** Garde la même valeur tant que sa clé ne change pas : évite de refaire un calcul coûteux à chaque rendu. */
function useStable<T>(value: T, key: string): T {
  const ref = useRef<{ key: string; value: T }>({ key, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

function formatPrice(locale: Parameters<typeof formatNumber>[2], price: V5PriceHint): string {
  try {
    return formatNumber(price.perPerson, { style: 'currency', currency: price.currency, maximumFractionDigits: 0 }, locale);
  } catch {
    return `${Math.round(price.perPerson)} ${price.currency}`;
  }
}

const safeClass = (category: string | null) => (category ? category.toLowerCase().replace(/[^a-z0-9_-]/g, '') : '');

/** Une couleur du thème (jeton CSS) lue sur l'élément, pour MapLibre qui ne lit pas les variables CSS. */
function themeColor(el: Element, token: string, fallback: string): string {
  try {
    const v = getComputedStyle(el).getPropertyValue(token).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;

interface SelectedPoi {
  point: CompasPoint;
  opener: HTMLElement | null;
  /** Ouvert au clavier : le focus passe dans la bulle. */
  keyboard: boolean;
}

/* ---------- Composant ---------- */

export function LiveMap(props: LiveMapProps) {
  const { name, routeGeojson, coords, stages, origin, nights, points, layers, base, focus, big, emptyText } = props;
  const { top: insetTop, bottom: insetBottom, left: insetLeft, right: insetRight } = props.inset;
  const { t, locale } = useTranslation();
  const nameId = useId();
  const layersId = useId();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const calloutRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const lastCam = useRef<string | null>(null);
  const grabY = useRef<number | null>(null);
  const grabClick = useRef(false);

  const [map, setMap] = useState<MlMap | null>(null);
  const [lib, setLib] = useState<MlModule | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<MapView>(EMPTY_VIEW);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  const [sizeKey, setSizeKey] = useState('');

  /* ----- Données dérivées ----- */

  const stageList = useStable(stages, stages.map((s) => `${s.day}|${s.lat}|${s.lon}|${s.title}`).join(';'));
  const coordList = useStable(coords, coords.map((c) => c.join(',')).join(';'));
  const originStable = useStable(origin ?? null, origin ? `${origin.lat}|${origin.lon}|${origin.title}` : '');
  const geometry = useMemo(
    () =>
      buildTripGeometry({
        routeGeojson,
        coords: coordList,
        stages: stageList,
        origin: originStable,
      }),
    [routeGeojson, coordList, stageList, originStable]
  );

  const pois = useMemo(() => points.filter((p) => p.kind === 'poi' && isLatLon(p.lat, p.lon)), [points]);
  const visiblePois = useMemo(() => visiblePoints(pois, layers), [pois, layers]);
  const poiById = useMemo(() => new Map(visiblePois.map((p) => [p.id, p])), [visiblePois]);
  const showSteps = layers.etapes;
  const showNights = layers.hebergement;

  const chosenNights = useMemo(() => nights.filter((n) => n.chosen && isLatLon(n.chosen.lat, n.chosen.lon)), [nights]);
  const focusDay = focus.kind === 'day' ? focus.day : null;
  const dayHasSegment = focusDay != null && geometry.segments.some((s) => s.day === focusDay);

  const hasContent =
    geometry.segments.length > 0 ||
    geometry.stages.length > 0 ||
    geometry.origin != null ||
    pois.length > 0 ||
    chosenNights.length > 0;

  const counts = useMemo(() => {
    const c = new Map<MapLayer, number>();
    for (const p of pois) {
      const l = layerOf(p);
      if (l) c.set(l, (c.get(l) ?? 0) + 1);
    }
    c.set('etapes', geometry.stages.length + (geometry.origin ? 1 : 0));
    c.set('hebergement', (c.get('hebergement') ?? 0) + chosenNights.length);
    return c;
  }, [pois, geometry, chosenNights]);
  const panelLayers = PANEL_LAYERS.filter((id) => (counts.get(id) ?? 0) > 0);
  const shownLayers = panelLayers.filter((id) => layers[id]).length;

  /* ----- Libellé d'accessibilité ----- */

  const summary = mapSummary(geometry, new Set(stages.map((s) => s.day)).size, nights.length);
  const label = useMemo(() => {
    const count = (n: number, one: TranslationKey, other: TranslationKey) => {
      const vars = { count: formatNumber(n, {}, locale) };
      return plural(locale, n, { one: t(one, vars), other: t(other, vars) });
    };
    const parts: string[] = [];
    if (summary.days > 0) parts.push(count(summary.days, 'compas.v5.carte.summaryDaysOne', 'compas.v5.carte.summaryDaysOther'));
    if (summary.km != null) parts.push(t('compas.v5.carte.summaryKm', { count: formatNumber(summary.km, {}, locale) }));
    if (summary.nights > 0) parts.push(count(summary.nights, 'compas.v5.carte.summaryNightsOne', 'compas.v5.carte.summaryNightsOther'));
    if (summary.approximate) parts.push(t('compas.v5.carte.summaryApprox'));
    return parts.length ? t('compas.v5.carte.summary', { parts: parts.join(', ') }) : t('compas.v5.carte.mapLabel');
  }, [summary.days, summary.km, summary.nights, summary.approximate, t, locale]);

  /* ----- Dernières données, lues par les écouteurs de la carte (sans les relier à chaque rendu) ----- */

  const latestView = useRef({ geometry, showSteps, showNights, nights, focusDay, visiblePois, keepPoi: null as string | null });
  const latestProps = useRef(props);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
    latestProps.current = props;
    latestView.current = { geometry, showSteps, showNights, nights, focusDay, visiblePois, keepPoi: selected?.point.id ?? null };
  });

  const computeView = useCallback(() => {
    const m = mapRef.current;
    const el = canvasRef.current;
    if (!m || !el) return;
    const d = latestView.current;
    const b = m.getBounds();
    const next = computeMapView({
      zoom: m.getZoom(),
      size: { width: el.clientWidth, height: el.clientHeight },
      viewport: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      project: (lat, lon) => {
        const p = m.project([lon, lat]);
        return { x: p.x, y: p.y };
      },
      geometry: d.geometry,
      showSteps: d.showSteps,
      showNights: d.showNights,
      nights: d.nights.map((n) => ({
        day: n.day,
        chosen: n.chosen && isLatLon(n.chosen.lat, n.chosen.lon) ? { id: n.chosen.id, lat: n.chosen.lat, lon: n.chosen.lon } : null,
        alternatives: n.alternatives.filter((a) => isLatLon(a.lat, a.lon)).map((a) => ({ id: a.id, lat: a.lat, lon: a.lon })),
      })),
      openDay: d.focusDay,
      pois: d.visiblePois,
      keepPoi: d.keepPoi,
    });
    setView((prev) => (prev.key === next.key ? prev : next));
  }, []);

  /* ----- Bulle : position, qui suit la carte ----- */

  const latestSelected = useRef<SelectedPoi | null>(null);
  // Avant les autres effets de mise en page : la bulle se place d'après la sélection du rendu courant.
  useLayoutEffect(() => {
    latestSelected.current = selected;
  });

  const positionCallout = useCallback(() => {
    const m = mapRef.current;
    const box = calloutRef.current;
    const area = canvasRef.current;
    const sel = latestSelected.current;
    if (!m || !box || !area || !sel) return;
    const p = m.project([sel.point.lon, sel.point.lat]);
    const placed = placeCallout({
      x: p.x,
      y: p.y,
      boxW: box.offsetWidth || 232,
      boxH: box.offsetHeight || 100,
      areaW: area.clientWidth,
      areaH: area.clientHeight,
    });
    box.style.transform = `translate(${placed.left}px, ${placed.top}px)`;
    box.style.setProperty('--ax', `${placed.arrowX}px`);
    box.dataset.below = placed.below ? 'true' : 'false';
  }, []);
  const closeCallout = useCallback((restoreFocus: boolean) => {
    const sel = latestSelected.current;
    setSelected(null);
    if (restoreFocus && sel?.opener && sel.opener.isConnected) sel.opener.focus();
  }, []);

  /* ----- Cycle de vie de la carte ----- */

  useEffect(() => {
    if (!hasContent || failed) return;
    const container = canvasRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: MlMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let moveFrame = 0;

    void (async () => {
      try {
        const mod = await import('maplibre-gl');
        if (cancelled) return;
        const maplibre = ((mod as unknown as { Map?: unknown }).Map ? mod : (mod as unknown as { default: MlModule }).default) as MlModule;
        maplibre.setWorkerUrl?.(WORKER_URL);

        const d = latestView.current;
        const startBounds = tripBounds(d.geometry, []);
        const center: [number, number] = startBounds
          ? [(startBounds.west + startBounds.east) / 2, (startBounds.south + startBounds.north) / 2]
          : FALLBACK_CENTER;
        const m = new maplibre.Map({
          container,
          style: { ...createMapStyle(latestProps.current.base), projection: { type: 'mercator' } },
          center,
          zoom: startBounds ? 9 : 4,
          minZoom: 2,
          maxZoom: 18,
          renderWorldCopies: false,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          locale: { 'Map.Title': tRef.current('compas.v5.carte.mapLabel') },
        });
        instance = m;
        mapRef.current = m;
        m.touchZoomRotate?.disableRotation?.();

        const forest = themeColor(container, '--lkv-primary', 'rgb(23, 64, 44)');
        const reduced = prefersReducedMotion();
        const fade = { duration: reduced ? 0 : 350 };
        m.on('style.load', () => {
          if (cancelled) return;
          m.addSource(SOURCE_DAYS, { type: 'geojson', data: EMPTY_FC as unknown as GeoJSON.GeoJSON });
          const width: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 6, 3.5, 12, 6.5, 16, 10];
          const haloWidth: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 6, 7, 12, 11, 16, 15];
          m.addLayer({
            id: LAYER_HALO,
            type: 'line',
            source: SOURCE_DAYS,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': 'rgb(255, 255, 255)',
              'line-width': haloWidth,
              'line-opacity': 0.95,
              'line-opacity-transition': fade,
            },
          });
          m.addLayer({
            id: LAYER_LINE,
            type: 'line',
            source: SOURCE_DAYS,
            filter: ['!', ['get', 'approximate']],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': forest, 'line-width': width, 'line-opacity': 1, 'line-opacity-transition': fade },
          });
          m.addLayer({
            id: LAYER_DASH,
            type: 'line',
            source: SOURCE_DAYS,
            filter: ['get', 'approximate'],
            layout: { 'line-cap': 'butt', 'line-join': 'round' },
            paint: {
              'line-color': forest,
              'line-width': width,
              'line-dasharray': [1.4, 1.6],
              'line-opacity': 1,
              'line-opacity-transition': fade,
            },
          });
          m.addLayer({
            id: LAYER_HIT,
            type: 'line',
            source: SOURCE_DAYS,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': forest, 'line-width': 30, 'line-opacity': 0.01 },
          });
          m.on('click', LAYER_HIT, (e) => {
            const day = Number(e.features?.[0]?.properties?.day);
            if (Number.isFinite(day) && day > 0) latestProps.current.onSelectDay(day);
          });
          m.on('mouseenter', LAYER_HIT, () => {
            m.getCanvas().style.cursor = 'pointer';
          });
          m.on('mouseleave', LAYER_HIT, () => {
            m.getCanvas().style.cursor = '';
          });
          setReady(true);
        });

        m.on('click', (e) => {
          const target = e.originalEvent?.target as Element | null | undefined;
          if (target?.closest?.('.v5-mk')) return;
          setSelected(null);
          setLayersOpen(false);
        });
        m.on('moveend', () => computeView());
        m.on('resize', () => computeView());
        m.on('move', () => {
          if (!latestSelected.current || moveFrame) return;
          moveFrame = requestAnimationFrame(() => {
            moveFrame = 0;
            positionCallout();
          });
        });

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (resizeTimer) clearTimeout(resizeTimer);
            m.resize();
            resizeTimer = setTimeout(() => {
              resizeTimer = null;
              setSizeKey(`${container.clientWidth}x${container.clientHeight}`);
            }, 160);
          });
          resizeObserver.observe(container);
        }
        setSizeKey(`${container.clientWidth}x${container.clientHeight}`);
        setLib(maplibre);
        setMap(m);
      } catch (error) {
        console.error('[LiveMap] carte indisponible', error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (moveFrame) cancelAnimationFrame(moveFrame);
      resizeObserver?.disconnect();
      instance?.remove();
      mapRef.current = null;
      lastCam.current = null;
      setMap(null);
      setLib(null);
      setReady(false);
    };
  }, [hasContent, failed, computeView, positionCallout]);

  /* ----- Fond, tracé, atténuation des autres jours ----- */

  useEffect(() => {
    if (!map || !ready) return;
    for (const mode of BASE_ORDER) {
      const id = `atlas-tile-${mode}`;
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', mode === base ? 'visible' : 'none');
    }
  }, [map, ready, base]);

  useEffect(() => {
    if (!map || !ready) return;
    const source = map.getSource(SOURCE_DAYS) as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: geometry.segments.map((s) => ({
        type: 'Feature',
        properties: { day: s.day, approximate: s.approximate },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
    });
  }, [map, ready, geometry]);

  useEffect(() => {
    if (!map || !ready) return;
    const dim = dayHasSegment && focusDay != null;
    const opacity = (full: number): number | ExpressionSpecification =>
      dim ? ['case', ['==', ['get', 'day'], focusDay], full, 0.28 * full] : full;
    map.setPaintProperty(LAYER_HALO, 'line-opacity', opacity(0.95));
    map.setPaintProperty(LAYER_LINE, 'line-opacity', opacity(1));
    map.setPaintProperty(LAYER_DASH, 'line-opacity', opacity(1));
  }, [map, ready, dayHasSegment, focusDay]);

  /* ----- Caméra : un seul mouvement à la fois, rien si l'emprise n'a pas changé ----- */

  const cameraTarget = useCallback(
    (kind: 'trip' | 'day'): Bounds | null => {
      const tripExtra: LatLon[] = chosenNights.map((n) => [n.chosen!.lat, n.chosen!.lon]);
      if (kind === 'day' && focusDay != null) {
        const night = nights.find((n) => n.day === focusDay);
        const extra: LatLon[] = [];
        if (night) {
          for (const o of [night.chosen, ...night.alternatives]) if (o && isLatLon(o.lat, o.lon)) extra.push([o.lat, o.lon]);
        }
        const b = dayBounds(geometry, focusDay, extra);
        if (b) return b;
      }
      const trip = tripBounds(geometry, tripExtra);
      if (trip) return trip;
      const around = boundsOf(pois.map((p) => [p.lat, p.lon] as LatLon));
      return around ? padBounds(around) : null;
    },
    [geometry, chosenNights, focusDay, nights, pois]
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!map || !ready || !el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (!width || !height) return;
    const target = cameraTarget(focusDay != null ? 'day' : 'trip');
    if (!target) return;
    const padding = cameraPadding({ top: insetTop, bottom: insetBottom, left: insetLeft, right: insetRight }, { width, height });
    const key = [focusDay ?? 'trip', boundsKey(target), padding.top, padding.bottom, padding.left, padding.right, sizeKey].join('|');
    if (lastCam.current === key) return;
    const first = lastCam.current === null;
    lastCam.current = key;
    map.stop();
    map.fitBounds(boundsToLngLat(target), {
      padding,
      duration: first || prefersReducedMotion() ? 0 : FLY_MS,
      maxZoom: FIT_MAX_ZOOM,
    });
  }, [map, ready, focusDay, cameraTarget, insetTop, insetBottom, insetLeft, insetRight, sizeKey]);

  const fitTrip = useCallback(() => {
    const el = canvasRef.current;
    if (!map || !el) return;
    const target = cameraTarget('trip');
    if (!target) return;
    map.stop();
    map.fitBounds(boundsToLngLat(target), {
      padding: cameraPadding({ top: insetTop, bottom: insetBottom, left: insetLeft, right: insetRight }, { width: el.clientWidth, height: el.clientHeight }),
      duration: prefersReducedMotion() ? 0 : 700,
      maxZoom: FIT_MAX_ZOOM,
    });
  }, [map, cameraTarget, insetTop, insetBottom, insetLeft, insetRight]);

  const zoomBy = useCallback(
    (dir: 1 | -1) => {
      if (!map) return;
      const options = { duration: prefersReducedMotion() ? 0 : 300 };
      if (dir > 0) map.zoomIn(options);
      else map.zoomOut(options);
    },
    [map]
  );

  /* ----- Ce qui est affiché dépend de la vue ----- */

  useEffect(() => {
    if (ready) computeView();
  }, [ready, computeView, geometry, showSteps, showNights, nights, focusDay, visiblePois, selected, sizeKey]);

  useLayoutEffect(() => {
    if (!selected) return;
    positionCallout();
    if (selected.keyboard) calloutRef.current?.focus();
  }, [selected, positionCallout, sizeKey]);

  // La bulle d'un point masqué (calque éteint) se ferme.
  useEffect(() => {
    if (selected && !poiById.has(selected.point.id)) setSelected(null);
  }, [selected, poiById]);

  // Changer de jour referme la bulle ouverte.
  useEffect(() => {
    setSelected(null);
  }, [focusDay]);

  /* ----- Marqueurs ----- */

  const specs: MarkerSpec[] = [];
  if (map) {
    const firstDay = geometry.stages[0]?.day ?? 1;
    if (showSteps) {
      if (geometry.origin) {
        const place = placeNameOf(geometry.origin.title);
        specs.push({
          key: 'step:origin',
          lat: geometry.origin.lat,
          lon: geometry.origin.lon,
          className: 'v5-mk v5-mk-step v5-mk-origin',
          content: (
            <StepPin
              text="D"
              label={place ? t('compas.v5.carte.pinStart', { place }) : t('compas.v5.carte.pinStartBare')}
              active={false}
              onClick={() => props.onSelectDay(firstDay)}
            />
          ),
        });
      }
      for (const s of geometry.stages) {
        const place = placeNameOf(s.title);
        specs.push({
          key: `step:${s.day}`,
          lat: s.lat,
          lon: s.lon,
          className: 'v5-mk v5-mk-step',
          content: (
            <StepPin
              text={String(s.day)}
              label={place ? t('compas.v5.carte.pinDay', { day: s.day, place }) : t('compas.v5.carte.pinDayBare', { day: s.day })}
              active={s.day === focusDay}
              onClick={() => props.onSelectDay(s.day)}
            />
          ),
        });
      }
      for (const l of view.labels) {
        const stage = l.id === 'origin' ? geometry.origin : geometry.stages.find((s) => `day:${s.day}` === l.id);
        if (!stage) continue;
        specs.push({
          key: `label:${l.id}`,
          lat: stage.lat,
          lon: stage.lon,
          className: 'v5-mk v5-mk-label',
          content: <PlaceLabel text={placeNameOf(stage.title)} dx={l.dx} dy={l.dy} />,
        });
      }
    }
    if (showNights) {
      for (const n of nights) {
        const o = n.chosen;
        if (o && isLatLon(o.lat, o.lon)) {
          const credit = o.photo ? t('compas.v5.carte.nightCredit', { credit: o.photo.credit, license: o.photo.license }) : null;
          const labelText =
            t('compas.v5.carte.night', { day: n.day, name: o.name }) +
            (n.priceLabel ? t('compas.v5.carte.nightPrice', { price: n.priceLabel }) : '') +
            (n.booked ? t('compas.v5.carte.nightBooked') : '');
          specs.push({
            key: `night:${n.day}`,
            lat: o.lat,
            lon: o.lon,
            className: 'v5-mk v5-mk-night',
            content: (
              <NightPin
                label={labelText}
                title={credit ? `${o.name} · ${credit}` : o.name}
                photo={o.photo}
                kind={o.kind}
                priceLabel={n.priceLabel}
                booked={n.booked}
                credit={credit}
                onClick={() => props.onSelectNight(n.day)}
              />
            ),
          });
        }
        if (n.day === focusDay) {
          for (const a of n.alternatives) {
            if (!isLatLon(a.lat, a.lon) || a.id === o?.id) continue;
            const credit = a.photo ? t('compas.v5.carte.nightCredit', { credit: a.photo.credit, license: a.photo.license }) : null;
            const priceText = a.price
              ? t(a.price.basis === 'bareme' ? 'compas.v5.carte.altPriceHint' : 'compas.v5.carte.altPrice', { price: formatPrice(locale, a.price) })
              : '';
            specs.push({
              key: `alt:${n.day}:${a.id}`,
              lat: a.lat,
              lon: a.lon,
              className: 'v5-mk v5-mk-alt pop',
              content: (
                <AltPin
                  label={t('compas.v5.carte.alt', { name: a.name }) + priceText}
                  title={credit ? `${a.name} · ${credit}` : a.name}
                  photo={a.photo}
                  kind={a.kind}
                  credit={credit}
                  offset={view.alts[`${n.day}:${a.id}`] ?? { offsetX: 0, offsetY: 0 }}
                  onClick={() => props.onPickAlternative(n.day, a.id)}
                />
              ),
            });
          }
        }
      }
    }
    for (const id of view.poiIds) {
      const p = poiById.get(id);
      if (!p) continue;
      const layer = layerOf(p);
      const kind = layer && layer !== 'profil' ? t(LAYER_LABEL[layer]) : null;
      const poiName = p.label.trim() || t('compas.v5.carte.unnamed');
      specs.push({
        key: `poi:${p.id}`,
        lat: p.lat,
        lon: p.lon,
        className: `v5-mk v5-mk-poi${p.category ? ` v5-cat-${safeClass(p.category)}` : ''}`,
        content: (
          <PoiPin
            icon={(p.category && POI_ICON[p.category]) || 'info'}
            label={kind ? t('compas.v5.carte.poi', { name: poiName, kind }) : poiName}
            onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
              setSelected({ point: p, opener: e.currentTarget, keyboard: e.detail === 0 });
              setLayersOpen(false);
            }}
          />
        ),
      });
    }
  }
  const markers = useDomMarkers(map, lib as MarkerLib | null, specs);

  /* ----- Gestes et clavier ----- */

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape') return;
    if (selected) {
      e.stopPropagation();
      closeCallout(true);
    } else if (layersOpen) {
      e.stopPropagation();
      setLayersOpen(false);
    }
  };

  const onGrabDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    grabY.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGrabUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const from = grabY.current;
    grabY.current = null;
    if (from == null || !Number.isFinite(e.clientY)) return;
    const dy = e.clientY - from;
    // Tirer vers le haut agrandit, vers le bas réduit, un toucher bascule.
    if (Math.abs(dy) < 16 || dy < 0 !== big) props.onToggleBig();
    grabClick.current = true;
  };
  const onGrabClick = () => {
    // Clavier (Entrée, Espace) : le pointeur a déjà décidé sinon.
    if (grabClick.current) grabClick.current = false;
    else props.onToggleBig();
  };

  /* ----- Rendu ----- */

  const attribution = ATLAS_TILES[base];
  const sel = selected && poiById.has(selected.point.id) ? selected : null;
  const selLayer = sel ? layerOf(sel.point) : null;
  const selName = sel ? sel.point.label.trim() || t('compas.v5.carte.unnamed') : '';
  const mapLive = hasContent && !failed;

  return (
    <section
      className="v5-map"
      aria-label={label}
      aria-describedby={nameId}
      data-lod={view.lod}
      data-base={base}
      data-big={big ? '1' : '0'}
      onKeyDown={onKeyDown}
    >
      <p id={nameId} className="v5-sr">
        {name}
      </p>
      {mapLive && <div ref={canvasRef} className="v5-map__canvas" />}
      {markers}
      {!hasContent && <p className="v5-map__empty">{emptyText}</p>}
      {hasContent && failed && (
        <p className="v5-map__empty" role="status">
          {t('compas.v5.carte.unavailable')}
        </p>
      )}

      <button
        type="button"
        className="v5-grab"
        aria-label={big ? t('compas.v5.carte.grabShrink') : t('compas.v5.carte.grabGrow')}
        aria-pressed={big}
        onPointerDown={onGrabDown}
        onPointerUp={onGrabUp}
        onPointerCancel={() => {
          grabY.current = null;
        }}
        onClick={onGrabClick}
      />

      {mapLive && (
        <>
          <div className="v5-mcap v5-lg" role="group" aria-label={t('compas.v5.carte.base')}>
            <span className="th" style={{ transform: `translateX(${Math.max(0, BASE_ORDER.indexOf(base)) * 100}%)` }} />
            {BASE_ORDER.map((id) => {
              const def = MAP_BASES.find((b) => b.id === id);
              if (!def) return null;
              return (
                <button key={id} type="button" aria-pressed={base === id} aria-label={t(BASE_LABEL[id])} onClick={() => props.onBase(id)}>
                  <V5Icon name={BASE_ICON[id]} size="s" />
                </button>
              );
            })}
          </div>

          <div className="v5-mcol v5-lg" role="group" aria-label={t('compas.v5.carte.controls')}>
            <button
              type="button"
              aria-label={t('compas.v5.carte.layersToggle')}
              aria-expanded={layersOpen}
              aria-controls={layersId}
              onClick={() => setLayersOpen((v) => !v)}
            >
              <V5Icon name="layers" size="s" />
            </button>
            <button type="button" aria-label={t('compas.v5.carte.fitTrip')} onClick={fitTrip}>
              <V5Icon name="fit" size="s" />
            </button>
            <button type="button" aria-label={t('compas.v5.carte.zoomIn')} onClick={() => zoomBy(1)}>
              <V5Icon name="plus" size="s" />
            </button>
            <button type="button" aria-label={t('compas.v5.carte.zoomOut')} onClick={() => zoomBy(-1)}>
              <V5Icon name="minus" size="s" />
            </button>
          </div>

          {layersOpen && (
            <div id={layersId} className="v5-layers v5-lg" role="group" aria-label={t('compas.v5.carte.layersTitle')}>
              <h3>
                {t('compas.v5.carte.layersTitle')}
                <span>{t('compas.v5.carte.layersCount', { shown: shownLayers, total: panelLayers.length })}</span>
              </h3>
              <div className="v5-lgrid">
                {panelLayers.map((id) => (
                  <button key={id} type="button" aria-pressed={layers[id]} onClick={() => props.onLayers({ ...layers, [id]: !layers[id] })}>
                    <V5Icon name={LAYER_ICON[id]} size="s" />
                    <em>{counts.get(id) ?? 0}</em>
                    {t(LAYER_LABEL[id])}
                  </button>
                ))}
              </div>
            </div>
          )}

          {summary.approximate && <span className="v5-map__approx">{t('compas.v5.carte.approxChip')}</span>}
          <span className="v5-attrib">
            {attribution.short}
            <span className="v5-sr">{attribution.credits}</span>
          </span>
        </>
      )}

      {sel && (
        <div
          ref={calloutRef}
          className="v5-callout v5-lg"
          role="dialog"
          aria-modal="false"
          aria-label={t('compas.v5.carte.calloutLabel', { name: selName })}
          tabIndex={-1}
        >
          <b>{selName}</b>
          {selLayer && selLayer !== 'profil' && <small>{t(LAYER_LABEL[selLayer])}</small>}
          <button
            type="button"
            className="act"
            onClick={() => {
              props.onPoi(sel.point);
              closeCallout(false);
            }}
          >
            {t('compas.v5.carte.poiOpen')}
          </button>
          <button type="button" className="v5-callout__x" aria-label={t('compas.v5.carte.calloutClose')} onClick={() => closeCallout(true)}>
            <V5Icon name="x" size="s" />
          </button>
        </div>
      )}
    </section>
  );
}


export default LiveMap;
