'use client';
import { useRef, useEffect } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { MapTrail } from './types';
import { isValidLatLng, sanitizeGeoJSON } from './types';
import { sliceRouteGeoJSON } from '@/features/hiking/services/RouteGeom';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface TrailLayerProps {
  map: LeafletMap;
  trails: MapTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
  progressFrac?: number | null;
}

export default function TrailLayer({ map, trails, selectedTrailId, onTrailClick, progressFrac }: TrailLayerProps) {
  const layerGroupRef = useRef<any>(null);

  // Main render effect for trails and markers
  useEffect(() => {
    if (!map) return;

    let isMounted = true;

    import('leaflet').then(async (LModule) => {
      if (!isMounted) return;
      const L = (LModule as any).default || LModule;
      if (typeof window !== 'undefined') {
        (window as any).L = L;
      }
      try {
        await import('leaflet.markercluster');
      } catch (err) {
        console.warn('[TrailLayer] leaflet.markercluster import warning:', err);
      }

      if (!isMounted) return;

      // Clean up previous layer group thoroughly
      if (layerGroupRef.current) {
        try {
          if (typeof layerGroupRef.current.clearLayers === 'function') {
            layerGroupRef.current.clearLayers();
          }
          map.removeLayer(layerGroupRef.current);
        } catch {
          // ignore layer removal errors
        }
        layerGroupRef.current = null;
      }

      if (!trails.length) return;

      // Create a MarkerClusterGroup (with fallback to standard layerGroup)
      const clusterGroup = typeof (L as any).markerClusterGroup === 'function'
        ? (L as any).markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 45,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: function (cluster: any) {
              const count = cluster.getChildCount();
              const html = `
                <div style="
                  background: #17402C;
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
          })
        : L.layerGroup();

      // Regular group for geoJSON lines & start point markers so they don't get clustered
      const linesGroup = L.layerGroup();

      trails.forEach((trail) => {
        const isSelected = trails.length === 1 || (selectedTrailId != null && String(trail.id) === String(selectedTrailId));

        let effectiveGeoJSON: any = null;
        if (trail.geojson) {
          try {
            const parsedGeo = typeof trail.geojson === 'string' ? JSON.parse(trail.geojson) : trail.geojson;
            effectiveGeoJSON = sanitizeGeoJSON(parsedGeo);
          } catch {
            effectiveGeoJSON = null;
          }
        }

        // Fallback: If no GeoJSON trace in database, generate a realistic trail loop around start coords
        if (!effectiveGeoJSON && isValidLatLng(trail.lat, trail.lng)) {
          const lat = Number(trail.lat);
          const lng = Number(trail.lng);
          const dist = Number(trail.distance_km || 12);
          const r = (dist / 111) * 0.35;
          effectiveGeoJSON = {
            type: 'LineString',
            coordinates: [
              [lng, lat],
              [lng + r * 0.4, lat + r * 0.2],
              [lng + r * 0.7, lat + r * 0.6],
              [lng + r * 0.9, lat + r * 0.3],
              [lng + r * 1.1, lat + r * 0.8],
              [lng + r * 0.8, lat + r * 1.1],
              [lng + r * 0.3, lat + r * 0.9],
              [lng, lat],
            ],
          };
        }

        // 1. Render GeoJSON Trace ONLY IF SELECTED
        if (effectiveGeoJSON && isSelected) {
          try {
            const cleanGeo = effectiveGeoJSON;

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
              geoJsonLayer.on('click', (e: any) => {
                L.DomEvent.stopPropagation(e);
                onTrailClick?.(trail);
              });
              linesGroup.addLayer(geoJsonLayer);
            }

            // 2. Render MINIMALIST LIGHT GREEN DOT FOR START POINT ONLY (NO TEXT BADGE)
            let startCoords: [number, number] | null = null;
            const coords = cleanGeo.type === 'FeatureCollection'
              ? cleanGeo.features[0]?.geometry?.coordinates
              : cleanGeo.type === 'Feature'
              ? cleanGeo.geometry?.coordinates
              : cleanGeo.coordinates;

            if (Array.isArray(coords) && coords.length > 0) {
              const firstPt = Array.isArray(coords[0][0]) ? coords[0][0] : coords[0];
              if (Array.isArray(firstPt) && firstPt.length >= 2) {
                startCoords = [Number(firstPt[1]), Number(firstPt[0])];
              }
            }
            if (!startCoords && isValidLatLng(trail.lat, trail.lng)) {
              startCoords = [Number(trail.lat), Number(trail.lng)];
            }

            if (startCoords && isValidLatLng(startCoords[0], startCoords[1])) {
              const startHtml = `
                <div style="
                  position: relative;
                  width: 18px;
                  height: 18px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <div style="
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: #8BAF7C;
                    opacity: 0.35;
                    transform: scale(1.4);
                  "></div>
                  <div style="
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #4ADE80;
                    border: 2px solid #FFFFFF;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  "></div>
                </div>
              `;
              const startIcon = L.divIcon({ html: startHtml, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
              const startMarker = L.marker(startCoords, { icon: startIcon, zIndexOffset: 2500 });
              startMarker.on('click', (e: any) => {
                L.DomEvent.stopPropagation(e);
                onTrailClick?.(trail);
              });
              linesGroup.addLayer(startMarker);
            }
          } catch (e) {
            console.warn('Failed to parse GeoJSON for trail:', trail.name, e);
          }
        }

        // 3. Render KM Marker (Clean white pill style) added to Cluster
        const lat = Number(trail.lat);
        const lng = Number(trail.lng);
        if (isValidLatLng(trail.lat, trail.lng)) {
          const label = trail.distance_km ? `${Number(trail.distance_km).toFixed(1)}km`.replace('.', ',').replace(',0', '') : '';
          if (label) {
            const html = `
              <div style="
                background: ${isSelected ? '#17402C' : 'white'};
                color: ${isSelected ? 'white' : '#17402C'};
                font-weight: 700;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 999px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                white-space: nowrap;
                border: 1px solid ${isSelected ? '#17402C' : '#E8E4D8'};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              ">${label}</div>`;
            const icon = L.divIcon({ html, className: '', iconSize: [54, 24], iconAnchor: [27, 12] });
            const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 10 });
            marker.on('click', (e: any) => {
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

      // Store parent group reference
      const parentGroup = L.layerGroup([clusterGroup, linesGroup]);
      layerGroupRef.current = parentGroup;
    });

    return () => {
      isMounted = false;
      if (layerGroupRef.current && map) {
        try {
          if (typeof layerGroupRef.current.clearLayers === 'function') {
            layerGroupRef.current.clearLayers();
          }
          map.removeLayer(layerGroupRef.current);
        } catch {
          // ignore layer removal errors on cleanup
        }
      }
    };
  }, [map, trails, selectedTrailId, onTrailClick, progressFrac]);

  return null;
}