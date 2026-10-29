'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoCollection } from '../data/hooks';
import type { CameraIntent, Level, PoiKind } from '../state/types';
import { selectVisiblePins } from './hierarchy';
import {
  boundsOfTrack,
  flyToLevel,
  flyoverTrack,
  followAt,
  followPadding,
  orbitController,
  overviewOf,
  overviewPadding,
  revealAt,
} from './camera';
import {
  TRACE_COLOR_EXPRESSION,
  TRACE_DASH_EXPRESSION,
  TRACE_WIDTH_EXPRESSION,
  traceStyleForRoute,
} from './traceStyles';
import { OPENFREEMAP_STYLE_URL } from '@/components/map/engine/standardBase';

export interface MapPin {
  id: string;
  kind: string;
  name: string;
  sub?: string | null;
  lat: number;
  lon: number;
  tone?: 'ink' | 'water' | 'warn' | 'bad' | 'good';
  /** Distance au centre, utilisée par la hiérarchie d'affichage. */
  distanceKm?: number;
}

export interface MapStageProps {
  level: Level;
  center: [number, number];
  zoom: number;
  theme: 'light' | 'dark';
  countries?: GeoCollection | null;
  regions?: GeoCollection | null;
  routes?: Array<{ id: number; name: string | null; network?: string | null; geojson: unknown }>;
  pins: MapPin[];
  activityTrack?: GeoCollection | null;
  selectedId?: string | null;
  reducedMotion?: boolean;
  paused?: boolean;
  onCountryClick?: (iso: string, name: string, center: [number, number]) => void;
  onRegionClick?: (group: string, center: [number, number]) => void;
  onPinClick?: (pin: MapPin) => void;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  onReady?: () => void;
  me?: { lat: number; lng: number } | null;
  /** Hauteur du tiroir en pixels : aucun repère ne doit apparaître dessous. */
  sheetHeightPx?: number;
  /** Mouvement de caméra demandé par la machine d'état. */
  cameraIntent?: CameraIntent | null;
  /** Appui long sur la carte (départ d'activité). */
  longPressHandlers?: Record<string, unknown>;
}

const TERRAIN_SOURCE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const EMPTY: GeoCollection = { type: 'FeatureCollection', features: [] };

/**
 * Scène cartographique unique de l'Explorer v2 (02_ARCHITECTURE.md §4).
 * Un seul composant monte la carte ; changer de niveau ne recrée jamais la
 * carte. Projection globe aux niveaux 0–1, mercator à partir du niveau 2.
 */
