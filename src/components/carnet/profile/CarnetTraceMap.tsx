'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '@/styles/carnet-trace.css';
import { leafletTiles } from '@/components/map/engine/leafletTiles';
import { dayColor, type DayTrace } from '@/features/carnet/trace/days';

export interface CarnetTraceMapProps {
  trace: unknown;
  /** Journées tracées : si présentes, chaque jour est dessiné dans sa couleur, bornes J1 → ✓ comprises. */
  dayTraces?: DayTrace[];
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
export function CarnetTraceMap({ trace, dayTraces, className = '' }: CarnetTraceMapProps) {
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
      const days = (dayTraces ?? []).filter((entry) => entry.coords.length >= 2);
      const coords = days.length > 0 ? days.flatMap((entry) => entry.coords.map(([lon, lat]) => [lat, lon] as [number, number])) : extractCoords(trace);
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

      if (days.length > 0) {
        const group = L.featureGroup().addTo(map);
        for (const entry of days) {
          const latlngs = entry.coords.map(([lon, lat]) => [lat, lon] as [number, number]);
          const color = dayColor(entry.day);
          L.polyline(latlngs, { color: '#ffffff', weight: 8, opacity: 0.9, lineCap: 'round' }).addTo(group);
          L.polyline(latlngs, { color, weight: 4.5, opacity: 1, lineCap: 'round', dashArray: entry.snapped ? undefined : '6 8' }).addTo(group);
          const pin = (label: string, size: [number, number]) =>
            L.divIcon({ className: 'lkdv-tr-pin-wrap', html: `<span class="lkdv-tr-pin" style="background:${color}">${label}</span>`, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });
          L.marker(latlngs[0] as [number, number], { icon: pin(`J${entry.day}`, [30, 22]), interactive: false, keyboard: false }).addTo(group);
          L.marker(latlngs[latlngs.length - 1] as [number, number], { icon: pin('✓', [22, 22]), interactive: false, keyboard: false }).addTo(group);
        }
        try {
          map.fitBounds(group.getBounds(), { padding: [26, 26] });
        } catch {
          /* bounds dégénérés : la vue initiale suffit */
        }
      } else if (coords.length > 0) {
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
  }, [trace, dayTraces]);

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
