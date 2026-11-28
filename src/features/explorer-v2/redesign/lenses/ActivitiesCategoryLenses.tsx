'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bike,
  Compass,
  Footprints,
  Loader2,
  MapPin,
  Mountain,
  Pencil,
  RefreshCw,
  Route,
  Snowflake,
  TrendingUp,
  Waves,
} from 'lucide-react';
import type { SlotLens } from '@/components/compte/drawer/SlotShell';
import { StaggerCard, StaggerList } from '@/components/carnet/v2/CarnetDrawerMotion';
import type { OutdoorActivityRoute, OutdoorDiscipline } from '@/app/api/explorer/v2/outdoor-routes/route';
import { RouteMiniTraceSvg } from '../components/RouteMiniTraceSvg';
import { computeRouteDifficulty, formatDurationFr, formatRouteNetworkLabel } from '../../poiTaxonomy';
import { distanceKm } from '../../sheet/context';
import type { ExplorerSpotRoute } from './ExplorerCategoryLenses';

/* ── Lens Definitions for Category "activities" (Rando, GR & Activités) ─── */

export const ACTIVITIES_CATEGORY_LENSES: SlotLens[] = [
  { id: 'all', label: 'Tout', icon: <Footprints size={15} aria-hidden="true" /> },
  { id: 'gr', label: 'GR & Rando', icon: <Route size={15} aria-hidden="true" /> },
  { id: 'bike', label: 'Vélo & VTT', icon: <Bike size={15} aria-hidden="true" /> },
  { id: 'mountain', label: 'Alpin & Eau', icon: <Mountain size={15} aria-hidden="true" /> },
];

export type ActivitiesLensGroup = 'all' | 'gr' | 'bike' | 'mountain';
export type OutdoorDisciplineFilter = 'all' | OutdoorDiscipline;
export type ActivitiesSortMode = 'relevance' | 'distance' | 'elevation' | 'nearest';

export interface UnifiedOutdoorRoute extends ExplorerSpotRoute {
  discipline: OutdoorDiscipline;
  source: 'osm' | 'postgis';
  osmRelationId?: number;
  waymarkedTheme?: 'hiking' | 'cycling' | 'mtb' | 'slopes';
  roundtrip?: boolean;
  operator?: string | null;
  sacScale?: string | null;
  fromTo?: string | null;
  centerCoord?: [number, number] | null;
}

const DISCIPLINE_META: Record<
  OutdoorDiscipline,
  { label: string; short: string; color: string; bg: string }
> = {
  gr: { label: 'GR / Grande Rando', short: 'GR', color: '#991B1B', bg: 'rgba(220, 38, 38, 0.12)' },
  hiking: { label: 'Rando & PR', short: 'Rando', color: '#17402C', bg: 'rgba(23, 64, 44, 0.12)' },
  trail: { label: 'Trail', short: 'Trail', color: '#9A3412', bg: 'rgba(234, 88, 12, 0.13)' },
  cycling: { label: 'Vélo / EuroVelo', short: 'Vélo', color: '#1D4ED8', bg: 'rgba(37, 99, 235, 0.12)' },
  mtb: { label: 'VTT', short: 'VTT', color: '#7C2D12', bg: 'rgba(180, 83, 9, 0.13)' },
  winter: { label: 'Ski / Neige', short: 'Neige', color: '#0369A1', bg: 'rgba(14, 165, 233, 0.14)' },
  water: { label: 'Canoë / Eau', short: 'Eau', color: '#0F766E', bg: 'rgba(20, 184, 166, 0.14)' },
  vertical: { label: 'Via Ferrata / Alpin', short: 'Alpin', color: '#6D28D9', bg: 'rgba(124, 58, 237, 0.13)' },
};

const GROUP_DISCIPLINES: Record<ActivitiesLensGroup, readonly OutdoorDiscipline[]> = {
  all: ['gr', 'hiking', 'trail', 'cycling', 'mtb', 'winter', 'water', 'vertical'],
  gr: ['gr', 'hiking', 'trail'],
  bike: ['cycling', 'mtb'],
  mountain: ['winter', 'vertical', 'water'],
};

