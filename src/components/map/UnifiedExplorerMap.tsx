'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Icon from '@/components/ui/Icon';
import type { MapTrail } from '@/components/explorer/types';
import { getDifficultyColor, isValidLatLng } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';
import { createMapStyle, type AtlasTileMode } from './engine/createMapStyle';
import { registerAtlasMapImages } from './engine/icons';
import { MAP_COLORS } from './engine/mapTheme';

/**
 * CHANTIER ATLAS — moteur cartographique unique (MapLibre GL, projection globe).
 *
 * Un seul canvas : carte plate en zoom local → bascule native en globe 3D en
 * dézoomant. Aucune dépendance nouvelle (maplibre-gl déjà installé).
 * Mobile-first : contrôles glass 44px, gestes natifs, reduced-motion respecté.
 */

export interface UnifiedViewportBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}

export interface UnifiedExplorerMapProps {
  trails?: MapTrail[];
  pois?: UnifiedPOI[];
  selectedTrailId?: string | null;
  onTrailClick?: (trail: MapTrail) => void;
  onPoiClick?: (poi: UnifiedPOI) => void;
  userLocation?: [number, number] | null;
  onMapReady?: () => void;
  onLocationUpdate?: (loc: [number, number]) => void;
  onViewportChange?: (bbox: UnifiedViewportBbox) => void;
  safeControls?: boolean;
  compact?: boolean;
}

// MapLibre attend [lng, lat] (contrairement à Leaflet [lat, lng]).
const DEFAULT_CENTER: [number, number] = [6.8694, 45.9237];
const COUNTRIES_GEOJSON_URL = '/data/countries-110m.geojson';
const VIEWPORT_BUFFER = 0.25;
const TILE_MODES: AtlasTileMode[] = ['topo', 'osm', 'satellite'];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildTrailsFeatureCollection(trails: MapTrail[]) {
  return {
    type: 'FeatureCollection' as const,
    features: trails
      .filter((trail) => isValidLatLng(trail.lat, trail.lng))
      .map((trail) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(trail.lng), Number(trail.lat)],
        },
        properties: {
          id: trail.id,
          name: trail.name,
          difficulty: trail.difficulty ?? '',
          color: getDifficultyColor(trail.difficulty),
        },
      })),
  };
}

