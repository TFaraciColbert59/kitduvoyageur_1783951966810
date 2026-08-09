'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import type { MapTrail } from './types';
import { isValidLatLng, toValidLatLng } from './types';
import TrailLayer from './TrailLayer';

interface ExplorerMapProps {
  trails: MapTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
  userLocation?: [number, number] | null;
  userPositions?: Array<{ latitude: number; longitude: number }>;
  userAccuracy?: number | null;
  headingDeg?: number | null;
  autoFollow?: boolean;
  onAutoFollowChange?: (enabled: boolean) => void;
  onMapReady?: () => void;
  onLocationUpdate?: (loc: [number, number]) => void;
}

const TOPO_TILE = {
  url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
};

const OSM_TILE = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

type TileMode = 'topo' | 'osm';
type LocationState = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable';

export default function ExplorerMap({
  trails,
  selectedTrailId,
  onTrailClick,
  userLocation,
  userPositions,
  userAccuracy = null,
  headingDeg,
  autoFollow = true,
  onAutoFollowChange,
  onMapReady,
  onLocationUpdate,
}: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<ReturnType<typeof import('leaflet')['tileLayer']> | null>(null);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const accuracyCircleRef = useRef<import('leaflet').Circle | null>(null);
  const userTrackPolylineRef = useRef<import('leaflet').Polyline | null>(null);
  const userDraggingRef = useRef(false);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [mapReady, setMapReady] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const geoAttemptedRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      // Clear any pre-existing Leaflet container instance
      if ((containerRef.current as any)?._leaflet_id) {
        (containerRef.current as any)._leaflet_id = null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [46.5, 2.5],
        zoom: 6,
        zoomControl: false,
        attributionControl: true,
      });

      map.on('dragstart', () => {
        userDraggingRef.current = true;
        onAutoFollowChange?.(false);
      });
      map.on('dragend', () => { userDraggingRef.current = false; });

      L.control.zoom({ position: 'topright' }).addTo(map);

      const tile = L.tileLayer(TOPO_TILE.url, {
        attribution: TOPO_TILE.attribution,
        maxZoom: 17,
      });
      tile.addTo(map);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tileLayerRef.current = tile as any;

      mapRef.current = map;
      setMapInstance(map);
      setMapReady(true);
      onMapReady?.();
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* ignore */ }
        mapRef.current = null;
      }
      if (containerRef.current) {
        (containerRef.current as any)._leaflet_id = null;
      }
      setMapInstance(null);
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-geolocation on mount — fires as soon as map is ready
  useEffect(() => {
    if (!mapReady || geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    if (!navigator.geolocation) {
      setLocationState('unavailable');
      return;
    }

    setLocationState('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const validPos = toValidLatLng(latitude, longitude);
        if (validPos) {
          setLocationState('located');
          onLocationUpdate?.(validPos);
          if (mapRef.current) {
            mapRef.current.flyTo(validPos, 13, { duration: 1.5 });
          }
        }
      },
      () => {
        setLocationState('denied');
        // Fallback: France center
        if (mapRef.current) {
          mapRef.current.flyTo([46.6, 2.5], 5, { duration: 1.0 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [mapReady, onLocationUpdate]);

  // Switch tile layer
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    import('leaflet').then((L) => {
      if (tileLayerRef.current) {
        try { mapRef.current!.removeLayer(tileLayerRef.current as unknown as import('leaflet').Layer); } catch { /* ignore */ }
      }
      const cfg = tileMode === 'topo' ? TOPO_TILE : OSM_TILE;
      const tile = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 17 });
      tile.addTo(mapRef.current!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tileLayerRef.current = tile as any;
    });
  }, [tileMode, mapReady]);

  // User location marker & accuracy circle (from prop) — orienté par le heading GPS réel si dispo,
  // sinon point neutre (jamais d'orientation inventée).
  useEffect(() => {
    const validLoc = userLocation ? toValidLatLng(userLocation[0], userLocation[1]) : null;
    if (!mapRef.current || !mapReady || !validLoc) return;
    import('leaflet').then((L) => {
      if (userMarkerRef.current) {
        try { mapRef.current!.removeLayer(userMarkerRef.current); } catch { /* ignore */ }
      }
      if (accuracyCircleRef.current) {
        try { mapRef.current!.removeLayer(accuracyCircleRef.current); } catch { /* ignore */ }
      }

      // Cercle d'incertitude GPS (accuracyM)
      if (userAccuracy != null && Number.isFinite(userAccuracy) && userAccuracy > 0) {
        const circle = L.circle(validLoc, {
          radius: Math.min(200, userAccuracy),
          color: userAccuracy > 30 ? '#f59e0b' : '#2D5A27',
          fillColor: userAccuracy > 30 ? '#f59e0b' : '#2D5A27',
          fillOpacity: 0.15,
          weight: 1,
        });
        circle.addTo(mapRef.current!);
        accuracyCircleRef.current = circle;
      }

      const heading = headingDeg != null && Number.isFinite(headingDeg) && headingDeg >= 0 && headingDeg < 360
        ? Math.round(headingDeg)
        : null;

      const html = heading != null
        ? `<div style="position:relative;width:18px;height:18px">
             <div style="position:absolute;inset:0;background:#2D5A27;border:3px solid #8BAF7C;border-radius:50%;box-shadow:0 0 0 4px #2D5A2740"></div>
             <svg width="16" height="16" viewBox="0 0 24 24" style="position:absolute;top:1px;left:1px;transform:rotate(${heading}deg);transform-origin:center">
               <path d="M12 2 L7 22 L12 17 L17 22 Z" fill="#2D5A27" stroke="#FBFAF6" stroke-width="1.5"/>
             </svg>
           </div>`
        : `<div style="width:14px;height:14px;background:#2D5A27;border:3px solid #8BAF7C;border-radius:50%;box-shadow:0 0 0 4px #2D5A2740"></div>`;

      const icon = L.divIcon({
        html,
        className: '',
        iconSize: heading != null ? [18, 18] : [14, 14],
        iconAnchor: heading != null ? [9, 9] : [7, 7],
      });
      const marker = L.marker(validLoc, { icon });
      marker.addTo(mapRef.current!);
      userMarkerRef.current = marker;
    });
  }, [userLocation, userAccuracy, headingDeg, mapReady]);

  // Live GPS Track Polyline (from userPositions)
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userPositions || userPositions.length < 2) return;
    import('leaflet').then((L) => {
      const validLatLngs: [number, number][] = [];
      for (const p of userPositions) {
        const pt = toValidLatLng(p?.latitude, p?.longitude);
        if (pt) validLatLngs.push(pt);
      }
      if (validLatLngs.length < 2) return;

      if (userTrackPolylineRef.current) {
        userTrackPolylineRef.current.setLatLngs(validLatLngs);
      } else {
        const polyline = L.polyline(validLatLngs, {
          color: '#ef4444',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        });
        polyline.addTo(mapRef.current!);
        userTrackPolylineRef.current = polyline;
      }
    });
  }, [userPositions, mapReady]);

  // Auto-follow GPS pendant une randonnée active (userPositions fourni) :
  // la carte suit la position réelle, sauf si l'utilisateur est en train de
  // faire glisser la carte (il reprend la main à ce moment-là).
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userPositions || userPositions.length < 2) return;
    if (userDraggingRef.current) return;

    let lastValid: [number, number] | null = null;
    for (const p of userPositions) {
      const pt = toValidLatLng(p?.latitude, p?.longitude);
      if (pt) lastValid = pt;
    }
    if (!lastValid) return;

    const currentCenter = mapRef.current.getCenter();
    const [cLat, cLng] = lastValid;
    if (Math.abs(currentCenter.lat - cLat) < 1e-8 && Math.abs(currentCenter.lng - cLng) < 1e-8) return;
    mapRef.current.panTo(lastValid, { animate: true, duration: 0.4 });
  }, [userPositions, mapReady]);

  // Auto-zoom to selected trail
  const fitToTrail = useCallback((trail: MapTrail) => {
    if (!mapRef.current) return;
    const pt = toValidLatLng(trail?.lat, trail?.lng);
    if (!pt) return;
    import('leaflet').then(() => {
      mapRef.current!.flyTo(pt, 14, { animate: true, duration: 1.2 });
    });
  }, []);

  useEffect(() => {
    if (!selectedTrailId || !mapReady) return;
    const trail = trails.find((t) => t.id === selectedTrailId);
    if (trail) fitToTrail(trail);
  }, [selectedTrailId, trails, mapReady, fitToTrail]);

  // Auto-fit all trails on load (only if geolocation not available)
  useEffect(() => {
    if (!mapReady || !trails.length || !mapRef.current) return;
    if (locationState === 'located' || locationState === 'locating') return;
    import('leaflet').then((L) => {
      const coords: [number, number][] = [];
      trails.forEach((t) => {
        const pt = toValidLatLng(t?.lat, t?.lng);
        if (pt) coords.push(pt);
      });
      if (!coords.length) return;
      const allBounds = L.latLngBounds(coords);
      if (allBounds.isValid()) {
        mapRef.current!.fitBounds(allBounds, { padding: [40, 40], maxZoom: 10 });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, trails.length, locationState]);

  const handleManualLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const validLoc = toValidLatLng(latitude, longitude);
        if (validLoc) {
          setLocationState('located');
          onLocationUpdate?.(validLoc);
          mapRef.current!.flyTo(validLoc, 13, { duration: 1.5 });
        } else {
          setLocationState('denied');
        }
      },
      () => setLocationState('denied'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {mapReady && mapInstance && (
        <TrailLayer
          map={mapInstance}
          trails={trails}
          selectedTrailId={selectedTrailId}
          onTrailClick={onTrailClick}
        />
      )}

      {/* Location status indicator */}
      {locationState === 'locating' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[40] bg-[#0d1a12]/90 border border-[#2D5A27]/40 rounded-xl px-4 py-2 flex items-center gap-2 backdrop-blur-sm">
          <div className="w-3 h-3 border-2 border-[#2D5A27]/30 border-t-[#8BAF7C] rounded-full animate-spin" />
          <span className="text-[#8BAF7C] text-xs font-mono">Localisation…</span>
        </div>
      )}

      {/* Denied — show button to retry */}
      {locationState === 'denied' && (
        <div className="absolute z-[40]" style={{ bottom: '80px', left: '12px' }}>
          <button
            onClick={handleManualLocate}
            className="flex items-center gap-2 bg-white/95 border border-[#E4E0D4] rounded-xl px-3 py-2 text-[#1C2620] text-xs font-medium shadow-md hover:bg-[#F5F2EA] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Activer ma position
          </button>
        </div>
      )}

      {/* Tile switcher */}
      <div className="absolute z-[40] flex items-center p-1 bg-white/95 backdrop-blur-sm border border-[#E4E0D4] rounded-2xl shadow-md" style={{ bottom: '80px', right: '12px' }}>
        <button
          onClick={() => setTileMode('osm')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
            tileMode === 'osm' ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#7A8A7D] hover:bg-[#F5F2EA] hover:text-[#1C2620]'
          }`}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path><path d="M9 3v12"></path><path d="M15 6v12"></path>
          </svg>
          Carte
        </button>
        <button
          onClick={() => setTileMode('topo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
            tileMode === 'topo' ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#7A8A7D] hover:bg-[#F5F2EA] hover:text-[#1C2620]'
          }`}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
          </svg>
          Relief
        </button>
      </div>

      {/* Difficulty legend */}
      <div
        className="absolute left-3 z-[40] bg-white/95 border border-[#E4E0D4] rounded-xl px-3 py-2 shadow-sm"
        style={{ bottom: '80px' }}
      >
        <p className="text-[9px] font-mono text-[#7A8A7D] uppercase tracking-widest mb-1.5">Difficulté</p>
        {[
          { key: 'easy', label: 'Facile', color: '#22c55e' },
          { key: 'moderate', label: 'Modérée', color: '#f97316' },
          { key: 'hard', label: 'Difficile', color: '#ef4444' },
          { key: 'expert', label: 'Expert', color: '#7c3aed' },
        ].map((d) => (
          <div key={d.key} className="flex items-center gap-1.5 mb-0.5">
            <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[9px] text-[#7A8A7D]">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

