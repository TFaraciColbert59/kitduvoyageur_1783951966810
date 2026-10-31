'use client';
import Icon from '@/components/ui/Icon';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { NavigationIcon as Navigation } from '@/components/icons/navigation';
import { LayersIcon as Layers } from '@/components/icons/layers';
import { Minimize2Icon as Minimize2 } from '@/components/icons/minimize-2';
import { DownloadIcon as DownloadAnimated } from '@/components/icons/download';
import { Maximize2Icon as Maximize2Animated } from '@/components/icons/maximize-2';
import { Sheet } from '@/components/ui/Sheet';
import { Card, Chip, EmptyState, IconButton } from '@/components/ui';
import { formatDistanceKm } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';
import type { MapTrail } from '@/components/explorer/types';
import LKDVMap from '@/features/carto/LKDVMap';
import '@/features/carto/carto.css';

interface DepartMapProps {
  trail: MapTrail | null;
  height?: string;
  className?: string;
  /** Rendu embarqué dans la modale plein écran — pas de second plein écran récursif. */
  embedded?: boolean;
}

type TileMode = 'topo' | 'osm' | 'satellite';

function extractCoords(geojson: any): [number, number][][] {
  if (!geojson) return [];
  const g = geojson.geometry || geojson;
  if (!g || !Array.isArray(g.coordinates)) return [];

  if (g.type === 'LineString') {
    const pts = (g.coordinates as number[][])
      .filter((pt) => pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]))
      .map((pt) => [pt[0], pt[1]] as [number, number]);
    return pts.length > 0 ? [pts] : [];
  }
  if (g.type === 'MultiLineString') {
    return (g.coordinates as number[][][])
      .map((line) =>
        line
          .filter((pt) => pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]))
          .map((pt) => [pt[0], pt[1]] as [number, number])
      )
      .filter((line) => line.length > 0);
  }
  return [];
}

