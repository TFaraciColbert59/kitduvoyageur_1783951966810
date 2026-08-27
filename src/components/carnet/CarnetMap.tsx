'use client';

import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import 'leaflet/dist/leaflet.css';

interface CarnetMapProps {
  traceGeojson?: any;
  distanceKm?: number;
  elevationM?: number;
  destination?: string;
  onDownloadGPX?: () => void;
}

export default function CarnetMap({
  traceGeojson,
  distanceKm,
  elevationM,
  destination,
  onDownloadGPX,
}: CarnetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Default coordinate centers
  const defaultLat = destination?.toLowerCase().includes('islande') || destination?.toLowerCase().includes('iceland')
    ? 64.96
    : destination?.toLowerCase().includes('vercors')
    ? 44.98
    : 45.33; // Chartreuse / Alpes
  const defaultLng = destination?.toLowerCase().includes('islande') || destination?.toLowerCase().includes('iceland')
    ? -19.02
    : destination?.toLowerCase().includes('vercors')
    ? 5.43
    : 5.82;

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let isMounted = true;
    const container = containerRef.current;

    // Clean any prior instance
    if (mapInstance.current) {
      try {
        mapInstance.current.remove();
      } catch {}
      mapInstance.current = null;
    }
    try {
      delete (container as any)._leaflet_id;
    } catch {}

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(container, {
        center: [defaultLat, defaultLng],
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstance.current = map;

      // OpenStreetMap France tiles (Zero watermark, high resolution)
      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 19,
        maxNativeZoom: 18,
        subdomains: ['a', 'b', 'c'],
        keepBuffer: 8,
      }).addTo(map);

      // Extract or synthesize coordinates
      let routeCoords: [number, number][] = [];

      if (traceGeojson?.geometry?.coordinates && Array.isArray(traceGeojson.geometry.coordinates)) {
        routeCoords = traceGeojson.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      } else if (traceGeojson?.coordinates && Array.isArray(traceGeojson.coordinates)) {
        routeCoords = traceGeojson.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      } else if (Array.isArray(traceGeojson) && traceGeojson.length > 0) {
        routeCoords = traceGeojson.map((pt: any) => [pt.lat || pt[1], pt.lng || pt[0]]);
      } else {
        const dist = Number(distanceKm) || 27.4;
        const r = (dist / 111) * 0.4;
        routeCoords = [
          [defaultLat, defaultLng],
          [defaultLat + r * 0.35, defaultLng + r * 0.25],
          [defaultLat + r * 0.7, defaultLng + r * 0.65],
          [defaultLat + r * 0.85, defaultLng + r * 0.3],
          [defaultLat + r * 1.1, defaultLng + r * 0.8],
          [defaultLat + r * 0.75, defaultLng + r * 1.15],
          [defaultLat + r * 0.25, defaultLng + r * 0.85],
          [defaultLat, defaultLng],
        ];
      }

      if (routeCoords.length > 0) {
        // Outer glow
        L.polyline(routeCoords, {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Core line
        const polyline = L.polyline(routeCoords, {
          color: '#17402C',
          weight: 4.5,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        try {
          map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
        } catch {}

        // Start marker
        L.circleMarker(routeCoords[0], {
          radius: 7,
          color: '#FFFFFF',
          fillColor: '#17402C',
          fillOpacity: 1,
          weight: 2.5,
        }).addTo(map).bindPopup('🟢 <strong>Départ de l’étape</strong>');

        // High point marker
        const midIndex = Math.floor(routeCoords.length / 2);
        if (midIndex > 0 && midIndex < routeCoords.length - 1) {
          L.circleMarker(routeCoords[midIndex], {
            radius: 6,
            color: '#FFFFFF',
            fillColor: '#D97746',
            fillOpacity: 1,
            weight: 2,
          }).addTo(map).bindPopup(`⛰️ <strong>Point culminant (+${elevationM || 1620}m)</strong>`);
        }

        // Finish marker
        L.circleMarker(routeCoords[routeCoords.length - 1], {
          radius: 7,
          color: '#FFFFFF',
          fillColor: '#B85838',
          fillOpacity: 1,
          weight: 2.5,
        }).addTo(map).bindPopup('🏁 <strong>Arrivée</strong>');
      }

      // Invalidate sizes repeatedly on render ticks
      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 100);
      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 400);

      setMapLoaded(true);
    });

    // ResizeObserver to automatically resize map when container shifts
    const observer = new ResizeObserver(() => {
      if (mapInstance.current) {
        try {
          mapInstance.current.invalidateSize();
        } catch {}
      }
    });
    observer.observe(container);

    return () => {
      isMounted = false;
      observer.disconnect();
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch {}
        mapInstance.current = null;
      }
    };
  }, [traceGeojson, distanceKm, elevationM, defaultLat, defaultLng]);

  const handleZoomIn = () => {
    if (mapInstance.current) mapInstance.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstance.current) mapInstance.current.zoomOut();
  };

  return (
    <div className="glass bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col border border-white shadow-sm w-full">
      {/* Header bar above map */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/80 border-b border-[#17402C]/10 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-display font-bold text-[#17402C]">Trace GPS &amp; Relief 3D</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 rounded-md bg-white border border-[#17402C]/15 flex items-center justify-center text-xs font-bold text-[#17402C] hover:bg-emerald-50 active:scale-95"
            title="Zoom avant"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 rounded-md bg-white border border-[#17402C]/15 flex items-center justify-center text-xs font-bold text-[#17402C] hover:bg-emerald-50 active:scale-95"
            title="Zoom arrière"
          >
            -
          </button>
        </div>
      </div>

      {/* Map Container with explicit pixel height */}
      <div className="relative w-full h-[360px] bg-[#E7E3D6] overflow-hidden">
        <div ref={containerRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#17402C]/10 bg-white/80 shrink-0">
        <p className="font-mono text-xs text-[#17402C] font-semibold">
          {distanceKm != null && distanceKm > 0 ? `${distanceKm} km` : '27.4 km'}
          {elevationM != null && elevationM > 0 ? ` · ${elevationM} m D+` : ' · 1620 m D+'}
        </p>
        {onDownloadGPX && (
          <button
            type="button"
            onClick={onDownloadGPX}
            className="glass-capsule-btn primary py-1 px-3 text-xs font-bold flex items-center gap-1.5"
          >
            <Icon name="ArrowDownTrayIcon" size={13} className="relative z-10" />
            <span className="relative z-10">Télécharger GPX</span>
          </button>
        )}
      </div>
    </div>
  );
}
