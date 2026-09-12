'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Icon from '@/components/ui/Icon';
import type { MapTrail } from '@/components/explorer/types';
import { getDifficultyColor, isValidLatLng } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';
import { createMapStyle, type AtlasTileMode } from './engine/createMapStyle';
import { prefersReducedMotion, flyToTarget } from './engine/camera';
import { resolveCountryName, resolveIsoA2 } from './engine/geo';
import { registerAtlasMapImages } from './engine/icons';
import { getPoiColor, MAP_COLORS } from './engine/mapTheme';
import { buildCountryDensityFC, buildRegionDensityFC } from './layers/densityLayers';
import type { CountryDensityRow, RegionDensityCell } from './layers/densityLayers';
import { useViewportData } from './hooks/useViewportData';
import type { ViewportQuery } from './hooks/viewportData';

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
  /** Données réelles du viewport courant (sentiers + POI), remontées à la page. */
  onViewportData?: (data: { trails: MapTrail[]; pois: UnifiedPOI[] }) => void;
  /** Densité par pays (matview Phase 1) — palier continent. */
  countryDensity?: CountryDensityRow[];
  /** Densité par cellule geohash-5 (matview Phase 1) — palier région. */
  regionDensity?: RegionDensityCell[];
  safeControls?: boolean;
  compact?: boolean;
}

// MapLibre attend [lng, lat] (contrairement à Leaflet [lat, lng]).
const DEFAULT_CENTER: [number, number] = [6.8694, 45.9237];
const COUNTRIES_GEOJSON_URL = '/data/countries-110m.geojson';
const VIEWPORT_BUFFER = 0.25;
const TILE_MODES: AtlasTileMode[] = ['topo', 'osm', 'satellite'];

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

function buildPoisFeatureCollection(pois: UnifiedPOI[]) {
  return {
    type: 'FeatureCollection' as const,
    features: pois
      .filter((poi) => isValidLatLng(poi.lat, poi.lng))
      .map((poi) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(poi.lng), Number(poi.lat)],
        },
        properties: {
          id: poi.id,
          name: poi.name,
          category: poi.category,
          altitude: poi.altitude_m ?? null,
          color: getPoiColor(poi.category),
        },
      })),
  };
}

/**
 * Popup POI construit en DOM (textContent) — jamais de setHTML avec données
 * serveur (anti-XSS). Contenu : nom + catégorie + altitude réels, ou rien.
 */
function openPoiPopup(
  map: MapLibreMap,
  properties: Record<string, unknown>,
  coordinates: [number, number],
  popupRef: React.MutableRefObject<Popup | null>
): void {
  const container = document.createElement('div');
  container.className = 'px-1 py-0.5 max-w-[220px]';

  const title = document.createElement('p');
  title.className = 'text-[13px] font-semibold text-[#17402C]';
  title.textContent =
    typeof properties.name === 'string' && properties.name ? properties.name : 'Point d’intérêt';
  container.append(title);

  const parts: string[] = [];
  if (typeof properties.category === 'string' && properties.category) parts.push(properties.category);
  if (typeof properties.altitude === 'number' && Number.isFinite(properties.altitude)) {
    parts.push(`${properties.altitude} m`);
  }
  if (parts.length > 0) {
    const meta = document.createElement('p');
    meta.className = 'text-[11px] text-[#5A7064]';
    meta.textContent = parts.join(' · ');
    container.append(meta);
  }

  popupRef.current?.remove();
  popupRef.current = new Popup({
    closeButton: true,
    closeOnClick: true,
    offset: 12,
    className: 'atlas-poi-popup',
  })
    .setLngLat(coordinates)
    .setDOMContent(container)
    .addTo(map);
}

