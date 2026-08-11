'use client';

import React, { useEffect, useRef } from 'react';

const PINS = [
  { id: 1, lat: 45.3, lng: 5.8, name: 'Bivouac Charmant Som' },
  { id: 2, lat: 45.28, lng: 5.85, name: 'Dent de Crolles' },
  { id: 3, lat: 45.32, lng: 5.78, name: 'Col de Porte' },
  { id: 4, lat: 45.25, lng: 5.82, name: 'Grand Som' },
];

export default function AventuresMiniMap() {
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
        center: [45.29, 5.81],
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      PINS.forEach((pin) => {
        L.circleMarker([pin.lat, pin.lng], {
          radius: 7,
          color: '#1C2620',
          fillColor: '#8BAF7C',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map).bindPopup(pin.name);
      });

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
    <div className="relative h-48 rounded-2xl overflow-hidden mx-4 mb-3 border border-[#1C2620]/15 shadow-sm">
      <div ref={containerRef} className="w-full h-full z-0" />
      <div className="absolute top-2 right-2 z-10 bg-[#1C2620]/80 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/20">
        📍 Carte d'aventures active
      </div>
    </div>
  );
}
