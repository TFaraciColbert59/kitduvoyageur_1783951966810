'use client';

// src/features/messaging/components/TraceMap.tsx
//
// Carte d'une trace GPX partagée en conversation : MapLibre, fond satellite,
// polyligne et cadrage automatique. Rendu client uniquement.

import React, { useEffect, useRef, useState } from 'react';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  loadCartoStyle,
  MAPTOOLKIT_LOGO,
  MAPTOOLKIT_COPYRIGHT,
  OSM_COPYRIGHT,
} from '@/features/carto/maptoolkit';
import '@/features/carto/carto.css';

export type TraceLineString = { type: 'LineString'; coordinates: [number, number][] };

export interface TraceMapProps {
  geojson: TraceLineString | null;
  height?: number;
}

export function TraceMap({ geojson, height = 260 }: TraceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!geojson || geojson.coordinates.length < 2 || !containerRef.current) return;
    let map: import('maplibre-gl').Map | null = null;
    let cancelled = false;

    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;
        let style: any;
        try {
          style = await loadCartoStyle({ base: 'hybrid', terrain3d: true });
        } catch {
          style = createMapStyle('satellite');
        }
        if (cancelled || !containerRef.current) return;
        const instance = new maplibregl.Map({
          container: containerRef.current,
          style: style,
          interactive: true,
          attributionControl: false,
        });
        map = instance;
        instance.on('load', () => {
          if (!instance || !geojson) return;
          instance.addSource('trace', { type: 'geojson', data: geojson });
          instance.addLayer({
            id: 'trace-line',
            type: 'line',
            source: 'trace',
            paint: { 'line-color': '#FF6B3D', 'line-width': 3.4, 'line-opacity': 0.95 },
          });
          const coords = geojson.coordinates;
          const bounds = coords.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(coords[0], coords[0]),
          );
          instance.fitBounds(bounds, { padding: 28, duration: 0 });
        });
      } catch {
        if (!cancelled) setError('Carte indisponible');
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [geojson]);

  if (error) return <div className="mattach-map-error">{error}</div>;

  return (
    <div className="mattach-map relative overflow-hidden" ref={containerRef} style={{ height }} aria-label="Carte du tracé">
      <div
        className="lkdv-map-attribution"
        style={{ position: 'absolute', right: 6, bottom: 6, zIndex: 10 }}
      >
        <img src={MAPTOOLKIT_LOGO} alt="Maptoolkit" height={20} loading="lazy" />
        <a href={MAPTOOLKIT_COPYRIGHT} target="_blank" rel="noopener noreferrer">
          © Maptoolkit
        </a>
        <a href={OSM_COPYRIGHT} target="_blank" rel="noopener noreferrer">
          © Openstreetmap
        </a>
      </div>
    </div>
  );
}