export default function UnifiedExplorerMap({
  trails,
  pois,
  selectedTrailId = null,
  onTrailClick,
  onPoiClick,
  userLocation,
  onMapReady,
  onLocationUpdate,
  onViewportChange,
  onViewportData,
  countryDensity,
  regionDensity,
  safeControls = false,
}: UnifiedExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const trailsRef = useRef<MapTrail[]>([]);
  const poisRef = useRef<UnifiedPOI[]>([]);
  const poiPopupRef = useRef<Popup | null>(null);
  const countryDensityRef = useRef<CountryDensityRow[]>([]);
  const callbacksRef = useRef({
    onTrailClick,
    onPoiClick,
    onMapReady,
    onLocationUpdate,
    onViewportChange,
    onViewportData,
  });

  const [ready, setReady] = useState(false);
  const [tileMode, setTileMode] = useState<AtlasTileMode>('topo');
  const [viewport, setViewport] = useState<ViewportQuery | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<{
    iso: string;
    name: string;
    count: number | null;
  } | null>(null);

  callbacksRef.current = {
    onTrailClick,
    onPoiClick,
    onMapReady,
    onLocationUpdate,
    onViewportChange,
    onViewportData,
  };
  trailsRef.current = trails ?? [];
  poisRef.current = pois ?? [];
  countryDensityRef.current = countryDensity ?? [];

  // Fetch viewport débouncé + annulation des requêtes obsolètes (Phase 3).
  const viewportData = useViewportData(viewport, true);

  useEffect(() => {
    // Ne jamais écraser les données initiales avant une première réponse réseau
    // (succès ou échec explicite) — ATLAS-R9.
    if (!viewportData.hasFetched) return;
    if (viewportData.error) {
      console.error('[UnifiedExplorerMap] données viewport indisponibles', {
        error: viewportData.error,
      });
    }
    callbacksRef.current.onViewportData?.(viewportData.data);
  }, [viewportData.data, viewportData.hasFetched, viewportData.error]);

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

      let instance: MapLibreMap;
      try {
        instance = new MapLibreMap({
          container,
          style: createMapStyle('topo'),
          center: initialView.center,
          zoom: initialView.zoom,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
        });
      } catch (caught) {
        // Jamais de spinner infini : erreur journalisée avec contexte, UI débloquée.
        console.error("[UnifiedExplorerMap] échec d'initialisation MapLibre", caught);
        setReady(true);
        return;
      }
      map = instance;
      mapRef.current = instance;

      // Hook de test (dev uniquement) : permet aux e2e/visuels de projeter des
      // coordonnées écran pour cliquer précisément sur un marqueur.
      if (process.env.NODE_ENV !== 'production') {
        (window as unknown as { __atlasTestMap?: MapLibreMap }).__atlasTestMap = instance;
      }

      const emitViewport = () => {
        const bounds = instance.getBounds();
        const padLng = (bounds.getEast() - bounds.getWest()) * VIEWPORT_BUFFER;
        const padLat = (bounds.getNorth() - bounds.getSouth()) * VIEWPORT_BUFFER;
        const buffered = {
          minLat: Math.max(-85, bounds.getSouth() - padLat),
          maxLat: Math.min(85, bounds.getNorth() + padLat),
          minLng: Math.max(-180, bounds.getWest() - padLng),
          maxLng: Math.min(180, bounds.getEast() + padLng),
          zoom: instance.getZoom(),
        };
        setViewport(buffered);
        callbacksRef.current.onViewportChange?.(buffered);
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

        try {
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
        } catch (caught) {
          // Les couches ATLAS peuvent échouer (images/canvas) : on journalise avec
          // contexte et on débloque l'UI plutôt que de laisser un spinner infini.
          console.error("[UnifiedExplorerMap] échec d'initialisation des couches", caught);
        }

        setReady(true);
        callbacksRef.current.onMapReady?.();
        emitViewport();
      });

      instance.on('moveend', emitViewport);
      instance.on('zoomend', emitViewport);
      instance.on('error', (event) => {
        console.error('[UnifiedExplorerMap] MapLibre error', event?.error ?? event);
      });

    // Couche monde : polygones pays (GeoJSON statique réel, déjà utilisé par Earth).
    // La géométrie est enrichie côté client avec `atlas_iso`/`atlas_name` normalisés
    // (même résolution que le référentiel countries_geo) pour filtres et interactions.
    countriesAbort = new AbortController();
    const countriesTimeout = window.setTimeout(() => countriesAbort?.abort(), 4_000);
    fetch(COUNTRIES_GEOJSON_URL, { signal: countriesAbort.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled || !mapRef.current) return;
        if (!Array.isArray(geojson?.features)) {
          throw new Error('GeoJSON pays invalide : propriété "features" absente');
        }
        const current = mapRef.current;
        if (current.getSource('atlas-countries')) return;
        const beforeId = current.getLayer('atlas-trails-selected')
          ? 'atlas-trails-selected'
          : undefined;
        const collection = {
          type: 'FeatureCollection',
          features: (geojson.features ?? []).map(
            (feature: { properties?: Record<string, unknown> } & Record<string, unknown>) => ({
              ...feature,
              properties: {
                ...(feature.properties ?? {}),
                atlas_iso: resolveIsoA2(feature.properties) ?? '',
                atlas_name: resolveCountryName(feature.properties),
              },
            })
          ),
        };
        current.addSource('atlas-countries', {
          type: 'geojson',
          data: collection as unknown as GeoJSON.GeoJSON,
        });
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
        current.addLayer(
          {
            id: 'atlas-country-selected',
            type: 'line',
            source: 'atlas-countries',
            filter: ['==', ['get', 'atlas_iso'], '__none__'],
            paint: {
              'line-color': MAP_COLORS.ink,
              'line-opacity': 0.9,
              'line-width': 1.8,
            },
          },
          beforeId
        );

        current.on('click', 'atlas-country-fill', (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const iso = String(feature?.properties?.atlas_iso ?? '');
          if (!iso) return;
          const density = countryDensityRef.current.find(
            (row) => String(row.iso_a2 ?? '').toUpperCase() === iso
          );
          setSelectedCountry({
            iso,
            name:
              String(feature?.properties?.atlas_name ?? '') ||
              String(density?.name ?? '') ||
              iso,
            count:
              density && Number.isFinite(Number(density.trail_count))
                ? Number(density.trail_count)
                : null,
          });
          if (
            density &&
            isValidLatLng(density.centroid_lat, density.centroid_lng)
          ) {
            flyToTarget(current, {
              center: [Number(density.centroid_lng), Number(density.centroid_lat)],
              zoom: 4.6,
              duration: 900,
            });
          }
        });
        current.on('mouseenter', 'atlas-country-fill', () => {
          current.getCanvas().style.cursor = 'pointer';
        });
        current.on('mouseleave', 'atlas-country-fill', () => {
          current.getCanvas().style.cursor = '';
        });
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('[UnifiedExplorerMap] GeoJSON pays indisponible', {
            url: COUNTRIES_GEOJSON_URL,
            error,
          });
        }
      })
      .finally(() => window.clearTimeout(countriesTimeout));
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

  // ── POI (clustering natif MapLibre) ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const data = buildPoisFeatureCollection(pois ?? []);
    const source = map.getSource('atlas-pois') as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }

    map.addSource('atlas-pois', {
      type: 'geojson',
      data,
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 15,
    });
    map.addLayer({
      id: 'atlas-pois-clusters',
      type: 'circle',
      source: 'atlas-pois',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': MAP_COLORS.ink,
        'circle-opacity': 0.92,
        'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
        'circle-stroke-color': MAP_COLORS.white,
        'circle-stroke-width': 2.5,
      },
    });
    map.addLayer({
      id: 'atlas-pois-points',
      type: 'circle',
      source: 'atlas-pois',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 5,
        'circle-stroke-color': MAP_COLORS.white,
        'circle-stroke-width': 1.5,
      },
    });

    map.on('click', 'atlas-pois-clusters', (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const clusterId = feature.properties?.cluster_id;
      const poiSource = map.getSource('atlas-pois') as GeoJSONSource;
      const coordinates = feature.geometry.coordinates as [number, number];
      void poiSource
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          map.easeTo({
            center: coordinates,
            zoom,
            ...(prefersReducedMotion() ? { duration: 0 } : { duration: 400 }),
          });
        })
        .catch((error: unknown) =>
          console.error('[UnifiedExplorerMap] expansion cluster:', error)
        );
    });

    map.on('click', 'atlas-pois-points', (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const id = String(feature.properties?.id ?? '');
      const poi = poisRef.current.find((candidate) => candidate.id === id);
      const coordinates = feature.geometry.coordinates as [number, number];
      openPoiPopup(map, (feature.properties ?? {}) as Record<string, unknown>, coordinates, poiPopupRef);
      if (poi) callbacksRef.current.onPoiClick?.(poi);
    });

    const setPointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = '';
    };
    for (const layer of ['atlas-pois-clusters', 'atlas-pois-points']) {
      map.on('mouseenter', layer, setPointer);
      map.on('mouseleave', layer, clearPointer);
    }
  }, [pois, ready]);

  // ── Densités matérialisées : continent (pays) + région (geohash5) ───────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const countryData = buildCountryDensityFC(countryDensity ?? []);
    const regionData = buildRegionDensityFC(regionDensity ?? []);

    const countrySource = map.getSource('atlas-country-density') as GeoJSONSource | undefined;
    if (countrySource) {
      countrySource.setData(countryData as unknown as GeoJSON.GeoJSON);
    } else {
      map.addSource('atlas-country-density', {
        type: 'geojson',
        data: countryData as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'atlas-country-density-circles',
        type: 'circle',
        source: 'atlas-country-density',
        minzoom: 2.4,
        maxzoom: 8.2,
        paint: {
          'circle-color': MAP_COLORS.ink,
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 4, 100, 10, 1000, 16],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2.4, 0, 3.6, 0.65, 6.5, 0.65, 8.2, 0],
          'circle-stroke-color': MAP_COLORS.white,
          'circle-stroke-width': 1,
        },
      });
    }

    const regionSource = map.getSource('atlas-region-density') as GeoJSONSource | undefined;
    if (regionSource) {
      regionSource.setData(regionData as unknown as GeoJSON.GeoJSON);
    } else {
      map.addSource('atlas-region-density', {
        type: 'geojson',
        data: regionData as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'atlas-region-density-circles',
        type: 'circle',
        source: 'atlas-region-density',
        minzoom: 6.8,
        maxzoom: 14.4,
        paint: {
          'circle-color': MAP_COLORS.sage,
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 3.5, 65, 11],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6.8, 0, 8.5, 0.8, 13, 0.8, 14.4, 0],
          'circle-stroke-color': MAP_COLORS.white,
          'circle-stroke-width': 1,
        },
      });
    }
  }, [countryDensity, regionDensity, ready]);

  // ── Pays sélectionné : contour + carte ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer('atlas-country-selected')) return;
    map.setFilter('atlas-country-selected', [
      '==',
      ['get', 'atlas_iso'],
      selectedCountry?.iso ?? '__none__',
    ]);
  }, [selectedCountry, ready]);

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

      {/* Sélection pays (couche monde) — données réelles, jamais inventées.
          Wrapper positionné : la classe `.glass` porte `position: relative`. */}
      {selectedCountry && (
        <div
          className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+72px)] md:left-auto md:right-3 md:top-20 z-[550] w-[236px]"
          data-atlas-country-card="true"
        >
          <div className="glass rounded-2xl p-3.5">
            <p className="glass-eyebrow">Pays</p>
            <h3 className="font-display font-bold text-[15px] text-[#17402C] mt-0.5">
              {selectedCountry.name || selectedCountry.iso}
            </h3>
            <p className="text-[11px] text-[#5A7064] mt-1">
              {selectedCountry.count != null
                ? `${selectedCountry.count} itinéraire${selectedCountry.count > 1 ? 's' : ''} référencé${selectedCountry.count > 1 ? 's' : ''}`
                : 'Densité non disponible'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Link
                href={`/pays/${selectedCountry.iso.toLowerCase()}`}
                className="glass-capsule-btn primary flex-1 !min-h-[34px] text-[11px] font-bold text-center"
              >
                Explorer le pays
              </Link>
              <button
                type="button"
                onClick={() => setSelectedCountry(null)}
                className="glass-circle-btn w-8 h-8 shrink-0"
                aria-label="Fermer la sélection pays"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
