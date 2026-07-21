'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import type { ExploreTrail } from './AdventureScore';
import TrailLayer from './TrailLayer';

interface ExplorerMapProps {
  trails: ExploreTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: ExploreTrail) => void;
  userLocation?: [number, number] | null;
  onMapReady?: () => void;
  onLocationUpdate?: (loc: [number, number]) => void;
}

const TOPO_TILE = {
  url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
};

const OSM_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

type TileMode = 'topo' | 'osm';
type LocationState = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable';

export default function ExplorerMap({ trails, selectedTrailId, onTrailClick, userLocation, onMapReady, onLocationUpdate }: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<ReturnType<typeof import('leaflet')['tileLayer']> | null>(null);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [mapReady, setMapReady] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const geoAttemptedRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
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
        setMapInstance(null);
        setMapReady(false);
      }
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
        const loc: [number, number] = [latitude, longitude];
        setLocationState('located');
        onLocationUpdate?.(loc);
        if (mapRef.current) {
          mapRef.current.flyTo([latitude, longitude], 13, { duration: 1.5 });
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

  // User location marker (from prop)
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userLocation) return;
    import('leaflet').then((L) => {
      if (userMarkerRef.current) {
        try { mapRef.current!.removeLayer(userMarkerRef.current); } catch { /* ignore */ }
      }
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#2D5A27;border:3px solid #8BAF7C;border-radius:50%;box-shadow:0 0 0 4px #2D5A2740"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker(userLocation, { icon });
      marker.addTo(mapRef.current!);
      userMarkerRef.current = marker;
    });
  }, [userLocation, mapReady]);

  // Auto-zoom to selected trail
  const fitToTrail = useCallback((trail: ExploreTrail) => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      if (trail.bbox_min_lat && trail.bbox_max_lat && trail.bbox_min_lng && trail.bbox_max_lng) {
        const bounds = L.latLngBounds(
          [trail.bbox_min_lat, trail.bbox_min_lng],
          [trail.bbox_max_lat, trail.bbox_max_lng]
        );
        mapRef.current!.fitBounds(bounds, { padding: [80, 80], maxZoom: 14, animate: true });
      } else if (trail.start_lat && trail.start_lng) {
        mapRef.current!.setView([trail.start_lat, trail.start_lng], 12, { animate: true });
      }
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
      const validTrails = trails.filter(
        (t) => t.bbox_min_lat && t.bbox_max_lat && t.bbox_min_lng && t.bbox_max_lng
      );
      if (!validTrails.length) return;
      const coords: [number, number][] = [];
      validTrails.forEach((t) => {
        coords.push([t.bbox_min_lat!, t.bbox_min_lng!]);
        coords.push([t.bbox_max_lat!, t.bbox_max_lng!]);
      });
      const allBounds = L.latLngBounds(coords);
      mapRef.current!.fitBounds(allBounds, { padding: [40, 40], maxZoom: 10 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, trails.length, locationState]);

  const handleManualLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setLocationState('located');
        onLocationUpdate?.([latitude, longitude]);
        mapRef.current!.flyTo([latitude, longitude], 13, { duration: 1.5 });
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#0d1a12]/90 border border-[#2D5A27]/40 rounded-xl px-4 py-2 flex items-center gap-2 backdrop-blur-sm">
          <div className="w-3 h-3 border-2 border-[#2D5A27]/30 border-t-[#8BAF7C] rounded-full animate-spin" />
          <span className="text-[#8BAF7C] text-xs font-mono">Localisation…</span>
        </div>
      )}

      {/* Denied — show button to retry */}
      {locationState === 'denied' && (
        <div className="absolute z-[1000]" style={{ bottom: '34vh', left: '12px' }}>
          <button
            onClick={handleManualLocate}
            className="flex items-center gap-2 bg-[#0d1a12]/90 border border-[#2D5A27]/40 rounded-xl px-3 py-2 text-[#8BAF7C] text-xs font-mono backdrop-blur-sm hover:border-[#2D5A27]/70 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Activer ma position
          </button>
        </div>
      )}

      {/* Tile switcher */}
      <div className="absolute z-[1000] flex flex-col gap-1.5" style={{ bottom: '34vh', right: '12px' }}>
        <button
          onClick={() => setTileMode('topo')}
          className={`w-10 h-10 rounded-xl border text-sm transition-all shadow-md shadow-black/20 ${
            tileMode === 'topo' ? 'bg-[#2D5A27] border-[#4A8A3F] text-white' : 'bg-[#0d1a12]/90 border-[#2D5A27]/30 text-[#8BAF7C]/60 hover:border-[#2D5A27]/60'
          }`}
          title="Carte topographique"
        >
          🗺
        </button>
        <button
          onClick={() => setTileMode('osm')}
          className={`w-10 h-10 rounded-xl border text-sm transition-all shadow-md shadow-black/20 ${
            tileMode === 'osm' ? 'bg-[#2D5A27] border-[#4A8A3F] text-white' : 'bg-[#0d1a12]/90 border-[#2D5A27]/30 text-[#8BAF7C]/60 hover:border-[#2D5A27]/60'
          }`}
          title="OpenStreetMap"
        >
          🧭
        </button>
      </div>

      {/* Difficulty legend */}
      <div
        className="absolute left-3 z-[1000] bg-[#0d1a12]/85 border border-[#2D5A27]/20 rounded-xl px-3 py-2.5 backdrop-blur-sm shadow-md shadow-black/20"
        style={{ bottom: '34vh' }}
      >
        <p className="text-[8px] font-mono text-[#8BAF7C]/30 uppercase tracking-widest mb-1.5">Difficulté</p>
        {[
          { key: 'easy', label: 'Facile', color: '#22c55e' },
          { key: 'moderate', label: 'Modérée', color: '#f97316' },
          { key: 'hard', label: 'Difficile', color: '#ef4444' },
          { key: 'expert', label: 'Expert', color: '#7c3aed' },
        ].map((d) => (
          <div key={d.key} className="flex items-center gap-1.5 mb-0.5">
            <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[9px] text-[#8BAF7C]/50">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
