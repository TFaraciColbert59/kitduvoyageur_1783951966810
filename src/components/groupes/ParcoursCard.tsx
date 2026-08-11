'use client';

import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

export default function ParcoursCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [45.33, 5.82],
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      // Real trail route line
      const routeCoords: [number, number][] = [
        [45.31, 5.78],
        [45.325, 5.81],
        [45.34, 5.83],
        [45.355, 5.85],
      ];

      const polyline = L.polyline(routeCoords, {
        color: '#17402C',
        weight: 5,
        opacity: 0.9,
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

      // Start & Finish markers
      L.circleMarker(routeCoords[0], {
        radius: 6,
        color: '#17402C',
        fillColor: '#2D5A27',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map).bindPopup('Point de départ');

      L.circleMarker(routeCoords[routeCoords.length - 1], {
        radius: 6,
        color: '#B85838',
        fillColor: '#D96B43',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map).bindPopup('🏁 Arrivée: Col de la Chamette');

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-display text-xl text-[#1C2620]">Le <span className="font-serif italic font-bold">parcours</span></h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">3 étapes</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">27,4 km</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Icon name="ArrowDownTrayIcon" size={12} /> GPX
          </button>
          <button className="px-3 py-1.5 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors cursor-pointer">
            Modifier
          </button>
        </div>
      </div>
      
      <p className="text-sm text-[#1C2620]/80 mb-6 font-sans">
        Saint-Pierre-de-Chartreuse — Charmant Som — Grand Vaneau — Col de la Chamette. Deux nuits en refuge gardé.
      </p>
      
      {/* Real Interactive Leaflet Map */}
      <div className="h-48 bg-[#E7E3D6]/50 rounded-xl relative overflow-hidden border border-[#1C2620]/10 mb-4 z-0">
        <div ref={containerRef} className="w-full h-full z-0" />
      </div>
      
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-[#1C2620]/60">
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[#17402C]" /> Tracé GPS principal</span>
        <span className="flex items-center gap-1.5"><Icon name="ArrowTrendingUpIcon" size={12} /> 1 620 m D+</span>
        <span className="flex items-center gap-1.5"><Icon name="HomeIcon" size={12} /> 3 refuges</span>
      </div>
    </div>
  );
}
