'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bike,
  Bookmark,
  Check,
  Clock,
  Cloud,
  CloudRain,
  Coins,
  Compass,
  Download,
  Droplets,
  ExternalLink,
  Flag,
  Footprints,
  Globe2,
  Home,
  Languages,
  MapPin,
  Mountain,
  Navigation,
  Phone,
  Play,
  Route,
  Share2,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Tent,
  TrendingDown,
  TrendingUp,
  Users,
  Waves,
  WifiOff,
  Wind,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SlotLens } from '@/components/compte/drawer/SlotShell';
import {
  AnimatedNumber,
  CARNET_SPRING,
  StackSlideView,
  StaggerCard,
  StaggerList,
} from '@/components/carnet/v2/CarnetDrawerMotion';
import {
  CollapsibleHeroPreview,
  useScrollCollapsePreview,
} from '@/features/community/v2/create/photo/CollapsibleHeroPreview';
import { ClubEmptyCard } from '@/components/clubs/drawer/ClubSharedUi';
import type { CountryDetails, PoiItem, RouteDetailPayload, RouteItem, TerrainReport } from '../../data/hooks';
import type { TerritorialEncyclopediaEntry } from '../../data/unifiedLayersHooks';
import type {
  ActivityPresetRecommendation,
  ExplorerReadiness,
  OutingFitResult,
  SafeEtaResult,
} from '../../adaptive/types';
import type { SpatialScale } from '../../state/spatialScale';
import type { Sport } from '../../state/types';
import { RouteMiniTraceSvg } from '../components/RouteMiniTraceSvg';
import {
  buildWeatherAdviceFr,
  computeRouteDifficulty,
  formatDurationFr,
  formatEmergencyServiceLabelFr,
  formatReportCategoryFr,
  formatRouteNetworkLabel,
  resolvePoiPresentation,
} from '../../poiTaxonomy';
import { renderPoiIcon } from './ExplorerPoiDetailView';
import { distanceKm } from '../../sheet/context';

/* ── Category 1 Lens Definitions ──────────────────────────────────────────── */

export const EXPLORER_CATEGORY_LENSES: SlotLens[] = [
  { id: 'spots', label: 'Lieux & Parcours', icon: <Mountain size={15} aria-hidden="true" /> },
  { id: 'territory', label: 'Territoire', icon: <Globe2 size={15} aria-hidden="true" /> },
];

/* ── Shared Types & Helpers ───────────────────────────────────────────────── */

export type ExplorerSpotRoute = RouteItem & {
  elev_gain_m?: number | null;
  elevationGainM?: number | null;
  max_alt_m?: number | null;
  duration_label?: string | null;
};

export interface ExplorerRouteElevationPoint {
  km: number;
  ele: number;
  lat?: number;
  lng?: number;
  slopePct?: number;
}

export interface ExplorerRouteDetailWeather {
  tempC?: number | null;
  windKmh?: number | null;
  symbol?: string | null;
  label?: string | null;
}

function isSafeHttpsUrl(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('https://') && trimmed.length > 10;
}

function formatNetworkBadge(route: Pick<RouteItem, 'network' | 'ref'>): string {
  return formatRouteNetworkLabel(route.network, route.ref).shortBadge;
}

function resolveRouteElevationGain(route: ExplorerSpotRoute, explicitGain?: number | null): number | null {
  if (typeof explicitGain === 'number' && Number.isFinite(explicitGain)) return Math.round(explicitGain);
  if (typeof route.elev_gain_m === 'number' && Number.isFinite(route.elev_gain_m)) {
    return Math.round(route.elev_gain_m);
  }
  if (typeof route.elevationGainM === 'number' && Number.isFinite(route.elevationGainM)) {
    return Math.round(route.elevationGainM);
  }
  return null;
}

function formatTimeHm(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function extractFirstCoord(geojson: unknown): [number, number] | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const obj = geojson as Record<string, unknown>;
  if (obj.type === 'Feature') return extractFirstCoord(obj.geometry);
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      const c = extractFirstCoord(f);
      if (c) return c;
    }
    return null;
  }
  const coords = obj.coordinates;
  if (!Array.isArray(coords)) return null;
  const walk = (node: unknown): [number, number] | null => {
    if (!Array.isArray(node)) return null;
    if (
      typeof node[0] === 'number' &&
      typeof node[1] === 'number' &&
      Number.isFinite(node[0]) &&
      Number.isFinite(node[1])
    ) {
      return [node[0], node[1]];
    }
    for (const child of node) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(coords);
}

function poiMeta(kind: string, subtype?: string | null): { icon: React.ReactNode; badge: string; color: string } {
  const pres = resolvePoiPresentation(kind, subtype);
  return {
    icon: renderPoiIcon(pres.iconKey, 20, pres.color),
    badge: pres.shortBadge,
    color: pres.color,
  };
}

function renderWeatherIcon(symbol?: string | null) {
  const norm = (symbol ?? '').toLowerCase();
  if (norm.includes('rain') || norm.includes('sleet') || norm.includes('drizzle') || norm.includes('shower')) {
    return <CloudRain size={16} color="#17402C" aria-hidden="true" />;
  }
  if (norm.includes('snow')) {
    return <Snowflake size={16} color="#17402C" aria-hidden="true" />;
  }
  if (norm.includes('cloud') || norm.includes('fog')) {
    return <Cloud size={16} color="#17402C" aria-hidden="true" />;
  }
  return <Sun size={16} color="#17402C" aria-hidden="true" />;
}

const SCALE_LABELS_FR: Record<SpatialScale, string> = {
  world: 'Monde',
  continent: 'Continent',
  country: 'Pays',
  region: 'Région',
  city: 'Ville',
  sector: 'Secteur',
};

const SPORT_META: Record<Sport, { label: string; icon: React.ReactNode }> = {
  rando: { label: 'Rando', icon: <Mountain size={17} aria-hidden="true" /> },
  trail: { label: 'Trail', icon: <Footprints size={17} aria-hidden="true" /> },
  course: { label: 'Course', icon: <Activity size={17} aria-hidden="true" /> },
  velo: { label: 'Vélo', icon: <Bike size={17} aria-hidden="true" /> },
  kayak: { label: 'Nautique', icon: <Waves size={17} aria-hidden="true" /> },
  ski: { label: 'Ski', icon: <Snowflake size={17} aria-hidden="true" /> },
  escalade: { label: 'Escalade', icon: <Compass size={17} aria-hidden="true" /> },
  famille: { label: 'Balade', icon: <Users size={17} aria-hidden="true" /> },
  bivouac: { label: 'Bivouac', icon: <Tent size={17} aria-hidden="true" /> },
};

/* ── Lens 1.0: ExplorerSpotsLens ──────────────────────────────────────────── */

export interface ExplorerFeaturedDestination {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  coords: [number, number];
  zoom: number;
  iso?: string;
}

const FEATURED_DESTINATIONS: readonly ExplorerFeaturedDestination[] = [
  {
    id: 'chamonix',
    name: 'Chamonix · Mont-Blanc',
    subtitle: 'Sommets 4 806 m · GR & refuges',
    badge: 'Alpes',
    coords: [6.8694, 45.9237],
    zoom: 12.5,
    iso: 'FR',
  },
  {
    id: 'ecrins',
    name: 'Massif des Écrins',
    subtitle: 'Haute montagne · Lacs glaciaires',
    badge: 'Isère',
    coords: [6.3596, 44.9222],
    zoom: 11.8,
    iso: 'FR',
  },
  {
    id: 'gavarnie',
    name: 'Cirque de Gavarnie',
    subtitle: 'Cascades & cols · GR 10',
    badge: 'Pyrénées',
    coords: [-0.0102, 42.7327],
    zoom: 12.5,
    iso: 'FR',
  },
  {
    id: 'corse',
    name: 'GR 20 · Corse',
    subtitle: 'Crêtes granitiques & refuges',
    badge: 'Corse',
    coords: [9.0512, 42.2665],
    zoom: 11.5,
    iso: 'FR',
  },
  {
    id: 'vercors',
    name: 'Hauts Plateaux du Vercors',
    subtitle: 'Bivouac, cabanes & falaises',
    badge: 'Préalpes',
    coords: [5.475, 44.97],
    zoom: 11.8,
    iso: 'FR',
  },
  {
    id: 'vosges',
    name: 'Crêtes des Vosges',
    subtitle: 'Ballons, lacs & GR 5',
    badge: 'Vosges',
    coords: [7.0124, 48.0361],
    zoom: 12,
    iso: 'FR',
  },
  {
    id: 'dolomites',
    name: 'Dolomites · Cortina',
    subtitle: 'Via ferrata & sommets calcaires',
    badge: 'Italie',
    coords: [12.1357, 46.5405],
    zoom: 12,
    iso: 'IT',
  },
  {
    id: 'zermatt',
    name: 'Valais · Zermatt',
    subtitle: 'Cervin · Sentiers alpins',
    badge: 'Suisse',
    coords: [7.7491, 46.0207],
    zoom: 12,
    iso: 'CH',
  },
];