export function classifySpotRouteDiscipline(route: ExplorerSpotRoute): OutdoorDiscipline {
  const net = (route.network ?? '').toLowerCase();
  const ref = (route.ref ?? '').toUpperCase();
  const name = (route.name ?? '').toUpperCase();

  if (name.includes('VIA FERRATA') || net === 'via_ferrata') return 'vertical';
  if (net === 'ski' || net === 'piste' || name.includes('SKI') || name.includes('RAQUETTE')) return 'winter';
  if (net === 'canoe' || net === 'kayak' || name.includes('CANO') || name.includes('KAYAK')) return 'water';
  if (net === 'mtb' || name.includes('VTT') || ref.startsWith('VTT')) return 'mtb';
  if (net === 'icn' || net === 'ncn' || net === 'rcn' || net === 'lcn' || net === 'bicycle' || ref.startsWith('EV')) {
    return 'cycling';
  }
  if (net === 'running' || name.includes('TRAIL')) return 'trail';
  if (
    net === 'iwn' ||
    net === 'nwn' ||
    net === 'rwn' ||
    /\bGR[P]?\s*\d*/.test(ref) ||
    /\bGR[P]?\s*\d+/.test(name) ||
    ref.includes('TMB') ||
    ref.includes('HRP') ||
    name.includes('TOUR DU ')
  ) {
    return 'gr';
  }
  return 'hiking';
}

function firstCoordOfGeojson(geojson: unknown): [number, number] | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const obj = geojson as Record<string, unknown>;
  if (obj.type === 'Feature') return firstCoordOfGeojson(obj.geometry);
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      const c = firstCoordOfGeojson(f);
      if (c) return c;
    }
    return null;
  }
  const coords = obj.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;
  if (obj.type === 'LineString' && Array.isArray(coords[0]) && coords[0].length >= 2) {
    return [Number(coords[0][0]), Number(coords[0][1])];
  }
  if (
    obj.type === 'MultiLineString' &&
    Array.isArray(coords[0]) &&
    Array.isArray(coords[0][0]) &&
    coords[0][0].length >= 2
  ) {
    return [Number(coords[0][0][0]), Number(coords[0][0][1])];
  }
  return null;
}

export interface OutdoorRoutesQueryResponse {
  routes: OutdoorActivityRoute[];
  fetchedAt: string;
  bbox: [number, number, number, number];
  clamped: boolean;
  degraded?: boolean;
}

/**
 * Fetches live GR, hiking, trail, cycling, MTB, winter, water & vertical routes
 * from the interconnected OpenStreetMap Overpass API for the active map viewport.
 */
export function useOutdoorActivityRoutes(params: {
  lat: number;
  lng: number;
  bbox: { south: number; west: number; north: number; east: number } | null;
  group: ActivitiesLensGroup;
  enabled: boolean;
}) {
  const qLat = Math.round(params.lat * 40) / 40;
  const qLng = Math.round(params.lng * 40) / 40;
  const qSpan = params.bbox
    ? Math.round(Math.max(params.bbox.north - params.bbox.south, 0.04) * 20) / 20
    : 0.16;

  return useQuery<OutdoorRoutesQueryResponse>({
    queryKey: ['explorer-v2', 'outdoor-routes', params.group, qLat, qLng, qSpan],
    enabled: params.enabled && Number.isFinite(params.lat) && Number.isFinite(params.lng),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({
        lat: String(params.lat),
        lng: String(params.lng),
        group: params.group,
        limit: '36',
      });
      if (params.bbox) {
        qs.set('minLat', String(params.bbox.south));
        qs.set('maxLat', String(params.bbox.north));
        qs.set('minLng', String(params.bbox.west));
        qs.set('maxLng', String(params.bbox.east));
      }
      const res = await fetch(`/api/explorer/v2/outdoor-routes?${qs.toString()}`, { signal });
      if (!res.ok) {
        return {
          routes: [],
          fetchedAt: new Date().toISOString(),
          bbox: [params.lng - 0.08, params.lat - 0.08, params.lng + 0.08, params.lat + 0.08],
          clamped: false,
          degraded: true,
        };
      }
      return (await res.json()) as OutdoorRoutesQueryResponse;
    },
  });
}

