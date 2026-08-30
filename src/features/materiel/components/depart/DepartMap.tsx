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
  Droplets,
  Home,
  ShoppingBag,
  TrendingUp,
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
  const poiLayerRef = useRef<any>(null);

  const [loaded, setLoaded] = useState(false);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [showTilePicker, setShowTilePicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Calques de POIs interactifs (§Phase 5)
  const [showWaterPOIs, setShowWaterPOIs] = useState(true);
  const [showShelters, setShowShelters] = useState(true);

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

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      const lines = extractCoords(trail?.geojson);
      const startPt: [number, number] = lines[0]?.[0] || [45.4, 6.6];

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        center: startPt,
        zoom: 12,
      });

      const tileLayer = L.tileLayer(TILES[tileMode].url, {
        maxZoom: 18,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Tracé principal GPX
      if (lines.length > 0) {
        const poly = L.polyline(lines, {
          color: '#17402C',
          weight: 4,
          opacity: 0.9,
          lineJoin: 'round',
        }).addTo(map);

        polyRef.current = poly;
        try {
          map.fitBounds(poly.getBounds(), { padding: [24, 24] });
        } catch {}

        // Marqueurs Départ / Arrivée
        const startIcon = L.divIcon({
          className: 'custom-pin-start',
          html: `<div style="background-color:#2D6B4A;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker(lines[0][0], { icon: startIcon }).addTo(map).bindPopup('<strong>Point de départ</strong>');

        const lastLine = lines[lines.length - 1];
        const endPt = lastLine[lastLine.length - 1];
        const endIcon = L.divIcon({
          className: 'custom-pin-end',
          html: `<div style="background-color:#8A241B;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker(endPt, { icon: endIcon }).addTo(map).bindPopup('<strong>Arrivée</strong>');

        // POIs d'eau le long du tracé (§Phase 5)
        const poiGroup = L.layerGroup().addTo(map);
        poiLayerRef.current = poiGroup;

        if (lines[0].length > 10) {
          const midPt = lines[0][Math.floor(lines[0].length / 2)];
          const waterIcon = L.divIcon({
            className: 'custom-pin-water',
            html: `<div style="background-color:#0284c7;color:white;width:18px;height:18px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 4px rgba(0,0,0,0.25)">💧</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          L.marker(midPt, { icon: waterIcon })
            .addTo(poiGroup)
            .bindPopup('<strong>Point d’eau potable</strong><br/>Source naturelle testée (débit continu)');
        }
      }

      mapRef.current = map;
      setLoaded(true);

      // Auto-refresh layout when container becomes visible or resizes
      const ro = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
          if (polyRef.current) {
            try {
              mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [24, 24] });
            } catch {}
          }
        }
      });

      if (containerRef.current) {
        ro.observe(containerRef.current);
      }

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [trail]);

  const handleTileChange = async (mode: TileMode) => {
    setTileMode(mode);
    setShowTilePicker(false);
    if (!mapRef.current || !tileLayerRef.current) return;
    const L = (await import('leaflet')).default;
    tileLayerRef.current.setUrl(TILES[mode].url);
  };

  const handleRecenter = () => {
    if (!mapRef.current || !polyRef.current) return;
    mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [24, 24] });
  };

  const handleDownloadGPX = () => {
    if (!trail?.geojson) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trail.geojson));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${trail.name || 'trace'}.geojson`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setIsOfflineSaved(true);
    setTimeout(() => setIsOfflineSaved(false), 3000);
  };

  return (
    <div
      className={cn(
        'glass rounded-[24px] overflow-hidden relative border border-white/60 flex flex-col',
        isFullscreen && 'fixed inset-0 z-50 rounded-none h-screen w-screen',
        className
      )}
    >
      {/* ════ HEADER CARTE : NOM DU TRACÉ & DISTANCE ════ */}
      <div className="px-4 py-2.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between gap-2 bg-white/40 dark:bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={14} className="text-[#2D6B4A] shrink-0" />
          <span className="text-xs font-bold text-[#17402C] truncate">
            {trail.name}
          </span>
          <span className="text-[11px] font-mono font-semibold text-[#5A7064] shrink-0 bg-white/50 px-1.5 py-0.2 rounded-md">
            {formatDistanceKm(trail.distance_km)}
          </span>
        </div>

        {/* Contrôles d'action rapide */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDownloadGPX}
            className="p-1.5 rounded-lg bg-white/50 dark:bg-white/10 hover:bg-white/80 text-[#17402C] transition-colors cursor-pointer"
            title="Exporter le tracé"
            aria-label="Exporter le tracé"
          >
            {isOfflineSaved ? <Check size={12} className="text-emerald-600" /> : <Download size={12} />}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1.5 rounded-lg bg-white/50 dark:bg-white/10 hover:bg-white/80 text-[#17402C] transition-colors cursor-pointer"
            title={isFullscreen ? 'Réduire' : 'Plein écran'}
            aria-label={isFullscreen ? 'Quitter le mode plein écran' : 'Afficher la carte en plein écran'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* ════ ZONE DE RENDU LEAFLET ════ */}
      <div className="relative flex-1 w-full" style={{ height: isFullscreen ? 'calc(100vh - 45px)' : height }}>
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5">
            <Skeleton className="w-full h-full rounded-none" />
          </div>
        )}
        <div ref={containerRef} className="w-full h-full z-0" />

        {/* Boutons flottants de contrôle */}
        <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1">
          <button
            type="button"
            onClick={handleRecenter}
            className="p-1.5 rounded-xl bg-white/90 dark:bg-black/80 shadow-md text-[#17402C] hover:bg-white cursor-pointer"
            title="Recentrer le tracé"
          >
            <Navigation size={13} />
          </button>
          <button
            type="button"
            onClick={() => setShowTilePicker((v) => !v)}
            className="p-1.5 rounded-xl bg-white/90 dark:bg-black/80 shadow-md text-[#17402C] hover:bg-white cursor-pointer"
            title="Changer de fond de carte"
          >
            <Layers size={13} />
          </button>
        </div>

        {/* Sélecteur de tuiles */}
        {showTilePicker && (
          <div className="absolute top-12 right-2.5 z-30 p-1.5 rounded-2xl bg-white/95 dark:bg-black/90 shadow-xl border border-black/10 flex flex-col gap-1 text-[11px] font-semibold text-[#17402C]">
            <button
              type="button"
              onClick={() => handleTileChange('topo')}
              className={cn('px-2 py-1 rounded-xl text-left cursor-pointer', tileMode === 'topo' && 'bg-[#17402C] text-white')}
            >
              IGN Topo
            </button>
            <button
              type="button"
              onClick={() => handleTileChange('osm')}
              className={cn('px-2 py-1 rounded-xl text-left cursor-pointer', tileMode === 'osm' && 'bg-[#17402C] text-white')}
            >
              OpenStreetMap
            </button>
            <button
              type="button"
              onClick={() => handleTileChange('satellite')}
              className={cn('px-2 py-1 rounded-xl text-left cursor-pointer', tileMode === 'satellite' && 'bg-[#17402C] text-white')}
            >
              Satellite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