export interface ExplorerSpotsLensProps {
  routes: readonly ExplorerSpotRoute[];
  pois?: readonly PoiItem[];
  center?: [number, number];
  zoom?: number;
  selectedRouteId?: number | null;
  loading?: boolean;
  onSelectRoute: (route: ExplorerSpotRoute) => void;
  onSelectPoi?: (poi: PoiItem) => void;
  onSelectDestination?: (dest: ExplorerFeaturedDestination) => void;
  onFocusCoordinates: (coords: [number, number], label?: string) => void;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}

function spotDistanceKm(center: [number, number] | undefined, lat: number, lon: number): number | null {
  if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return null;
  const R = 6371;
  const dLat = ((lat - center[1]) * Math.PI) / 180;
  const dLng = ((lon - center[0]) * Math.PI) / 180;
  const r1 = (center[1] * Math.PI) / 180;
  const r2 = (lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

const clientPoiThumbCache = new Map<string, string | null>();

function SpotPoiThumb({
  imageUrl,
  alt,
  icon,
  badge,
}: {
  imageUrl?: string | null;
  alt: string;
  icon: React.ReactNode;
  badge: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);
  const safeImg = !imgFailed && isSafeHttpsUrl(imageUrl) ? imageUrl : null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: 13,
        background: 'linear-gradient(145deg, #E8F0E7 0%, #D7E6D4 100%)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 0.5px rgba(23, 64, 44, 0.1)',
      }}
    >
      {safeImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeImg}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 200 125"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.45 }}
          >
            <path
              d="M-10 95 Q45 58 100 76 T210 55 M-10 72 Q52 34 108 54 T210 32 M-10 116 Q60 85 115 98 T210 82 M20 125 Q85 95 145 112 T210 100"
              fill="none"
              stroke="#5B7F55"
              strokeWidth="1.25"
            />
          </svg>
          <span
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.9)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 8px rgba(23, 43, 36, 0.1)',
            }}
          >
            {icon}
          </span>
        </>
      )}
      <span
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          padding: '2px 7px',
          borderRadius: 999,
          background: safeImg ? 'rgba(23, 43, 36, 0.62)' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: safeImg ? 'blur(10px)' : undefined,
          WebkitBackdropFilter: safeImg ? 'blur(10px)' : undefined,
          color: safeImg ? '#FBFAF6' : '#17402C',
          fontSize: 10,
          fontWeight: 700,
          boxShadow: '0 1px 4px rgba(23, 43, 36, 0.12)',
        }}
      >
        {badge}
      </span>
    </div>
  );
}