export function mergeOutdoorAndPlaceRoutes(
  placeRoutes: ExplorerSpotRoute[],
  osmRoutes: OutdoorActivityRoute[],
): UnifiedOutdoorRoute[] {
  const out: UnifiedOutdoorRoute[] = [];
  const seenKeys = new Set<string>();

  // 1. Keep local Supabase/PostGIS routes first (indexed, full elevation & instant)
  for (const r of placeRoutes) {
    if (!r.name && !r.ref) continue;
    const normKey = `${(r.ref || '').toLowerCase().trim()}::${(r.name || '').toLowerCase().trim()}`;
    seenKeys.add(normKey);
    out.push({
      ...r,
      discipline: classifySpotRouteDiscipline(r),
      source: 'postgis',
      centerCoord: firstCoordOfGeojson(r.geojson),
    });
  }

  // 2. Append live OSM outdoor activity routes (GR, PR, EuroVelo, VTT, Ski, Canoë, Via Ferrata)
  for (const r of osmRoutes) {
    const normKey = `${(r.ref || '').toLowerCase().trim()}::${(r.name || '').toLowerCase().trim()}`;
    if (seenKeys.has(normKey)) continue;
    seenKeys.add(normKey);
    out.push({
      id: r.id,
      name: r.name,
      ref: r.ref,
      network: r.network,
      distance_km: r.distance_km,
      elev_gain_m: r.elev_gain_m,
      geojson: r.geojson,
      discipline: r.discipline,
      source: 'osm',
      osmRelationId: r.osmRelationId,
      waymarkedTheme: r.waymarkedTheme,
      roundtrip: r.roundtrip,
      operator: r.operator,
      sacScale: r.sacScale,
      fromTo: r.fromTo,
      centerCoord: r.center,
    });
  }

  return out;
}

function DisciplineIcon({ discipline }: { discipline: OutdoorDiscipline }) {
  switch (discipline) {
    case 'gr':
      return <Route size={13} aria-hidden="true" />;
    case 'cycling':
    case 'mtb':
      return <Bike size={13} aria-hidden="true" />;
    case 'winter':
      return <Snowflake size={13} aria-hidden="true" />;
    case 'water':
      return <Waves size={13} aria-hidden="true" />;
    case 'vertical':
      return <Mountain size={13} aria-hidden="true" />;
    case 'trail':
    case 'hiking':
    default:
      return <Footprints size={13} aria-hidden="true" />;
  }
}

export interface ActivitiesRoutesLensProps {
  group: ActivitiesLensGroup;
  routes: UnifiedOutdoorRoute[];
  center: [number, number];
  selectedRouteId: number | null;
  loading: boolean;
  fetchingLive: boolean;
  clamped?: boolean;
  locationLabel: string;
  onSelectRoute: (route: UnifiedOutdoorRoute) => void;
  onFocusRouteOnMap: (route: UnifiedOutdoorRoute) => void;
  onRefresh: () => void;
  onOpenPlanner: () => void;
}

