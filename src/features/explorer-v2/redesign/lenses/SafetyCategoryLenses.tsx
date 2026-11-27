'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Flag,
  Flame,
  Plane,
  Plus,
  Radio,
  ShieldCheck,
  Sun,
  Sunrise,
  Sunset,
  ThumbsUp,
  Waves,
  Wind,
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
  StaggerList,
} from '@/components/carnet/v2/CarnetDrawerMotion';
import type { OfflineDaylight } from '../../adaptive/types';
import type { PoiItem, TerrainReport, WeatherResponse } from '../../data/hooks';
import type { HazardsPayload, MapBbox } from '../../data/unifiedLayersHooks';
import { isPointInViewport } from '../../data/spatialLoader';
import {
  buildWeatherAdviceFr,
  formatHazardSeverityFr,
  formatReportCategoryFr,
  resolvePoiPresentation,
} from '../../poiTaxonomy';
import { renderPoiIcon } from './ExplorerPoiDetailView';

export const SAFETY_CATEGORY_LENSES: SlotLens[] = [
  { id: 'hazards', label: 'Risques', icon: <Flame size={15} aria-hidden="true" /> },
  { id: 'weather', label: 'Météo & Radar', icon: <CloudRain size={15} aria-hidden="true" /> },
  { id: 'survival', label: 'Eau & Secours', icon: <Droplets size={15} aria-hidden="true" /> },
];

export type HazardKindFilter = 'all' | 'fire' | 'flood' | 'quake' | 'airspace';

export interface SafetyHazardsLensProps {
  hazards: HazardsPayload | null | undefined;
  kindFilter: HazardKindFilter;
  center: [number, number];
  viewportBounds?: MapBbox | null;
  zoom?: number;
  areaName?: string | null;
  airspaceCount?: number;
  loading?: boolean;
  onFocusCoordinates?: (coords: [number, number], label?: string) => void;
  reports?: ReadonlyArray<TerrainReport>;
  onOpenReportModal?: () => void;
  onConfirmReport?: (reportId: string, action: 'confirm' | 'gone') => void | Promise<void>;
}

export interface SafetyWeatherLensProps {
  weather: WeatherResponse | null | undefined;
  daylight: OfflineDaylight | null | undefined;
  radarEnabled: boolean;
  onToggleRadar: () => void;
  radarUpdatedAt?: string | null;
  loading?: boolean;
}

export type SurvivalKindFilter = 'all' | 'water' | 'refuge' | 'rescue';

