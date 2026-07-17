'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { ExploreTrail } from './AdventureScore';
import { DIFFICULTY_COLORS } from './AdventureScore';
import type GeoJSON from 'geojson';

interface TrailLayerProps {
  map: LeafletMap;
  trails: ExploreTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: ExploreTrail) => void;
}

// This component manages Leaflet GeoJSON layers imperatively
export default function TrailLayer({ map, trails, selectedTrailId, onTrailClick }: TrailLayerProps) {
  const layersRef = useRef<Map<string, import('leaflet').GeoJSON>>(new Map());

  const addLayer = useCallback(
    (trail: ExploreTrail, L: typeof import('leaflet')) => {
      if (!map || !trail.geometry || !trail.geometry.coordinates?.length) return;

      const isSelected = trail.id === selectedTrailId;
      const color = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';

      try {
        const layer = L.geoJSON(
          { type: 'Feature', geometry: trail.geometry, properties: {} } as GeoJSON.Feature,
          {
            style: {
              color,
              weight: isSelected ? 5 : 3,
              opacity: isSelected ? 1 : 0.75,
              lineCap: 'round',
              lineJoin: 'round',
            },
          }
        );

        layer.on('click', () => onTrailClick(trail));
        layer.on('mouseover', () => {
          layer.setStyle({ weight: 5, opacity: 1 });
        });
        layer.on('mouseout', () => {
          if (trail.id !== selectedTrailId) {
            layer.setStyle({ weight: 3, opacity: 0.75 });
          }
        });

        layer.addTo(map);
        layersRef.current.set(trail.id, layer);
      } catch {
        // Skip invalid geometries
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, selectedTrailId]
  );

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      // Remove existing layers
      layersRef.current.forEach((layer) => {
        try {
          map.removeLayer(layer);
        } catch {
          // ignore
        }
      });
      layersRef.current.clear();

      // Add new layers
      trails.forEach((trail) => addLayer(trail, L));
    });

    return () => {
      layersRef.current.forEach((layer) => {
        try {
          map.removeLayer(layer);
        } catch {
          // ignore
        }
      });
      layersRef.current.clear();
    };
  }, [map, trails, selectedTrailId, addLayer]);

  return null;
}
