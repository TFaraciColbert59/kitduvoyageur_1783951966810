'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  ZoomIn,
  ZoomOut,
  Navigation,
  Layers,
  Maximize2,
  Minimize2,
  Download,
  Check,
  Compass,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDistanceKm } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';
import type { MapTrail } from '@/components/explorer/types';

interface DepartMapProps {
  trail: MapTrail | null;
  height?: string;
  className?: string;
}

type TileMode = 'topo' | 'osm' | 'satellite';

const TILES: Record<TileMode, { url: string; attribution: string }> = {
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, USGS, NOAA',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Earthstar Geographics',
  },
};

function extractCoords(geojson: any): [number, number][][] {
  if (!geojson) return [];
  const g = geojson.geometry || geojson;
  if (!g || !Array.isArray(g.coordinates)) return [];

  if (g.type === 'LineString') {
    const pts = (g.coordinates as number[][])
      .filter((pt) => pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]))
      .map((pt) => [pt[1], pt[0]] as [number, number]);
    return pts.length > 0 ? [pts] : [];
  }
  if (g.type === 'MultiLineString') {
    return (g.coordinates as number[][][])
      .map((line) =>
        line
          .filter((pt) => pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]))
          .map((pt) => [pt[1], pt[0]] as [number, number])
      )
      .filter((line) => line.length > 0);
  }
  return [];
}

