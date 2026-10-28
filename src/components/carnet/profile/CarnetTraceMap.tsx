'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { leafletTiles } from '@/components/map/engine/leafletTiles';

export interface CarnetTraceMapProps {
  trace: unknown;
  distanceKm?: number | null;
  elevationM?: number | null;
  className?: string;
}

function extractCoords(trace: unknown): [number, number][] {
  const raw =
    (trace as any)?.geometry?.coordinates ?? (trace as any)?.coordinates ?? (trace as any);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((point: any) => {
      if (Array.isArray(point)) return [Number(point[1]), Number(point[0])] as [number, number];
      if (point && typeof point === 'object') return [Number(point.lat), Number(point.lng)] as [number, number];
      return null;
    })
    .filter(
      (point): point is [number, number] =>
        point !== null && point !== undefined && Number.isFinite(point[0]) && Number.isFinite(point[1]),
    );
}

/**
 * Carte de la fiche : mêmes tuiles, même crédit et même trace que le Compte
 * (Leaflet, sans Card ni Button : le bloc porte sa propre géométrie).
 */
export function CarnetTraceMap({ trace, className = '' }: CarnetTraceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let mounted = true;

    if (mapRef.current) {
      mapRef.current.remove?.();
      mapRef.current = null;
    }
    try {
      delete (container as any)._leaflet_id;
    } catch {
      /* Leaflet conserve un id : sans effet hors dev */
    }

    void import('leaflet').then((L) => {
      if (!mounted) return;
      const coords = extractCoords(trace);
      const map = L.map(container, {
        center: coords[0] ?? [45.9, 6.9],
        zoom: coords.length > 0 ? 10 : 4,
        zoomControl: false,
        attributionControl: false,
        dragging: coords.length > 0,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.control.attribution({ prefix: false }).addTo(map);
      const tiles = leafletTiles('osm');
      L.tileLayer(tiles.url, { ...tiles.options, keepBuffer: 4 }).addTo(map);

      if (coords.length > 0) {
        const halo = L.polyline(coords, {
          color: '#ffffff',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
        }).addTo(map);
        L.polyline(coords, { color: '#17402C', weight: 4.5, opacity: 1, lineCap: 'round' }).addTo(map);
        L.circleMarker(coords[0], {
          radius: 6,
          color: '#fff',
          fillColor: '#17402C',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        L.circleMarker(coords[coords.length - 1], {
          radius: 6,
          color: '#fff',
          fillColor: '#3d7a52',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        try {
          map.fitBounds(halo.getBounds(), { padding: [26, 26] });
        } catch {
          /* bounds dégénérés : la vue initiale suffit */
        }
      }

      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          /* carte démontée entre-temps */
        }
      }, 120);
      setReady(true);
    });

    const observer = new ResizeObserver(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch {
        /* noop */
      }
    });
    observer.observe(container);

    return () => {
      mounted = false;
      observer.disconnect();
      try {
        mapRef.current?.remove?.();
      } catch {
        /* noop */
      }
      mapRef.current = null;
    };
  }, [trace]);

  return (
    <div
      className={`ckp-map-canvas ${className}`.trim()}
      ref={containerRef}
      data-ready={ready ? 'true' : 'false'}
      aria-label="Carte du parcours"
    />
  );
}

export default CarnetTraceMap;