export function DepartMap({ trail, height = '240px', className, embedded = false }: DepartMapProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [showTilePicker, setShowTilePicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  const lines = useMemo(() => extractCoords(trail?.geojson), [trail?.geojson]);
  const startLngLat: [number, number] = useMemo(() => {
    if (lines[0]?.[0]) return lines[0][0];
    return [trail?.lng || 6.86, trail?.lat || 45.83];
  }, [lines, trail?.lat, trail?.lng]);

  const handleReady = useCallback(
    async (map: MapLibreMap) => {
      mapRef.current = map;
      if (lines.length === 0) return;

      const maplibregl = await import('maplibre-gl');
      const allCoords = lines.flat();

      if (!map.getSource('depart-track-source')) {
        map.addSource('depart-track-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: lines.length > 1 ? 'MultiLineString' : 'LineString',
              coordinates: lines.length > 1 ? lines : lines[0],
            },
            properties: {},
          },
        });
      }

      if (!map.getLayer('depart-track-casing')) {
        map.addLayer({
          id: 'depart-track-casing',
          type: 'line',
          source: 'depart-track-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.95 },
        });
      }

      if (!map.getLayer('depart-track-main')) {
        map.addLayer({
          id: 'depart-track-main',
          type: 'line',
          source: 'depart-track-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#17402C', 'line-width': 4.5, 'line-opacity': 1.0 },
        });
      }

      try {
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(
            allCoords[0] as [number, number],
            allCoords[0] as [number, number],
          ),
        );
        map.fitBounds(bounds, { padding: 24, duration: 0 });
      } catch {}
    },
    [lines],
  );

  if (!trail) {
    return (
      <Card className="p-5 text-center">
        <EmptyState
          compact
          icon={
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/40 text-[color:var(--lkv-text-primary)]">
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

  const handleTileChange = (mode: TileMode) => {
    setTileMode(mode);
    setShowTilePicker(false);
  };

  const handleRecenter = async () => {
    const map = mapRef.current;
    if (!map) return;
    const allCoords = lines.flat();
    if (allCoords.length > 0) {
      const maplibregl = await import('maplibre-gl');
      const bounds = allCoords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(
          allCoords[0] as [number, number],
          allCoords[0] as [number, number],
        ),
      );
      map.fitBounds(bounds, { padding: 24, duration: 400 });
    } else {
      map.easeTo({ center: startLngLat, zoom: 12, duration: 400 });
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
          <span className="text-xs font-bold text-[color:var(--lkv-text-primary)] truncate">{trail.name}</span>
          {trail.distance_km !== null && (
            <span className="text-[11px] font-mono font-semibold text-[var(--lkv-text-muted)] shrink-0 bg-white/50 px-1.5 py-0.2 rounded-md">
              {formatDistanceKm(trail.distance_km)}
            </span>
          )}
        </div>

        {/* Contrôles d'action rapide Liquid Glass */}
        <div className="flex items-center gap-1.5 shrink-0">
          <IconButton
            size="sm"
            variant="ghost"
            className="rounded-full bg-white/50 backdrop-blur-xs text-[color:var(--lkv-text-primary)] hover:bg-white/70"
            onClick={handleRecenter}
            aria-label="Recentrer sur le départ"
            title="Recentrer"
          >
            <Navigation size={14} />
          </IconButton>

          <IconButton
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full bg-white/50 backdrop-blur-xs text-[color:var(--lkv-text-primary)] hover:bg-white/70",
              showTilePicker && "bg-white text-[var(--lkv-primary)] shadow-xs"
            )}
            onClick={() => setShowTilePicker(!showTilePicker)}
            aria-label="Changer de fond de carte"
            title="Fonds de carte"
          >
            <Layers size={14} />
          </IconButton>

          <IconButton
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full bg-white/50 backdrop-blur-xs text-[color:var(--lkv-text-primary)] hover:bg-white/70",
              isOfflineSaved && "text-[var(--lkv-primary-hover)]"
            )}
            onClick={handleDownloadGPX}
            aria-label="Télécharger le fichier trace GPX/GeoJSON"
            title="Sauvegarder la trace"
          >
            <DownloadAnimated size={14} />
          </IconButton>

          {!embedded && (
            <IconButton
              size="sm"
              variant="ghost"
              className="rounded-full bg-white/50 backdrop-blur-xs text-[color:var(--lkv-text-primary)] hover:bg-white/70"
              onClick={() => setIsFullscreen(true)}
              aria-label="Agrandir la carte en plein écran"
              title="Plein écran"
            >
              <Maximize2Animated size={14} />
            </IconButton>
          )}
        </div>
      </div>

      {/* ════ ZONE CARTE ════ */}
      <div className="relative w-full overflow-hidden" style={{ height: actualHeight }}>
        <LKDVMap
          center={startLngLat}
          zoom={12}
          base={tileMode === 'satellite' ? 'hybrid' : 'maptoolkit'}
          terrain3d={true}
          interactive={true}
          onReady={handleReady}
        />

        {/* ── Menu Calques Déroulant ── */}
        {showTilePicker && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5 p-2 bg-white/90 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <span className="text-[10px] font-bold text-[color:var(--lkv-text-muted)] px-1 uppercase tracking-wider">
              Fond de carte
            </span>
            <Chip
              selected={tileMode === 'topo'}
              onClick={() => handleTileChange('topo')}
              className="text-xs justify-start"
            >
              Maptoolkit Hiking
            </Chip>
            <Chip
              selected={tileMode === 'satellite'}
              onClick={() => handleTileChange('satellite')}
              className="text-xs justify-start"
            >
              Hybride Satellite HD
            </Chip>
            <Chip
              selected={tileMode === 'osm'}
              onClick={() => handleTileChange('osm')}
              className="text-xs justify-start"
            >
              Plan Vectoriel
            </Chip>
          </div>
        )}
      </div>

      {/* ════ MODALE PLEIN ÉCRAN ════ */}
      {!embedded && (
        <Sheet
          open={isFullscreen}
          onOpenChange={setIsFullscreen}
          title={trail.name}
          description="Aperçu immersif du tracé GPX de votre départ"
        >
          <div className="relative w-full h-[75dvh] flex flex-col rounded-3xl overflow-hidden border border-white/40 shadow-2xl">
            <div className="absolute top-3 right-3 z-30">
              <IconButton
                size="sm"
                variant="secondary"
                className="rounded-full bg-white/80 backdrop-blur-md shadow-md"
                onClick={() => setIsFullscreen(false)}
                aria-label="Fermer la vue plein écran"
              >
                <Minimize2 size={16} />
              </IconButton>
            </div>
            <DepartMap trail={trail} height="100%" embedded={true} />
          </div>
        </Sheet>
      )}
    </Card>
  );
}

export default DepartMap;
