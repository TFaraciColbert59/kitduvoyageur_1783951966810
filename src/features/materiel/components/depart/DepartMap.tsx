'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapPin, ZoomIn, ZoomOut, Navigation, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { MapTrail } from '@/components/explorer/types';

interface DepartMapProps {
  trail: MapTrail | null;
  /** Hauteur CSS du conteneur carte (ex: '220px', '280px'). Default: '228px'. */
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

/** Extrait les coordonnées [lat, lng][] depuis un GeoJSON LineString ou MultiLineString. */
function extractCoords(geojson: any): [number, number][] {
  if (!geojson) return [];
  const g = geojson.geometry || geojson;
  if (!g || !Array.isArray(g.coordinates)) return [];

  if (g.type === 'LineString') {
    return (g.coordinates as number[][])
      .filter((pt) => pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]))
      .map((pt) => [pt[1], pt[0]]);
  }
  if (g.type === 'MultiLineString') {
    return (g.coordinates as number[][][])
      .flat()
      .filter((pt) => pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]))
      .map((pt) => [pt[1], pt[0]]);
  }
  return [];
}

/**
 * DepartMap — carte Leaflet lazy avec tracé du randonnee.
 *
 * Regles tactiles iOS :
 * - `touch-action: pan-x pan-y` sur le conteneur racine → ne bloque PAS le scroll parent
 * - Le conteneur carte a `overflow-hidden` uniquement sur ses propres bords (rounded)
 * - `tap: false` dans les options Leaflet (evite le doublon Safari)
 * - `preferCanvas: true` pour la performance GPU sur mobile
 */