export default function MapStage({
  level,
  center,
  zoom,
  theme,
  countries,
  regions,
  routes,
  pins,
  activityTrack,
  selectedId,
  reducedMotion = false,
  paused = false,
  onCountryClick,
  onRegionClick,
  onPinClick,
  onMoveEnd,
  onReady,
  me,
  sheetHeightPx = 176,
  cameraIntent = null,
  longPressHandlers,
}: MapStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [overlay, setOverlay] = useState<Array<{ pin: MapPin; x: number; y: number }>>([]);
  const [meScreen, setMeScreen] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const movedToRef = useRef<string>('');
  const orbitRef = useRef<number | null>(null);

  // ── création de la carte (une seule fois) ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    setReady(false);
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center,
      zoom,
      // Notre pied de page porte les attributions (P10-09) : le contrôle natif
      // ajoutait des liens de 14 px, sous la cible tactile de 44 px.
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      fadeDuration: 120,
      maxPitch: 70,
    });
    mapRef.current = map;
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_EXPLORER_SCENES === '1'
    ) {
      (window as unknown as { __xpMap?: MapLibreMap }).__xpMap = map;
    }

    map.on('load', () => {
      map.setProjection({ type: 'globe' });
      try {
        map.setSky({
          'sky-color': 'rgba(233,238,231,0.0)',
          'sky-horizon-blend': 0.5,
          'horizon-color': '#e9eee7',
          'horizon-fog-blend': 0.6,
          'fog-color': '#eef2ed',
          'fog-ground-blend': 0.7,
        } as never);
      } catch {
        /* setSky indisponible : le style reste fonctionnel */
      }

      const ensureSources = () => {
        if (!map.getSource('xp-countries')) {
          map.addSource('xp-countries', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-regions')) {
          map.addSource('xp-regions', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-routes')) {
          map.addSource('xp-routes', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-track')) {
          map.addSource('xp-track', { type: 'geojson', data: EMPTY as never });
        }
        if (!map.getSource('xp-terrain')) {
          map.addSource('xp-terrain', {
            type: 'raster-dem',
            tiles: [TERRAIN_SOURCE],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 13,
            attribution: 'Relief : AWS Terrain Tiles (open data)',
          });
        }
        if (!map.getLayer('xp-countries-fill')) {
          map.addLayer({
            id: 'xp-countries-fill',
            type: 'fill',
            source: 'xp-countries',
            paint: { 'fill-color': '#5B7F55', 'fill-opacity': 0.13 },
          });
          map.addLayer({
            id: 'xp-countries-line',
            type: 'line',
            source: 'xp-countries',
            paint: { 'line-color': '#17402C', 'line-width': 0.8, 'line-opacity': 0.32 },
          });
        }
        if (!map.getLayer('xp-regions-fill')) {
          map.addLayer({
            id: 'xp-regions-fill',
            type: 'fill',
            source: 'xp-regions',
            paint: { 'fill-color': '#2F6F78', 'fill-opacity': 0.1 },
          });
          map.addLayer({
            id: 'xp-regions-line',
            type: 'line',
            source: 'xp-regions',
            paint: { 'line-color': '#2F6F78', 'line-width': 0.9, 'line-opacity': 0.45 },
          });
        }
        if (!map.getLayer('xp-routes-casing')) {
          map.addLayer({
            id: 'xp-routes-casing',
            type: 'line',
            source: 'xp-routes',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': ['*', 1.7, TRACE_WIDTH_EXPRESSION as never],
              'line-opacity': 0.9,
            },
          });
        }
        if (!map.getLayer('xp-routes-line')) {
          map.addLayer({
            id: 'xp-routes-line',
            type: 'line',
            source: 'xp-routes',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': TRACE_COLOR_EXPRESSION as never,
              'line-width': TRACE_WIDTH_EXPRESSION as never,
              'line-opacity': 0.95,
              'line-dasharray': TRACE_DASH_EXPRESSION as never,
            },
          });
        }
        if (!map.getLayer('xp-track-line')) {
          map.addLayer({
            id: 'xp-track-line',
            type: 'line',
            source: 'xp-track',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#17402C', 'line-width': 4, 'line-opacity': 0.9 },
          });
        }
        if (!map.getLayer('xp-hillshade')) {
          map.addLayer({
            id: 'xp-hillshade',
            type: 'hillshade',
            source: 'xp-terrain',
            layout: { visibility: 'none' },
            paint: {
              'hillshade-shadow-color': '#17402C',
              'hillshade-highlight-color': '#FFFFFF',
              'hillshade-accent-color': '#5B7F55',
              'hillshade-exaggeration': 0.35,
            },
          });
        }
      };

      ensureSources();

      // Fond Explorer : eau et terres sauge, étiquettes masquées sur le globe.
      try {
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-color', '#E9EEE7');
          } else if (layer.type === 'fill' && /water|ocean|sea/i.test(layer.id)) {
            map.setPaintProperty(layer.id, 'fill-color', '#D9E4DB');
          }
        }
      } catch {
        /* style inattendu : on garde le fond d'origine */
      }

      setReady(true);
      onReady?.();

      const handleCountry = (event: { features?: Array<{ properties?: Record<string, unknown> }> }) => {
        const props = event.features?.[0]?.properties;
        const iso = typeof props?.iso_a2 === 'string' ? props.iso_a2 : null;
        const name = typeof props?.name === 'string' ? props.name : '';
        if (!iso || !onCountryClick) return;
        const lngLat = map.getCenter();
        onCountryClick(iso, name, [lngLat.lng, lngLat.lat]);
      };

      const handleRegion = (event: { features?: Array<{ properties?: Record<string, unknown> }> }) => {
        const props = event.features?.[0]?.properties;
        const group = typeof props?.group === 'string' ? props.group : null;
        if (!group || !onRegionClick) return;
        const lngLat = map.getCenter();
        onRegionClick(group, [lngLat.lng, lngLat.lat]);
      };

      map.on('click', 'xp-countries-fill', handleCountry as never);
      map.on('click', 'xp-regions-fill', handleRegion as never);
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      onMoveEnd?.([c.lng, c.lat], map.getZoom());
    });

    return () => {
      if (orbitRef.current) window.clearInterval(orbitRef.current);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sources ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-countries') as GeoJSONSource | undefined;
    if (source && countries) source.setData(countries as never);
  }, [countries, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-regions') as GeoJSONSource | undefined;
    if (source) source.setData((regions ?? EMPTY) as never);
  }, [regions, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-routes') as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: (routes ?? [])
        .filter((route) => route.geojson)
        .map((route) => ({
          type: 'Feature',
          properties: { id: route.id, name: route.name, style: traceStyleForRoute(route.network) },
          geometry: route.geojson as never,
        })),
    } as never);
  }, [routes, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('xp-track') as GeoJSONSource | undefined;
    if (source) source.setData((activityTrack ?? EMPTY) as never);
  }, [activityTrack, ready]);

  // ── thème ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const dark = theme === 'dark';
    try {
      if (map.getLayer('xp-countries-fill')) {
        map.setPaintProperty('xp-countries-fill', 'fill-color', dark ? '#8FB79B' : '#5B7F55');
        map.setPaintProperty('xp-countries-fill', 'fill-opacity', dark ? 0.18 : 0.13);
      }
      if (map.getLayer('xp-countries-line')) {
        map.setPaintProperty('xp-countries-line', 'line-color', dark ? '#DCEFE2' : '#17402C');
        map.setPaintProperty('xp-countries-line', 'line-opacity', dark ? 0.4 : 0.32);
      }
      if (map.getLayer('xp-regions-line')) {
        map.setPaintProperty('xp-regions-line', 'line-color', dark ? '#7FB3C8' : '#2F6F78');
      }
      map.setSky({
        'sky-color': dark ? 'rgba(20,26,23,0)' : 'rgba(233,238,231,0)',
        'horizon-color': dark ? '#141a17' : '#e9eee7',
        'fog-color': dark ? '#1c2420' : '#eef2ed',
        'sky-horizon-blend': 0.5,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.7,
      } as never);
    } catch {
      /* propriétés absentes : aucune conséquence */
    }
    const canvas = map.getCanvas();
    canvas.style.filter = dark ? 'brightness(0.72) saturate(0.85) contrast(1.02)' : '';
  }, [theme, ready]);

  // ── projection et relief selon le niveau ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      map.setProjection({ type: level <= 1 ? 'globe' : 'mercator' });
    } catch {
      /* projection non supportée */
    }
    // Étiquettes : masquées sur le globe (niveau 0–1), visibles dès la région.
    try {
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type !== 'symbol') continue;
        map.setLayoutProperty(layer.id, 'visibility', level <= 1 ? 'none' : 'visible');
      }
    } catch {
      /* aucune couche d'étiquettes */
    }

    const hillshade = map.getLayer('xp-hillshade');
    if (hillshade) {
      map.setLayoutProperty('xp-hillshade', 'visibility', level >= 3 ? 'visible' : 'none');
    }
    try {
      map.setTerrain(level >= 3 ? { source: 'xp-terrain', exaggeration: 1.3 } : null);
    } catch {
      /* DEM indisponible */
    }
  }, [level, ready]);

  // ── caméra : plongée entre niveaux ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${level}:${zoom.toFixed(2)}:${center[0].toFixed(3)}:${center[1].toFixed(3)}`;
    if (movedToRef.current === key) return;
    movedToRef.current = key;
    flyToLevel(map, center as [number, number], level, reducedMotion);
  }, [level, center, zoom, ready, reducedMotion]);

  // ── orbite de sommet (pause au toucher, reprise après 6 s) ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (level !== 3 || paused || reducedMotion) return;
    return orbitController(map, true);
  }, [level, paused, reducedMotion, ready]);

  // ── intentions de caméra (révélation, suivi, vue d'ensemble, survol) ──
  const intentKey = cameraIntent ? `${cameraIntent.type}:${Date.now()}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !cameraIntent) return;
    const container = map.getContainer();

    if (cameraIntent.type === 'bearing') {
      if (cameraIntent.northUp) map.easeTo({ bearing: 0, duration: reducedMotion ? 0 : 400 });
      return;
    }
    if (cameraIntent.type === 'reveal') {
      revealAt(map, cameraIntent.center, reducedMotion);
      return;
    }
    if (cameraIntent.type === 'follow') {
      const padding = followPadding(container.clientHeight, sheetHeightPx);
      followAt(map, center, map.getBearing(), 1.4, padding, reducedMotion);
      return;
    }
    if (cameraIntent.type === 'overview') {
      const geometry = activityTrack?.features?.[0]?.geometry ?? null;
      const bounds = cameraIntent.bounds ?? boundsOfTrack(geometry);
      overviewOf(map, bounds, overviewPadding(container.clientWidth, sheetHeightPx), reducedMotion);
      return;
    }
    if (cameraIntent.type === 'flyover') {
      const points: Array<[number, number]> = [];
      const walk = (value: unknown) => {
        if (!Array.isArray(value)) return;
        if (typeof value[0] === 'number' && typeof value[1] === 'number') {
          points.push([value[0] as number, value[1] as number]);
          return;
        }
        for (const child of value) walk(child);
      };
      for (const route of routes ?? []) walk((route.geojson as { coordinates?: unknown })?.coordinates);
      if (points.length < 2) return;
      return flyoverTrack(map, points, reducedMotion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentKey, ready]);

  // ── repères projetés (overlay DOM, pas de Marker MapLibre) ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let frame = 0;

    const project = () => {
      frame = 0;
      const next: Array<{ pin: MapPin; x: number; y: number }> = [];
      for (const pin of pins) {
        const point = map.project([pin.lon, pin.lat]);
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        if (point.x < -80 || point.x > map.getContainer().clientWidth + 80) continue;
        if (point.y < -60 || point.y > map.getContainer().clientHeight + 60) continue;
        next.push({ pin, x: point.x, y: point.y });
      }
      const sheetTop = map.getContainer().clientHeight - sheetHeightPx;
      const kept = selectVisiblePins(
        next.map((item) => ({
          id: item.pin.id,
          kind: item.pin.kind as PoiKind,
          x: item.x,
          y: item.y,
          distanceKm: item.pin.distanceKm ?? 0,
          item,
        })),
        {
          level,
          sheetTop,
          viewport: {
            width: map.getContainer().clientWidth,
            height: map.getContainer().clientHeight,
          },
        },
      ).map((entry) => entry.item);
      setOverlay((current) => {
        const same =
          current.length === kept.length &&
          current.every(
            (item, index) =>
              item.pin.id === kept[index]?.pin.id &&
              Math.abs(item.x - kept[index].x) < 0.5 &&
              Math.abs(item.y - kept[index].y) < 0.5,
          );
        return same ? current : kept;
      });
      if (me) {
        const point = map.project([me.lng, me.lat]);
        setMeScreen((current) =>
          current && Math.abs(current.x - point.x) < 0.5 && Math.abs(current.y - point.y) < 0.5
            ? current
            : { x: point.x, y: point.y },
        );
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(project);
    };

    project();
    map.on('move', schedule);
    map.on('zoom', schedule);
    map.on('render', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      map.off('move', schedule);
      map.off('zoom', schedule);
      map.off('render', schedule);
    };
  }, [level, me, pins, ready, sheetHeightPx]);

  return (
    <div
      className="xp-map"
      ref={containerRef}
      data-testid="xp-map"
      data-level={level}
      data-ready={ready ? '1' : '0'}
      data-pins={pins.length}
      {...(longPressHandlers as Record<string, unknown>)}
    >
      {!ready ? (
        <div className="xp-map-globe-skeleton" aria-hidden="true">
          <span />
        </div>
      ) : null}
      <div className="xp-map-overlay" aria-hidden={false}>
        {meScreen ? (
          <>
            <span className="xp-me-halo" style={{ left: meScreen.x, top: meScreen.y }} aria-hidden="true" />
            <span className="xp-me" style={{ left: meScreen.x, top: meScreen.y }} aria-label="Ma position" role="img" />
          </>
        ) : null}
        {overlay.map(({ pin, x, y }) => (
          <button
            key={pin.id}
            type="button"
            className="xp-pin"
            data-pin={pin.id}
            data-selected={pin.id === selectedId ? 'true' : 'false'}
            style={{ left: x, top: y }}
            onClick={(event) => {
              event.stopPropagation();
              onPinClick?.(pin);
            }}
            aria-label={`${pin.name}${pin.sub ? `, ${pin.sub}` : ''}`}
          >
            <span className="xp-pin-ico" data-tone={pin.tone ?? 'ink'} aria-hidden="true" />
            <span className="xp-pin-text">
              <span className="xp-pin-title">{pin.name}</span>
              {pin.sub ? <span className="xp-pin-sub">{pin.sub}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

