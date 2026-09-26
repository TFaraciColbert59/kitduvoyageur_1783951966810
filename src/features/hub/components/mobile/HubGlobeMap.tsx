'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Check, ChevronDown, MapPin, Route, X } from 'lucide-react';
import { sanitizeGeoJSON, type MapTrail } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';
import type { HubRoutePoint } from './HubRouteMap';

export interface HubGlobeMapProps {
  name: string;
  routeCoords: Array<[number, number]>;
  routeGeojson?: Record<string, unknown> | null;
  highlightCoords?: Array<[number, number]>;
  points?: HubRoutePoint[];
  className?: string;
  /** Tap libre sur la carte : permet de poser un point (lat, lng). */
  onMapClick?: (lat: number, lng: number) => void;
}

/**
 * Surface volontairement locale : le wrapper ne doit jamais tirer le module
 * MapLibre dans le graphe RSC du Hub. Le composant réel est chargé après le
 * montage, dans le chunk client, comme dans Explorer.
 */
type HubUnifiedMapProps = {
  compact?: boolean;
  trails?: MapTrail[];
  selectedTrail?: MapTrail | null;
  selectedTrailId?: string | null;
  pois?: UnifiedPOI[];
  onPoiClick?: (poi: UnifiedPOI) => void;
  onMapClick?: (lat: number, lng: number) => void;
};

const CATEGORY_BY_LABEL: Array<[RegExp, UnifiedPOI['category']]> = [
  [/eau|source|fontaine|water/i, 'water'],
  [/refuge|g[îi]te|cabane|chalet|hut/i, 'refuge'],
  [/sommet|peak|pic|cime/i, 'summit'],
  [/camping|bivouac|camp/i, 'camping'],
  [/col|pass/i, 'col'],
  [/cascade|waterfall/i, 'waterfall'],
  [/point de vue|panorama|belv[ée]d[èe]re|viewpoint/i, 'viewpoint'],
  // Categories du preparateur de voyage (toute activite).
  [/food|restaurant|resto|table|repas|d[îi]ner|brasserie|caf[ée]/i, 'food'],
  [/stay|h[ôo]tel|g[îi]te|hut|hebergement|nuit/i, 'stay'],
  [/transport|voiture|car|bus|train|avion|plane|bateau|boat|bik[eé]|v[ée]lo/i, 'transport'],
  [/[ée]tape|step|jour/i, 'step'],
];

function poiCategory(category?: string | null, label?: string | null): UnifiedPOI['category'] {
  const haystack = `${category ?? ''} ${label ?? ''}`;
  for (const [pattern, resolvedCategory] of CATEGORY_BY_LABEL) {
    if (pattern.test(haystack)) return resolvedCategory;
  }
  return 'viewpoint';
}

function validCoords(coords: Array<[number, number]>): Array<[number, number]> {
  return coords.filter(
    ([lat, lng]) =>
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Number(lat) >= -90 &&
      Number(lat) <= 90 &&
      Number(lng) >= -180 &&
      Number(lng) <= 180,
  );
}

function validPoiCoords(point: HubRoutePoint): boolean {
  return (
    Number.isFinite(Number(point.lat)) &&
    Number.isFinite(Number(point.lon)) &&
    Number(point.lat) >= -90 &&
    Number(point.lat) <= 90 &&
    Number(point.lon) >= -180 &&
    Number(point.lon) <= 180
  );
}

function firstLngLat(geometry: Record<string, unknown> | null): [number, number] | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const queue: unknown[] = [geometry.coordinates];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!Array.isArray(current)) continue;
    if (
      current.length >= 2 &&
      typeof current[0] === 'number' &&
      typeof current[1] === 'number' &&
      Number.isFinite(current[0]) &&
      Number.isFinite(current[1])
    ) {
      return [Number(current[0]), Number(current[1])];
    }
    for (let index = current.length - 1; index >= 0; index -= 1) {
      queue.unshift(current[index]);
    }
  }
  return null;
}

function poiId(point: HubRoutePoint, index: number): string {
  return point.id?.trim() || `hub-poi-${index}-${point.label}`;
}