export function DepartMap({ trail, height = '240px', className }: DepartMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [loaded, setLoaded] = useState(false);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [showTilePicker, setShowTilePicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // État vide si aucun tracé
  if (!trail) {
    return (
      <div className="glass rounded-[24px] p-5 text-center space-y-2.5 border border-white/60">
        <div className="w-10 h-10 rounded-2xl bg-white/40 border border-white/60 flex items-center justify-center mx-auto text-[#17402C]">
          <Compass size={20} />
        </div>
        <div>
          <h3 className="text-xs sm:text-[13px] font-bold text-[#17402C]">Aucun tracé associé à ce départ</h3>
          <p className="text-[11px] text-[#5A7064] mt-0.5">
            Liez un itinéraire GPX pour activer le calcul de dénivelé et la carte interactive.
          </p>
        </div>
        <Link
          href="/preparer-randonnee"
          className="glass-capsule-btn primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold mt-1"
        >
          <MapPin size={12} />
          <span>Associer une randonnée</span>
        </Link>
      </div>
    );
  }

  // Initialisation dynamique de Leaflet
  useEffect(() => {
    let cancelled = false;
    let mapInstance: any = null;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        touchZoom: true,
        preferCanvas: true,
      } as any);

      mapInstance = map;
      mapRef.current = map;

      const tile = L.tileLayer(TILES[tileMode].url, {
        maxZoom: 18,
        minZoom: 4,
      }).addTo(map);
      tileLayerRef.current = tile;

      const lines = extractCoords(trail.geojson);

      if (lines.length > 0) {
        const polyline = L.polyline(lines, {
          color: '#17402C',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        polyRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [24, 24] });

        const firstLine = lines[0];
        const lastLine = lines[lines.length - 1];
        const startPt = firstLine[0];
        const endPt = lastLine[lastLine.length - 1];

        const startIcon = L.divIcon({
          className: 'depart-map-marker-start',
          html: `<div style="width:12px;height:12px;background:#2D6B4A;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const endIcon = L.divIcon({
          className: 'depart-map-marker-end',
          html: `<div style="width:12px;height:12px;background:#8A241B;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        if (startPt) L.marker(startPt, { icon: startIcon }).addTo(map);
        if (endPt && (Math.abs(startPt[0] - endPt[0]) > 0.001 || Math.abs(startPt[1] - endPt[1]) > 0.001)) {
          L.marker(endPt, { icon: endIcon }).addTo(map);
        }
      } else if (trail.lat != null && trail.lng != null) {
        map.setView([trail.lat, trail.lng], 13);
      }

      setLoaded(true);
    });

    return () => {
      cancelled = true;
      if (mapInstance) {
        try { mapInstance.remove(); } catch {}
        mapRef.current = null;
        polyRef.current = null;
      }
    };
  }, [trail]);

  // Changement de fond de carte
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
      const newTile = L.tileLayer(TILES[tileMode].url, { maxZoom: 18, minZoom: 4 });
      newTile.addTo(mapRef.current);
      tileLayerRef.current = newTile;
    });
  }, [tileMode]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const recenter = () => {
    if (mapRef.current && polyRef.current) {
      mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [24, 24] });
    }
  };

  const handleSaveOffline = () => {
    setIsOfflineSaved(true);
    try {
      localStorage.setItem(`lkdv_offline_trail_${trail.id}`, JSON.stringify(trail));
    } catch {}
  };

  return (
    <div
      className={cn(
        'glass rounded-[24px] overflow-hidden transition-all border border-white/60 shadow-xs',
        isFullscreen && 'fixed inset-4 z-50 shadow-2xl flex flex-col bg-white/95 backdrop-blur-xl',
        className
      )}
      style={{ touchAction: 'pan-x pan-y' }}
      role="region"
      aria-label="Carte du tracé de départ"
    >
      {/* Header carte */}
      <div className="px-4 py-2.5 border-b border-white/20 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={14} className="text-[#2D6B4A] shrink-0" />
          <span className="text-xs font-semibold text-[#17402C] truncate">{trail.name}</span>
          {trail.distance_km && (
            <span className="text-[10.5px] font-mono font-bold text-[#5A7064] shrink-0">
              {formatDistanceKm(trail.distance_km)}
            </span>
          )}
        </div>

        {/* Boutons d actions rapides */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleSaveOffline}
            className={cn(
              'px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer',
              isOfflineSaved
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-white/40 text-[#17402C] hover:bg-white/70'
            )}
            title="Enregistrer le tracé pour utilisation hors-ligne"
            aria-pressed={isOfflineSaved}
          >
            {isOfflineSaved ? <Check size={11} /> : <Download size={11} />}
            <span>{isOfflineSaved ? 'Sauvegardé' : 'Hors-ligne'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1 rounded-lg bg-white/40 hover:bg-white/70 text-[#17402C] cursor-pointer"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
            aria-label={isFullscreen ? 'Quitter le mode plein écran' : 'Passer en plein écran'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Conteneur de carte Leaflet */}
      <div className="relative w-full" style={{ height: isFullscreen ? '100%' : height }}>
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5">
            <Skeleton className="w-full h-full rounded-none" />
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full h-full z-0"
          style={{ minHeight: isFullscreen ? '100%' : height }}
        />

        {/* Contrôles tactiles superposés */}
        {loaded && (
          <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1">
            <button
              type="button"
              onClick={recenter}
              className="w-7 h-7 rounded-xl glass flex items-center justify-center text-[#17402C] hover:bg-white/80 transition-colors shadow-sm cursor-pointer"
              title="Recentrer sur le tracé"
              aria-label="Recentrer la carte sur le tracé"
            >
              <Navigation size={12} />
            </button>

            <button
              type="button"
              onClick={zoomIn}
              className="w-7 h-7 rounded-xl glass flex items-center justify-center text-[#17402C] hover:bg-white/80 transition-colors shadow-sm cursor-pointer"
              title="Zoomer"
              aria-label="Zoom avant"
            >
              <ZoomIn size={12} />
            </button>

            <button
              type="button"
              onClick={zoomOut}
              className="w-7 h-7 rounded-xl glass flex items-center justify-center text-[#17402C] hover:bg-white/80 transition-colors shadow-sm cursor-pointer"
              title="Dézoomer"
              aria-label="Zoom arrière"
            >
              <ZoomOut size={12} />
            </button>

            {/* Sélecteur de calque fond de carte */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTilePicker((v) => !v)}
                className="w-7 h-7 rounded-xl glass flex items-center justify-center text-[#17402C] hover:bg-white/80 transition-colors shadow-sm cursor-pointer"
                title="Changer de fond de carte"
                aria-label="Sélectionner le fond de carte"
                aria-expanded={showTilePicker}
              >
                <Layers size={12} />
              </button>

              {showTilePicker && (
                <div className="absolute right-0 bottom-full mb-1 glass rounded-xl p-1 shadow-lg space-y-0.5 min-w-[90px] border border-white/60">
                  {(['topo', 'osm', 'satellite'] as TileMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setTileMode(mode);
                        setShowTilePicker(false);
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors uppercase tracking-wider cursor-pointer',
                        tileMode === mode
                          ? 'bg-[#17402C] text-white'
                          : 'text-[#17402C] hover:bg-white/40'
                      )}
                    >
                      {mode === 'topo' ? 'IGN Topo' : mode === 'osm' ? 'Plan OSM' : 'Satellite'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
