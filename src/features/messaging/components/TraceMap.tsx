'use client';

// src/features/messaging/components/TraceMap.tsx
//
// Carte d'un tracé partagé en conversation (aperçu avant envoi et tiroir
// d'ouverture) : MapLibre, fond satellite, tracé en deux traits (liseré forest
// + trait clair), départ et arrivée distincts. Rendu client uniquement.
//
// Fiabilité (tiroir animé, conteneur de taille provisoire) :
//  - le worker MapLibre est déclaré (`setWorkerUrl`), sans quoi aucune source
//    GeoJSON ne se charge en MapLibre 6 et le tracé n'est jamais dessiné ;
//  - projection Mercator et fond transparent : la première image est déjà
//    cadrée sur le tracé (pas de globe blanc au chargement à froid) ;
//  - source et couches sont ajoutées dès que le style est prêt ;
//  - un ResizeObserver recadre la carte (`resize` + `fitBounds`) tant que la
//    personne ne l'a pas manipulée ;
//  - segments disjoints : MultiLineString, jamais de droite entre deux segments ;
//  - fond de carte en échec (hors ligne) : le tracé reste lisible en SVG ;
//  - `map.remove()` au démontage (un seul contexte WebGL vivant ici : la
//    messagerie n'ouvre jamais deux cartes à la fois, les bulles sont en SVG).

import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  geometrySegments,
  lngLatBounds,
  simplifySegments,
  unwrapAntimeridian,
  type LngLat,
  type TraceGeometry,
} from '@/lib/geo/traceCoordinates';
import { TRACE_EMPTY_LABEL, TRACE_STYLE } from '../lib/traceStyle';
import { TraceThumb } from './TraceThumb';

export type { TraceLineString, TraceGeometry } from '@/lib/geo/traceCoordinates';
export { TRACE_EMPTY_LABEL };

export interface TraceMapPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface TraceMapProps {
  /** LineString, MultiLineString ou tout ce que lit `geometrySegments`. */
  geojson: TraceGeometry | null;
  height?: number | string;
  /** Marges de cadrage (px) qui laissent la place aux pastilles posées par-dessus. */
  padding?: TraceMapPadding;
  /** Texte de l'état vide (aucun tracé exploitable). */
  emptyLabel?: string;
}

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';
const MAX_MAP_POINTS = 2000;
const MAX_FIT_ZOOM = 16;
const READY_TIMEOUT_MS = 15_000;
const TILES_TIMEOUT_MS = 10_000;
const TILE_ERRORS_BEFORE_FALLBACK = 3;
const SATELLITE_SOURCE = 'atlas-satellite';

type Status = 'loading' | 'ready' | 'nobasemap' | 'error';

/** Marges réduites pour qu'elles ne dépassent jamais 70 % de la taille réelle. */
function clampPadding(padding: Required<TraceMapPadding>, width: number, height: number) {
  const vertical = padding.top + padding.bottom;
  const horizontal = padding.left + padding.right;
  const kv = vertical > height * 0.7 ? (height * 0.7) / vertical : 1;
  const kh = horizontal > width * 0.7 ? (width * 0.7) / horizontal : 1;
  return {
    top: Math.round(padding.top * kv),
    bottom: Math.round(padding.bottom * kv),
    left: Math.round(padding.left * kh),
    right: Math.round(padding.right * kh),
  };
}

