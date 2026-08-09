'use client';

import React, { useEffect, useRef } from 'react';

interface CarnetMapProps {
  traceGeojson?: any;
  distanceKm?: number;
  elevationM?: number;
  onDownloadGPX: () => void;
}

export default function CarnetMap({ traceGeojson, distanceKm, elevationM, onDownloadGPX }: CarnetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || !traceGeojson) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapRef.current) return;

      // Clean previous map instance if re-rendering
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      leafletInstance.current = map;

      // Topo tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      try {
        const geoLayer = L.geoJSON(traceGeojson, {
          style: {
            color: '#17402C',
            weight: 4,
            opacity: 0.85,
          },
        }).addTo(map);

        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30] });

          // Add Start Marker
          const coords = (traceGeojson.geometry?.coordinates || traceGeojson.coordinates || []) as [number, number][];
          if (coords.length > 0) {
            const startPt = coords[0];
            const endPt = coords[coords.length - 1];

            L.circleMarker([startPt[1], startPt[0]], {
              radius: 7,
              color: '#17402C',
              fillColor: '#2D5A27',
              fillOpacity: 1,
              weight: 2,
            }).addTo(map).bindPopup('🟢 Départ');

            L.circleMarker([endPt[1], endPt[0]], {
              radius: 7,
              color: '#B85838',
              fillColor: '#D96B43',
              fillOpacity: 1,
              weight: 2,
            }).addTo(map).bindPopup('🏁 Arrivée');
          }
        }
      } catch (err) {
        console.warn('[CarnetMap] Error rendering GeoJSON trace:', err);
      }
    });

    return () => {
      isMounted = false;
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, [traceGeojson]);

  return (
    <div className="bg-white rounded-[2rem] border border-[#1C2620]/10 shadow-sm overflow-hidden flex flex-col">
      {/* Map Container */}
      <div className="relative aspect-[4/3] bg-[#E7E3D6] overflow-hidden">
        {traceGeojson ? (
          <div ref={mapRef} className="w-full h-full z-0" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#6B7A72] space-y-2">
            <span className="text-3xl">🗺️</span>
            <p className="text-xs font-mono font-medium">Trace GPS non enregistrée pour cette session</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#1C2620]/5 bg-[#FBFAF6]">
        <p className="font-mono text-[11px] text-[#1C2620]/70">
          {distanceKm != null && distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : ''}
          {elevationM != null && elevationM > 0 ? ` · ${elevationM} m D+` : ''}
          {!distanceKm && !elevationM ? 'Données de parcours réelles' : ''}
        </p>
        {traceGeojson && (
          <button
            onClick={onDownloadGPX}
            className="font-mono text-[11px] font-semibold text-[#17402C] hover:text-[#0E291B] transition-colors flex items-center gap-1"
          >
            Télécharger GPX ↓
          </button>
        )}
      </div>
    </div>
  );
}
