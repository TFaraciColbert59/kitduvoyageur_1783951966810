'use client';
import { useRef, useCallback, useEffect } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { MapTrail } from './types';
import { getDifficultyColor, formatDistance } from './types';

interface TrailLayerProps {
  map: LeafletMap;
  trails: MapTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
}

export default function TrailLayer({ map, trails, selectedTrailId, onTrailClick }: TrailLayerProps) {
  const markersRef = useRef<globalThis.Map<string, import('leaflet').Marker>>(new globalThis.Map());

  const buildIcon = useCallback((trail: MapTrail, isSelected: boolean, L: typeof import('leaflet')) => {
    const diffColor = getDifficultyColor(trail.difficulty);
    const label = trail.distance_km ? `${trail.distance_km.toFixed(1)} km` : trail.name?.substring(0, 12) || '•';

    if (isSelected) {
      const html = `
        <div style="
          background: #1C2620;
          color: white;
          font-weight: 600;
          font-size: 11px;
          padding: 5px 10px;
          border-radius: 999px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          white-space: nowrap;
          transform: scale(1.1);
          transform-origin: bottom center;
          border: 2px solid ${diffColor};
          position: relative;
        ">${label}</div>`;
      return L.divIcon({ html, className: '', iconSize: [80, 28], iconAnchor: [40, 14] });
    } else {
      const html = `
        <div style="
          background: white;
          color: #1C2620;
          font-weight: 600;
          font-size: 11px;
          padding: 4px 9px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
          white-space: nowrap;
          border: 1.5px solid rgba(200,195,176,0.6);
          cursor: pointer;
          transition: transform 0.1s;
          border-left: 3px solid ${diffColor};
        ">${label}</div>`;
      return L.divIcon({ html, className: '', iconSize: [80, 24], iconAnchor: [40, 12] });
    }
  }, []);

  const addMarker = useCallback(
    (trail: MapTrail, L: typeof import('leaflet')) => {
      if (!map) return;
      const lat = trail.lat;
      const lng = trail.lng;
      if (lat === null || lat === undefined || lng === null || lng === undefined) return;

      const isSelected = trail.id === selectedTrailId;
      try {
        const icon = buildIcon(trail, isSelected, L);
        const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });
        marker.on('click', () => onTrailClick(trail));
        marker.addTo(map);
        markersRef.current.set(trail.id, marker);
      } catch {
        // skip invalid coords silently
      }
    },
    [map, selectedTrailId, onTrailClick, buildIcon]
  );

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;
    const markers = markersRef.current;

    import('leaflet').then((L) => {
      markers.forEach((marker) => {
        try { map.removeLayer(marker); } catch { /* ignore */ }
      });
      markers.clear();
      trails.forEach((trail) => addMarker(trail, L));
    });

    return () => {
      markers.forEach((marker) => {
        try { map.removeLayer(marker); } catch { /* ignore */ }
      });
      markers.clear();
    };
  }, [map, trails, selectedTrailId, addMarker]);

  return null;
}
