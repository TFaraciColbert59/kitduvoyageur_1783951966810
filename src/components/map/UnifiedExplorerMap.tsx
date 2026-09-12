'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LngLatBounds,
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Icon from '@/components/ui/Icon';
import type { MapTrail } from '@/components/explorer/types';
import { getDifficultyColor, isValidLatLng, sanitizeGeoJSON } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';
import { createMapStyle, type AtlasTileMode } from './engine/createMapStyle';
import { prefersReducedMotion, easeToTarget, flyToTarget } from './engine/camera';
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
  /** Sentier sélectionné (avec son `geojson` exact une fois chargé) — tracé affiché comme avant. */
  selectedTrail?: MapTrail | null;
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
/** Zoom minimal : le globe reste cadré et exploitable (pas de bille minuscule). */
const GLOBE_MIN_ZOOM = 1.2;
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

/** Étend des bounds MapLibre à partir d'une structure de coordonnées GeoJSON. */
function extendBoundsFromCoordinates(bounds: LngLatBounds, coordinates: unknown): void {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) bounds.extend([lng, lat]);
    return;
  }
  for (const child of coordinates) extendBoundsFromCoordinates(bounds, child);
}

/** Feature de tracé à partir du geojson exact d'un sentier (nettoyé, jamais inventé). */
function buildTrailTrackFeature(trail: MapTrail | null | undefined) {
  if (!trail) return null;
  const geometry = sanitizeGeoJSON(trail.geojson);
  if (!geometry) return null;
  return {
    type: 'Feature' as const,
    properties: { id: String(trail.id) },
    geometry,
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
  selectedTrail = null,
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
  const [viewMode, setViewMode] = useState<'local' | 'globe'>('globe');
  const localViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
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
          // Départ « façon Google Earth » : on ouvre sur le globe, puis on
          // plonge vers la vue locale après le chargement du style.
          center: initialView.center,
          zoom: 1.6,
          minZoom: GLOBE_MIN_ZOOM,
          renderWorldCopies: false,
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

      // MapLibre v6 (projection globe) n'applique pas `minZoom` au dézoom
      // molette/pince : sans ce verrou, l'utilisateur descend sous le seuil et
      // le monde se déplie en bandes répétées (plus de globe). On reclampe.
      instance.setMinZoom(GLOBE_MIN_ZOOM);
      instance.on('zoom', () => {
        if (cancelled) return;
        if (instance.getZoom() < GLOBE_MIN_ZOOM) {
          instance.setZoom(GLOBE_MIN_ZOOM);
        }
      });

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
        setViewMode(instance.getZoom() > 4 ? 'local' : 'globe');
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

    // Couche monde : polygones pays (GeoJSON statique réel, déjà utilisé par les fiches pays).
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
          // La sélection pays est un geste de vue monde/continent : on l'ignore
          // en vue locale et dès qu'un sentier/POI est sous le doigt (évite
          // d'ouvrir la carte pays en tapant un tracé).
          if (current.getZoom() > 8) return;
          const hitsInteractiveLayer = current.queryRenderedFeatures(event.point, {
            layers: ['atlas-trails-points', 'atlas-pois-points', 'atlas-pois-clusters'],
          });
          if (hitsInteractiveLayer.length > 0) return;

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

  // ── Tracé exact du sentier sélectionné (parité legacy : glow + ligne + cadrage) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const feature = buildTrailTrackFeature(selectedTrail);
    const data = {
      type: 'FeatureCollection' as const,
      features: feature ? [feature] : [],
    };

    const source = map.getSource('atlas-trail-track') as GeoJSONSource | undefined;
    if (source) {
      source.setData(data as unknown as GeoJSON.GeoJSON);
    } else {
      map.addSource('atlas-trail-track', {
        type: 'geojson',
        data: data as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'atlas-trail-track-glow',
        type: 'line',
        source: 'atlas-trail-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': MAP_COLORS.sageLight,
          'line-width': 10,
          'line-opacity': 0.45,
        },
      });
      map.addLayer({
        id: 'atlas-trail-track-line',
        type: 'line',
        source: 'atlas-trail-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': MAP_COLORS.ink,
          'line-width': 5.5,
          'line-opacity': 0.95,
        },
      });
    }

    // Cadrage identique au legacy : padding 60, zoom max 15.
    if (feature) {
      const bounds = new LngLatBounds();
      extendBoundsFromCoordinates(bounds, feature.geometry.coordinates);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 60,
          maxZoom: 15,
          duration: prefersReducedMotion() ? 0 : 700,
        });
      }
    }
  }, [selectedTrail, ready]);

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
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const nextZoom = Math.max(map.getZoom() - 1, GLOBE_MIN_ZOOM);
    easeToTarget(map, { center: [center.lng, center.lat], zoom: nextZoom, duration: 200 });
  }, []);

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

  /** Bascule globe ⇄ vue locale (mémorise la dernière vue locale). */
  const handleToggleGlobe = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (viewMode === 'globe') {
      // « Explorer ma zone » : plonge vers la position utilisateur si connue,
      // sinon vers la dernière vue locale / la vue initiale calculée au montage.
      const hasUserLocation = userLocation && isValidLatLng(userLocation[0], userLocation[1]);
      const targetCenter: [number, number] = hasUserLocation
        ? [Number(userLocation![1]), Number(userLocation![0])]
        : localViewRef.current?.center ?? initialView.center;
      const targetZoom = hasUserLocation
        ? 12
        : localViewRef.current?.zoom ?? initialView.zoom;
      flyToTarget(map, { center: targetCenter, zoom: targetZoom, duration: 1_600 });
      setViewMode('local');
    } else {
      const center = map.getCenter();
      localViewRef.current = { center: [center.lng, center.lat], zoom: map.getZoom() };
      flyToTarget(map, { center: [center.lng, center.lat], zoom: 1.6, duration: 1_100 });
      setViewMode('globe');
    }
  }, [viewMode, userLocation, initialView.center, initialView.zoom]);

  const bottomControlsOffset = safeControls
    ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+96px)]'
    : 'bottom-4';
  const desktopTilesOffset = safeControls
    ? 'md:bottom-[calc(env(safe-area-inset-bottom,0px)+96px)]'
    : 'md:bottom-4';

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

      {/* Contrôles mobiles simplifiés :
          - une action centrale « Explorer ma zone » / « Vue globe » ;
          - zoom compact à droite (pincer pour zoomer reste natif) ;
          - fond de carte en haut à gauche, icônes seules.
          ⚠️ Les classes `.glass-*` imposent leur `display` : les bascules
          responsives passent par des wrappers, jamais directement dessus. */}

      {/* Action principale — mobile (centrée, seule au-dessus de la tab bar) */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 ${bottomControlsOffset} z-[510] md:hidden`}
        data-atlas-primary-cta="mobile"
      >
        <button
          type="button"
          onClick={handleToggleGlobe}
          className="glass-capsule-btn !min-h-[48px] px-4 flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95"
          aria-label={viewMode === 'globe' ? 'Explorer ma zone (vue locale)' : 'Afficher le globe'}
          aria-pressed={viewMode === 'local'}
        >
          <Icon name="compass" size={15} />
          <span className="text-[12px] font-bold whitespace-nowrap">
            {viewMode === 'globe' ? 'Explorer ma zone' : 'Vue globe'}
          </span>
        </button>
      </div>

      {/* Zoom (−/+) + recentrage : mobile = zoom seul ; desktop = colonne complète */}
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
        <div className="hidden md:contents">
          <button
            type="button"
            onClick={handleRecenter}
            className="glass-circle-btn w-11 h-11 shadow-lg flex items-center justify-center cursor-pointer active:scale-95"
            aria-label="Me recentrer"
            title="Me recentrer"
          >
            <Icon name="navigation" size={16} />
          </button>
          <button
            type="button"
            onClick={handleToggleGlobe}
            className="glass-capsule-btn !min-h-[44px] px-3 flex items-center justify-center gap-1.5 shadow-lg cursor-pointer active:scale-95"
            aria-label={viewMode === 'globe' ? 'Explorer ma zone (vue locale)' : 'Afficher le globe'}
            title={viewMode === 'globe' ? 'Explorer ma zone' : 'Vue globe'}
            aria-pressed={viewMode === 'local'}
          >
            <Icon name="compass" size={14} />
            <span className="text-[11px] font-bold whitespace-nowrap">
              {viewMode === 'globe' ? 'Explorer ma zone' : 'Vue globe'}
            </span>
          </button>
        </div>
      </div>

      {/* Légende densité — desktop uniquement (simplicité mobile) */}
      {viewport && viewport.zoom > 2.4 && viewport.zoom < 14.4 && (
        <div
          className={`hidden md:block absolute left-3 ${
            safeControls ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+152px)]' : 'bottom-20'
          } z-[500] pointer-events-none`}
          data-atlas-density-legend="true"
        >
          <div className="glass-pill text-[10px] font-semibold">
            ● Densité de sentiers — taille ∝ nombre
          </div>
        </div>
      )}

      {/* Fond de carte — mobile : icônes en haut à gauche ; desktop : libellés en bas à gauche */}
      <div
        className={`absolute left-3 top-[calc(env(safe-area-inset-top,0px)+10px)] md:top-auto ${desktopTilesOffset} z-[500] glass-capsule-bar flex items-center`}
        data-atlas-controls="tiles"
        role="group"
        aria-label="Fond de carte"
      >
        {TILE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setTileMode(mode)}
            className={`glass-capsule-segment !w-12 !min-w-0 !px-0 md:!w-auto md:!min-w-[76px] md:!px-[18px] !min-h-[44px] text-[11px] font-semibold cursor-pointer flex items-center justify-center ${
              tileMode === mode ? 'active' : ''
            }`}
            aria-pressed={tileMode === mode}
            aria-label={mode === 'topo' ? 'Relief' : mode === 'osm' ? 'Plan' : 'Satellite'}
            title={mode === 'topo' ? 'Relief' : mode === 'osm' ? 'Plan' : 'Satellite'}
          >
            <span className="md:hidden inline-flex">
              <Icon name={mode === 'topo' ? 'mountain' : mode === 'osm' ? 'map' : 'layers'} size={16} />
            </span>
            <span className="hidden md:inline">
              {mode === 'topo' ? 'Relief' : mode === 'osm' ? 'Plan' : 'Satellite'}
            </span>
          </button>
        ))}
      </div>

      {/* Attribution légère (obligatoire pour les tuiles) — mobile : haut droite ; desktop : bas centre */}
      <div className="absolute z-[400] right-3 top-[calc(env(safe-area-inset-top,0px)+16px)] md:right-auto md:left-1/2 md:-translate-x-1/2 md:top-auto md:bottom-[calc(env(safe-area-inset-bottom,0px)+2px)] text-[9px] leading-none text-[#5A7064] bg-white/70 px-2 py-1 rounded-full pointer-events-none">
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
                className="glass-capsule-btn primary flex-1 !min-h-[44px] text-[11px] font-bold text-center"
              >
                Explorer le pays
              </Link>
              <button
                type="button"
                onClick={() => setSelectedCountry(null)}
                className="glass-circle-btn w-11 h-11 shrink-0"
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