export function HubGlobeMap({
  name,
  routeCoords,
  routeGeojson = null,
  highlightCoords = [],
  points = [],
  className = '',
  onMapClick,
}: HubGlobeMapProps) {
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [poiExpanded, setPoiExpanded] = useState(false);

  const selectedTrail = useMemo<MapTrail | null>(() => {
    const realGeometry = sanitizeGeoJSON(routeGeojson);
    const realFirst = firstLngLat(realGeometry);
    const fallback = validCoords([...routeCoords, ...highlightCoords]);
    if (!realGeometry && fallback.length < 2) return null;

    const fallbackCoordinates =
      fallback.length >= 2
        ? fallback.map(([lat, lng]) => [Number(lng), Number(lat)])
        : null;
    const geojson = realGeometry ?? {
      type: 'Feature',
      properties: { name: name || 'Itinéraire' },
      geometry: { type: 'LineString', coordinates: fallbackCoordinates },
    };

    return {
      id: 'hub-selected-itinerary',
      name: name || 'Itinéraire',
      lat: realFirst?.[1] ?? fallback[0]?.[0] ?? null,
      lng: realFirst?.[0] ?? fallback[0]?.[1] ?? null,
      geojson,
    };
  }, [highlightCoords, name, routeCoords, routeGeojson]);

  const validPoints = useMemo(() => points.filter(validPoiCoords), [points]);

  const unifiedPois = useMemo<UnifiedPOI[]>(
    () =>
      validPoints.map((point, index) => ({
        id: poiId(point, index),
        name: point.label,
        category: poiCategory(point.category, point.label),
        lat: Number(point.lat),
        lng: Number(point.lon),
        description: point.description ?? point.label,
        details: point.description ?? point.label,
        source: 'trail_pois',
        is_verified: true,
      })),
    [validPoints],
  );

  const pointByPoiId = useMemo(() => {
    const index = new Map<string, HubRoutePoint>();
    validPoints.forEach((point, pointIndex) => index.set(poiId(point, pointIndex), point));
    return index;
  }, [validPoints]);

  const selectedPoi = unifiedPois.find((poi) => poi.id === selectedPoiId) ?? null;
  const selectedPoint = selectedPoiId ? pointByPoiId.get(selectedPoiId) ?? null : null;
  const [MapComponent, setMapComponent] = useState<ComponentType<HubUnifiedMapProps> | null>(
    null,
  );
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void import('@/components/map/UnifiedExplorerMap')
      .then((module) => {
        if (!active) return;
        setMapComponent(() => module.default);
      })
      .catch((error: unknown) => {
        console.error('[HubGlobeMap] chargement du globe impossible', error);
        if (!active) return;
        setMapLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={`hub-globe-map ${className}`} data-hub-globe-map="true">
      {selectedTrail && MapComponent ? (
        <MapComponent
          compact
          trails={[selectedTrail]}
          selectedTrail={selectedTrail}
          selectedTrailId={selectedTrail.id}
          pois={unifiedPois}
          onPoiClick={(poi) => {
            setSelectedPoiId(poi.id);
            setPoiExpanded(false);
          }}
          onMapClick={onMapClick}
        />
      ) : selectedTrail && !mapLoadFailed ? (
        <div className="hub-globe-map__loading" role="status" aria-live="polite">
          <span className="hub-globe-map__loading-orb" aria-hidden="true" />
          <span>Préparation du globe…</span>
        </div>
      ) : (
        <div className="hub-globe-map__empty">
          <MapPin size={22} aria-hidden="true" />
          <span>{selectedTrail ? 'Globe indisponible' : 'Aucun itinéraire géolocalisé'}</span>
        </div>
      )}

      {unifiedPois.length > 0 ? (
        <div className="hub-globe-poi-rail" aria-label="Points d’intérêt de l’itinéraire">
          {unifiedPois.map((poi, index) => {
            const point = validPoints[index];
            return (
              <button
                key={poi.id}
                type="button"
                onClick={() => {
                  setSelectedPoiId(poi.id);
                  setPoiExpanded(false);
                }}
                aria-pressed={selectedPoiId === poi.id}
                className="hub-globe-poi-chip"
              >
                <span
                  className="hub-globe-poi-chip__dot"
                  style={{ background: point?.color ?? 'rgba(255,255,255,0.78)' }}
                  aria-hidden="true"
                />
                <MapPin size={13} aria-hidden="true" />
                <span>{poi.name}</span>
                {point?.visited ? <Check size={12} aria-label="Déjà visité" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedPoi ? (
        <div className={`hub-globe-poi-card ${poiExpanded ? 'is-expanded' : ''}`}>
          <button
            type="button"
            className="hub-globe-poi-card__main"
            onClick={() => setPoiExpanded((value) => !value)}
            aria-expanded={poiExpanded}
          >
            <span className="hub-globe-poi-card__icon" aria-hidden="true">
              <MapPin size={15} />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                {selectedPoi.category}
              </span>
              <span className="block truncate text-[13px] font-semibold text-white">
                {selectedPoi.name}
              </span>
            </span>
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`ml-auto shrink-0 text-white/70 transition-transform ${poiExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {poiExpanded ? (
            <div className="hub-globe-poi-card__details">
              <p>{selectedPoi.description ?? 'Point d’intérêt de l’itinéraire.'}</p>
              <p className="hub-globe-poi-card__route">
                <Route size={13} aria-hidden="true" />
                {selectedTrail?.name ?? 'Itinéraire'}
              </p>
              <div className="hub-globe-poi-card__meta">
                <span>{selectedPoint?.visited ? 'Déjà visité' : 'À découvrir'}</span>
                {selectedPoint?.stepId ? <span>Étape liée</span> : <span>Voyage entier</span>}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="hub-globe-poi-card__close"
            onClick={() => {
              setSelectedPoiId(null);
              setPoiExpanded(false);
            }}
            aria-label="Fermer le point d’intérêt"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default HubGlobeMap;