export function DepartMap({ trail, height = '228px', className }: DepartMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [showTilePicker, setShowTilePicker] = useState(false);

  // Init Leaflet une seule fois au montage
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    if (mapRef.current) return;

    let mounted = true;
    const container = containerRef.current;

    // Evite les instances zombies si le composant est monte deux fois (StrictMode)
    try { delete (container as any)._leaflet_id; } catch {}

    import('leaflet').then((LMod) => {
      if (!mounted || !containerRef.current || mapRef.current) return;
      const L = (LMod as any).default || LMod;

      // Icones statiques (evite le probleme de webpack)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center: [number, number] =
        trail?.lat != null && trail?.lng != null &&
        isFinite(trail.lat) && isFinite(trail.lng)
          ? [trail.lat, trail.lng]
          : [45.9237, 6.8694]; // Chamonix fallback

      const map = L.map(containerRef.current!, {
        center,
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false, // desactive pour eviter hijack du scroll page
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        tap: false, // Safari: evite double-tap fantome
        preferCanvas: true,
      });

      mapRef.current = map;

      const tile = L.tileLayer(TILES.topo.url, { maxZoom: 18, maxNativeZoom: 18, keepBuffer: 4 });
      tile.addTo(map);
      tileRef.current = tile;

      // Tracé GPX
      const coords = extractCoords(trail?.geojson);
      if (coords.length >= 2) {
        // Halo blanc
        L.polyline(coords, { color: '#FFFFFF', weight: 8, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        // Trait vert LKDV
        const poly = L.polyline(coords, {
          color: '#17402C', weight: 4.5, opacity: 1, lineCap: 'round', lineJoin: 'round',
        }).addTo(map);
        polyRef.current = poly;

        // Marker depart
        L.circleMarker(coords[0], {
          radius: 7, color: '#FFFFFF', fillColor: '#17402C', fillOpacity: 1, weight: 2.5,
        }).addTo(map).bindPopup(`<strong>Départ</strong><br/>${trail?.name ?? ''}`);

        // Marker arrivee
        L.circleMarker(coords[coords.length - 1], {
          radius: 7, color: '#FFFFFF', fillColor: '#2D6B4A', fillOpacity: 1, weight: 2.5,
        }).addTo(map).bindPopup('<strong>Arrivée</strong>');

        try { map.fitBounds(poly.getBounds(), { padding: [28, 28] }); } catch {}
      }

      // Attribution minimale
      L.control.attribution({ prefix: false }).addAttribution(TILES.topo.attribution).addTo(map);

      // Resize automatique
      const observer = new ResizeObserver(() => {
        try { map.invalidateSize(); } catch {}
      });
      observer.observe(container);

      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 120);
      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 500);

      if (mounted) setLoaded(true);

      // Cleanup
      return () => {
        mounted = false;
        observer.disconnect();
      };
    });

    return () => {
      mounted = false;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  // Uniquement au montage — ne pas re-init si trail change (trail est stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement de fond de carte
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    import('leaflet').then((LMod) => {
      const L = (LMod as any).default || LMod;
      const cfg = TILES[tileMode];
      try {
        mapRef.current.removeLayer(tileRef.current);
      } catch {}
      const newTile = L.tileLayer(cfg.url, { maxZoom: 18, maxNativeZoom: 18, keepBuffer: 4 });
      newTile.addTo(mapRef.current);
      tileRef.current = newTile;
    });
  }, [tileMode]);

  const zoomIn = () => { try { mapRef.current?.zoomIn(); } catch {} };
  const zoomOut = () => { try { mapRef.current?.zoomOut(); } catch {} };
  const recenter = () => {
    if (!mapRef.current || !polyRef.current) return;
    try { mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [28, 28] }); } catch {}
  };

  const distanceLabel = trail?.distance_km ? `${trail.distance_km} km` : null;

  return (
    <div className={cn('glass rounded-[28px] overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/20">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={13} className="text-[#17402C] shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-[#17402C] truncate">
            {trail?.name ?? 'Tracé de la randonnée'}
          </span>
        </div>
        {distanceLabel && (
          <span className="text-[10px] font-mono font-bold text-[#5A7064] shrink-0 ml-2">
            {distanceLabel}
          </span>
        )}
      </div>

      {/* Conteneur carte — touch-action: pan-x pan-y permet le scroll de la page tout en gardant le pan/zoom Leaflet */}
      <div
        className="relative w-full overflow-hidden bg-[#E8E4D6]"
        style={{ height, touchAction: 'pan-x pan-y' }}
        aria-label={`Carte du tracé : ${trail?.name ?? 'randonnée'}`}
        role="img"
      >
        {/* Skeleton avant chargement */}
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E8E4D6]">
            <Skeleton className="absolute inset-0 rounded-none" />
            <div className="relative z-20 flex flex-col items-center gap-2 text-[#5A7064]">
              <MapPin size={20} aria-hidden="true" />
              <span className="text-xs font-medium">Chargement de la carte…</span>
            </div>
          </div>
        )}

        {/* Container Leaflet */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Controles superposés */}
        <div className="absolute right-2 top-2 z-[400] flex flex-col gap-1.5">
          {/* Zoom */}
          <button
            onClick={zoomIn}
            className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm flex items-center justify-center text-[#17402C] hover:bg-white active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#17402C]"
            aria-label="Zoom avant"
            title="Zoom avant"
          >
            <ZoomIn size={14} aria-hidden="true" />
          </button>
          <button
            onClick={zoomOut}
            className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm flex items-center justify-center text-[#17402C] hover:bg-white active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#17402C]"
            aria-label="Zoom arrière"
            title="Zoom arrière"
          >
            <ZoomOut size={14} aria-hidden="true" />
          </button>

          {/* Recentrer sur le tracé */}
          {loaded && polyRef.current && (
            <button
              onClick={recenter}
              className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm flex items-center justify-center text-[#17402C] hover:bg-white active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#17402C]"
              aria-label="Recentrer sur le tracé"
              title="Recentrer"
            >
              <Navigation size={13} aria-hidden="true" />
            </button>
          )}

          {/* Fond de carte */}
          <div className="relative">
            <button
              onClick={() => setShowTilePicker((v) => !v)}
              className="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm flex items-center justify-center text-[#17402C] hover:bg-white active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#17402C]"
              aria-label="Changer le fond de carte"
              aria-expanded={showTilePicker}
              aria-haspopup="listbox"
            >
              <Layers size={13} aria-hidden="true" />
            </button>
            {showTilePicker && (
              <div
                role="listbox"
                aria-label="Fond de carte"
                className="absolute right-9 top-0 bg-white/90 backdrop-blur-md rounded-xl border border-white/60 shadow-lg overflow-hidden min-w-[96px]"
              >
                {(['topo', 'osm', 'satellite'] as TileMode[]).map((mode) => (
                  <button
                    key={mode}
                    role="option"
                    aria-selected={tileMode === mode}
                    onClick={() => { setTileMode(mode); setShowTilePicker(false); }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-[10.5px] font-semibold capitalize transition-colors',
                      tileMode === mode
                        ? 'bg-[#17402C]/10 text-[#17402C]'
                        : 'text-[#5A7064] hover:bg-[#17402C]/5 hover:text-[#17402C]'
                    )}
                  >
                    {mode === 'topo' ? 'Topo' : mode === 'osm' ? 'OSM' : 'Satellite'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overlay "cliquer pour interagir" optionnel — masque après premier touch */}
        {/* (supprime pour eviter de bloquer la map) */}
      </div>
    </div>
  );
}