export default function UnifiedExplorerMap({
  trails,
  selectedTrailId = null,
  onTrailClick,
  onPoiClick,
  userLocation,
  onMapReady,
  onLocationUpdate,
  onViewportChange,
  safeControls = false,
}: UnifiedExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const trailsRef = useRef<MapTrail[]>([]);
  const callbacksRef = useRef({
    onTrailClick,
    onPoiClick,
    onMapReady,
    onLocationUpdate,
    onViewportChange,
  });

  const [ready, setReady] = useState(false);
  const [tileMode, setTileMode] = useState<AtlasTileMode>('topo');

  callbacksRef.current = {
    onTrailClick,
    onPoiClick,
    onMapReady,
    onLocationUpdate,
    onViewportChange,
  };
  trailsRef.current = trails ?? [];

  const initialView = useMemo(() => {
    if (userLocation && isValidLatLng(userLocation[0], userLocation[1])) {
      return {
        center: [Number(userLocation[1]), Number(userLocation[0])] as [number, number],
        zoom: 12,
      };
    }
    const first = (trails ?? []).find((trail) => isValidLatLng(trail.lat, trail.lng));
    if (first) {
      return {
        center: [Number(first.lng), Number(first.lat)] as [number, number],
        zoom: 11,
      };
    }
    return { center: DEFAULT_CENTER, zoom: 6 };
    // Vue initiale volontairement figée au montage (la caméra est ensuite pilotée par l'utilisateur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initialisation du canvas unique ─────────────────────────────────────────
  // Création différée dans le tick suivant : en React StrictMode (dev), le
  // premier montage est immédiatement démonté ; sans ce différé, un canvas est
  // construit puis détruit pendant le chargement du style, ce qui bloque le
  // worker du style pour l'instance suivante.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let countriesAbort: AbortController | null = null;

    const startTimer = window.setTimeout(() => {
      if (cancelled || !containerRef.current) return;

      // Worker servi depuis /public : le calcul par défaut via import.meta.url
      // pointe vers un chunk inexistant une fois bundlé (aucune source GeoJSON
      // rendue). Voir scripts/atlas/copy-maplibre-worker.mjs.
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

      const instance = new MapLibreMap({
        container,
        style: createMapStyle('topo'),
        center: initialView.center,
        zoom: initialView.zoom,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map = instance;
      mapRef.current = instance;

      const emitViewport = () => {
        const bounds = instance.getBounds();
        const padLng = (bounds.getEast() - bounds.getWest()) * VIEWPORT_BUFFER;
        const padLat = (bounds.getNorth() - bounds.getSouth()) * VIEWPORT_BUFFER;
        callbacksRef.current.onViewportChange?.({
          minLat: Math.max(-85, bounds.getSouth() - padLat),
          maxLat: Math.min(85, bounds.getNorth() + padLat),
          minLng: Math.max(-180, bounds.getWest() - padLng),
          maxLng: Math.min(180, bounds.getEast() + padLng),
          zoom: instance.getZoom(),
        });
      };

      // Readiness sur `style.load` (déterministe) plutôt que `load` : le rendu
      // complet dépend du chargement des tuiles et du premier frame GPU, ce qui
      // rend `load` fragile en CI/headless. La carte est interactive dès que le
      // style est chargé ; les tuiles continuent en streaming.
      instance.on('style.load', () => {
        if (cancelled) return;

        // Atmosphère sage appliquée après le load : en v6.4.1, un `sky` déclaré
        // dans le style racine bloque tout le pipeline de style (écart documenté).
        try {
          instance.setSky({
            'sky-color': MAP_COLORS.sageLight,
            'horizon-color': MAP_COLORS.background,
            'fog-color': MAP_COLORS.background,
            'sky-horizon-blend': 0.6,
            'atmosphere-blend': 0.9,
          });
        } catch (error) {
          console.error('[UnifiedExplorerMap] setSky indisponible:', error);
        }

        registerAtlasMapImages(instance);

        instance.addSource('atlas-trails', {
          type: 'geojson',
          data: buildTrailsFeatureCollection(trailsRef.current),
        });
        instance.addLayer({
          id: 'atlas-trails-selected',
          type: 'circle',
          source: 'atlas-trails',
          filter: ['==', ['get', 'id'], '__none__'],
          paint: {
            'circle-radius': 12,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': MAP_COLORS.ink,
            'circle-stroke-width': 3,
          },
        });
        instance.addLayer({
          id: 'atlas-trails-points',
          type: 'circle',
          source: 'atlas-trails',
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-stroke-color': MAP_COLORS.white,
            'circle-stroke-width': 2,
          },
        });

        instance.on('click', 'atlas-trails-points', (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          const trail = trailsRef.current.find((t) => t.id === String(id));
          if (trail) callbacksRef.current.onTrailClick?.(trail);
        });
        instance.on('mouseenter', 'atlas-trails-points', () => {
          instance.getCanvas().style.cursor = 'pointer';
        });
        instance.on('mouseleave', 'atlas-trails-points', () => {
          instance.getCanvas().style.cursor = '';
        });

        setReady(true);
        callbacksRef.current.onMapReady?.();
        emitViewport();
      });

      instance.on('moveend', emitViewport);
      instance.on('zoomend', emitViewport);
      instance.on('error', (event) => {
        const message = event?.error?.message ?? String(event);
        console.error('[UnifiedExplorerMap] MapLibre error:', message);
      });

      // Couche monde : polygones pays (GeoJSON statique réel, déjà utilisé par Earth).
      countriesAbort = new AbortController();
      fetch(COUNTRIES_GEOJSON_URL, { signal: countriesAbort.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((geojson) => {
          if (cancelled || !mapRef.current) return;
          const current = mapRef.current;
          if (current.getSource('atlas-countries')) return;
          const beforeId = current.getLayer('atlas-trails-selected')
            ? 'atlas-trails-selected'
            : undefined;
          current.addSource('atlas-countries', { type: 'geojson', data: geojson });
          current.addLayer(
            {
              id: 'atlas-country-fill',
              type: 'fill',
              source: 'atlas-countries',
              paint: { 'fill-color': MAP_COLORS.sageLight, 'fill-opacity': 0.16 },
            },
            beforeId
          );
          current.addLayer(
            {
              id: 'atlas-country-line',
              type: 'line',
              source: 'atlas-countries',
              paint: {
                'line-color': MAP_COLORS.inkSecondary,
                'line-opacity': 0.35,
                'line-width': 0.6,
              },
            },
            beforeId
          );
        })
        .catch((error: unknown) => {
          if ((error as Error)?.name !== 'AbortError') {
            console.error('[UnifiedExplorerMap] GeoJSON pays indisponible:', error);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      countriesAbort?.abort();
      if (map) {
        map.remove();
        mapRef.current = null;
      }
      setReady(false);
    };
  }, [initialView.center, initialView.zoom]);

  // ── Synchronisation des sentiers (props → source GeoJSON) ───────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('atlas-trails') as GeoJSONSource | undefined;
    source?.setData(buildTrailsFeatureCollection(trails ?? []));
  }, [trails, ready]);

  // ── Surbrillance du sentier sélectionné ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer('atlas-trails-selected')) return;
    map.setFilter('atlas-trails-selected', ['==', ['get', 'id'], selectedTrailId ?? '__none__']);
  }, [selectedTrailId, ready]);

  // ── Position utilisateur ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const valid = userLocation && isValidLatLng(userLocation[0], userLocation[1]);
    const data = {
      type: 'FeatureCollection' as const,
      features: valid
        ? [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [Number(userLocation![1]), Number(userLocation![0])],
              },
              properties: {},
            },
          ]
        : [],
    };
    const source = map.getSource('atlas-user') as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource('atlas-user', { type: 'geojson', data });
    map.addLayer({
      id: 'atlas-user-halo',
      type: 'circle',
      source: 'atlas-user',
      paint: { 'circle-radius': 12, 'circle-color': MAP_COLORS.info, 'circle-opacity': 0.18 },
    });
    map.addLayer({
      id: 'atlas-user-point',
      type: 'circle',
      source: 'atlas-user',
      paint: {
        'circle-radius': 5,
        'circle-color': MAP_COLORS.info,
        'circle-stroke-color': MAP_COLORS.white,
        'circle-stroke-width': 2,
      },
    });
  }, [userLocation, ready]);

  // ── Fond de carte (topo / osm / satellite) ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const mode of TILE_MODES) {
      const layerId = `atlas-tile-${mode}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', mode === tileMode ? 'visible' : 'none');
      }
    }
  }, [tileMode, ready]);

  // ── Contrôles glass ─────────────────────────────────────────────────────────
  const animateOptions = useCallback(
    (duration: number) => (prefersReducedMotion() ? { duration: 0 } : { duration }),
    []
  );

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ ...animateOptions(200) });
  }, [animateOptions]);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ ...animateOptions(200) });
  }, [animateOptions]);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userLocation && isValidLatLng(userLocation[0], userLocation[1])) {
      map.flyTo({
        center: [Number(userLocation[1]), Number(userLocation[0])],
        zoom: Math.max(map.getZoom(), 13),
        ...animateOptions(600),
      });
      callbacksRef.current.onLocationUpdate?.([Number(userLocation[0]), Number(userLocation[1])]);
    }
  }, [userLocation, animateOptions]);

  const bottomControlsOffset = safeControls
    ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+96px)]'
    : 'bottom-4';

  return (
    <div
      className="relative w-full h-full"
      data-testid="unified-explorer-map"
      data-atlas-ready={ready ? 'true' : 'false'}
    >
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {!ready && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-[#FBFAF6]">
          <div className="w-8 h-8 border-[3px] border-[#17402C] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Zoom + recentrage (44px, glass) */}
      <div
        className={`absolute right-3 ${bottomControlsOffset} z-[500] flex flex-col gap-2`}
        data-atlas-controls="right"
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="glass-circle-btn w-11 h-11 shadow-lg flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Zoom avant"
          title="Zoom avant"
        >
          <Icon name="plus" size={16} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="glass-circle-btn w-11 h-11 shadow-lg flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Zoom arrière"
          title="Zoom arrière"
        >
          <Icon name="minus" size={16} />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          className="glass-circle-btn w-11 h-11 shadow-lg flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Me recentrer"
          title="Me recentrer"
        >
          <Icon name="navigation" size={16} />
        </button>
      </div>

      {/* Fond de carte (capsule glass) */}
      <div
        className={`absolute left-3 ${bottomControlsOffset} z-[500] glass-capsule-bar flex items-center`}
        data-atlas-controls="tiles"
        role="group"
        aria-label="Fond de carte"
      >
        {TILE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setTileMode(mode)}
            className={`glass-capsule-segment px-3 h-9 text-[11px] font-semibold cursor-pointer ${
              tileMode === mode ? 'active' : ''
            }`}
            aria-pressed={tileMode === mode}
            title={mode === 'topo' ? 'Relief' : mode === 'osm' ? 'Plan' : 'Satellite'}
          >
            {mode === 'topo' ? 'Relief' : mode === 'osm' ? 'Plan' : 'Satellite'}
          </button>
        ))}
      </div>

      {/* Attribution légère (obligatoire pour les tuiles) */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)+2px)] z-[400] text-[9px] leading-none text-[#5A7064] bg-white/70 px-2 py-1 rounded-full pointer-events-none">
        © OpenStreetMap France · Esri
      </div>
    </div>
  );
}
