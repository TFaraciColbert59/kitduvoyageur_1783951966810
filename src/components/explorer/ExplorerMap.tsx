'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { ExploreTrail } from './AdventureScore';
import TrailLayer from './TrailLayer';

interface ExplorerMapProps {
  trails: ExploreTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: ExploreTrail) => void;
  onMapReady?: () => void;
}

const TOPO_TILE = {
  url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
};

const OSM_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

type TileMode = 'topo' | 'osm';

export default function ExplorerMap({ trails, selectedTrailId, onTrailClick, onMapReady }: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<ReturnType<typeof import('leaflet')['tileLayer']> | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      // Fix default icon paths
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
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
        setMapInstance(null);
        setMapReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch tile layer
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    import('leaflet').then((L) => {
      if (tileLayerRef.current) {
        try {
          mapRef.current!.removeLayer(tileLayerRef.current as unknown as import('leaflet').Layer);
        } catch {
          // ignore
        }
      }
      const cfg = tileMode === 'topo' ? TOPO_TILE : OSM_TILE;
      const tile = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 17 });
      tile.addTo(mapRef.current!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tileLayerRef.current = tile as any;
    });
  }, [tileMode, mapReady]);

  // Auto-zoom to selected trail
  const fitToTrail = useCallback((trail: ExploreTrail) => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      if (trail.bbox_min_lat && trail.bbox_max_lat && trail.bbox_min_lng && trail.bbox_max_lng) {
        const bounds = L.latLngBounds(
          [trail.bbox_min_lat, trail.bbox_min_lng],
          [trail.bbox_max_lat, trail.bbox_max_lng]
        );
        mapRef.current!.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      } else if (trail.start_lat && trail.start_lng) {
        mapRef.current!.setView([trail.start_lat, trail.start_lng], 12);
      }
    });
  }, []);

  // Fit to selected trail
  useEffect(() => {
    if (!selectedTrailId || !mapReady) return;
    const trail = trails.find((t) => t.id === selectedTrailId);
    if (trail) fitToTrail(trail);
  }, [selectedTrailId, trails, mapReady, fitToTrail]);

  // Auto-fit all trails on load
  useEffect(() => {
    if (!mapReady || !trails.length || !mapRef.current) return;
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
  }, [mapReady, trails.length]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Trail layers (imperative) */}
      {mapReady && mapInstance && (
        <TrailLayer
          map={mapInstance}
          trails={trails}
          selectedTrailId={selectedTrailId}
          onTrailClick={onTrailClick}
        />
      )}

      {/* Tile switcher */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={() => setTileMode('topo')}
          className={`w-10 h-10 rounded-xl border text-sm transition-all ${
            tileMode === 'topo' ?'bg-[#E4501C] border-[#E4501C] text-white shadow-lg' :'bg-[#0f1a16]/90 border-white/15 text-white/60 hover:border-white/30'
          }`}
          title="Carte topographique"
        >
          🗺
        </button>
        <button
          onClick={() => setTileMode('osm')}
          className={`w-10 h-10 rounded-xl border text-sm transition-all ${
            tileMode === 'osm' ?'bg-[#E4501C] border-[#E4501C] text-white shadow-lg' :'bg-[#0f1a16]/90 border-white/15 text-white/60 hover:border-white/30'
          }`}
          title="OpenStreetMap"
        >
          🧭
        </button>
      </div>

      {/* Difficulty legend */}
      <div className="absolute bottom-6 left-4 z-[1000] bg-[#0f1a16]/90 border border-white/10 rounded-xl px-3 py-2.5 backdrop-blur-sm">
        <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Difficulté</p>
        {[
          { key: 'easy', label: 'Facile', color: '#22c55e' },
          { key: 'moderate', label: 'Modérée', color: '#f97316' },
          { key: 'hard', label: 'Difficile', color: '#ef4444' },
          { key: 'expert', label: 'Expert', color: '#7c3aed' },
        ].map((d) => (
          <div key={d.key} className="flex items-center gap-1.5 mb-0.5">
            <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[10px] text-white/50">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