export interface SafetySurvivalLensProps {
  pois: ReadonlyArray<PoiItem>;
  center: [number, number];
  viewportBounds?: MapBbox | null;
  kindFilter?: SurvivalKindFilter;
  loading?: boolean;
  onSelectPoi?: (poi: PoiItem) => void;
  onFocusCoordinates?: (coords: [number, number], label?: string) => void;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(fromLngLat: [number, number], toLngLat: [number, number]): number {
  const [lng1, lat1] = fromLngLat;
  const [lng2, lat2] = toLngLat;
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function formatDistanceLabel(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.max(10, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

function formatFreshness(iso: string | null | undefined): string {
  if (!iso) return 'Direct';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'Direct';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return `il y a ${Math.round(diffH / 24)} j`;
}

function formatClockHm(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatHourAxis(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const h = new Date(ts).getHours();
  return `${String(h).padStart(2, '0')}h`;
}

function renderWeatherIcon(symbol: string | null | undefined, size = 28) {
  const sym = (symbol ?? '').toLowerCase();
  if (sym.includes('thunder')) {
    return <CloudLightning size={size} color="#4f46e5" aria-hidden="true" />;
  }
  if (sym.includes('snow') || sym.includes('sleet')) {
    return <CloudSnow size={size} color="#0284c7" aria-hidden="true" />;
  }
  if (sym.includes('rain') || sym.includes('drizzle') || sym.includes('shower')) {
    return <CloudRain size={size} color="#2563eb" aria-hidden="true" />;
  }
  if (sym.includes('fog')) {
    return <CloudFog size={size} color="#56665d" aria-hidden="true" />;
  }
  if (sym.includes('partly') || sym.includes('fair')) {
    return <CloudSun size={size} color="#17402c" aria-hidden="true" />;
  }
  if (sym.includes('cloud')) {
    return <Cloud size={size} color="#56665d" aria-hidden="true" />;
  }
  return <Sun size={size} color="#b45309" aria-hidden="true" />;
}

interface NormalizedHazardCard {
  id: string;
  kind: Exclude<HazardKindFilter, 'all'> | 'alert';
  title: string;
  coords: [number, number] | null;
  distanceKm: number;
  freshness: string;
  badge?: string;
  tone: 'red' | 'blue' | 'amber' | 'indigo';
}

const HAZARD_TONE_STYLES: Record<
  NormalizedHazardCard['tone'],
  { wellBg: string; wellColor: string; pillBg: string; pillColor: string; border: string }
> = {
  red: {
    wellBg: 'rgba(220, 38, 38, 0.12)',
    wellColor: '#dc2626',
    pillBg: 'rgba(220, 38, 38, 0.1)',
    pillColor: '#b91c1c',
    border: 'rgba(220, 38, 38, 0.2)',
  },
  blue: {
    wellBg: 'rgba(37, 99, 235, 0.12)',
    wellColor: '#2563eb',
    pillBg: 'rgba(37, 99, 235, 0.1)',
    pillColor: '#1d4ed8',
    border: 'rgba(37, 99, 235, 0.2)',
  },
  amber: {
    wellBg: 'rgba(180, 83, 9, 0.12)',
    wellColor: '#b45309',
    pillBg: 'rgba(180, 83, 9, 0.1)',
    pillColor: '#92400e',
    border: 'rgba(180, 83, 9, 0.22)',
  },
  indigo: {
    wellBg: 'rgba(79, 70, 229, 0.12)',
    wellColor: '#4f46e5',
    pillBg: 'rgba(79, 70, 229, 0.1)',
    pillColor: '#4338ca',
    border: 'rgba(79, 70, 229, 0.2)',
  },
};

function hazardIcon(kind: NormalizedHazardCard['kind']) {
  switch (kind) {
    case 'fire':
      return <Flame size={16} aria-hidden="true" />;
    case 'flood':
      return <Waves size={16} aria-hidden="true" />;
    case 'quake':
      return <Activity size={16} aria-hidden="true" />;
    case 'airspace':
      return <Plane size={16} aria-hidden="true" />;
    default:
      return <AlertTriangle size={16} aria-hidden="true" />;
  }
}

const GLASS_CARD_BASE: React.CSSProperties = {
  borderRadius: 18,
  background: 'rgba(255, 255, 255, 0.84)',
  border: '0.5px solid rgba(23, 64, 44, 0.13)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.05)',
};

export function SafetyHazardsLens({
  hazards,
  kindFilter,
  center,
  viewportBounds = null,
  zoom = 12,
  areaName = null,
  airspaceCount,
  loading = false,
  onFocusCoordinates,
  reports = [],
  onOpenReportModal,
  onConfirmReport,
}: SafetyHazardsLensProps) {
  const [votedReports, setVotedReports] = useState<Record<string, 'confirm' | 'gone'>>({});
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const visibleReports = useMemo(() => {
    if (kindFilter !== 'all' || !reports.length) return [];
    return reports
      .filter((r) => {
        if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return false;
        if (r.status === 'resolved' || r.status === 'gone') return false;
        return isPointInViewport(r.lat, r.lng, viewportBounds);
      })
      .map((r) => ({
        report: r,
        distanceKm: haversineKm(center, [r.lng, r.lat]),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [reports, kindFilter, viewportBounds, center]);

  const handleVoteReport = async (reportId: string, action: 'confirm' | 'gone') => {
    if (!onConfirmReport || busyReportId === reportId) return;
    setBusyReportId(reportId);
    try {
      await onConfirmReport(reportId, action);
      setVotedReports((prev) => ({ ...prev, [reportId]: action }));
    } finally {
      setBusyReportId((cur) => (cur === reportId ? null : cur));
    }
  };

  const items = useMemo<NormalizedHazardCard[]>(() => {
    const list: NormalizedHazardCard[] = [];
    const fallbackIso = hazards?.meta?.fetchedAt ?? null;

    if (kindFilter === 'all' || kindFilter === 'fire') {
      for (const feat of hazards?.fires?.features ?? []) {
        const coords = feat.geometry?.coordinates;
        const validCoords: [number, number] | null =
          Array.isArray(coords) &&
          coords.length >= 2 &&
          Number.isFinite(coords[0]) &&
          Number.isFinite(coords[1])
            ? [coords[0], coords[1]]
            : null;
        if (!validCoords || !isPointInViewport(validCoords[1], validCoords[0], viewportBounds)) {
          continue;
        }
        const title =
          typeof feat.properties?.title === 'string' && feat.properties.title.trim()
            ? feat.properties.title.trim()
            : 'Feu actif';
        const dateIso =
          typeof feat.properties?.date === 'string' ? feat.properties.date : fallbackIso;

        list.push({
          id: `fire-${String(feat.id ?? list.length)}`,
          kind: 'fire',
          title,
          coords: validCoords,
          distanceKm: haversineKm(center, validCoords),
          freshness: formatFreshness(dateIso),
          tone: 'red',
        });
      }
    }

    if (kindFilter === 'all' || kindFilter === 'flood') {
      const seenFloodKeys = new Set<string>();
      const maxFloodAgeMs = 7 * 86_400_000;
      const nowMs = Date.now();
      for (const feat of hazards?.floods?.features ?? []) {
        const coords = feat.geometry?.coordinates;
        const validCoords: [number, number] | null =
          Array.isArray(coords) &&
          coords.length >= 2 &&
          Number.isFinite(coords[0]) &&
          Number.isFinite(coords[1])
            ? [coords[0], coords[1]]
            : null;
        if (!validCoords || !isPointInViewport(validCoords[1], validCoords[0], viewportBounds)) {
          continue;
        }
        const river =
          typeof feat.properties?.river === 'string' && feat.properties.river.trim()
            ? feat.properties.river.trim()
            : null;
        const stationName =
          typeof feat.properties?.name === 'string' && feat.properties.name.trim()
            ? feat.properties.name.trim()
            : 'Station hydro';
        const title = river && !stationName.toLowerCase().includes(river.toLowerCase())
          ? `${river} · ${stationName}`
          : stationName;
        const dateIso =
          typeof feat.properties?.updatedAt === 'string'
            ? feat.properties.updatedAt
            : fallbackIso;

        // Defense-in-depth: never display stale (> 7 days) administrative station records
        if (dateIso) {
          const ts = Date.parse(dateIso);
          if (Number.isFinite(ts) && nowMs - ts > maxFloodAgeMs) continue;
        }

        const dedupKey = title.toLowerCase().replace(/\s+/g, ' ').trim();
        if (seenFloodKeys.has(dedupKey)) continue;
        seenFloodKeys.add(dedupKey);

        const levelM =
          typeof feat.properties?.levelM === 'number' && Number.isFinite(feat.properties.levelM)
            ? `${feat.properties.levelM.toFixed(2).replace('.', ',')} m`
            : undefined;

        list.push({
          id: `flood-${String(feat.id ?? list.length)}`,
          kind: 'flood',
          title,
          coords: validCoords,
          distanceKm: haversineKm(center, validCoords),
          freshness: formatFreshness(dateIso),
          badge: levelM,
          tone: 'blue',
        });
      }
    }

    if (kindFilter === 'all' || kindFilter === 'quake') {
      for (const feat of hazards?.earthquakes?.features ?? []) {
        const coords = feat.geometry?.coordinates;
        const validCoords: [number, number] | null =
          Array.isArray(coords) &&
          coords.length >= 2 &&
          Number.isFinite(coords[0]) &&
          Number.isFinite(coords[1])
            ? [coords[0], coords[1]]
            : null;
        if (!validCoords || !isPointInViewport(validCoords[1], validCoords[0], viewportBounds)) {
          continue;
        }
        const mag =
          typeof feat.properties?.magnitude === 'number' &&
          Number.isFinite(feat.properties.magnitude)
            ? `M${feat.properties.magnitude.toFixed(1)}`
            : null;
        const place =
          typeof feat.properties?.place === 'string' && feat.properties.place.trim()
            ? feat.properties.place.trim()
            : typeof feat.properties?.title === 'string' && feat.properties.title.trim()
              ? feat.properties.title.trim()
              : 'Séisme';
        const dateIso =
          typeof feat.properties?.time === 'string' ? feat.properties.time : fallbackIso;

        list.push({
          id: `quake-${String(feat.id ?? list.length)}`,
          kind: 'quake',
          title: place,
          coords: validCoords,
          distanceKm: haversineKm(center, validCoords),
          freshness: formatFreshness(dateIso),
          badge: mag ?? undefined,
          tone: 'amber',
        });
      }
    }

    if (kindFilter === 'all') {
      const areaTokens = (areaName ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4);
      const isWideOverview = zoom <= 8.5;

      for (const alert of hazards?.alerts ?? []) {
        const areaDescNorm = (alert.areaDesc ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        // Keep national alerts only at wide/country zoom OR when their zone matches the viewed sector
        if (
          !isWideOverview &&
          (!areaDescNorm ||
            areaTokens.length === 0 ||
            !areaTokens.some((tok) => areaDescNorm.includes(tok)))
        ) {
          continue;
        }
        const sev = alert.severity.toLowerCase();
        const tone: NormalizedHazardCard['tone'] =
          sev === 'extreme' || sev === 'severe'
            ? 'red'
            : sev === 'moderate'
              ? 'amber'
              : 'indigo';
        list.push({
          id: `alert-${alert.id}`,
          kind: 'alert',
          title: alert.headline || alert.event,
          coords: null,
          distanceKm: Number.POSITIVE_INFINITY,
          freshness: formatFreshness(alert.onset ?? fallbackIso),
          badge: formatHazardSeverityFr(alert.severity),
          tone,
        });
      }
    }

    if (
      (kindFilter === 'all' || kindFilter === 'airspace') &&
      typeof airspaceCount === 'number' &&
      airspaceCount > 0
    ) {
      list.push({
        id: 'airspace-live',
        kind: 'airspace',
        title: `${airspaceCount} appareil${airspaceCount > 1 ? 's' : ''} en vol`,
        coords: center,
        distanceKm: 0,
        freshness: 'Direct',
        tone: 'indigo',
      });
    }

    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [hazards, kindFilter, center, viewportBounds, zoom, areaName, airspaceCount]);

  const reportTriggerButton = onOpenReportModal ? (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={CARNET_SPRING}
      onClick={onOpenReportModal}
      style={{
        height: 36,
        padding: '0 13px',
        borderRadius: 999,
        border: '0.5px solid rgba(180, 83, 9, 0.28)',
        background:
          'linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(254, 243, 199, 0.82))',
        color: '#92400E',
        fontSize: 12,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 3px 10px rgba(180, 83, 9, 0.1)',
        alignSelf: 'flex-start',
      }}
    >
      <Plus size={14} aria-hidden="true" />
      <span>Signaler un danger ici</span>
    </motion.button>
  ) : null;

  if (loading && items.length === 0 && visibleReports.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 72 }} aria-busy="true">
        {reportTriggerButton}
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="club-glass-card xp20-shimmer"
            style={{ ...GLASS_CARD_BASE, height: 60 }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0 && visibleReports.length === 0) {
    return (
      <div
        className="club-glass-card"
        style={{
          ...GLASS_CARD_BASE,
          padding: '22px 16px',
          background:
            'linear-gradient(180deg, rgba(240, 249, 244, 0.92), rgba(255, 255, 255, 0.86))',
          borderColor: 'rgba(23, 64, 44, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: 'rgba(23, 64, 44, 0.1)',
            color: '#17402c',
            display: 'inline-grid',
            placeItems: 'center',
          }}
        >
          <ShieldCheck size={22} aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#17402c' }}>
          Aucun risque actif dans la zone
        </span>
        {onOpenReportModal ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={CARNET_SPRING}
            onClick={onOpenReportModal}
            style={{
              marginTop: 2,
              height: 35,
              padding: '0 14px',
              borderRadius: 999,
              border: '0.5px solid rgba(180, 83, 9, 0.28)',
              background: 'rgba(255, 251, 235, 0.94)',
              color: '#92400E',
              fontSize: 12,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 #fff, 0 2px 8px rgba(180, 83, 9, 0.08)',
            }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Signaler un danger ici</span>
          </motion.button>
        ) : null}
      </div>
    );
  }

  return (
    <StaggerList
      style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 64 }}
    >
      {reportTriggerButton}

      {visibleReports.map(({ report, distanceKm }) => {
        const isClear =
          report.category === 'marking' ||
          (report.passability === 'passable' && report.severity === 'info');
        const accent = isClear
          ? {
              border: 'rgba(21, 128, 61, 0.24)',
              bg: 'linear-gradient(180deg, rgba(240, 253, 244, 0.9), rgba(255, 255, 255, 0.86))',
              wellBg: 'rgba(21, 128, 61, 0.12)',
              wellColor: '#15803D',
              pillBg: 'rgba(21, 128, 61, 0.11)',
              pillColor: '#166534',
            }
          : {
              border: 'rgba(180, 83, 9, 0.26)',
              bg: 'linear-gradient(180deg, rgba(255, 251, 235, 0.9), rgba(255, 255, 255, 0.86))',
              wellBg: 'rgba(180, 83, 9, 0.13)',
              wellColor: '#B45309',
              pillBg: 'rgba(180, 83, 9, 0.11)',
              pillColor: '#92400E',
            };
        const title = formatReportCategoryFr(report.category);
        const voted = votedReports[report.id] ?? null;
        const confirmCount =
          (typeof report.present_count === 'number' ? report.present_count : 0) +
          (voted === 'confirm' ? 1 : 0);
        const isBusy = busyReportId === report.id;

        return (
          <div
            key={`report-${report.id}`}
            className="club-glass-card"
            style={{
              ...GLASS_CARD_BASE,
              background: accent.bg,
              borderColor: accent.border,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <button
              type="button"
              disabled={!onFocusCoordinates}
              onClick={() => onFocusCoordinates?.([report.lng, report.lat], title)}
              style={{
                border: 0,
                padding: 0,
                background: 'transparent',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                cursor: onFocusCoordinates ? 'pointer' : 'default',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: accent.wellBg,
                  color: accent.wellColor,
                  display: 'inline-grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {isClear ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                  <Flag size={15} aria-hidden="true" />
                )}
              </span>

              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#172B24',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: accent.pillBg,
                      color: accent.pillColor,
                      flexShrink: 0,
                    }}
                  >
                    Terrain
                  </span>
                </div>

                {report.description ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#34473E',
                      lineHeight: 1.35,
                    }}
                  >
                    {report.description}
                  </span>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
                  {Number.isFinite(distanceKm) && distanceKm > 0 ? (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '1.5px 7px',
                        borderRadius: 999,
                        background: 'rgba(23, 64, 44, 0.07)',
                        color: '#172B24',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatDistanceLabel(distanceKm)}
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '1.5px 7px',
                      borderRadius: 999,
                      background: 'rgba(86, 102, 93, 0.09)',
                      color: '#56665D',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatFreshness(report.created_at)}
                  </span>
                </div>
              </div>
            </button>

            {onConfirmReport ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 44 }}>
                <button
                  type="button"
                  disabled={isBusy || voted !== null}
                  onClick={() => void handleVoteReport(report.id, 'confirm')}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 999,
                    border:
                      voted === 'confirm'
                        ? '0.5px solid rgba(180, 83, 9, 0.4)'
                        : '0.5px solid rgba(23, 64, 44, 0.14)',
                    background:
                      voted === 'confirm'
                        ? 'rgba(180, 83, 9, 0.14)'
                        : 'rgba(255, 255, 255, 0.88)',
                    color: voted === 'confirm' ? '#92400E' : '#172B24',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: isBusy || voted !== null ? 'default' : 'pointer',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <ThumbsUp size={11} aria-hidden="true" />
                  <span>Confirmer ({confirmCount})</span>
                </button>

                <button
                  type="button"
                  disabled={isBusy || voted !== null}
                  onClick={() => void handleVoteReport(report.id, 'gone')}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 999,
                    border:
                      voted === 'gone'
                        ? '0.5px solid rgba(21, 128, 61, 0.42)'
                        : '0.5px solid rgba(21, 128, 61, 0.2)',
                    background:
                      voted === 'gone'
                        ? 'rgba(21, 128, 61, 0.14)'
                        : 'rgba(240, 253, 244, 0.85)',
                    color: '#166534',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: isBusy || voted !== null ? 'default' : 'pointer',
                  }}
                >
                  <Check size={11} aria-hidden="true" />
                  <span>{voted === 'gone' ? 'Signalé résolu' : 'Résolu'}</span>
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {items.map((item) => {
        const tone = HAZARD_TONE_STYLES[item.tone];
        const clickable = Boolean(item.coords && onFocusCoordinates);

        return (
          <motion.button
            key={item.id}
            type="button"
            disabled={!clickable}
            whileTap={clickable ? { scale: 0.98 } : undefined}
            transition={CARNET_SPRING}
            onClick={() => {
              if (item.coords && onFocusCoordinates) {
                onFocusCoordinates(item.coords, item.title);
              }
            }}
            className="club-glass-card"
            style={{
              ...GLASS_CARD_BASE,
              borderColor: tone.border,
              padding: '10px 12px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: tone.wellBg,
                color: tone.wellColor,
                display: 'inline-grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {hazardIcon(item.kind)}
            </span>

            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#172b24',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.title}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {item.badge ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: tone.pillBg,
                      color: tone.pillColor,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}

                {Number.isFinite(item.distanceKm) && item.distanceKm > 0 ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.07)',
                      color: '#172b24',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatDistanceLabel(item.distanceKm)}
                  </span>
                ) : null}

                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'rgba(86, 102, 93, 0.09)',
                    color: '#56665d',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.freshness}
                </span>
              </div>
            </div>
          </motion.button>
        );
      })}
    </StaggerList>
  );
}

export function SafetyWeatherLens({
  weather,
  daylight,
  radarEnabled,
  onToggleRadar,
  radarUpdatedAt,
  loading = false,
}: SafetyWeatherLensProps) {
  const hours = useMemo(() => (weather?.hours ?? []).slice(0, 12), [weather]);
  const current = hours[0] ?? null;

  const currentTemp = current?.temperature_c ?? null;
  const windKmh =
    typeof current?.wind_ms === 'number' && Number.isFinite(current.wind_ms)
      ? Math.round(current.wind_ms * 3.6)
      : null;

  const chartData = useMemo(() => {
    return hours.map((h) => ({
      hour: formatHourAxis(h.time),
      temp: typeof h.temperature_c === 'number' && Number.isFinite(h.temperature_c)
        ? Number(h.temperature_c.toFixed(1))
        : null,
      precip: Number(
        (h.precip_mm ?? h.precipitation_mm ?? 0).toFixed(1),
      ),
    }));
  }, [hours]);

  const turnaroundMs = useMemo(() => {
    if (!daylight || daylight.status !== 'normal') return null;
    const refMs = daylight.sunsetMs ?? daylight.civilDuskMs;
    if (typeof refMs !== 'number' || !Number.isFinite(refMs)) return null;
    // Standard 2h margin before sunset for safe turnaround
    return refMs - 2 * 3_600_000;
  }, [daylight]);

  const hasPrecip = chartData.some((d) => d.precip > 0);

  if (loading && !current && !daylight) {
    return (
      <div
        className="club-glass-card xp20-shimmer"
        style={{ ...GLASS_CARD_BASE, height: 220 }}
        aria-busy="true"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 64 }}>
      {/* Compact visual hero */}
      <div
        className="club-glass-card"
        style={{
          ...GLASS_CARD_BASE,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                background: 'rgba(23, 64, 44, 0.08)',
                display: 'inline-grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {renderWeatherIcon(current?.symbol, 26)}
            </span>
            <div
              style={{
                fontSize: 30,
                lineHeight: 1,
                fontWeight: 800,
                color: '#172b24',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <AnimatedNumber value={currentTemp} suffix="°C" />
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(23, 64, 44, 0.08)',
              color: '#17402c',
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Wind size={13} aria-hidden="true" />
            <AnimatedNumber value={windKmh} suffix=" km/h" />
          </div>
        </div>

        {/* Offline twilight & turnaround pill (explicitly labeled for instant readability) */}
        {daylight ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: daylight.status === 'normal' ? 'repeat(3, minmax(0, 1fr))' : '1fr',
              gap: 6,
              padding: '7px 10px',
              borderRadius: 14,
              background: 'rgba(251, 250, 246, 0.92)',
              border: '0.5px solid rgba(23, 64, 44, 0.12)',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#172b24',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {daylight.status === 'normal' ? (
              <>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#56665d' }}>Lever</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sunrise size={12} color="#b45309" aria-hidden="true" />
                    <span>{formatClockHm(daylight.sunriseMs)}</span>
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#56665d' }}>Coucher</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sunset size={12} color="#17402c" aria-hidden="true" />
                    <span>{formatClockHm(daylight.sunsetMs ?? daylight.civilDuskMs)}</span>
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#56665d' }}>Demi-tour</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#56665d' }}>
                    <Clock size={11} aria-hidden="true" />
                    <span>{formatClockHm(turnaroundMs)}</span>
                  </span>
                </span>
              </>
            ) : (
              <span style={{ color: '#17402c' }}>
                {daylight.status === 'polar_day' ? 'Jour polaire (24h)' : 'Nuit polaire'}
              </span>
            )}
          </div>
        ) : null}

        {/* Plain-French weather & equipment tip */}
        {(() => {
          const advice = buildWeatherAdviceFr(
            currentTemp,
            windKmh,
            current?.precip_mm ?? current?.precipitation_mm ?? null,
            current?.symbol,
          );
          if (!advice) return null;
          return (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 11,
                background: 'rgba(23, 64, 44, 0.06)',
                fontSize: 11.5,
                fontWeight: 600,
                color: '#17402c',
                lineHeight: 1.35,
              }}
            >
              {advice}
            </div>
          );
        })()}
      </div>

      {/* 12 h Recharts AreaChart */}
      <div
        className="club-glass-card"
        style={{
          ...GLASS_CARD_BASE,
          padding: '10px 10px 6px',
        }}
      >
        {chartData.length > 1 ? (
          <div style={{ width: '100%', height: 112 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 6, right: 6, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="lkdvSafetyTempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#17402c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#96ba8e" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="lkdvSafetyRainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#56665d' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="temp"
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 10, fill: '#56665d' }}
                  tickFormatter={(v) => `${Math.round(Number(v))}°`}
                  axisLine={false}
                  tickLine={false}
                />
                {hasPrecip ? (
                  <YAxis
                    yAxisId="rain"
                    orientation="right"
                    hide
                    domain={[0, 'dataMax + 2']}
                  />
                ) : null}
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '0.5px solid rgba(23, 64, 44, 0.16)',
                    background: 'rgba(255, 255, 255, 0.96)',
                    fontSize: 11.5,
                    padding: '6px 10px',
                    boxShadow: '0 6px 16px rgba(23, 43, 36, 0.12)',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    if (name === 'precip') return [`${value} mm`, 'Pluie'];
                    return [`${value}°C`, 'Temp.'];
                  }}
                />
                {hasPrecip ? (
                  <Area
                    yAxisId="rain"
                    type="stepAfter"
                    dataKey="precip"
                    stroke="#2563eb"
                    strokeOpacity={0.55}
                    strokeWidth={1.2}
                    fill="url(#lkdvSafetyRainGrad)"
                    isAnimationActive={false}
                  />
                ) : null}
                <Area
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp"
                  stroke="#17402c"
                  strokeWidth={2.2}
                  fill="url(#lkdvSafetyTempGrad)"
                  activeDot={{ r: 4, fill: '#17402c', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            style={{
              height: 112,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: '#56665d',
            }}
          >
            Prévisions 12 h indisponibles
          </div>
        )}
      </div>

      {/* 1-tap visual radar toggle pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={CARNET_SPRING}
          onClick={onToggleRadar}
          aria-pressed={radarEnabled}
          className={radarEnabled ? undefined : 'lkdv-carnet-btn-soft'}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: radarEnabled
              ? '0.5px solid rgba(23, 64, 44, 0.35)'
              : '0.5px solid rgba(23, 64, 44, 0.18)',
            background: radarEnabled
              ? 'linear-gradient(180deg, #1f543a, #17402c)'
              : 'rgba(255, 255, 255, 0.86)',
            color: radarEnabled ? '#fbfaf6' : '#17402c',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            boxShadow: radarEnabled
              ? '0 4px 12px rgba(23, 64, 44, 0.22)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(23, 43, 36, 0.06)',
          }}
        >
          <Radio size={13} aria-hidden="true" />
          <span>{radarEnabled ? 'Radar pluie ON' : 'Radar pluie OFF'}</span>
        </motion.button>

        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: '4px 9px',
            borderRadius: 999,
            background: 'rgba(23, 64, 44, 0.08)',
            color: '#56665d',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatFreshness(radarUpdatedAt)}
        </span>
      </div>
    </div>
  );
}

type VitalCategory = 'water' | 'refuge' | 'rescue' | 'access';

function classifyVitalPoi(poi: PoiItem): VitalCategory | null {
  const kind = (poi.kind ?? '').trim().toLowerCase();
  const sub = (poi.subtype ?? '').trim().toLowerCase();

  if (kind === 'water' || sub.includes('water') || sub.includes('spring')) {
    return 'water';
  }
  if (
    kind === 'rescue' ||
    sub.includes('rescue') ||
    sub.includes('hospital') ||
    sub.includes('medical') ||
    sub.includes('pghm')
  ) {
    return 'rescue';
  }
  if (
    kind === 'refuge' ||
    kind === 'shelter' ||
    sub.includes('refuge') ||
    sub.includes('shelter') ||
    sub.includes('hut')
  ) {
    return 'refuge';
  }
  if (kind === 'access') {
    return 'access';
  }
  return null;
}

export function SafetySurvivalLens({
  pois,
  center,
  viewportBounds = null,
  kindFilter = 'all',
  loading = false,
  onSelectPoi,
  onFocusCoordinates,
}: SafetySurvivalLensProps) {
  const vitalPois = useMemo(() => {
    const entries: Array<{ poi: PoiItem; category: VitalCategory; distanceKm: number }> = [];
    for (const poi of pois) {
      const category = classifyVitalPoi(poi);
      if (!category) continue;
      if (kindFilter !== 'all' && category !== kindFilter) continue;
      if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lon)) continue;
      if (!isPointInViewport(poi.lat, poi.lon, viewportBounds)) continue;
      entries.push({
        poi,
        category,
        distanceKm: haversineKm(center, [poi.lon, poi.lat]),
      });
    }
    return entries.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [pois, center, viewportBounds, kindFilter]);

  if (loading && vitalPois.length === 0) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          paddingBottom: 72,
        }}
        aria-busy="true"
      >
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="club-glass-card xp20-shimmer"
            style={{ ...GLASS_CARD_BASE, height: 96 }}
          />
        ))}
      </div>
    );
  }

  if (vitalPois.length === 0) {
    return (
      <div
        className="club-glass-card"
        style={{
          ...GLASS_CARD_BASE,
          padding: '22px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: 'rgba(14, 116, 144, 0.1)',
            color: '#0e7490',
            display: 'inline-grid',
            placeItems: 'center',
          }}
        >
          <Droplets size={18} aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#172b24' }}>
          Aucun point d&apos;eau ou refuge proche
        </span>
      </div>
    );
  }

  return (
    <StaggerList
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        paddingBottom: 64,
      }}
    >
      {vitalPois.map(({ poi, category, distanceKm }) => {
        const pres = resolvePoiPresentation(poi.kind, poi.subtype);
        return (
          <motion.button
            key={poi.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={CARNET_SPRING}
            onClick={() => {
              if (onSelectPoi) {
                onSelectPoi(poi);
              } else {
                onFocusCoordinates?.([poi.lon, poi.lat], poi.name);
              }
            }}
            className="club-glass-card"
            style={{
              ...GLASS_CARD_BASE,
              padding: '10px 11px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              textAlign: 'left',
              cursor: onSelectPoi || onFocusCoordinates ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 11,
                  background: pres.bgTint,
                  color: pres.color,
                  display: 'inline-grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {renderPoiIcon(pres.iconKey, 16, pres.color)}
              </span>

              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: poi.potable === true ? 'rgba(14, 116, 144, 0.12)' : pres.bgTint,
                  color: poi.potable === true ? '#0e7490' : pres.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {poi.potable === true ? 'Potable' : pres.shortBadge}
              </span>
            </div>

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: '#172b24',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {poi.name || (category === 'water' ? "Point d'eau" : pres.label)}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: '#56665d',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{formatDistanceLabel(distanceKm)}</span>
              {typeof poi.ele_m === 'number' && Number.isFinite(poi.ele_m) ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{Math.round(poi.ele_m)} m</span>
                </>
              ) : null}
            </div>
          </motion.button>
        );
      })}
    </StaggerList>
  );
}
