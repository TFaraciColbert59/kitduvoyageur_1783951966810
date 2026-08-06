'use client';
import { useRef, useCallback, useEffect } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import type { MapTrail } from './types';
import { getDifficultyColor } from './types';

interface TrailLayerProps {
  map: LeafletMap;
  trails: MapTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
}

import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export default function TrailLayer({ map, trails, selectedTrailId, onTrailClick }: TrailLayerProps) {
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
        
        let greenColor = '#4ade80';
        switch ((trail.difficulty || '').toLowerCase()) {
          case 'facile': greenColor = '#86efac'; break;
          case 'modérée':
          case 'moderate': greenColor = '#4ade80'; break;
          case 'difficile':
          case 'difficult': greenColor = '#22c55e'; break;
          case 'expert':
          case 'très difficile': greenColor = '#16a34a'; break;
        }

        // 1. Render GeoJSON Trace ONLY IF SELECTED (Hide by default)
        if (trail.geojson && isSelected) {
          try {
            const geoJsonLayer = L.geoJSON(trail.geojson as any, {
              style: {
                color: '#1C2620',
                weight: 6,
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

            // Auto-fit bounds if selected
            try {
              const bounds = geoJsonLayer.getBounds();
              if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true });
              }
            } catch {
              // ignore bounds fitting errors
            }
          } catch (e) {
            console.warn('Failed to parse GeoJSON for trail:', trail.name, e);
          }
        }

        // 2. Render KM Marker (Clean white pill style) added to Cluster!
        if (trail.lat && trail.lng && !isNaN(trail.lat) && !isNaN(trail.lng)) {
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
            const marker = L.marker([trail.lat, trail.lng], { icon, zIndexOffset: isSelected ? 1000 : 10 });
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
  }, [map, trails, selectedTrailId, onTrailClick]);

  return null;
}