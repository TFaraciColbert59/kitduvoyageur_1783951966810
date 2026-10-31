'use client';

import React, { useMemo } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import LKDVMap from '@/features/carto/LKDVMap';
import '@/features/carto/carto.css';
import { extractCoords } from './traceGeometry';

export interface CarnetTraceMapProps {
  trace: unknown;
  distanceKm?: number | null;
  elevationM?: number | null;
  className?: string;
}

/**
 * Carte de la fiche carnet : propulsée par LKDVMap (Maptoolkit Hiking 3D unifié).
 * Remplace l'ancien rendu Leaflet pour une expérience 3D fluide et cohérente sur iPhone.
 */
export function CarnetTraceMap({ trace, className = '' }: CarnetTraceMapProps) {
  const coords = useMemo(() => extractCoords(trace), [trace]);
  const center: [number, number] = useMemo(
    () => (coords.length > 0 ? [coords[0][1], coords[0][0]] : [6.8694, 45.9237]),
    [coords],
  );

  const handleReady = React.useCallback(
    async (map: MapLibreMap) => {
      if (coords.length < 2) return;
      const maplibregl = await import('maplibre-gl');
      const lineCoords = coords.map(([lat, lng]) => [lng, lat]);

      if (!map.getSource('carnet-trace-source')) {
        map.addSource('carnet-trace-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: lineCoords,
            },
            properties: {},
          },
        });
      }

      if (!map.getLayer('carnet-trace-halo')) {
        map.addLayer({
          id: 'carnet-trace-halo',
          type: 'line',
          source: 'carnet-trace-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
        });
      }

      if (!map.getLayer('carnet-trace-main')) {
        map.addLayer({
          id: 'carnet-trace-main',
          type: 'line',
          source: 'carnet-trace-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#17402C', 'line-width': 4.5, 'line-opacity': 1 },
        });
      }

      try {
        const bounds = lineCoords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(
            lineCoords[0] as [number, number],
            lineCoords[0] as [number, number],
          ),
        );
        map.fitBounds(bounds, { padding: 28, duration: 0 });
      } catch {
        /* bounds dégénérés : vue initiale */
      }
    },
    [coords],
  );

  return (
    <div
      className={`ckp-map-canvas ${className}`.trim()}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 220 }}
      aria-label="Carte du parcours"
    >
      <LKDVMap
        center={center}
        zoom={coords.length > 0 ? 11 : 5}
        base="maptoolkit"
        terrain3d={true}
        interactive={coords.length > 0}
        onReady={handleReady}
      />
    </div>
  );
}

export default CarnetTraceMap;
