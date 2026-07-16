'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Trail {
  id: string;
  name: string;
  difficulty: string;
  distance_km: number;
  elevation_gain_m: number;
  duration_hours: number;
  region: string;
  tags: string[];
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  is_loop: boolean;
  is_verified: boolean;
}

interface Refuge {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  altitude_m: number;
  capacity: number;
  is_staffed: boolean;
  price_per_night: number;
  has_meals: boolean;
  region: string;
  tags: string[];
  is_verified: boolean;
}

interface WaterPoint {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  altitude_m: number;
  water_type: string;
  is_potable: boolean;
  is_seasonal: boolean;
  region: string;
  is_verified: boolean;
}

interface Summit {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  altitude_m: number;
  prominence_m: number;
  difficulty: string;
  best_season: string[];
  region: string;
  massif: string;
  tags: string[];
  is_verified: boolean;
}

interface MapData {
  trails: Trail[];
  refuges: Refuge[];
  waterPoints: WaterPoint[];
  summits: Summit[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f59e0b',
  hard: '#ef4444',
  expert: '#7c3aed',
  technical: '#1e1b4b',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  moderate: 'Modéré',
  hard: 'Difficile',
  expert: 'Expert',
  technical: 'Technique',
};

export default function InteractiveMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const [mapData, setMapData] = useState<MapData>({ trails: [], refuges: [], waterPoints: [], summits: [] });
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState({ trails: true, refuges: true, water: true, summits: true });

