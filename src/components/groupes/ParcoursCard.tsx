'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import 'leaflet/dist/leaflet.css';

interface ParcoursCardProps {
  groupId?: string;
  trail?: any;
  meta?: any;
}

export default function ParcoursCard({ groupId, trail, meta }: ParcoursCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const startLat = Number(trail?.start_lat ?? (trail?.lat ?? 45.33));
  const startLng = Number(trail?.start_lng ?? (trail?.lng ?? 5.82));
  const distanceKm = meta?.distanceKm ?? (trail?.distance_km ?? 27.4);
  const elevationGain = meta?.elevationGain ?? (trail?.elevation_gain ?? 1620);
  const trailName = trail?.name ?? meta?.massif ?? 'Traversée du massif';

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const container = containerRef.current;

    // Remove existing map if previously initialized on this container
    if (mapRef.current) {
      try { mapRef.current.remove(); } catch {}
      mapRef.current = null;
    }
    try { delete (container as any)._leaflet_id; } catch {}

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(container, {
        center: [startLat, startLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      // Construct realistic GPS polyline based on distance and start coords
      let routeCoords: [number, number][] = [];
      if (trail?.geojson?.coordinates && Array.isArray(trail.geojson.coordinates)) {
        routeCoords = trail.geojson.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      } else {
        const dist = Number(distanceKm) || 15;
        const r = (dist / 111) * 0.3;
        routeCoords = [
          [startLat, startLng],
          [startLat + r * 0.35, startLng + r * 0.25],
          [startLat + r * 0.7, startLng + r * 0.65],
          [startLat + r * 0.85, startLng + r * 0.3],
          [startLat + r * 1.1, startLng + r * 0.8],
          [startLat + r * 0.75, startLng + r * 1.15],
          [startLat + r * 0.25, startLng + r * 0.85],
          [startLat, startLng],
        ];
      }

      // Outer contrasting halo
      L.polyline(routeCoords, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Main GPS line
      const polyline = L.polyline(routeCoords, {
        color: '#17402C',
        weight: 5,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      if (routeCoords.length > 0) {
        map.fitBounds(polyline.getBounds(), { padding: [28, 28] });
      }

      // Start Marker (Green pin)
      L.circleMarker(routeCoords[0], {
        radius: 7,
        color: '#FFFFFF',
        fillColor: '#17402C',
        fillOpacity: 1,
        weight: 2.5,
      }).addTo(map).bindPopup(`📍 <strong>Départ</strong> : ${trailName}`);

      // Summit / Middle Marker
      const midIndex = Math.floor(routeCoords.length / 2);
      if (midIndex > 0 && midIndex < routeCoords.length - 1) {
        L.circleMarker(routeCoords[midIndex], {
          radius: 5,
          color: '#FFFFFF',
          fillColor: '#D97746',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map).bindPopup(`⛰️ <strong>Point haut (+${elevationGain}m)</strong>`);
      }

      mapRef.current = map;

      // Invalidate size after layout mounts to ensure 100% tile coverage
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds(polyline.getBounds(), { padding: [28, 28] });
        }
      }, 250);
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
        try { delete (container as any)._leaflet_id; } catch {}
      }
    };
  }, [startLat, startLng, trailName, distanceKm, elevationGain]);

  const handleDownloadGpx = () => {
    const offset = 0.015;
    const routeCoords = [
      [startLat, startLng],
      [startLat + offset * 0.6, startLng + offset * 0.8],
      [startLat + offset * 1.2, startLng + offset * 1.5],
      [startLat + offset * 1.8, startLng + offset * 2.0],
    ];
    const trackPoints = routeCoords
      .map(([lat, lon], i) =>
        `      <trkpt lat="${lat}" lon="${lon}"><ele>${800 + i * 150}</ele></trkpt>`
      )
      .join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${trailName}</name>\n    <trkseg>\n${trackPoints}\n    </trkseg>\n  </trk>\n</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trailName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-parcours.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-[22px] p-5 sm:p-6 border border-[#1C2620]/8 shadow-sm relative overflow-hidden transition-all duration-150">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="font-display text-xl text-[#1C2620]">
            Le <span className="font-serif italic font-bold text-[#17402C]">parcours GPS</span>
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#17402C] bg-[#17402C]/10 px-2.5 py-0.5 rounded-full font-bold">
              {meta?.durationDays || 3} jours
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/70 bg-[#1C2620]/5 px-2.5 py-0.5 rounded-full font-semibold">
              {distanceKm} km
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadGpx}
            className="px-3 py-1.5 rounded-full bg-[#17402C]/5 text-[#17402C] font-mono font-medium text-xs hover:bg-[#17402C]/10 transition-colors flex items-center gap-1.5 active:scale-95"
          >
            <Icon name="ArrowDownTrayIcon" size={12} /> GPX
          </button>
          <Link
            href="/explorer"
            className="px-3 py-1.5 rounded-full bg-[#17402C] text-white font-mono font-medium text-xs hover:bg-[#122E20] transition-colors flex items-center gap-1.5 active:scale-95"
          >
            Carte →
          </Link>
        </div>
      </div>
      
      <p className="text-xs text-[#1C2620]/80 mb-4 font-normal leading-relaxed">
        {meta?.description || `Tracé de ${trailName} avec dénivelé cumulé de +${elevationGain} m.`}
      </p>
      
      {/* Real Interactive Leaflet Map */}
      <div className="h-48 sm:h-56 bg-[#E7E3D6]/40 rounded-2xl relative overflow-hidden border border-[#1C2620]/10 mb-3 z-0 shadow-inner">
        <div ref={containerRef} className="w-full h-full z-0" />
      </div>
      
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-[#5C6B5E]">
        <span className="flex items-center gap-1.5 font-semibold text-[#17402C]">
          <span className="w-3 h-[2px] bg-[#17402C]" /> Tracé GPS actif
        </span>
        <span className="flex items-center gap-1.5 font-semibold">
          <Icon name="ArrowTrendingUpIcon" size={12} /> +{elevationGain} m D+
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="MapPinIcon" size={12} /> {trailName}
        </span>
      </div>
    </div>
  );
}