export function ExplorerSpotsLens({
  routes,
  pois = [],
  center,
  zoom = 12,
  selectedRouteId = null,
  loading = false,
  onSelectRoute,
  onSelectPoi,
  onSelectDestination,
  onFocusCoordinates,
  onEmptyAction,
  emptyActionLabel = 'Explorer la zone',
}: ExplorerSpotsLensProps) {
  const notablePois = useMemo(() => pois.slice(0, 14), [pois]);
  const [hydratedThumbs, setHydratedThumbs] = useState<Record<string, string>>({});

  // Non-blocking background hydration of real POI photos (Wikipedia + Wikimedia Commons Geosearch)
  // so the list renders instantaneously while real photographs stream in smoothly.
  const missingThumbKey = useMemo(
    () =>
      notablePois
        .filter((p) => !isSafeHttpsUrl(p.imageUrl) && !clientPoiThumbCache.has(p.id))
        .map((p) => p.id)
        .join('|'),
    [notablePois],
  );

  useEffect(() => {
    if (!missingThumbKey) return;
    const missing = notablePois.filter(
      (p) =>
        !isSafeHttpsUrl(p.imageUrl) &&
        !clientPoiThumbCache.has(p.id) &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        p.name.trim().length > 1,
    );
    if (missing.length === 0) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch('/api/explorer/v2/poi-thumbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pois: missing.slice(0, 14).map((p) => ({
            id: p.id,
            name: p.name,
            lat: p.lat,
            lon: p.lon,
            kind: p.kind,
          })),
        }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? (res.json() as Promise<{ thumbs?: Record<string, string> }>) : null))
        .then((data) => {
          if (controller.signal.aborted || !data?.thumbs) return;
          const nextEntries: Record<string, string> = {};
          for (const p of missing) {
            const found = data.thumbs[p.id];
            if (isSafeHttpsUrl(found)) {
              clientPoiThumbCache.set(p.id, found);
              nextEntries[p.id] = found;
            } else {
              clientPoiThumbCache.set(p.id, null);
            }
          }
          if (Object.keys(nextEntries).length > 0) {
            setHydratedThumbs((prev) => ({ ...prev, ...nextEntries }));
          }
        })
        .catch(() => {
          /* fail-open: keep calm topo fallback */
        });
    }, 80);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingThumbKey]);

  if (loading && routes.length === 0 && notablePois.length === 0) {
    return (
      <div
        aria-busy="true"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          paddingBottom: 60,
        }}
      >
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="club-glass-card"
            style={{
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              className="xp20-shimmer"
              style={{
                width: '100%',
                aspectRatio: '16 / 10',
                borderRadius: 13,
              }}
            />
            <div
              className="xp20-shimmer"
              style={{
                height: 12,
                width: '76%',
                borderRadius: 999,
              }}
            />
            <div
              className="xp20-shimmer"
              style={{
                height: 10,
                width: '48%',
                borderRadius: 999,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // At globe / country overview zoom (< 6.5), present the curated destinations atlas
  // so users zoomed all the way out can jump into a massif in 1 tap.
  if (zoom < 6.5 && onSelectDestination) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Massifs & destinations à explorer
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6E7F76' }}>
            Touchez pour plonger
          </span>
        </div>
        <StaggerList
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 9,
          }}
        >
          {FEATURED_DESTINATIONS.map((dest) => (
            <StaggerCard
              key={dest.id}
              asButton
              className="club-glass-card"
              onClick={() => onSelectDestination(dest)}
              style={{
                padding: '11px 11px',
                border: 0,
                borderRadius: 18,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 'fit-content',
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'rgba(150, 186, 142, 0.24)',
                  color: '#17402C',
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {dest.badge}
              </span>
              <strong
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#172B24',
                  lineHeight: 1.2,
                }}
              >
                {dest.name}
              </strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#56665D',
                  lineHeight: 1.3,
                }}
              >
                {dest.subtitle}
              </span>
            </StaggerCard>
          ))}
        </StaggerList>
      </div>
    );
  }

  if (routes.length === 0 && notablePois.length === 0) {
    return (
      <div style={{ paddingBottom: 60 }}>
        <ClubEmptyCard
          icon={<Mountain size={20} color="#17402C" aria-hidden="true" />}
          title="Aucun lieu ou itinéraire dans cette zone"
          description="Dézoomez légèrement ou recherchez un autre secteur."
          actions={
            onEmptyAction ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                onClick={onEmptyAction}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {emptyActionLabel}
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <StaggerList
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
        paddingBottom: 60,
      }}
    >
      {routes.map((route) => {
        const active = selectedRouteId !== null && selectedRouteId === route.id;
        const badge = formatNetworkBadge(route);
        const title = route.name?.trim() || route.ref?.trim() || `Itinéraire #${route.id}`;
        const dPlus = resolveRouteElevationGain(route);

        return (
          <StaggerCard
            key={`route-${route.id}`}
            asButton
            className={`club-glass-card${active ? ' is-active-club' : ''}`}
            onClick={() => onSelectRoute(route)}
            style={{
              padding: 8,
              border: 0,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              minWidth: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 10',
                borderRadius: 13,
                background: '#EFF4EE',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 0 0.5px rgba(23, 64, 44, 0.08)',
              }}
            >
              <RouteMiniTraceSvg geojson={route.geojson} />
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#17402C',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 4px rgba(23, 43, 36, 0.08)',
                }}
              >
                {badge}
              </span>
            </div>

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: '#172B24',
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                padding: '0 2px',
                minHeight: 31,
              }}
            >
              {title}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 2px 2px',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#56665D',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Route size={12} color="#17402C" aria-hidden="true" />
                {route.distance_km != null ? (
                  <AnimatedNumber value={route.distance_km} suffix=" km" maximumFractionDigits={1} />
                ) : (
                  '—'
                )}
              </span>
              {dPlus !== null ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <TrendingUp size={12} color="#5B7F55" aria-hidden="true" />
                  <AnimatedNumber value={dPlus} prefix="+" suffix=" m" />
                </span>
              ) : null}
            </div>
          </StaggerCard>
        );
      })}

      {notablePois.map((poi) => {
        const meta = poiMeta(poi.kind, poi.subtype);
        const pres = resolvePoiPresentation(poi.kind, poi.subtype);
        const distKm = spotDistanceKm(center, poi.lat, poi.lon);
        const resolvedImg =
          poi.imageUrl ?? hydratedThumbs[poi.id] ?? clientPoiThumbCache.get(poi.id) ?? null;
        return (
          <StaggerCard
            key={`poi-${poi.id}`}
            asButton
            className="club-glass-card"
            onClick={() => {
              if (onSelectPoi) {
                onSelectPoi(resolvedImg ? { ...poi, imageUrl: resolvedImg } : poi);
              } else {
                onFocusCoordinates([poi.lon, poi.lat], poi.name);
              }
            }}
            style={{
              padding: 8,
              border: 0,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              minWidth: 0,
            }}
          >
            <SpotPoiThumb
              imageUrl={resolvedImg}
              alt={poi.name}
              icon={meta.icon}
              badge={meta.badge}
            />

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: '#172B24',
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                padding: '0 2px',
                minHeight: 31,
              }}
            >
              {poi.name}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                padding: '0 2px 2px',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#56665D',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {poi.ele_m != null ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Mountain size={12} color="#17402C" aria-hidden="true" />
                  <AnimatedNumber value={Math.round(poi.ele_m)} suffix=" m" />
                </span>
              ) : poi.potable ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#0284C7' }}>
                  <Droplets size={12} aria-hidden="true" />
                  Potable
                </span>
              ) : poi.capacity ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#9A3412' }}>
                  <Home size={12} aria-hidden="true" />
                  {poi.capacity} pl.
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: pres.color,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renderPoiIcon(pres.iconKey, 12, pres.color)}
                  <span>{pres.shortBadge}</span>
                </span>
              )}
              {distKm !== null ? (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#56665D', flex: 'none' }}>
                  {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${Math.round(distKm)} km`}
                </span>
              ) : null}
            </div>
          </StaggerCard>
        );
      })}
    </StaggerList>
  );
}

/* ── Detail View: ExplorerRouteDetailView ─────────────────────────────────── */

export interface ExplorerRouteDetailViewProps {
  route: ExplorerSpotRoute;
  routeDetail?: RouteDetailPayload | null;
  routeDetailLoading?: boolean;
  nearbyPois?: readonly PoiItem[];
  reports?: readonly TerrainReport[];
  onSelectNearbyPoi?: (poi: PoiItem) => void;
  elevationPoints?: readonly ExplorerRouteElevationPoint[];
  maxAltM?: number | null;
  elevGainM?: number | null;
  etaLabel?: string | null;
  weather?: ExplorerRouteDetailWeather | null;
  safeEta?: SafeEtaResult | null;
  outingFit?: OutingFitResult | null;
  onClose: () => void;
  onFocusCoordinates: (coords: [number, number], label?: string) => void;
  onExportGpx?: () => void;
  onDownloadOffline?: () => void;
  onToggleSave?: () => void;
  isSaved?: boolean;
  onOpenReport?: () => void;
  onPlanApproach?: () => void;
}

function fitScoreLabelFr(score: number, vetoed: boolean): string {
  if (vetoed || score < 40) return 'Conditions difficiles';
  if (score >= 80) return 'Conditions idéales';
  if (score >= 60) return 'Conditions correctes';
  return 'Vigilance conseillée';
}

export function ExplorerRouteDetailView({
  route,
  routeDetail = null,
  routeDetailLoading = false,
  nearbyPois = [],
  reports = [],
  onSelectNearbyPoi,
  elevationPoints = [],
  maxAltM = null,
  elevGainM = null,
  etaLabel = null,
  weather = null,
  safeEta = null,
  outingFit = null,
  onClose,
  onFocusCoordinates,
  onExportGpx,
  onDownloadOffline,
  onToggleSave,
  isSaved = false,
  onOpenReport,
  onPlanApproach,
}: ExplorerRouteDetailViewProps) {
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const title = route.name?.trim() || route.ref?.trim() || `Itinéraire #${route.id}`;
  const networkMeta = formatRouteNetworkLabel(route.network, route.ref);

  const mergedElevationPoints = useMemo<readonly ExplorerRouteElevationPoint[]>(() => {
    if (elevationPoints.length > 1) return elevationPoints;
    if (routeDetail?.elevationPoints && routeDetail.elevationPoints.length > 1) {
      return routeDetail.elevationPoints;
    }
    return [];
  }, [elevationPoints, routeDetail?.elevationPoints]);

  const resolvedDistanceKm = routeDetail?.distanceKm ?? route.distance_km ?? null;
  const dPlus = routeDetail?.elevGainM ?? resolveRouteElevationGain(route, elevGainM);
  const dMinus = routeDetail?.elevLossM ?? null;
  const minAlt = routeDetail?.minAltM ?? null;

  const computedMaxAlt = useMemo(() => {
    if (typeof routeDetail?.maxAltM === 'number' && Number.isFinite(routeDetail.maxAltM)) {
      return Math.round(routeDetail.maxAltM);
    }
    if (typeof maxAltM === 'number' && Number.isFinite(maxAltM)) return Math.round(maxAltM);
    if (typeof route.max_alt_m === 'number' && Number.isFinite(route.max_alt_m)) {
      return Math.round(route.max_alt_m);
    }
    if (mergedElevationPoints.length > 0) {
      let peak = -Infinity;
      for (const pt of mergedElevationPoints) {
        if (Number.isFinite(pt.ele) && pt.ele > peak) peak = pt.ele;
      }
      if (Number.isFinite(peak)) return Math.round(peak);
    }
    return null;
  }, [routeDetail?.maxAltM, maxAltM, route.max_alt_m, mergedElevationPoints]);

  const difficulty = useMemo(
    () =>
      routeDetail?.difficulty ??
      computeRouteDifficulty(resolvedDistanceKm, dPlus, computedMaxAlt),
    [routeDetail?.difficulty, resolvedDistanceKm, dPlus, computedMaxAlt],
  );

  const estimatedMinutes = useMemo(() => {
    if (typeof routeDetail?.estimatedMinutes === 'number' && routeDetail.estimatedMinutes > 0) {
      return routeDetail.estimatedMinutes;
    }
    if (typeof resolvedDistanceKm === 'number' && resolvedDistanceKm > 0) {
      return Math.round((resolvedDistanceKm / 4 + (dPlus ?? 0) / 350) * 60);
    }
    return null;
  }, [routeDetail?.estimatedMinutes, resolvedDistanceKm, dPlus]);

  const resolvedEta = useMemo(() => {
    if (etaLabel) return etaLabel;
    if (route.duration_label) return route.duration_label;
    if (estimatedMinutes) return formatDurationFr(estimatedMinutes);
    if (safeEta?.formattedP50) return safeEta.formattedP50;
    return '—';
  }, [etaLabel, route.duration_label, estimatedMinutes, safeEta]);

  const routeAnchor = useMemo(() => extractFirstCoord(route.geojson), [route.geojson]);

  // Weather: prefer real route-midpoint weather from `/api/explorer/v2/route-detail`, fallback to prop
  const tempC = routeDetail?.weather?.tempC ?? weather?.tempC ?? null;
  const feelsLikeC = routeDetail?.weather?.feelsLikeC ?? null;
  const windKmh = routeDetail?.weather?.windKmh ?? weather?.windKmh ?? null;
  const weatherSymbol = routeDetail?.weather?.symbol ?? weather?.symbol ?? null;
  const weatherDesc =
    routeDetail?.weather?.label ??
    weather?.label ??
    (weatherSymbol === 'snow'
      ? 'Neige'
      : weatherSymbol === 'rain'
        ? 'Pluie'
        : weatherSymbol === 'sun'
          ? 'Ensoleillé'
          : 'Météo locale');
  const weatherAdvice =
    routeDetail?.weather?.advice ??
    buildWeatherAdviceFr(tempC, windKmh, routeDetail?.weather?.precipMm ?? null, weatherSymbol);

  // Daylight & Arrival in plain French (explicitly flags nightfall / headlamp!)
  const arrivalMs =
    estimatedMinutes != null
      ? Date.now() + estimatedMinutes * 60_000
      : safeEta?.estimatedArrivalP50Ms ?? null;
  const arrivalHm = formatTimeHm(arrivalMs);
  const sunsetHm = routeDetail?.weather?.sunsetHm ?? formatTimeHm(safeEta?.daylight.sunsetMs);
  const sunriseHm = routeDetail?.weather?.sunriseHm ?? null;

  const afterDarkMinutes = useMemo(() => {
    if (!arrivalMs || !safeEta?.daylight.sunsetMs) return null;
    const diffMin = Math.round((arrivalMs - safeEta.daylight.sunsetMs) / 60_000);
    return diffMin > 0 ? diffMin : 0;
  }, [arrivalMs, safeEta?.daylight.sunsetMs]);

  // Nearby useful POIs along the route (water, refuge, access)
  const routeNearbyPois = useMemo(() => {
    if (!routeAnchor || nearbyPois.length === 0) return [];
    const scored = nearbyPois
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => ({
        poi: p,
        pres: resolvePoiPresentation(p.kind, p.subtype),
        km: distanceKm(routeAnchor, [p.lon, p.lat]),
      }))
      .filter((x) => x.km <= 4)
      .sort((a, b) => a.km - b.km);

    const picks: typeof scored = [];
    for (const grp of ['water', 'shelter', 'access'] as const) {
      const hit = scored.find((s) => s.pres.group === grp && !picks.some((p) => p.poi.id === s.poi.id));
      if (hit) picks.push(hit);
    }
    return picks;
  }, [nearbyPois, routeAnchor]);

  const routeNearbyReports = useMemo(() => {
    if (!routeAnchor || reports.length === 0) return [];
    return reports
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .map((r) => ({ report: r, km: distanceKm(routeAnchor, [r.lng, r.lat]) }))
      .filter((x) => x.km <= 3.5)
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }, [reports, routeAnchor]);

  const handleShareRoute = async () => {
    const shareUrl =
      typeof window !== 'undefined' && routeAnchor
        ? `${window.location.origin}/explorer?lat=${routeAnchor[1].toFixed(5)}&lng=${routeAnchor[0].toFixed(5)}&z=13`
        : typeof window !== 'undefined'
          ? window.location.href
          : '';
    const text = `${title}${resolvedDistanceKm != null ? ` (${resolvedDistanceKm.toFixed(1)} km${dPlus != null ? `, +${dPlus} m` : ''})` : ''} — Le Kit du Voyageur`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url: shareUrl });
        setSharedFeedback(true);
        window.setTimeout(() => setSharedFeedback(false), 1800);
        return;
      }
      await navigator.clipboard?.writeText(shareUrl || text);
      setSharedFeedback(true);
      window.setTimeout(() => setSharedFeedback(false), 1800);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <StackSlideView stackKey={`route-${route.id}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, paddingBottom: 14 }}>
        {/* Header: clear French type, route name, locality & color-coded difficulty */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche parcours"
            style={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.16)',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#17402C',
              display: 'inline-grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.06)',
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>

          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#17402C',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {networkMeta.label}
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: difficulty.bgTint,
                  color: difficulty.color,
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {difficulty.level}
              </span>
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: '#172B24',
                lineHeight: 1.22,
              }}
            >
              {title}
            </h3>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#56665D', marginTop: 2 }}>
              {[
                routeDetail?.loopType ?? null,
                routeDetail?.startLocation ?? null,
              ]
                .filter(Boolean)
                .join(' · ') || (routeDetailLoading ? 'Analyse du relief et du parcours…' : difficulty.summary)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleShareRoute()}
            aria-label="Partager cet itinéraire"
            title={sharedFeedback ? 'Lien copié' : 'Partager'}
            style={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.16)',
              background: 'rgba(255, 255, 255, 0.9)',
              color: sharedFeedback ? '#15803D' : '#17402C',
              display: 'inline-grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.06)',
            }}
          >
            {sharedFeedback ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
          </button>
        </div>

        {/* Compact Liquid Glass Route Actions Bar */}
        {(onPlanApproach || onToggleSave || onExportGpx || onDownloadOffline || onOpenReport) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {onPlanApproach ? (
              <button
                type="button"
                onClick={onPlanApproach}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: 0,
                  background: 'linear-gradient(180deg, #1f543a, #17402c)',
                  color: '#FBFAF6',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(23, 64, 44, 0.22)',
                }}
              >
                <Navigation size={12} aria-hidden="true" />
                <span>Y aller</span>
              </button>
            ) : null}

            {onToggleSave ? (
              <button
                type="button"
                onClick={onToggleSave}
                aria-pressed={isSaved}
                style={{
                  height: 32,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: isSaved
                    ? '0.5px solid rgba(23, 64, 44, 0.3)'
                    : '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: isSaved
                    ? 'rgba(23, 64, 44, 0.11)'
                    : 'rgba(255, 255, 255, 0.88)',
                  color: '#17402C',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.05)',
                }}
              >
                <Bookmark size={12} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{isSaved ? 'Enregistré' : 'Enregistrer'}</span>
              </button>
            ) : null}

            {onExportGpx ? (
              <button
                type="button"
                onClick={onExportGpx}
                style={{
                  height: 32,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: 'rgba(255, 255, 255, 0.88)',
                  color: '#17402C',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.05)',
                }}
              >
                <Download size={12} aria-hidden="true" />
                <span>GPX</span>
              </button>
            ) : null}

            {onDownloadOffline ? (
              <button
                type="button"
                onClick={onDownloadOffline}
                style={{
                  height: 32,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: 'rgba(255, 255, 255, 0.88)',
                  color: '#17402C',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.05)',
                }}
              >
                <WifiOff size={12} aria-hidden="true" />
                <span>Hors-ligne</span>
              </button>
            ) : null}

            {onOpenReport ? (
              <button
                type="button"
                onClick={onOpenReport}
                style={{
                  height: 32,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: '0.5px solid rgba(180, 83, 9, 0.24)',
                  background: 'rgba(255, 251, 235, 0.9)',
                  color: '#92400E',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(180, 83, 9, 0.06)',
                }}
              >
                <Flag size={12} aria-hidden="true" />
                <span>Signaler</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Optional real hero photo */}
        {routeDetail?.imageUrl ? (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 16,
              overflow: 'hidden',
              background: '#E8F0E6',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={routeDetail.imageUrl}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : null}

        {/* 4 crystal-clear labeled metric cards (2×2 grid — ZERO mystery icons, ZERO empty dashes) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <div className="club-glass-card" style={{ padding: '10px 11px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Route size={12} color="#17402C" aria-hidden="true" />
              Distance
            </span>
            <strong style={{ fontSize: 16, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
              {resolvedDistanceKm != null ? (
                <AnimatedNumber value={resolvedDistanceKm} suffix=" km" maximumFractionDigits={1} />
              ) : (
                '—'
              )}
            </strong>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6E7F76' }}>
              {routeDetail?.loopType ?? 'Parcours balisé'}
            </span>
          </div>

          <div className="club-glass-card" style={{ padding: '10px 11px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={12} color="#17402C" aria-hidden="true" />
              Montée (D+)
            </span>
            <strong style={{ fontSize: 16, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
              {dPlus != null ? (
                <AnimatedNumber value={dPlus} prefix="+" suffix=" m" />
              ) : routeDetailLoading ? (
                'Calcul…'
              ) : (
                'Non mesuré'
              )}
            </strong>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6E7F76', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {dMinus != null ? (
                <>
                  <TrendingDown size={11} aria-hidden="true" />
                  Descente -{dMinus} m
                </>
              ) : (
                difficulty.level
              )}
            </span>
          </div>

          <div className="club-glass-card" style={{ padding: '10px 11px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Mountain size={12} color="#17402C" aria-hidden="true" />
              Altitude max
            </span>
            <strong style={{ fontSize: 16, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
              {computedMaxAlt != null ? (
                <AnimatedNumber value={computedMaxAlt} suffix=" m" />
              ) : routeDetailLoading ? (
                'Calcul…'
              ) : (
                'Non mesurée'
              )}
            </strong>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6E7F76' }}>
              {minAlt != null ? `Point bas : ${minAlt} m` : 'Relief DEM réel'}
            </span>
          </div>

          <div className="club-glass-card" style={{ padding: '10px 11px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color="#17402C" aria-hidden="true" />
              Durée estimée
            </span>
            <strong style={{ fontSize: 16, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
              {resolvedEta}
            </strong>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6E7F76' }}>
              {routeDetail?.avgSlopePct != null
                ? `Pente moy. ${routeDetail.avgSlopePct}%${routeDetail.maxSlopePct ? ` (max ${routeDetail.maxSlopePct}%)` : ''}`
                : 'Allure rando moyenne'}
            </span>
          </div>
        </div>

        {/* Real Interactive DEM Elevation Profile */}
        <div
          className="club-glass-card"
          style={{
            padding: '10px 12px 10px',
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {mergedElevationPoints.length > 1 ? 'Profil d’altitude réel' : 'Tracé du parcours'}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6E7F76' }}>
              {mergedElevationPoints.length > 1
                ? 'Touchez la courbe pour voir sur la carte'
                : routeDetailLoading
                  ? 'Calcul du relief…'
                  : 'Touchez pour centrer'}
            </span>
          </div>

          {mergedElevationPoints.length > 1 ? (
            <div style={{ width: '100%', height: 132 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mergedElevationPoints as ExplorerRouteElevationPoint[]}
                  margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                  onClick={(state) => {
                    const payload = (
                      state as {
                        activePayload?: Array<{ payload?: ExplorerRouteElevationPoint }>;
                      } | null
                    )?.activePayload?.[0]?.payload;
                    if (
                      payload &&
                      typeof payload.lng === 'number' &&
                      typeof payload.lat === 'number' &&
                      Number.isFinite(payload.lng) &&
                      Number.isFinite(payload.lat)
                    ) {
                      onFocusCoordinates(
                        [payload.lng, payload.lat],
                        `Km ${payload.km} · ${Math.round(payload.ele)} m`,
                      );
                    } else if (routeAnchor) {
                      onFocusCoordinates(routeAnchor, title);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="lkdvExplorerEleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#17402C" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#96BA8E" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="km"
                    tick={{ fontSize: 10, fill: '#56665D' }}
                    tickFormatter={(v) => `${v} km`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 40', 'dataMax + 40']}
                    tick={{ fontSize: 10, fill: '#56665D' }}
                    tickFormatter={(v) => `${v} m`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '0.5px solid rgba(23, 64, 44, 0.16)',
                      background: 'rgba(255, 255, 255, 0.96)',
                      fontSize: 11.5,
                      padding: '6px 10px',
                      boxShadow: '0 6px 16px rgba(23, 43, 36, 0.12)',
                    }}
                    formatter={(value: unknown) => [`${Math.round(Number(value) || 0)} m`, 'Altitude']}
                    labelFormatter={(label) => `Distance : ${label} km`}
                  />
                  <Area
                    type="monotone"
                    dataKey="ele"
                    stroke="#17402C"
                    strokeWidth={2.3}
                    fill="url(#lkdvExplorerEleGrad)"
                    isAnimationActive={false}
                    activeDot={{ r: 4.5, fill: '#17402C', stroke: '#FBFAF6', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (routeAnchor) onFocusCoordinates(routeAnchor, title);
              }}
              aria-label={`Centrer la carte sur ${title}`}
              style={{
                width: '100%',
                height: 112,
                border: 0,
                padding: 0,
                borderRadius: 12,
                background: '#EFF4EE',
                overflow: 'hidden',
                cursor: routeAnchor ? 'pointer' : 'default',
                display: 'block',
              }}
            >
              <RouteMiniTraceSvg geojson={route.geojson} width={320} height={112} />
            </button>
          )}
        </div>

        {/* Crystal-clear French Weather, Equipment Advice & Daylight Safety Card */}
        <div
          className="club-glass-card"
          style={{
            padding: '11px 12px',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Météo & Conditions aujourd’hui
            </span>
            {outingFit ? (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 800,
                  background: outingFit.vetoed
                    ? 'rgba(220, 38, 38, 0.14)'
                    : 'rgba(150, 186, 142, 0.28)',
                  color: outingFit.vetoed ? '#991B1B' : '#17402C',
                }}
              >
                {fitScoreLabelFr(outingFit.fitScore, outingFit.vetoed)} ({outingFit.fitScore}/100)
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {renderWeatherIcon(weatherSymbol)}
              <strong style={{ fontSize: 14, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
                {tempC != null ? `${Math.round(tempC)}°C` : '—'} · {weatherDesc}
              </strong>
              {feelsLikeC != null ? (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#56665D' }}>
                  (ressenti {feelsLikeC}°C)
                </span>
              ) : null}
            </div>
            {windKmh != null ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#56665D' }}>
                <Wind size={13} color="#5B7F55" aria-hidden="true" />
                Vent {Math.round(windKmh)} km/h
              </span>
            ) : null}
          </div>

          {weatherAdvice ? (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 11,
                background: 'rgba(23, 64, 44, 0.06)',
                fontSize: 12,
                fontWeight: 600,
                color: '#17402C',
                lineHeight: 1.35,
              }}
            >
              {weatherAdvice}
            </div>
          ) : null}

          {/* Explicit Daylight / Headlamp section (NO MORE cryptic "18h06 · 16h55"!) */}
          {(arrivalHm || sunsetHm) ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                paddingTop: 6,
                borderTop: '0.5px solid rgba(23, 64, 44, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                {arrivalHm ? (
                  <span style={{ color: '#56665D', fontWeight: 600 }}>
                    Arrivée estimée (départ maintenant) : <strong style={{ color: '#172B24' }}>{arrivalHm}</strong>
                  </span>
                ) : null}
                {sunsetHm ? (
                  <span style={{ color: '#56665D', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sunset size={13} color="#B45309" aria-hidden="true" />
                    Coucher du soleil : <strong style={{ color: '#172B24' }}>{sunsetHm}</strong>
                  </span>
                ) : null}
                {sunriseHm && !arrivalHm ? (
                  <span style={{ color: '#56665D', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sunrise size={13} color="#D97706" aria-hidden="true" />
                    Lever : <strong style={{ color: '#172B24' }}>{sunriseHm}</strong>
                  </span>
                ) : null}
              </div>

              {afterDarkMinutes != null && afterDarkMinutes > 0 ? (
                <div
                  style={{
                    padding: '6px 9px',
                    borderRadius: 10,
                    background: 'rgba(217, 119, 6, 0.14)',
                    color: '#92400E',
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>
                    Fin prévue après la tombée de la nuit (+{formatDurationFr(afterDarkMinutes)}) — prévoir une lampe frontale
                  </span>
                </div>
              ) : arrivalHm && sunsetHm ? (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#15803D' }}>
                  ✓ Retour prévu de jour avant la tombée de la nuit
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Editorial context (Wikipedia) */}
        {routeDetail?.summary ? (
          <div
            className="club-glass-card"
            style={{ padding: '11px 12px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              À propos du secteur
            </span>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.48, color: '#1F332B', fontWeight: 500 }}>
              {routeDetail.summary}
            </p>
            {routeDetail.wikiUrl ? (
              <a
                href={routeDetail.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#17402C',
                  textDecoration: 'none',
                }}
              >
                <span>Lire sur Wikipédia</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Useful POIs near the trailhead/route (water, refuge, access) */}
        {routeNearbyPois.length > 0 && onSelectNearbyPoi ? (
          <div
            className="club-glass-card"
            style={{ padding: '11px 12px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 7 }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Points utiles autour du départ
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {routeNearbyPois.map((srv) => (
                <button
                  key={srv.poi.id}
                  type="button"
                  onClick={() => onSelectNearbyPoi(srv.poi)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 9px',
                    borderRadius: 12,
                    border: '0.5px solid rgba(23, 64, 44, 0.1)',
                    background: 'rgba(255, 255, 255, 0.75)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    {renderPoiIcon(srv.pres.iconKey, 14, srv.pres.color)}
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#172B24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {srv.pres.shortBadge} · {srv.poi.name}
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#56665D', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                    {srv.km < 1 ? `${Math.round(srv.km * 1000)} m` : `${srv.km.toFixed(1)} km`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {/* Active community terrain reports along the route */}
        {routeNearbyReports.length > 0 ? (
          <div
            className="club-glass-card"
            style={{ padding: '11px 12px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 7 }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Signalements terrain sur le secteur
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {routeNearbyReports.map(({ report, km }) => (
                <div
                  key={report.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.78)',
                    border: '0.5px solid rgba(23, 64, 44, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <strong style={{ fontSize: 11.5, fontWeight: 700, color: report.severity === 'critical' ? '#991B1B' : '#92400E' }}>
                      {formatReportCategoryFr(report.category)}
                    </strong>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#56665D', fontVariantNumeric: 'tabular-nums' }}>
                      {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                    </span>
                  </div>
                  {report.description ? (
                    <span style={{ fontSize: 12, color: '#1F332B', lineHeight: 1.35 }}>
                      {report.description}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </StackSlideView>
  );
}

/* ── Lens 1.1: ExplorerTerritoryLens ──────────────────────────────────────── */

export interface ExplorerTerritoryLensProps {
  name: string;
  scale: SpatialScale;
  coordinates?: { lat: number; lng: number } | null;
  entry?: TerritorialEncyclopediaEntry | null;
  countryDetails?: CountryDetails | null;
  elevationM?: number | null;
  temperatureC?: number | null;
  spotsCount?: number | null;
  speciesCount?: number | null;
  active?: boolean;
  onFocusCoordinates?: (coords: [number, number], label?: string) => void;
}

export function ExplorerTerritoryLens({
  name,
  scale,
  coordinates = null,
  entry = null,
  countryDetails = null,
  elevationM = null,
  temperatureC = null,
  spotsCount = null,
  speciesCount = null,
  active = true,
  onFocusCoordinates,
}: ExplorerTerritoryLensProps) {
  const [heroCollapsed, setHeroCollapsed] = useScrollCollapsePreview(active);
  const [excerptExpanded, setExcerptExpanded] = useState(false);

  const isMacroScale = scale === 'world' || scale === 'continent' || scale === 'country';
  const isLocalScale = !isMacroScale;

  const resolvedCoords = coordinates ?? entry?.coordinates ?? null;
  const coordsLabel = resolvedCoords
    ? `${Math.abs(resolvedCoords.lat).toFixed(2)}°${resolvedCoords.lat >= 0 ? 'N' : 'S'} · ${Math.abs(resolvedCoords.lng).toFixed(2)}°${resolvedCoords.lng >= 0 ? 'E' : 'O'}`
    : undefined;

  const areaKm2 = isMacroScale
    ? (entry?.practical?.areaKm2 ?? countryDetails?.area_km2 ?? null)
    : null;
  const resolvedElevation =
    typeof elevationM === 'number' && Number.isFinite(elevationM) ? Math.round(elevationM) : null;
  const resolvedTemp = temperatureC ?? entry?.weather?.temperatureC ?? null;
  const resolvedSpeciesCount = speciesCount ?? entry?.biodiversity?.totalSpecies ?? null;
  const resolvedActiveCount = spotsCount ?? resolvedSpeciesCount ?? null;
  const activeCountLabel =
    spotsCount !== null && spotsCount !== undefined ? 'Lieux & tracés' : 'Espèces';

  const emergencyList = useMemo(() => {
    const raw =
      entry?.practical?.emergencyNumbers ?? countryDetails?.practical?.emergency_numbers ?? null;
    const out: Array<{ label: string; number: string }> = [];
    const seenDial = new Set<string>();
    if (raw) {
      for (const [k, v] of Object.entries(raw)) {
        const cleaned = String(v ?? '').trim();
        const dial = cleaned.replace(/[^+\d]/g, '');
        if (cleaned && dial && !seenDial.has(dial)) {
          seenDial.add(dial);
          out.push({ label: formatEmergencyServiceLabelFr(k, cleaned), number: cleaned });
        }
      }
    }
    if (!seenDial.has('112')) {
      out.unshift({ label: 'Urgences', number: '112' });
    }
    return out.slice(0, 4);
  }, [entry?.practical?.emergencyNumbers, countryDetails?.practical?.emergency_numbers]);

  const localChips = useMemo(() => {
    if (!isLocalScale) return [];
    const list: Array<{ key: string; icon: React.ReactNode; value: string }> = [];
    if (
      resolvedSpeciesCount !== null &&
      resolvedSpeciesCount > 0 &&
      spotsCount !== null &&
      spotsCount !== undefined
    ) {
      list.push({
        key: 'local-species',
        icon: <Compass size={12} color="#17402C" aria-hidden="true" />,
        value: `${resolvedSpeciesCount} espèce${resolvedSpeciesCount > 1 ? 's' : ''}`,
      });
    }
    if (typeof entry?.weather?.windMs === 'number' && Number.isFinite(entry.weather.windMs)) {
      list.push({
        key: 'local-wind',
        icon: <Wind size={12} color="#17402C" aria-hidden="true" />,
        value: `${Math.round(entry.weather.windMs * 3.6)} km/h`,
      });
    }
    if (
      typeof entry?.weather?.humidityPct === 'number' &&
      Number.isFinite(entry.weather.humidityPct)
    ) {
      list.push({
        key: 'local-humidity',
        icon: <Droplets size={12} color="#17402C" aria-hidden="true" />,
        value: `${Math.round(entry.weather.humidityPct)}% hum.`,
      });
    }
    const localCarnets = entry?.community?.publicCarnetsCount ?? 0;
    const localClubs = entry?.community?.publicClubsCount ?? 0;
    if (localCarnets > 0 || localClubs > 0) {
      const parts: string[] = [];
      if (localCarnets > 0) parts.push(`${localCarnets} carnet${localCarnets > 1 ? 's' : ''}`);
      if (localClubs > 0) parts.push(`${localClubs} club${localClubs > 1 ? 's' : ''}`);
      list.push({
        key: 'local-community',
        icon: <Users size={12} color="#17402C" aria-hidden="true" />,
        value: parts.join(' · '),
      });
    }
    const localAlerts =
      (entry?.hazardsSummary?.activeAlerts ?? 0) + (entry?.hazardsSummary?.activeWildfires ?? 0);
    if (localAlerts > 0) {
      list.push({
        key: 'local-hazards',
        icon: <AlertTriangle size={12} color="#B45309" aria-hidden="true" />,
        value: `${localAlerts} vigilance${localAlerts > 1 ? 's' : ''}`,
      });
    }
    return list;
  }, [
    isLocalScale,
    resolvedSpeciesCount,
    spotsCount,
    entry?.weather?.windMs,
    entry?.weather?.humidityPct,
    entry?.community?.publicCarnetsCount,
    entry?.community?.publicClubsCount,
    entry?.hazardsSummary?.activeAlerts,
    entry?.hazardsSummary?.activeWildfires,
  ]);

  const countryChips = useMemo(() => {
    const list: Array<{ key: string; icon: React.ReactNode; value: string }> = [];
    const continent = entry?.practical?.continent ?? countryDetails?.continent ?? null;
    const capital = entry?.practical?.capital ?? countryDetails?.capital ?? null;
    const currency = entry?.practical?.currencyCode ?? countryDetails?.currency_code ?? null;
    const languages = entry?.practical?.languages ?? countryDetails?.languages ?? [];

    if (continent) {
      list.push({
        key: 'continent',
        icon: <Globe2 size={12} color="#17402C" aria-hidden="true" />,
        value: continent,
      });
    }
    if (capital) {
      list.push({
        key: 'capital',
        icon: <MapPin size={12} color="#17402C" aria-hidden="true" />,
        value: capital,
      });
    }
    if (currency) {
      list.push({
        key: 'currency',
        icon: <Coins size={12} color="#17402C" aria-hidden="true" />,
        value: currency,
      });
    }
    for (const lang of (languages ?? []).slice(0, 3)) {
      if (lang && lang.trim()) {
        list.push({
          key: `lang-${lang}`,
          icon: <Languages size={12} color="#17402C" aria-hidden="true" />,
          value: lang.trim(),
        });
      }
    }
    return list;
  }, [entry?.practical, countryDetails]);

  const compactCountrySummary = useMemo(() => {
    if (!isLocalScale) return null;
    const parts: string[] = [];
    const countryName = countryDetails?.name?.trim() || null;
    const currency = entry?.practical?.currencyCode ?? countryDetails?.currency_code ?? null;
    const primaryLang =
      (entry?.practical?.languages ?? countryDetails?.languages ?? []).find(
        (l) => typeof l === 'string' && l.trim().length > 0,
      ) ?? null;
    const capital = entry?.practical?.capital ?? countryDetails?.capital ?? null;
    if (countryName) parts.push(countryName);
    if (currency) parts.push(currency);
    if (primaryLang) parts.push(primaryLang.trim());
    if (capital && capital.toLowerCase() !== name.trim().toLowerCase()) {
      parts.push(`Cap. ${capital}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [isLocalScale, countryDetails, entry?.practical, name]);

  const validThumb = isSafeHttpsUrl(entry?.wiki?.thumbnailUrl) ? entry.wiki.thumbnailUrl : null;
  const wikiDescription = entry?.wiki?.description?.trim() || null;
  const wikiExtract = entry?.wiki?.extract?.trim() || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 60 }}>
      <CollapsibleHeroPreview
        collapsed={heroCollapsed}
        onExpand={() => setHeroCollapsed(false)}
        title={name}
        subtitle={coordsLabel}
        avatarUrl={validThumb}
        fallbackText={name.slice(0, 1).toUpperCase() || 'T'}
      >
        <div
          className="club-glass-card"
          style={{
            padding: 12,
            background:
              'linear-gradient(145deg, rgba(211, 235, 217, 0.52), rgba(255, 255, 255, 0.88))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span
              style={{
                width: 'fit-content',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(23, 64, 44, 0.12)',
                color: '#17402C',
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {SCALE_LABELS_FR[scale]}
            </span>
            <strong
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: '#172B24',
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </strong>
            {isLocalScale && wikiDescription ? (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#465950',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {wikiDescription}
              </span>
            ) : null}
            {coordsLabel ? (
              <button
                type="button"
                onClick={() => {
                  if (resolvedCoords && onFocusCoordinates) {
                    onFocusCoordinates([resolvedCoords.lng, resolvedCoords.lat], name);
                  }
                }}
                style={{
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  color: '#56665D',
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: resolvedCoords && onFocusCoordinates ? 'pointer' : 'default',
                  width: 'fit-content',
                }}
              >
                <Compass size={12} color="#17402C" aria-hidden="true" />
                <span>{coordsLabel}</span>
              </button>
            ) : null}
          </div>

          {validThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={validThumb}
              alt={name}
              loading="lazy"
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                objectFit: 'cover',
                flex: 'none',
                boxShadow: '0 2px 8px rgba(23, 43, 36, 0.12)',
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.82)',
                color: '#17402C',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              {isLocalScale ? <Mountain size={20} /> : <Globe2 size={20} />}
            </span>
          )}
        </div>
      </CollapsibleHeroPreview>

      {/* 3-col visual KPI strip */}
      <div
        className="lkdv-carnet-kpi-grid-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        <div
          className="lkdv-carnet-kpi-mini club-glass-card"
          style={{ padding: '10px 10px', borderRadius: 18 }}
        >
          <small style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#56665D' }}>
            {isLocalScale
              ? resolvedElevation != null
                ? 'Altitude'
                : 'Échelle'
              : areaKm2 != null
                ? 'Surface'
                : resolvedElevation != null
                  ? 'Altitude'
                  : 'Échelle'}
          </small>
          <b
            style={{
              display: 'block',
              marginTop: 2,
              fontSize: 13.5,
              fontWeight: 800,
              color: '#172B24',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isLocalScale ? (
              resolvedElevation != null ? (
                <AnimatedNumber value={resolvedElevation} suffix=" m" />
              ) : (
                SCALE_LABELS_FR[scale]
              )
            ) : areaKm2 != null ? (
              areaKm2 >= 10_000 ? (
                <AnimatedNumber value={Math.round(areaKm2 / 1000)} suffix="k km²" />
              ) : (
                <AnimatedNumber value={Math.round(areaKm2)} suffix=" km²" />
              )
            ) : resolvedElevation != null ? (
              <AnimatedNumber value={resolvedElevation} suffix=" m" />
            ) : (
              SCALE_LABELS_FR[scale]
            )}
          </b>
        </div>

        <div
          className="lkdv-carnet-kpi-mini club-glass-card"
          style={{ padding: '10px 10px', borderRadius: 18 }}
        >
          <small style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#56665D' }}>
            Météo
          </small>
          <b
            style={{
              display: 'block',
              marginTop: 2,
              fontSize: 13.5,
              fontWeight: 800,
              color: '#172B24',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {resolvedTemp != null ? (
              <AnimatedNumber value={Math.round(resolvedTemp)} suffix="°C" />
            ) : (
              '—'
            )}
          </b>
        </div>

        <div
          className="lkdv-carnet-kpi-mini club-glass-card"
          style={{ padding: '10px 10px', borderRadius: 18 }}
        >
          <small style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#56665D' }}>
            {activeCountLabel}
          </small>
          <b
            style={{
              display: 'block',
              marginTop: 2,
              fontSize: 13.5,
              fontWeight: 800,
              color: '#172B24',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {resolvedActiveCount != null ? <AnimatedNumber value={resolvedActiveCount} /> : '—'}
          </b>
        </div>
      </div>

      {/* Local scale: prioritize local dossier summary & local chips ahead of country facts */}
      {isLocalScale && localChips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {localChips.map((chip) => (
            <span
              key={chip.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.78)',
                boxShadow: 'inset 0 0 0 0.5px rgba(27, 67, 50, 0.12)',
                color: '#172B24',
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              {chip.icon}
              <span>{chip.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {isLocalScale && wikiExtract ? (
        <button
          type="button"
          className="club-glass-card"
          onClick={() => setExcerptExpanded((prev) => !prev)}
          aria-expanded={excerptExpanded}
          style={{
            border: 0,
            textAlign: 'left',
            cursor: 'pointer',
            padding: '10px 12px',
          }}
        >
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: excerptExpanded ? 8 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: 12,
              lineHeight: 1.42,
              color: '#465950',
            }}
          >
            {wikiExtract}
          </span>
        </button>
      ) : null}

      {/* Clickable Emergency tel: pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {emergencyList.map((em) => {
          const dial = em.number.replace(/[^+\d]/g, '');
          const isPrimary = dial === '112';
          return (
            <a
              key={`${em.label}-${em.number}`}
              href={`tel:${dial}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 12px',
                borderRadius: 999,
                background: isPrimary
                  ? 'linear-gradient(180deg, #1f543a, #17402c)'
                  : 'rgba(255, 255, 255, 0.82)',
                color: isPrimary ? '#FBFAF6' : '#17402C',
                boxShadow: isPrimary
                  ? '0 4px 12px rgba(23, 64, 44, 0.22)'
                  : 'inset 0 0 0 0.5px rgba(27, 67, 50, 0.14)',
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                textDecoration: 'none',
              }}
            >
              <Phone size={13} aria-hidden="true" />
              <span>
                {em.label} · {em.number}
              </span>
            </a>
          );
        })}
      </div>

      {/* Macro scale: primary country practical chips + Wikipedia excerpt */}
      {isMacroScale && countryChips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {countryChips.map((chip) => (
            <span
              key={chip.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.78)',
                boxShadow: 'inset 0 0 0 0.5px rgba(27, 67, 50, 0.12)',
                color: '#172B24',
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              {chip.icon}
              <span>{chip.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {isMacroScale && wikiExtract ? (
        <button
          type="button"
          className="club-glass-card"
          onClick={() => setExcerptExpanded((prev) => !prev)}
          aria-expanded={excerptExpanded}
          style={{
            border: 0,
            textAlign: 'left',
            cursor: 'pointer',
            padding: '10px 12px',
          }}
        >
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: excerptExpanded ? 8 : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: 12,
              lineHeight: 1.4,
              color: '#56665D',
            }}
          >
            {wikiExtract}
          </span>
        </button>
      ) : null}

      {/* Territory -> Compas trip preparation bridge */}
      {(() => {
        const iso = (countryDetails?.iso_a2 ?? entry?.iso ?? '').trim().toUpperCase();
        const compasHref = `/compas?country=${encodeURIComponent(iso)}&q=${encodeURIComponent(name)}`;
        return (
          <Link
            href={compasHref}
            className="club-glass-card"
            style={{
              padding: '11px 13px',
              borderRadius: 18,
              background:
                'linear-gradient(135deg, rgba(23, 64, 44, 0.09), rgba(255, 255, 255, 0.9))',
              border: '0.5px solid rgba(23, 64, 44, 0.18)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(23, 43, 36, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'linear-gradient(180deg, #1f543a, #17402c)',
                  color: '#FBFAF6',
                  display: 'inline-grid',
                  placeItems: 'center',
                  flex: 'none',
                  boxShadow: '0 3px 8px rgba(23, 64, 44, 0.2)',
                }}
              >
                <Compass size={16} aria-hidden="true" />
              </span>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <strong style={{ fontSize: 12.5, fontWeight: 800, color: '#172B24' }}>
                  Préparer un voyage ici (Compas)
                </strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#56665D',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Formalités, matériel et itinéraire pour {name}
                </span>
              </div>
            </div>
            <ArrowUpRight size={16} color="#17402C" aria-hidden="true" style={{ flex: 'none' }} />
          </Link>
        );
      })()}

      {/* Local scale: compact secondary country reference strip */}
      {isLocalScale && compactCountrySummary ? (
        <div
          className="club-glass-card"
          style={{
            padding: '8px 11px',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 11.5,
            fontWeight: 600,
            color: '#56665D',
            opacity: 0.9,
          }}
        >
          <Globe2 size={13} color="#17402C" aria-hidden="true" style={{ flex: 'none' }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Repères pays · {compactCountrySummary}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ── Lens 1.2: ExplorerReadinessLens ──────────────────────────────────────── */

export interface ExplorerReadinessLensProps {
  readiness: ExplorerReadiness;
  recommendation?: ActivityPresetRecommendation | null;
  onLaunchRecommendedSport?: (sport: Sport) => void;
}

export function ExplorerReadinessLens({
  readiness,
  recommendation = null,
  onLaunchRecommendedSport,
}: ExplorerReadinessLensProps) {
  const isColdStart = readiness.status === 'cold_start' || readiness.score === null;
  const ringPct = isColdStart ? 0 : Math.max(0, Math.min(100, Math.round(readiness.score ?? 0)));

  const acwrRatio = readiness.acwr.dampedRatio;
  const acwrPct =
    !isColdStart && acwrRatio !== null
      ? Math.max(6, Math.min(100, Math.round((acwrRatio / 1.8) * 100)))
      : 0;
  const acwrColor =
    readiness.acwr.zone === 'spike' || readiness.acwr.zone === 'caution'
      ? '#B98A2E'
      : '#17402C';

  const recoveryPct = isColdStart
    ? 0
    : Math.max(0, Math.min(100, Math.round(100 - readiness.recoveryDebt96h)));

  const altitudeM = Math.round(readiness.altitudeAcclimatization.ceilingM);
  const altitudePct = Math.max(8, Math.min(100, Math.round((altitudeM / 4500) * 100)));

  const bars: Array<{
    key: string;
    label: string;
    pct: number;
    color: string;
    valueNode: React.ReactNode;
  }> = [
    {
      key: 'acwr',
      label: 'ACWR',
      pct: acwrPct,
      color: acwrColor,
      valueNode:
        !isColdStart && acwrRatio !== null ? (
          <AnimatedNumber value={Number(acwrRatio.toFixed(2))} maximumFractionDigits={2} />
        ) : (
          '—'
        ),
    },
    {
      key: 'recovery',
      label: 'Récupération',
      pct: recoveryPct,
      color: '#5B7F55',
      valueNode: !isColdStart ? <AnimatedNumber value={recoveryPct} suffix="%" /> : '—',
    },
    {
      key: 'altitude',
      label: 'Plafond altitude',
      pct: altitudePct,
      color: '#96BA8E',
      valueNode: <AnimatedNumber value={altitudeM} suffix=" m" />,
    },
  ];

  const recSportMeta = recommendation ? SPORT_META[recommendation.sport] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 60 }}>
      {/* 104x104 conic-gradient donut ring + 3 slim animated bars */}
      <div
        className="club-glass-card"
        style={{
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          className="lkdv-carnet-kit-ring"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isColdStart ? 0 : ringPct}
          aria-label={isColdStart ? 'Calibration initiale' : `Forme ${ringPct} sur 100`}
          style={
            {
              '--p': ringPct,
              position: 'relative',
              flex: 'none',
              width: 104,
              height: 104,
              borderRadius: 999,
              background: `conic-gradient(#17402C ${ringPct}%, rgba(23, 64, 44, 0.12) 0)`,
            } as React.CSSProperties
          }
        >
          <div
            className="lkdv-carnet-kit-ring-core"
            style={{
              position: 'absolute',
              inset: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              borderRadius: 999,
              background: 'rgba(251, 250, 246, 0.96)',
              textAlign: 'center',
            }}
          >
            <b
              style={{
                fontSize: isColdStart ? 15 : 19,
                fontWeight: 800,
                lineHeight: 1.05,
                color: '#172B24',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isColdStart ? 'Init' : <AnimatedNumber value={ringPct} />}
            </b>
            {!isColdStart ? (
              <small
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: '#56665D',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                /100
              </small>
            ) : null}
          </div>
        </div>

        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {bars.map((bar) => (
            <div key={bar.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 6,
                  fontSize: 11.5,
                }}
              >
                <span style={{ fontWeight: 600, color: '#172B24' }}>{bar.label}</span>
                <strong
                  style={{
                    fontWeight: 700,
                    color: '#56665D',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {bar.valueNode}
                </strong>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 5,
                  borderRadius: 999,
                  background: 'rgba(23, 43, 36, 0.08)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  aria-hidden="true"
                  initial={{ width: 0 }}
                  animate={{ width: `${bar.pct}%` }}
                  transition={CARNET_SPRING}
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    background: bar.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compact 1-tap Recommended Activity visual tile */}
      {recommendation && recSportMeta ? (
        <button
          type="button"
          className="club-glass-card"
          onClick={() => onLaunchRecommendedSport?.(recommendation.sport)}
          style={{
            width: '100%',
            border: 0,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            textAlign: 'left',
            cursor: onLaunchRecommendedSport ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                background: 'rgba(150, 186, 142, 0.28)',
                color: '#17402C',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              {recSportMeta.icon}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <strong style={{ fontSize: 13.5, fontWeight: 800, color: '#172B24' }}>
                {recSportMeta.label}
              </strong>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#56665D',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <AnimatedNumber value={recommendation.effortEnvelope.maxDurationMin} suffix=" min" />
                {' · '}
                <AnimatedNumber
                  value={recommendation.effortEnvelope.maxElevationGainM}
                  prefix="+"
                  suffix=" m"
                />
              </span>
            </div>
          </div>

          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              flex: 'none',
              background: 'linear-gradient(180deg, #1f543a, #17402c)',
              color: '#FBFAF6',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 12px rgba(23, 64, 44, 0.24)',
            }}
          >
            <Play size={14} fill="currentColor" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