export function TraceMap({ geojson, height = 260, padding, emptyLabel = TRACE_EMPTY_LABEL }: TraceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);

  // Segments tracés (≥ 2 points), antiméridien déroulé : jamais reliés entre eux.
  const segments = useMemo(() => unwrapAntimeridian(geometrySegments(geojson)), [geojson]);
  // Identité stable : un parent qui recrée l'objet à chaque rendu ne relance pas la carte.
  const signature = useMemo(() => {
    if (segments.length === 0) return '';
    const flat = segments.flat();
    return `${segments.length}|${flat.length}|${flat[0]}|${flat[Math.floor(flat.length / 2)]}|${flat[flat.length - 1]}`;
  }, [segments]);
  const segmentsRef = useRef<LngLat[][]>(segments);
  segmentsRef.current = segments;
  const paddingRef = useRef<Required<TraceMapPadding>>({ top: 28, right: 28, bottom: 28, left: 28 });
  paddingRef.current = { top: 28, right: 28, bottom: 28, left: 28, ...padding };

  useEffect(() => {
    const container = containerRef.current;
    if (!signature || !container) return undefined;
    const lines = simplifySegments(segmentsRef.current, MAX_MAP_POINTS);
    const bounds = lngLatBounds(lines.flat());
    if (!bounds) return undefined;
    const startPoint = lines[0][0];
    const lastLine = lines[lines.length - 1];
    const endPoint = lastLine[lastLine.length - 1];

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let tilesTimer: ReturnType<typeof setTimeout> | undefined;
    let userMoved = false;
    let ready = false;
    let tilesOk = false;
    let tileErrors = 0;
    setStatus('loading');

    const cameraBounds: [[number, number], [number, number]] = [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ];
    const fitPadding = () => clampPadding(paddingRef.current, container.clientWidth, container.clientHeight);

    const fit = () => {
      if (!map || cancelled) return;
      // Conteneur encore sans taille (tiroir qui s'ouvre) : le ResizeObserver rappellera.
      if (container.clientWidth < 48 || container.clientHeight < 48) return;
      try {
        map.fitBounds(cameraBounds, { padding: fitPadding(), duration: 0, maxZoom: MAX_FIT_ZOOM });
      } catch {
        /* cadre impossible : la vue courante reste */
      }
    };

    const refit = () => {
      if (!map || cancelled) return;
      map.resize();
      if (ready && !userMoved) fit();
    };

    const markBasemapMissing = () => {
      if (!cancelled && !tilesOk) setStatus((current) => (current === 'error' ? current : 'nobasemap'));
    };

    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled) return;
        // Worker servi depuis /public (MapLibre 6) : sans lui, la source GeoJSON ne charge jamais.
        maplibregl.setWorkerUrl(WORKER_URL);
        // Mercator + fond transparent : la première image est locale et sombre, jamais un globe blanc.
        const style = { ...createMapStyle('satellite', { transparentBackground: true }), projection: { type: 'mercator' as const } };
        const initialReady = container.clientWidth >= 48 && container.clientHeight >= 48;
        const instance = new maplibregl.Map({
          container,
          style,
          interactive: true,
          attributionControl: false,
          fadeDuration: 0,
          ...(initialReady
            ? { bounds: cameraBounds, fitBoundsOptions: { padding: fitPadding(), maxZoom: MAX_FIT_ZOOM } }
            : { center: [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2] as [number, number], zoom: 8 }),
        });
        map = instance;
        instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        instance.on('movestart', (event) => {
          // Un déplacement venant d'un geste porte `originalEvent` ; le cadrage automatique non.
          if ((event as { originalEvent?: unknown }).originalEvent) userMoved = true;
        });
        instance.on('sourcedata', (event) => {
          const e = event as { sourceId?: string; isSourceLoaded?: boolean };
          if (e.sourceId === SATELLITE_SOURCE && e.isSourceLoaded) {
            tilesOk = true;
            if (tilesTimer) clearTimeout(tilesTimer);
            if (!cancelled) setStatus((current) => (current === 'nobasemap' ? 'ready' : current));
          }
        });
        instance.on('error', (event) => {
          const e = event as { sourceId?: string };
          if (e.sourceId === SATELLITE_SOURCE) {
            tileErrors += 1;
            if (tileErrors >= TILE_ERRORS_BEFORE_FALLBACK) markBasemapMissing();
          }
        });

        const addTrace = () => {
          if (ready || cancelled) return;
          const geometry =
            lines.length === 1
              ? { type: 'LineString' as const, coordinates: lines[0] }
              : { type: 'MultiLineString' as const, coordinates: lines };
          try {
            instance.addSource('trace', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry } });
          } catch {
            // Style pas encore chargé : on réessaie au prochain `styledata`.
            return;
          }
          ready = true;
          instance.addSource('trace-ends', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                { type: 'Feature', properties: { role: 'end' }, geometry: { type: 'Point', coordinates: endPoint } },
                { type: 'Feature', properties: { role: 'start' }, geometry: { type: 'Point', coordinates: startPoint } },
              ],
            },
          });
          instance.addLayer({
            id: 'trace-casing',
            type: 'line',
            source: 'trace',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': TRACE_STYLE.casing, 'line-width': TRACE_STYLE.casingWidth, 'line-opacity': 0.95 },
          });
          instance.addLayer({
            id: 'trace-line',
            type: 'line',
            source: 'trace',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': TRACE_STYLE.line, 'line-width': TRACE_STYLE.lineWidth },
          });
          // Arrivée dessous, départ dessus : sur une boucle, le départ reste lisible.
          instance.addLayer({
            id: 'trace-end',
            type: 'circle',
            source: 'trace-ends',
            filter: ['==', ['get', 'role'], 'end'],
            paint: {
              'circle-radius': TRACE_STYLE.markerRadius,
              'circle-color': TRACE_STYLE.endFill,
              'circle-stroke-color': TRACE_STYLE.endRing,
              'circle-stroke-width': TRACE_STYLE.markerRingWidth,
            },
          });
          instance.addLayer({
            id: 'trace-start',
            type: 'circle',
            source: 'trace-ends',
            filter: ['==', ['get', 'role'], 'start'],
            paint: {
              'circle-radius': TRACE_STYLE.markerRadius,
              'circle-color': TRACE_STYLE.startFill,
              'circle-stroke-color': TRACE_STYLE.startRing,
              'circle-stroke-width': TRACE_STYLE.markerRingWidth,
            },
          });
          if (readyTimer) clearTimeout(readyTimer);
          instance.resize();
          fit();
          setStatus((current) => (current === 'nobasemap' ? current : 'ready'));
          // Le tiroir finit de s'animer : un dernier recadrage une fois posé.
          settleTimer = setTimeout(refit, 400);
          // Aucune tuile reçue après un délai : le fond de carte est indisponible.
          tilesTimer = setTimeout(markBasemapMissing, TILES_TIMEOUT_MS);
        };

        // `load` et `isStyleLoaded()` attendent les tuiles du fond : le style chargé suffit pour poser
        // le tracé (l'ajout d'une source échoue tant que le style n'est pas là, on réessaie).
        instance.on('styledata', addTrace);
        instance.once('load', addTrace);
        addTrace();

        observer = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(refit);
        });
        observer.observe(container);

        readyTimer = setTimeout(() => {
          if (!ready && !cancelled) setStatus('error');
        }, READY_TIMEOUT_MS);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (settleTimer) clearTimeout(settleTimer);
      if (readyTimer) clearTimeout(readyTimer);
      if (tilesTimer) clearTimeout(tilesTimer);
      observer?.disconnect();
      try {
        map?.remove();
      } catch {
        /* carte déjà détruite */
      }
      map = null;
    };
  }, [signature, attempt]);

  const style: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
    position: 'relative',
  };

  if (!signature) {
    return (
      <div className="mtrace mtrace-empty" style={style} role="status">
        <span>{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="mtrace" style={style}>
      <div className="mattach-map mtrace-canvas" ref={containerRef} aria-label="Carte du tracé" />
      {status === 'loading' ? (
        <div className="mtrace-state" role="status" aria-label="Chargement de la carte">
          <span className="mtrace-spin" aria-hidden="true" />
        </div>
      ) : null}
      {status === 'nobasemap' ? (
        <div className="mtrace-state mtrace-nobasemap" role="status">
          <TraceThumb geojson={geojson} width={360} height={420} reserveBottom={44} pad={40} />
          <span className="mtrace-nobasemap-label">Fond de carte indisponible</span>
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="mtrace-state mtrace-error" role="alert">
          <span>Carte indisponible</span>
          <button
            type="button"
            className="mtrace-retry"
            onClick={() => {
              setStatus('loading');
              setAttempt((n) => n + 1);
            }}
          >
            Réessayer
          </button>
        </div>
      ) : null}
    </div>
  );
}
