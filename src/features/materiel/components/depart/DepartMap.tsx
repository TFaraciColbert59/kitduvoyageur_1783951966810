'use client';
import Icon from '@/components/ui/Icon';
import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { NavigationIcon as Navigation } from '@/components/icons/navigation';
import { LayersIcon as Layers } from '@/components/icons/layers';
import { Minimize2Icon as Minimize2 } from '@/components/icons/minimize-2';
import { DownloadIcon as DownloadAnimated } from '@/components/icons/download';
import { Maximize2Icon as Maximize2Animated } from '@/components/icons/maximize-2';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sheet } from '@/components/ui/Sheet';
import { Card, Chip, EmptyState, IconButton } from '@/components/ui';
import { formatDistanceKm } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';
import type { MapTrail } from '@/components/explorer/types';

interface DepartMapProps {
  trail: MapTrail | null;
  height?: string;
  className?: string;
  /** Rendu embarqué dans la modale plein écran — pas de second plein écran récursif. */
  embedded?: boolean;
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

export function DepartMap({ trail, height = '240px', className, embedded = false }: DepartMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [loaded, setLoaded] = useState(false);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [showTilePicker, setShowTilePicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  useEffect(() => {
    if (!trail) return;
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      const lines = extractCoords(trail?.geojson);
      const startPt: [number, number] = lines[0]?.[0] || [trail?.lat || 45.83, trail?.lng || 6.86];

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
          color: 'var(--lkv-primary)',
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
          html: `<div style="background-color:var(--lkv-primary-hover);width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker(lines[0][0], { icon: startIcon })
          .addTo(map)
          .bindPopup('<strong>Point de départ</strong>');

        const lastLine = lines[lines.length - 1];
        const endPt = lastLine[lastLine.length - 1];
        const endIcon = L.divIcon({
          className: 'custom-pin-end',
          html: `<div style="background-color:var(--lkv-danger);width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker(endPt, { icon: endIcon }).addTo(map).bindPopup('<strong>Arrivée</strong>');
      } else {
        // Point unique si pas de ligne
        const pinIcon = L.divIcon({
          className: 'custom-pin-center',
          html: `<div style="background-color:var(--lkv-primary);width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker(startPt, { icon: pinIcon })
          .addTo(map)
          .bindPopup(`<strong>${trail?.name || 'Point de départ'}</strong>`);
      }

      mapRef.current = map;
      setLoaded(true);

      // Force recalcul dimensions
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
          if (polyRef.current) {
            try {
              mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [24, 24] });
            } catch {}
          }
        }
      }, 100);

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 350);

      // Auto-refresh layout on container resize
      const ro = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });

      if (containerRef.current) {
        ro.observe(containerRef.current);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail]);

  // État vide si aucun tracé
  if (!trail) {
    return (
      <Card className="p-5 text-center">
        <EmptyState
          compact
          icon={
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/40 text-[var(--lkv-primary)]">
              <Compass size={20} />
            </span>
          }
          title="Aucun tracé associé à ce départ"
          description="Liez un itinéraire GPX pour activer la carte interactive."
          actionLabel="Associer une randonnée"
          actionHref="/hub/depart"
        />
      </Card>
    );
  }

  const handleTileChange = async (mode: TileMode) => {
    setTileMode(mode);
    setShowTilePicker(false);
    if (!mapRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(TILES[mode].url);
  };

  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (polyRef.current) {
      mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [24, 24] });
    } else if (trail?.lat && trail?.lng) {
      mapRef.current.setView([trail.lat, trail.lng], 12);
    }
  };

  const handleDownloadGPX = () => {
    if (!trail?.geojson) return;
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trail.geojson));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${trail.name || 'trace'}.geojson`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setIsOfflineSaved(true);
    setTimeout(() => setIsOfflineSaved(false), 3000);
  };

  const actualHeight = embedded ? 'min(72dvh, 560px)' : height;

  return (
    <Card
      className={cn(
        'relative flex flex-col overflow-hidden p-0 shadow-xs',
        className
      )}
    >
      {/* ════ HEADER CARTE : NOM DU TRACÉ & DISTANCE ════ */}
      <div className="px-4 py-2.5 border-b border-black/5 flex items-center justify-between gap-2 bg-white/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="map-pin" size={14} className="text-[var(--lkv-primary-hover)] shrink-0" />
          <span className="text-xs font-bold text-[var(--lkv-primary)] truncate">{trail.name}</span>
          {trail.distance_km !== null && (
            <span className="text-[11px] font-mono font-semibold text-[var(--lkv-text-muted)] shrink-0 bg-white/50 px-1.5 py-0.2 rounded-md">
              {formatDistanceKm(trail.distance_km)}
            </span>
          )}
        </div>

        {/* Contrôles d'action rapide Liquid Glass */}
        <div className="flex items-center gap-1.5 shrink-0">
          <IconButton
            variant="glass"
            onClick={handleDownloadGPX}
            className="text-[var(--lkv-primary)]"
            title="Exporter le tracé"
            aria-label="Exporter le tracé"
          >
            {isOfflineSaved ? (
              <Icon name="check" size={14} className="text-[var(--lkv-forest-600)]" />
            ) : (
              <DownloadAnimated size={14} />
            )}
          </IconButton>
          {!embedded && (
            <IconButton
              variant="glass"
              onClick={() => setIsFullscreen((v) => !v)}
              className="text-[var(--lkv-primary)]"
              title={isFullscreen ? 'Réduire' : 'Plein écran'}
              aria-label={
                isFullscreen ? 'Quitter le mode plein écran' : 'Afficher la carte en plein écran'
              }
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2Animated size={14} />}
            </IconButton>
          )}
        </div>
      </div>

      {/* ════ ZONE DE RENDU LEAFLET AVEC HAUTEUR PIXEL STRICTE GARANTIE ════ */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: actualHeight, minHeight: actualHeight }}
      >
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5">
            <Skeleton className="w-full h-full rounded-none" />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ height: actualHeight, minHeight: actualHeight }}
        />

        {/* Boutons flottants de contrôle Liquid Glass */}
        <div className="absolute right-2.5 top-2.5 z-[var(--z-fab)] flex flex-col gap-1.5">
          <IconButton
            variant="glass"
            onClick={handleRecenter}
            className="text-[var(--lkv-primary)] shadow-md"
            title="Recentrer le tracé"
            aria-label="Recentrer le tracé"
          >
            <Navigation size={15} />
          </IconButton>
          <IconButton
            variant="glass"
            onClick={() => setShowTilePicker((v) => !v)}
            className="text-[var(--lkv-primary)] shadow-md"
            title="Changer de fond de carte"
            aria-label="Changer de fond de carte"
            aria-expanded={showTilePicker}
          >
            <Layers size={15} />
          </IconButton>
        </div>

        {/* Sélecteur de tuiles */}
        {showTilePicker && (
          <div className="absolute right-14 top-2.5 z-[var(--z-drawer)] flex flex-col gap-1 rounded-2xl border border-black/10 bg-white/95 p-1.5 text-[11px] font-semibold text-[var(--lkv-primary)] shadow-xl">
            <Chip
              selected={tileMode === 'topo'}
              onClick={() => handleTileChange('topo')}
              className="justify-start text-left"
            >
              IGN Topo
            </Chip>
            <Chip
              selected={tileMode === 'osm'}
              onClick={() => handleTileChange('osm')}
              className="justify-start text-left"
            >
              OpenStreetMap
            </Chip>
            <Chip
              selected={tileMode === 'satellite'}
              onClick={() => handleTileChange('satellite')}
              className="justify-start text-left"
            >
              Satellite
            </Chip>
          </div>
        )}
      </div>

      {!embedded && (
        <Sheet
          open={isFullscreen}
          onOpenChange={setIsFullscreen}
          title="Carte du tracé"
        >
          <DepartMap trail={trail} embedded />
        </Sheet>
      )}
    </Card>
  );
}
