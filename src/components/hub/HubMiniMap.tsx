'use client';

// Hub V5e — VRAIE carte (tuiles OSM France) + VRAI tracé depuis la BDD
// (trip_steps géolocalisés), même pattern que la page aventure
// (components/groupes/ParcoursCard) : import dynamique Leaflet, halo blanc
// + trace foncée, circleMarkers départ/étapes/arrivée. Carte 100% statique
// (pointer-events none + interactions off) : toute la carte-menu reste un
// lien. Fallback synthétique (comme ParcoursCard) si < 2 points géo.
import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface HubMiniMapStep {
  latitude: number | null;
  longitude: number | null;
}

export interface HubMiniMapProps {
  steps: HubMiniMapStep[];
  /** Distance totale (km) pour le tracé synthétique de secours. */
  distanceKm?: number;
  /** Réserve basse supplémentaire (px) — ex. capsule météo flottante. */
  reserveBottom?: number;
  className?: string;
}

export default function HubMiniMap({ steps, distanceKm = 0, reserveBottom = 0, className }: HubMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoKey = steps
    .map((s) => `${s.latitude ?? 'x'},${s.longitude ?? 'x'}`)
    .join('|');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === 'undefined') return;
    let isCancelled = false;

    import('leaflet').then((L) => {
      if (isCancelled || !containerRef.current) return;
      const container = containerRef.current;

      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* noop */ }
        mapRef.current = null;
      }
      if ((container as any)._leaflet_id) {
        try { delete (container as any)._leaflet_id; } catch { /* noop */ }
      }

      const geo = steps
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => [Number(s.latitude), Number(s.longitude)] as [number, number]);

      let routeCoords: [number, number][] = [];
      if (geo.length >= 2) {
        routeCoords = geo;
      } else {
        // Fallback synthétique (pattern page aventure) autour du point connu
        // ou des Alpes par défaut — la carte reste toujours réelle.
        const start: [number, number] = geo[0] ?? [45.9237, 6.8694];
        const r = ((Number(distanceKm) || 15) / 111) * 0.3;
        routeCoords = [
          start,
          [start[0] + r * 0.35, start[1] + r * 0.25],
          [start[0] + r * 0.7, start[1] + r * 0.65],
          [start[0] + r * 0.85, start[1] + r * 0.3],
          [start[0] + r * 1.1, start[1] + r * 0.8],
          [start[0] + r * 0.75, start[1] + r * 1.15],
          [start[0] + r * 0.25, start[1] + r * 0.85],
        ];
      }

      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        zoomSnap: 0.25,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | OSM France',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      // Halo blanc + trace foncée (lisibilité maximale sur tuiles).
      L.polyline(routeCoords, {
        color: '#FFFFFF',
        weight: 7,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      const polyline = L.polyline(routeCoords, {
        color: '#17402C',
        weight: 4.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // POIs : départ plein, étapes intermédiaires, arrivée en anneau.
      L.circleMarker(routeCoords[0], {
        radius: 6,
        color: '#FFFFFF',
        fillColor: '#17402C',
        fillOpacity: 1,
        weight: 2.5,
      }).addTo(map);

      for (let i = 1; i < routeCoords.length - 1; i++) {
        L.circleMarker(routeCoords[i], {
          radius: 4,
          color: '#FFFFFF',
          fillColor: '#5B7F55',
          fillOpacity: 1,
          weight: 1.8,
        }).addTo(map);
      }

      L.circleMarker(routeCoords[routeCoords.length - 1], {
        radius: 5.5,
        color: '#17402C',
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        weight: 2.5,
      }).addTo(map);

      // Trace + POIs à DROITE du panneau d'infos : on réserve la largeur
      // du panneau (mesurée au mount) + la réserve basse (capsule météo).
      const fitToTrace = () => {
        const root = container.closest('[data-media-root]');
        const panel = root?.parentElement?.querySelector('[data-media-content-panel]');
        let reserveLeft = Math.round(container.clientWidth * 0.42);
        if (panel && root) {
          const panelR = panel.getBoundingClientRect();
          const rootR = root.getBoundingClientRect();
          reserveLeft = Math.max(Math.round(panelR.right - rootR.left) + 16, 60);
        }
        map.fitBounds(polyline.getBounds(), {
          paddingTopLeft: [reserveLeft, 10],
          paddingBottomRight: [12, Math.max(reserveBottom + 10, 12)],
        });
      };
      fitToTrace();
      mapRef.current = map;

      setTimeout(() => {
        if (!isCancelled && mapRef.current) {
          mapRef.current.invalidateSize();
          fitToTrace();
        }
      }, 250);
    });

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* noop */ }
        mapRef.current = null;
      }
      if (container) {
        try { delete (container as any)._leaflet_id; } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geoKey (coords sérialisées) pilote le cycle ; steps est re-créé à chaque rendu serveur.
  }, [geoKey, distanceKm, reserveBottom]);

  // pointer-events-none : la carte-menu (lien) reste cliquable partout.
  return (
    <div
      ref={containerRef}
      className={`pointer-events-none z-0 h-full w-full ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}