  // Load map data
  useEffect(() => {
    fetch('/api/map/pois')
      .then(r => r.json())
      .then(data => {
        setMapData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Initialize and render map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;
    if (mapInitialized.current) return;
    mapInitialized.current = true;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default;

      // Fix default icon paths for Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current!, {
        center: [45.5, 6.5],
        zoom: 7,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const trailsGroup = L.layerGroup().addTo(map);
      const refugesGroup = L.layerGroup().addTo(map);
      const waterGroup = L.layerGroup().addTo(map);
      const summitsGroup = L.layerGroup().addTo(map);

      // ── Trails ──────────────────────────────────────────────
      if (layers.trails) {
        mapData.trails.forEach(trail => {
          if (!trail.start_lat || !trail.start_lng) return;
          const color = DIFFICULTY_COLORS[trail.difficulty] || '#6b7280';

          const coords: [number, number][] = [[trail.start_lat, trail.start_lng]];
          if (trail.end_lat && trail.end_lng && !trail.is_loop) {
            coords.push([trail.end_lat, trail.end_lng]);
          }

          const polyline = L.polyline(coords, {
            color,
            weight: 4,
            opacity: 0.8,
            dashArray: trail.is_loop ? '8, 4' : undefined,
          });

          const startIcon = L.divIcon({
            html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const marker = L.marker([trail.start_lat, trail.start_lng], { icon: startIcon });

          const popupContent = `
            <div style="min-width:220px;font-family:sans-serif">
              <div style="background:${color};color:white;padding:8px 12px;border-radius:6px 6px 0 0;margin:-12px -12px 8px -12px">
                <strong style="font-size:14px">&#x1F97E; ${trail.name}</strong>
              </div>
              <div style="padding:0 4px">
                <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty}</span>
                <div style="margin-top:8px;font-size:12px;color:#374151;line-height:1.6">
                  &#x1F4CF; <strong>${trail.distance_km} km</strong> &nbsp;|&nbsp; &#x2B06;&#xFE0F; <strong>${trail.elevation_gain_m}m D+</strong><br/>
                  &#x23F1;&#xFE0F; <strong>${trail.duration_hours}h</strong> &nbsp;|&nbsp; &#x1F4CD; ${trail.region}
                </div>
                ${trail.tags?.length ? `<div style="margin-top:6px">${trail.tags.slice(0,3).map((t: string) => `<span style="background:#f3f4f6;padding:2px 6px;border-radius:8px;font-size:10px;margin-right:4px">${t}</span>`).join('')}</div>` : ''}
              </div>
            </div>
          `;

          marker.bindPopup(popupContent, { maxWidth: 280 });
          polyline.bindPopup(popupContent, { maxWidth: 280 });

          trailsGroup.addLayer(polyline);
          trailsGroup.addLayer(marker);
        });
      }

      // ── Refuges ──────────────────────────────────────────────
      if (layers.refuges) {
        mapData.refuges.forEach(refuge => {
          if (!refuge.lat || !refuge.lng) return;

          const icon = L.divIcon({
            html: `<div style="background:#1e40af;color:white;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid white">&#x1F3E0;</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const marker = L.marker([refuge.lat, refuge.lng], { icon });
          marker.bindPopup(`
            <div style="min-width:220px;font-family:sans-serif">
              <div style="background:#1e40af;color:white;padding:8px 12px;border-radius:6px 6px 0 0;margin:-12px -12px 8px -12px">
                <strong style="font-size:14px">&#x1F3E0; ${refuge.name}</strong>
              </div>
              <div style="padding:0 4px;font-size:12px;color:#374151;line-height:1.8">
                &#x26F0;&#xFE0F; Altitude: <strong>${refuge.altitude_m}m</strong><br/>
                &#x1F465; Capacite: <strong>${refuge.capacity} pers.</strong><br/>
                ${refuge.is_staffed ? '&#x2705; Garde' : '&#x1F513; Non garde'} &nbsp;|&nbsp; ${refuge.has_meals ? '&#x1F37D;&#xFE0F; Repas' : '&#x1F372; Cuisine'}<br/>
                ${refuge.price_per_night ? `&#x1F4B6; <strong>${refuge.price_per_night}EUR/nuit</strong><br/>` : ''}
                &#x1F4CD; ${refuge.region}
              </div>
            </div>
          `, { maxWidth: 260 });

          refugesGroup.addLayer(marker);
        });
      }

      // ── Water Points ─────────────────────────────────────────
      if (layers.water) {
        mapData.waterPoints.forEach(wp => {
          if (!wp.lat || !wp.lng) return;

          const icon = L.divIcon({
            html: `<div style="background:#0891b2;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);border:2px solid white">&#x1F4A7;</div>`,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const marker = L.marker([wp.lat, wp.lng], { icon });
          marker.bindPopup(`
            <div style="min-width:180px;font-family:sans-serif">
              <div style="background:#0891b2;color:white;padding:8px 12px;border-radius:6px 6px 0 0;margin:-12px -12px 8px -12px">
                <strong>&#x1F4A7; ${wp.name || 'Point eau'}</strong>
              </div>
              <div style="font-size:12px;color:#374151;line-height:1.8">
                &#x1F3F7;&#xFE0F; ${wp.water_type} &nbsp;|&nbsp; ${wp.is_potable ? '&#x2705; Potable' : '&#x26A0;&#xFE0F; Non potable'}<br/>
                ${wp.is_seasonal ? '&#x1F338; Saisonnier' : '&#x1F504; Permanent'}<br/>
                ${wp.altitude_m ? `&#x26F0;&#xFE0F; ${wp.altitude_m}m` : ''} &#x1F4CD; ${wp.region}
              </div>
            </div>
          `, { maxWidth: 240 });

          waterGroup.addLayer(marker);
        });
      }

      // ── Summits ──────────────────────────────────────────────
      if (layers.summits) {
        mapData.summits.forEach(summit => {
          if (!summit.lat || !summit.lng) return;
          const color = DIFFICULTY_COLORS[summit.difficulty] || '#6b7280';

          const icon = L.divIcon({
            html: `<div style="background:${color};color:white;padding:3px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.4)">&#x25B2; ${summit.altitude_m}m</div>`,
            className: '',
            iconSize: [80, 24],
            iconAnchor: [40, 12],
          });

          const marker = L.marker([summit.lat, summit.lng], { icon });
          marker.bindPopup(`
            <div style="min-width:220px;font-family:sans-serif">
              <div style="background:${color};color:white;padding:8px 12px;border-radius:6px 6px 0 0;margin:-12px -12px 8px -12px">
                <strong style="font-size:14px">&#x25B2; ${summit.name}</strong>
              </div>
              <div style="font-size:12px;color:#374151;line-height:1.8">
                &#x26F0;&#xFE0F; Altitude: <strong>${summit.altitude_m}m</strong><br/>
                ${summit.prominence_m ? `Prominence: <strong>${summit.prominence_m}m</strong><br/>` : ''}
                Difficulte: <strong>${DIFFICULTY_LABELS[summit.difficulty] || summit.difficulty}</strong><br/>
                ${summit.massif ? `Massif: ${summit.massif}<br/>` : ''}
                &#x1F4CD; ${summit.region}
                ${summit.best_season?.length ? `<br/>Saison: ${summit.best_season.join(', ')}` : ''}
              </div>
            </div>
          `, { maxWidth: 260 });

          summitsGroup.addLayer(marker);
        });
      }

      // Cleanup on unmount
      return () => {
        map.remove();
        mapInitialized.current = false;
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full rounded-xl" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1C2620]/80 rounded-xl z-[1000]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white text-sm">Chargement de la carte...</p>
          </div>
        </div>
      )}

      {/* Layer controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-[#1C2620]/95 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-white/10 space-y-2 min-w-[160px]">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Couches</p>
        {[
          { key: 'trails', icon: '&#x1F97E;', label: 'Sentiers', color: '#f59e0b' },
          { key: 'refuges', icon: '&#x1F3E0;', label: 'Refuges', color: '#1e40af' },
          { key: 'water', icon: '&#x1F4A7;', label: "Points d'eau", color: '#0891b2' },
          { key: 'summits', icon: '&#x25B2;', label: 'Sommets', color: '#ef4444' },
        ].map(({ key, icon, label, color }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key as keyof typeof layers)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              layers[key as keyof typeof layers]
                ? 'bg-white/10 text-white' :'text-white/40 hover:text-white/60'
            }`}
          >
            <span className="text-base" dangerouslySetInnerHTML={{ __html: icon }} />
            <span className="flex-1 text-left">{label}</span>
            <span
              className={`w-2 h-2 rounded-full transition-all ${layers[key as keyof typeof layers] ? 'opacity-100' : 'opacity-20'}`}
              style={{ background: color }}
            />
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="absolute bottom-4 left-4 z-[1000] flex gap-2 flex-wrap">
          {[
            { count: mapData.trails.length, label: 'sentiers' },
            { count: mapData.refuges.length, label: 'refuges' },
            { count: mapData.waterPoints.length, label: 'sources' },
            { count: mapData.summits.length, label: 'sommets' },
          ].map(({ count, label }) => (
            <div key={label} className="bg-[#1C2620]/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
              <strong>{count}</strong>
              <span className="text-white/60">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
