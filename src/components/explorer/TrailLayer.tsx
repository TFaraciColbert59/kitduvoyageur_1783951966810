'use client';
import { useRef, useEffect } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { MapTrail } from './types';
import { isValidLatLng, sanitizeGeoJSON } from './types';
import { sliceRouteGeoJSON } from '@/features/hiking/services/RouteGeom';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import type { UnifiedPOI } from '@/lib/queries/pois';

interface TrailLayerProps {
  map: LeafletMap;
  trails: MapTrail[];
  pois?: UnifiedPOI[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
  onPoiClick?: (poi: UnifiedPOI) => void;
  progressFrac?: number | null;
}

export default function TrailLayer({ map, trails, pois, selectedTrailId, onTrailClick, onPoiClick, progressFrac }: TrailLayerProps) {
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

      // On-demand fetch of selected trail GeoJSON if missing
      let selectedGeo = null;
      if (selectedTrailId) {
        const found = trails.find((t) => String(t.id) === String(selectedTrailId));
        if (found && found.geojson) {
          selectedGeo = found.geojson;
        } else {
          try {
            const res = await fetch(`/api/hikes/${selectedTrailId}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.geojson) selectedGeo = data.geojson;
            }
          } catch (e) {
            console.warn('[TrailLayer] Failed to fetch selected hike GeoJSON:', e);
          }
        }
      }

      // Render single selected GPS trace
      if (selectedGeo && isMounted) {
        try {
          const parsed = typeof selectedGeo === 'string' ? JSON.parse(selectedGeo) : selectedGeo;
          const cleanGeo = sanitizeGeoJSON(parsed) || (parsed.type ? parsed : { type: 'Feature', geometry: parsed, properties: {} });

          if (cleanGeo) {
            // Glow / casing
            const casingLayer = L.geoJSON(cleanGeo as any, {
              style: {
                color: '#5B7F55',
                weight: 10,
                opacity: 0.35,
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
              // Sharp Forest Green route track
              const geoJsonLayer = L.geoJSON(cleanGeo as any, {
                style: {
                  color: '#17402C',
                  weight: 5,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round',
                },
              });
              linesGroup.addLayer(geoJsonLayer);
            }

            // Fit map bounds to selected trace
            try {
              const boundsLayer = L.geoJSON(cleanGeo as any);
              const b = boundsLayer.getBounds();
              if (b && b.isValid()) {
                map.fitBounds(b, { padding: [60, 60], maxZoom: 15 });
              }
            } catch {}
          }
        } catch (e) {
          console.warn('[TrailLayer] Error rendering selected GeoJSON:', e);
        }
      }

      trails.forEach((trail) => {
        const isSelected = trails.length === 1 || (selectedTrailId != null && String(trail.id) === String(selectedTrailId));

        if (isSelected && isValidLatLng(trail.lat, trail.lng)) {
          const startCoords: [number, number] = [Number(trail.lat), Number(trail.lng)];
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

        // 3. Render KM Marker (Clean white pill style) added to Cluster
        const lat = Number(trail.lat);
        const lng = Number(trail.lng);
        if (isValidLatLng(trail.lat, trail.lng)) {
          const label = trail.distance_km ? `${Number(trail.distance_km).toFixed(1)}km`.replace('.', ',').replace(',0', '') : '';
          if (label) {
            const html = `
              <div style="
                background: ${isSelected ? 'linear-gradient(180deg, rgba(23,64,44,0.92) 0%, rgba(15,43,30,0.96) 100%)' : 'linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(245, 241, 233, 0.75) 100%)'};
                color: ${isSelected ? '#FAF8F5' : '#17402C'};
                font-weight: 700;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 9999px;
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.9), 0 2px 8px rgba(23,64,44,0.12);
                white-space: nowrap;
                border: 1.5px solid ${isSelected ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.85)'};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.15s ease;
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

      // 4. Render POIs if present
      const poiGroup = typeof (L as any).markerClusterGroup === 'function'
        ? (L as any).markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 35,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: function (cluster: any) {
              const count = cluster.getChildCount();
              const html = `
                <div style="
                  background: #2D6B4A;
                  color: white;
                  font-weight: 700;
                  font-size: 11px;
                  width: 28px;
                  height: 28px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 6px rgba(45,107,74,0.35);
                  border: 2px solid white;
                ">📍${count}</div>
              `;
              return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
            }
          })
        : L.layerGroup();

      if (pois && pois.length > 0) {
        pois.forEach((poi) => {
          if (!isValidLatLng(poi.lat, poi.lng)) return;
          let emoji = '👁️';
          let bgColor = '#7C3AED';
          switch (poi.category) {
            case 'refuge': emoji = '🏡'; bgColor = '#17402C'; break;
            case 'summit': case 'col': emoji = '⛰️'; bgColor = '#2D6B4A'; break;
            case 'water': emoji = '💧'; bgColor = '#0284C7'; break;
            case 'waterfall': emoji = '🌊'; bgColor = '#0EA5E9'; break;
            case 'camping': emoji = '⛺'; bgColor = '#16A34A'; break;
            default: emoji = '👁️'; bgColor = '#7C3AED'; break;
          }

          const poiIcon = L.divIcon({
            html: `
              <div style="
                background-color: ${bgColor};
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                font-size: 13px;
                cursor: pointer;
              ">${emoji}</div>
            `,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14],
          });

          const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon, zIndexOffset: 2000 });
          marker.bindPopup(`
            <div style="padding: 6px; font-family: system-ui; min-width: 150px;">
              <strong style="font-size: 13px; color: #17402C; display: block; margin-bottom: 2px;">${emoji} ${poi.name}</strong>
              ${poi.altitude_m ? `<span style="font-size: 11px; font-weight: 600; color: #5B7F55; display: block;">📈 ${poi.altitude_m}m</span>` : ''}
              <p style="font-size: 11px; color: #365233; margin: 2px 0 0 0;">${poi.details || 'Point d\'intérêt'}</p>
            </div>
          `);
          marker.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            onPoiClick?.(poi);
          });
          poiGroup.addLayer(marker);
        });
      }

      // Add all layers to map
      clusterGroup.addTo(map);
      poiGroup.addTo(map);
      linesGroup.addTo(map);

      // Store parent group reference
      const parentGroup = L.layerGroup([clusterGroup, poiGroup, linesGroup]);
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
  }, [map, trails, pois, selectedTrailId, onTrailClick, onPoiClick, progressFrac]);

  return null;
}