export function ActivitiesRoutesLens({
  group,
  routes,
  center,
  selectedRouteId,
  loading,
  fetchingLive,
  clamped = false,
  locationLabel,
  onSelectRoute,
  onFocusRouteOnMap,
  onRefresh,
  onOpenPlanner,
}: ActivitiesRoutesLensProps) {
  const [disciplineFilter, setDisciplineFilter] = useState<OutdoorDisciplineFilter>('all');
  const [sortBy, setSortBy] = useState<ActivitiesSortMode>('relevance');

  const allowedForGroup = GROUP_DISCIPLINES[group];

  const groupScopedRoutes = useMemo(
    () => routes.filter((r) => allowedForGroup.includes(r.discipline)),
    [allowedForGroup, routes],
  );

  const disciplineCounts = useMemo(() => {
    const counts: Partial<Record<OutdoorDiscipline, number>> = {};
    for (const r of groupScopedRoutes) {
      counts[r.discipline] = (counts[r.discipline] ?? 0) + 1;
    }
    return counts;
  }, [groupScopedRoutes]);

  const effectiveFilter =
    disciplineFilter === 'all' || allowedForGroup.includes(disciplineFilter)
      ? disciplineFilter
      : 'all';

  const visibleRoutes = useMemo(() => {
    const base =
      effectiveFilter === 'all'
        ? groupScopedRoutes
        : groupScopedRoutes.filter((r) => r.discipline === effectiveFilter);

    const list = base.slice();
    if (sortBy === 'distance') {
      list.sort((a, b) => (b.distance_km ?? 0) - (a.distance_km ?? 0));
    } else if (sortBy === 'elevation') {
      list.sort((a, b) => (b.elev_gain_m ?? 0) - (a.elev_gain_m ?? 0));
    } else if (sortBy === 'nearest') {
      list.sort((a, b) => {
        const da = a.centerCoord ? distanceKm(center, a.centerCoord) : 9999;
        const db = b.centerCoord ? distanceKm(center, b.centerCoord) : 9999;
        return da - db;
      });
    }
    return list;
  }, [center, effectiveFilter, groupScopedRoutes, sortBy]);

  return (
    <div className="xp20-act-lens" data-testid="xp20-activities-lens">
      {/* Header Strip: Live Map Sync + Traceur Shortcut + Refresh */}
      <div className="xp20-act-head">
        <div className="xp20-act-head-copy">
          <span className="xp20-act-eyebrow">
            <span
              className={`xp20-act-live-dot${fetchingLive ? ' is-busy' : ''}`}
              aria-hidden="true"
            />
            {fetchingLive
              ? 'Synchronisation OSM…'
              : `${visibleRoutes.length} parcours · ${locationLabel}`}
          </span>
          {clamped ? (
            <span className="xp20-act-subnote">Zone centrée sur la carte — zoomez pour plus de sentiers locaux</span>
          ) : null}
        </div>
        <div className="xp20-act-head-actions">
          <button
            type="button"
            className="xp20-act-pill-btn is-primary xp20-tactile"
            onClick={onOpenPlanner}
            title="Tracer un itinéraire sur la carte"
          >
            <Pencil size={12} aria-hidden="true" />
            <span>Tracer</span>
          </button>
          <button
            type="button"
            className="xp20-act-icon-btn xp20-tactile"
            onClick={onRefresh}
            aria-label="Actualiser les parcours sur cette zone"
            title="Actualiser"
          >
            <RefreshCw size={13} className={fetchingLive ? 'xp20-route-spin' : undefined} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Discipline Filter Chips */}
      <div className="xp20-act-chips" role="tablist" aria-label="Filtrer par discipline outdoor">
        <button
          type="button"
          role="tab"
          aria-selected={effectiveFilter === 'all'}
          className={`xp20-act-chip xp20-tactile${effectiveFilter === 'all' ? ' is-active' : ''}`}
          onClick={() => setDisciplineFilter('all')}
        >
          <span>Tous</span>
          <span className="xp20-act-chip-count">{groupScopedRoutes.length}</span>
        </button>

        {allowedForGroup.map((disc) => {
          const count = disciplineCounts[disc] ?? 0;
          if (count === 0 && effectiveFilter !== disc) return null;
          const meta = DISCIPLINE_META[disc];
          const active = effectiveFilter === disc;
          return (
            <button
              key={disc}
              type="button"
              role="tab"
              aria-selected={active}
              className={`xp20-act-chip xp20-tactile${active ? ' is-active' : ''}`}
              onClick={() => setDisciplineFilter(disc)}
            >
              <DisciplineIcon discipline={disc} />
              <span>{meta.short}</span>
              <span className="xp20-act-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Sort Row */}
      {visibleRoutes.length > 1 ? (
        <div className="xp20-act-sort-row" aria-label="Trier les parcours">
          {(
            [
              ['relevance', 'GR & Phares'],
              ['nearest', 'Proches'],
              ['distance', 'Distance'],
              ['elevation', 'Dénivelé'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`xp20-act-sort-pill${sortBy === id ? ' is-active' : ''}`}
              onClick={() => setSortBy(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Loading State */}
      {loading && visibleRoutes.length === 0 ? (
        <div className="xp20-act-loading" role="status">
          <Loader2 size={20} className="xp20-route-spin" aria-hidden="true" />
          <span>Recherche des GR, sentiers et parcours sur la carte…</span>
        </div>
      ) : visibleRoutes.length === 0 ? (
        <div className="xp20-act-empty">
          <Compass size={22} aria-hidden="true" />
          <strong>Aucun parcours balisé dans cette fenêtre</strong>
          <p>
            Déplacez ou zoomez la carte sur un massif, une forêt ou un littoral, ou tracez votre propre itinéraire.
          </p>
          <div className="xp20-act-empty-actions">
            <button type="button" className="xp20-act-pill-btn is-primary xp20-tactile" onClick={onOpenPlanner}>
              <Pencil size={13} aria-hidden="true" />
              <span>Tracer sur la carte</span>
            </button>
            <button type="button" className="xp20-act-pill-btn xp20-tactile" onClick={onRefresh}>
              <RefreshCw size={13} aria-hidden="true" />
              <span>Rechercher ici</span>
            </button>
          </div>
        </div>
      ) : (
        <StaggerList className="xp20-act-grid">
          {visibleRoutes.map((route) => {
            const discMeta = DISCIPLINE_META[route.discipline];
            const netLabel = formatRouteNetworkLabel(route.network, route.ref);
            const badgeText = route.ref?.trim() || netLabel.shortBadge || discMeta.short;
            const distFromCenter = route.centerCoord ? distanceKm(center, route.centerCoord) : null;
            const diff = computeRouteDifficulty({
              distanceKm: route.distance_km,
              elevGainM: route.elev_gain_m ?? null,
              network: route.network,
            });
            const estMinutes =
              route.distance_km != null && route.distance_km > 0
                ? Math.round(
                    (route.distance_km /
                      (route.discipline === 'cycling'
                        ? 18
                        : route.discipline === 'mtb'
                          ? 12
                          : route.discipline === 'trail'
                            ? 7.5
                            : 4)) *
                      60 +
                      ((route.elev_gain_m ?? 0) / 300) * 30,
                  )
                : null;
            const isSelected = selectedRouteId === route.id;

            return (
              <StaggerCard key={`${route.source}-${route.id}`} className="xp20-act-card-wrap">
                <div
                  className={`xp20-act-card xp20-card-press${isSelected ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectRoute(route)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectRoute(route);
                    }
                  }}
                >
                  {/* Visual Trace Header */}
                  <div className="xp20-act-card-visual">
                    <span
                      className="xp20-act-badge"
                      style={{ color: discMeta.color, background: discMeta.bg }}
                    >
                      <DisciplineIcon discipline={route.discipline} />
                      <span>{badgeText}</span>
                    </span>

                    <button
                      type="button"
                      className="xp20-act-focus-btn xp20-tactile"
                      aria-label={`Centrer la carte sur ${route.name || badgeText}`}
                      title="Voir sur la carte"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocusRouteOnMap(route);
                      }}
                    >
                      <MapPin size={13} aria-hidden="true" />
                    </button>

                    <div className="xp20-act-trace-box">
                      {route.geojson ? (
                        <RouteMiniTraceSvg geojson={route.geojson} width={120} height={46} />
                      ) : (
                        <Route size={24} className="xp20-act-trace-fallback" aria-hidden="true" />
                      )}
                    </div>
                  </div>

                  {/* Info Body */}
                  <div className="xp20-act-card-body">
                    <strong className="xp20-act-card-title">
                      {route.name || `${discMeta.label} ${route.ref ?? ''}`.trim()}
                    </strong>

                    <div className="xp20-act-card-meta">
                      {route.distance_km != null ? (
                        <span>{route.distance_km.toFixed(1)} km</span>
                      ) : null}
                      {route.elev_gain_m != null && route.elev_gain_m > 0 ? (
                        <span>
                          <TrendingUp size={10} aria-hidden="true" />+{route.elev_gain_m} m
                        </span>
                      ) : null}
                      {estMinutes != null ? <span>{formatDurationFr(estMinutes)}</span> : null}
                    </div>

                    <div className="xp20-act-card-foot">
                      <span className="xp20-act-diff">{diff.label}</span>
                      {distFromCenter != null && distFromCenter < 250 ? (
                        <span className="xp20-act-dist">
                          {distFromCenter < 1
                            ? `${Math.round(distFromCenter * 1000)} m`
                            : `${distFromCenter.toFixed(0)} km`}
                        </span>
                      ) : (
                        <span className="xp20-act-dist">
                          {route.source === 'osm' ? 'OSM Live' : 'Topo'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </StaggerCard>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}

export default ActivitiesRoutesLens;
