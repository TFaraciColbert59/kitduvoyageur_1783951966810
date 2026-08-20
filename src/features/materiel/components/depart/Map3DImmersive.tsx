'use client';
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapRoute {
  coordinates: [number, number][];
}

/** W-D-1 Map3DImmersive — carte MapLibre teintée Sage + tracé de route + halo. */
export function Map3DImmersive({ route, className }: { route?: MapRoute; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: route?.coordinates?.[0] ?? [2.2, 46.6],
      zoom: 7,
    });
    mapRef.current = map;

    map.on('load', () => {
      if (route && route.coordinates.length > 1) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route.coordinates },
          },
        });
        map.addLayer({
          id: 'route-halo', type: 'line', source: 'route',
          paint: { 'line-color': 'rgba(91,127,85,0.28)', 'line-width': 8 },
        });
        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          paint: { 'line-color': '#5B7F55', 'line-width': 3 },
        });
        const coords = route.coordinates as [number, number][];
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 40, maxZoom: 12 }
        );
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [route]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-[var(--r-lg)] bg-stone-100 ${className ?? ''}`}
      style={{ filter: 'saturate(1.1) hue-rotate(-10deg)' }}
      aria-label="Carte immersive du départ"
      role="img"
    />
  );
}
