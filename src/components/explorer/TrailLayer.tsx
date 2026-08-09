'use client';
import { useRef, useCallback, useEffect } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import type { MapTrail } from './types';
import { isValidLatLng, sanitizeGeoJSON } from './types';

interface TrailLayerProps {
  map: LeafletMap;
  trails: MapTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
  progressFrac?: number | null;
}

import { sliceRouteGeoJSON } from '@/features/hiking/services/RouteGeom';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export default function TrailLayer({ map, trails, selectedTrailId, onTrailClick, progressFrac }: TrailLayerProps) {
  const layerGroupRef = useRef<any>(null);

  // Main render effect for trails and markers
  useEffect(() => {
    if (!map) return;

    let isMounted = true;

    Promise.all([
      import('leaflet'),
      import('leaflet.markercluster')
    ]).then(([LModule]) => {
      if (!isMounted) return;
      const L = LModule.default || LModule;

      // Clean up previous layer group
      if (layerGroupRef.current) {
        try { map.removeLayer(layerGroupRef.current); } catch {
          // ignore layer removal errors
        }
        layerGroupRef.current = null;
      }

      if (!trails.length) return;

      // Create a MarkerClusterGroup
      // @ts-expect-error - leaflet.markercluster types not available
      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: function (cluster: any) {
          const count = cluster.getChildCount();
          const html = `
            <div style="
              background: #1C2620;
              color: white;
              font-weight: 700;
              font-size: 11px;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
              border: 2px solid white;
            ">${count}</div>
          `;
          return L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
        }
      });

      // Regular group for geoJSON lines so they don't get clustered
      const linesGroup = L.layerGroup();

      trails.forEach((trail) => {
        const isSelected = trail.id === selectedTrailId;

        // 1. Render GeoJSON Trace ONLY IF SELECTED (Hide by default)
        if (trail.geojson && isSelected) {
          try {
            const parsedGeo = typeof trail.geojson === 'string' ? JSON.parse(trail.geojson) : trail.geojson;
            const cleanGeo = sanitizeGeoJSON(parsedGeo);
            if (!cleanGeo) return;

            // Outer casing for high contrast
            const casingLayer = L.geoJSON(cleanGeo as any, {
              style: {
                color: '#FBFAF6',
                weight: 9,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              },
            });
            linesGroup.addLayer(casingLayer);

            // Dynamically slice trail into completed vs remaining if progressFrac exists
            if (progressFrac != null && Number.isFinite(progressFrac) && progressFrac > 0) {
              const { completedGeojson, remainingGeojson } = sliceRouteGeoJSON(cleanGeo, progressFrac);

              // Completed portion (Solid Forest Green)
              if (completedGeojson) {
                const completedLayer = L.geoJSON(completedGeojson as any, {
                  style: {
                    color: '#17402C',
                    weight: 6,
                    opacity: 1.0,
                    lineCap: 'round',
                    lineJoin: 'round',
                  },
                });
                linesGroup.addLayer(completedLayer);
              }

              // Remaining portion (Dashed Sage Green)
              if (remainingGeojson) {
                const remainingLayer = L.geoJSON(remainingGeojson as any, {
                  style: {
                    color: '#4A7C5B',
                    weight: 5,
                    opacity: 0.75,
                    dashArray: '8, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                  },
                });
                linesGroup.addLayer(remainingLayer);
              }
            } else {
              // Full trail line if progress is 0
              const geoJsonLayer = L.geoJSON(cleanGeo as any, {
                style: {
                  color: '#17402C',
                  weight: 5,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round',
                },
              });
              geoJsonLayer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onTrailClick?.(trail);
              });
              linesGroup.addLayer(geoJsonLayer);
            }
          } catch (e) {
            console.warn('Failed to parse GeoJSON for trail:', trail.name, e);
          }
        }

        // 2. Render KM Marker (Clean white pill style) added to Cluster!
        // Coerce lat/lng first, exclude null/"" (Number(null)===0 → ghost marker
        // à (0,0)) ainsi que tout non-fini (NaN, Infinity, "abc") et hors bornes
        // géographiques (lat±90, lng±180).
        const lat = Number(trail.lat);
        const lng = Number(trail.lng);
        if (isValidLatLng(trail.lat, trail.lng)) {
          const label = trail.distance_km ? `${Number(trail.distance_km).toFixed(1)}km`.replace('.', ',').replace(',0', '') : '';
          if (label) {
            const html = `
              <div style="
                background: ${isSelected ? '#1C2620' : 'white'};
                color: ${isSelected ? 'white' : '#1C2620'};
                font-weight: 700;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 999px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                white-space: nowrap;
                border: 1px solid ${isSelected ? '#1C2620' : '#E8E4D8'};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              ">${label}</div>`;
            const icon = L.divIcon({ html, className: '', iconSize: [54, 24], iconAnchor: [27, 12] });
            const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 10 });
            marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              onTrailClick?.(trail);
            });
            clusterGroup.addLayer(marker);
          }
        }
      });

      // Add both layers to map
      clusterGroup.addTo(map);
      linesGroup.addTo(map);
      
      // Store both in a parent group so we can remove them later
      const parentGroup = L.layerGroup([clusterGroup, linesGroup]);
      layerGroupRef.current = parentGroup;
    });

    return () => {
      isMounted = false;
      if (layerGroupRef.current && map) {
        try { map.removeLayer(layerGroupRef.current); } catch {
          // ignore layer removal errors on cleanup
        }
      }
    };
  }, [map, trails, selectedTrailId, onTrailClick, progressFrac]);

  return null;
}