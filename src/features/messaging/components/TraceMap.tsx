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
//  - source et couches sont ajoutées dès que le style est prêt ;
//  - un ResizeObserver recadre la carte (`resize` + `fitBounds`) tant que la
//    personne ne l'a pas manipulée ;
//  - `map.remove()` au démontage (un seul contexte WebGL vivant ici : la
//    messagerie n'ouvre jamais deux cartes à la fois, les bulles sont en SVG).

import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  extractLngLat,
  lngLatBounds,
  simplifyLngLat,
  type LngLat,
  type TraceLineString,
} from '@/lib/geo/traceCoordinates';
import { TRACE_STYLE } from '../lib/traceStyle';

export type { TraceLineString } from '@/lib/geo/traceCoordinates';

export interface TraceMapPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface TraceMapProps {
  geojson: TraceLineString | null;
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
export const TRACE_EMPTY_LABEL = 'Tracé indisponible pour cette randonnée';

type Status = 'loading' | 'ready' | 'error';

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

  const coords = useMemo(() => extractLngLat(geojson), [geojson]);
  // Identité stable : un parent qui recrée l'objet à chaque rendu ne relance pas la carte.
  const signature = useMemo(() => {
    if (coords.length < 2) return '';
    const first = coords[0];
    const last = coords[coords.length - 1];
    const mid = coords[Math.floor(coords.length / 2)];
    return `${coords.length}|${first}|${mid}|${last}`;
  }, [coords]);
  const coordsRef = useRef<LngLat[]>(coords);
  coordsRef.current = coords;
  const paddingRef = useRef<Required<TraceMapPadding>>({ top: 28, right: 28, bottom: 28, left: 28 });
  paddingRef.current = { top: 28, right: 28, bottom: 28, left: 28, ...padding };

  useEffect(() => {
    const container = containerRef.current;
    if (!signature || !container) return undefined;
    const line = simplifyLngLat(coordsRef.current, MAX_MAP_POINTS);
    const bounds = lngLatBounds(line);
    if (!bounds) return undefined;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let userMoved = false;
    let ready = false;
    setStatus('loading');

    const fit = () => {
      if (!map || cancelled) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      // Conteneur encore sans taille (tiroir qui s'ouvre) : le ResizeObserver rappellera.
      if (w < 48 || h < 48) return;
      try {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding: clampPadding(paddingRef.current, w, h), duration: 0, maxZoom: MAX_FIT_ZOOM },
        );
      } catch {
        /* cadre impossible : la vue courante reste */
      }
    };

    const refit = () => {
      if (!map || cancelled) return;
      map.resize();
      if (ready && !userMoved) fit();
    };

    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled) return;
        // Worker servi depuis /public (MapLibre 6) : sans lui, la source GeoJSON ne charge jamais.
        maplibregl.setWorkerUrl(WORKER_URL);
        const instance = new maplibregl.Map({
          container,
          style: createMapStyle('satellite'),
          interactive: true,
          attributionControl: false,
          fadeDuration: 0,
          renderWorldCopies: false,
        });
        map = instance;
        instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        instance.on('movestart', (event) => {
          // Un déplacement venant d'un geste porte `originalEvent` ; le cadrage automatique non.
          if ((event as { originalEvent?: unknown }).originalEvent) userMoved = true;
        });

        const addTrace = () => {
          if (ready || cancelled) return;
          ready = true;
          const feature = {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: line },
          };
          instance.addSource('trace', { type: 'geojson', data: feature });
          instance.addSource('trace-ends', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                { type: 'Feature', properties: { role: 'end' }, geometry: { type: 'Point', coordinates: line[line.length - 1] } },
                { type: 'Feature', properties: { role: 'start' }, geometry: { type: 'Point', coordinates: line[0] } },
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
          setStatus('ready');
          // Le tiroir finit de s'animer : un dernier recadrage une fois posé.
          settleTimer = setTimeout(refit, 400);
        };

        // `load` n'arrive qu'après les premières tuiles ; le style prêt suffit pour poser le tracé.
        instance.on('styledata', () => {
          if (instance.isStyleLoaded()) addTrace();
        });
        instance.once('load', addTrace);
        if (instance.isStyleLoaded()) addTrace();

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
