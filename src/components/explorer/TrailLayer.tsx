'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { ExploreTrail } from './AdventureScore';
import { DIFFICULTY_COLORS } from './AdventureScore';

interface TrailLayerProps {
  map: LeafletMap;
  trails: ExploreTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: ExploreTrail) => void;
}

type AnyGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: AnyGeometry[];
};

/** Returns true if the geometry has drawable line coordinates */
function isValidGeometry(geom: AnyGeometry | null | undefined): boolean {
  if (!geom || !geom.type) return false;
  if (geom.type === 'GeometryCollection') {
    return Array.isArray(geom.geometries) && geom.geometries.length > 0;
  }
  return Array.isArray((geom as { coordinates?: unknown }).coordinates) &&
    ((geom as { coordinates: unknown[] }).coordinates as unknown[]).length > 0;
}

/** Converts any geometry to a GeoJSON FeatureCollection Leaflet can render */
function toFeatureCollection(geom: AnyGeometry): object {
  if (geom.type === 'FeatureCollection') return geom as object;
  if (geom.type === 'Feature') return { type: 'FeatureCollection', features: [geom] };
  if (geom.type === 'GeometryCollection') {
    // Flatten each sub-geometry into its own Feature
    const features = (geom.geometries || []).map((g) => ({
      type: 'Feature',
      geometry: g,
      properties: {},
    }));
    return { type: 'FeatureCollection', features };
  }
  // LineString, MultiLineString, Polygon, etc.
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: geom, properties: {} }],
  };
}

// This component manages Leaflet GeoJSON layers imperatively
export default function TrailLayer({ map, trails, selectedTrailId, onTrailClick }: TrailLayerProps) {
  const layersRef = useRef<Map<string, import('leaflet').GeoJSON>>(new Map());

  const addLayer = useCallback(
    (trail: ExploreTrail, L: typeof import('leaflet')) => {
      if (!map) return;

      const geom = trail.geometry as AnyGeometry | null;
      if (!isValidGeometry(geom)) return;

      const isSelected = trail.id === selectedTrailId;
      const color = DIFFICULTY_COLORS[trail.difficulty] || '#94a3b8';

      try {
        const featureCollection = toFeatureCollection(geom!);

        const layer = L.geoJSON(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          featureCollection as any,
          {
            style: () => ({
              color,
              weight: isSelected ? 7 : 4,
              opacity: isSelected ? 1 : 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }),
          }
        );

        layer.on('click', () => onTrailClick(trail));
        layer.on('mouseover', () => {
          layer.setStyle({ weight: 6, opacity: 1 });
        });
        layer.on('mouseout', () => {
          if (trail.id !== selectedTrailId) {
            layer.setStyle({ weight: 4, opacity: 0.9 });
          }
        });

        layer.addTo(map);
        layersRef.current.set(trail.id, layer);
      } catch {
        // Skip invalid geometries silently
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
      const layers = layersRef.current;
      layers.forEach((layer) => {
        try {
          map.removeLayer(layer);
        } catch {
          // ignore
        }
      });
      layers.clear();
    };
  }, [map, trails, selectedTrailId, addLayer]);

  return null;
}
