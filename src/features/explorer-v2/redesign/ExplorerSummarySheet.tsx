'use client';

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Award,
  Backpack,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Clock,
  CloudOff,
  Compass,
  Download,
  Flame,
  Gauge,
  Leaf,
  MapPin,
  Mountain,
  Pencil,
  RefreshCw,
  Route,
  Scissors,
  Send,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AnimatedNumber, StackSlideView } from '@/components/carnet/v2/CarnetDrawerMotion';
import type { SummarySavedState } from '../activity/finishOutcome';
import type { WeatherSnapshot } from '../adaptive/types';
import type { GeoCollection } from '../data/hooks';
import { formatPrimarySpeedMetric, resolveActivityProfile } from '../specs/resolveActivityProfile';
import type { SafetyCorridorState } from '../state/hudMachine';
import type { ActivityState, Sport, StrengthLog } from '../state/types';
import type { HudContrastVariant } from './primitives/ExplorerNonModalSheet';
import { RouteMiniTraceSvg } from './components/RouteMiniTraceSvg';
import {
  decimateTrackLngLat,
  saveExplorerOutingHandoff,
} from '../outingHandoff';

const LazySummaryExpertAnalysisSubDrawer = lazy(() =>
  import('./summary/SummaryExpertAnalysisSubDrawer').then((m) => ({
    default: m.SummaryExpertAnalysisSubDrawer,
  })),
);

const LazySummaryPrivacyCropSubDrawer = lazy(() =>
  import('./summary/SummaryPrivacyCropSubDrawer').then((m) => ({
    default: m.SummaryPrivacyCropSubDrawer,
  })),
);

export interface ExplorerSummaryPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  t?: number;
  speed?: number | null;
  acc?: number | null;
  hr?: number | null;
  speedKmh?: number | null;
  cad?: number | null;
  powerW?: number | null;
}

export interface ExplorerSummaryWaypoint {
  id: string;
  kind: string;
  label: string;
  lat: number;
  lng: number;
}

export interface ExplorerSummarySheetProps {
  summary: ActivityState & { endedAt: number };
  summarySaved?: SummarySavedState;
  units: 'metric' | 'imperial';
  activityTrack: GeoCollection | null;
  onRetrySync: () => void;
  onDone: () => void;
  summaryId?: string | null;
  sportLabel?: string | null;
  points?: ReadonlyArray<ExplorerSummaryPoint>;
  waypoints?: ReadonlyArray<ExplorerSummaryWaypoint>;
  photosCount?: number;
  xpEarned?: number | null;
  onSaveDetails?: (details: { title: string; rpe: number; notes: string }) => void | Promise<void>;
  onExportGpx?: () => void;
  onAddToCarnet?: () => void;
  onShareOuting?: () => void;
  onDiscard?: () => void;
  onSaveAsRoute?: (title: string) => void;
  onLaunchBottle?: () => void;
  onOpenPokedex?: () => void;
  onOpenSafetyReport?: () => void;
  /** Enriched outing context harvested from Explorer for full form auto-fill & expert analysis. */
  locationLabel?: string | null;
  centerCoords?: [number, number] | null;
  weatherLabel?: string | null;
  weather?: WeatherSnapshot | null;
  packWeightKg?: number | null;
  bodyWeightKg?: number | null;
  strengthLog?: StrengthLog | null;
  safetyCorridor?: SafetyCorridorState | null;
  userId?: string | null;
  contrast?: HudContrastVariant;
  glovesMode?: boolean;
  onProfileCursorChange?: (
    cursor: { lon: number; lat: number; distanceM: number; elevationM: number | null } | null,
  ) => void;
  onHighlightSegment?: (
    segment: { coordinates: Array<[number, number]>; label?: string } | null,
  ) => void;
}

type SummaryTab = 'overview' | 'connect';

const SPORT_FALLBACK_LABELS: Record<Sport, string> = {
  rando: 'Rando',
  trail: 'Trail',
  velo: 'Vélo',
  course: 'Course',
  escalade: 'Alpinisme',
  ski: 'Ski',
  kayak: 'Kayak',
  bivouac: 'Bivouac',
  famille: 'Famille',
};

const RPE_LEVELS: ReadonlyArray<{ value: number; label: string; color: string; bg: string }> = [
  { value: 1, label: 'Très facile', color: '#15803D', bg: 'rgba(21, 128, 61, 0.14)' },
  { value: 2, label: 'Facile', color: '#15803D', bg: 'rgba(21, 128, 61, 0.14)' },
  { value: 3, label: 'Léger', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.14)' },
  { value: 4, label: 'Modéré', color: '#65A30D', bg: 'rgba(101, 163, 13, 0.15)' },
  { value: 5, label: 'Confort +', color: '#CA8A04', bg: 'rgba(202, 138, 4, 0.15)' },
  { value: 6, label: 'Soutenu', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)' },
  { value: 7, label: 'Exigeant', color: '#EA580C', bg: 'rgba(234, 88, 12, 0.15)' },
  { value: 8, label: 'Difficile', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.14)' },
  { value: 9, label: 'Très dur', color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.15)' },
  { value: 10, label: 'Maximal', color: '#991B1B', bg: 'rgba(153, 27, 27, 0.16)' },
];

function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatOutingTimestamp(ms: number): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return 'Aujourd’hui';
  }
}

function buildDefaultTitle(sportName: string, startedAt: number, routeName?: string | null): string {
  if (routeName && routeName.trim().length > 0) return routeName.trim();
  try {
    const formattedDate = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(startedAt));
    return `Sortie ${sportName} · ${formattedDate}`;
  } catch {
    return `Sortie ${sportName}`;
  }
}

function estimateCaloriesKcal(sport: Sport, elapsedS: number, distanceM: number, elevGainM: number): number {
  const hours = Math.max(0, elapsedS) / 3600;
  const km = Math.max(0, distanceM) / 1000;
  const metBySport: Record<Sport, number> = {
    rando: 6.0,
    trail: 9.5,
    velo: 7.5,
    course: 9.8,
    escalade: 7.5,
    ski: 7.0,
    kayak: 5.5,
    bivouac: 4.5,
    famille: 4.0,
  };
  const met = metBySport[sport] ?? 6.0;
  return Math.max(0, Math.round(Math.max(met * 70 * hours, (km * 55 + elevGainM * 0.45) * 0.85)));
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractPointsFromGeoJson(geojson: unknown): ExplorerSummaryPoint[] {
  if (!geojson || typeof geojson !== 'object') return [];
  const obj = geojson as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : null;
  if (type === 'Feature') return extractPointsFromGeoJson(obj.geometry);
  if (type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj.features.flatMap((f) => extractPointsFromGeoJson(f));
  }
  if (type === 'LineString' && Array.isArray(obj.coordinates)) {
    return obj.coordinates
      .filter(
        (c): c is number[] =>
          Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number',
      )
      .map((c) => ({
        lng: c[0],
        lat: c[1],
        ele: typeof c[2] === 'number' ? c[2] : null,
      }));
  }
  if (type === 'MultiLineString' && Array.isArray(obj.coordinates)) {
    const out: ExplorerSummaryPoint[] = [];
    for (const seg of obj.coordinates) {
      if (!Array.isArray(seg)) continue;
      for (const c of seg) {
        if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
          out.push({ lng: c[0], lat: c[1], ele: typeof c[2] === 'number' ? c[2] : null });
        }
      }
    }
    return out;
  }
  return [];
}

function buildGpxXml(
  title: string,
  points: ReadonlyArray<ExplorerSummaryPoint>,
  waypoints: ReadonlyArray<ExplorerSummaryWaypoint>,
): string {
  const safeName = escapeXml(title || 'Sortie Explorer');
  const wptXml = waypoints
    .map(
      (wp) =>
        `  <wpt lat="${wp.lat.toFixed(6)}" lon="${wp.lng.toFixed(6)}"><name>${escapeXml(wp.label)}</name><type>${escapeXml(wp.kind)}</type></wpt>`,
    )
    .join('\n');
  const trkptsXml = points
    .map((pt) => {
      const eleTag =
        pt.ele !== null && pt.ele !== undefined && Number.isFinite(pt.ele)
          ? `<ele>${pt.ele.toFixed(1)}</ele>`
          : '';
      const timeTag =
        pt.t !== undefined && Number.isFinite(pt.t)
          ? `<time>${new Date(pt.t).toISOString()}</time>`
          : '';
      return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleTag}${timeTag}</trkpt>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Le Kit du Voyageur Explorer" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${safeName}</name></metadata>`,
    wptXml,
    '  <trk>',
    `    <name>${safeName}</name>`,
    '    <trkseg>',
    trkptsXml,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

export function ExplorerSummarySheet({
  summary,
  summarySaved = 'pending',
  units,
  activityTrack,
  onRetrySync,
  onDone,
  summaryId = null,
  sportLabel = null,
  points,
  waypoints,
  photosCount,
  xpEarned = null,
  onSaveDetails,
  onExportGpx,
  onAddToCarnet,
  onShareOuting,
  onDiscard,
  onSaveAsRoute,
  onLaunchBottle,
  onOpenPokedex,
  onOpenSafetyReport,
  locationLabel = null,
  centerCoords = null,
  weatherLabel = null,
  weather = null,
  packWeightKg = null,
  bodyWeightKg = null,
  strengthLog = null,
  userId = null,
  contrast = 'standard',
  glovesMode = false,
  onProfileCursorChange,
  onHighlightSegment,
}: ExplorerSummarySheetProps) {
  const resolvedSportLabel =
    sportLabel || summary.selection?.variantLabel || SPORT_FALLBACK_LABELS[summary.sport] || 'Sortie';
  const defaultTitle = useMemo(
    () => buildDefaultTitle(resolvedSportLabel, summary.startedAt, summary.route?.name),
    [resolvedSportLabel, summary.startedAt, summary.route?.name],
  );

  const [activeTab, setActiveTab] = useState<SummaryTab>('overview');
  const [title, setTitle] = useState(defaultTitle);
  const [rpe, setRpe] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [routeSavedFeedback, setRouteSavedFeedback] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const activeProfile = useMemo(
    () => resolveActivityProfile(summary.selection?.variantId || summary.sport),
    [summary.selection?.variantId, summary.sport],
  );

  const distanceMetric = useMemo(() => {
    const m = Math.max(0, summary.distanceM || 0);
    if (units === 'imperial') {
      return { value: Number((m / 1609.344).toFixed(2)), suffix: ' mi', decimals: 2 };
    }
    if (m < 1000) return { value: Math.round(m), suffix: ' m', decimals: 0 };
    return { value: Number((m / 1000).toFixed(2)), suffix: ' km', decimals: 2 };
  }, [summary.distanceM, units]);

  const elapsedS =
    summary.movingS > 0
      ? summary.movingS
      : Math.max(0, Math.round((summary.endedAt - summary.startedAt) / 1000));
  const elevGainM = Math.max(0, Math.round(summary.elevGainM || 0));
  const caloriesKcal = useMemo(
    () => estimateCaloriesKcal(summary.sport, elapsedS, summary.distanceM || 0, elevGainM),
    [summary.sport, elapsedS, summary.distanceM, elevGainM],
  );

  const speedMetric = useMemo(() => {
    if (elapsedS < 5 || (summary.distanceM || 0) <= 0) {
      const unitBySpec =
        activeProfile.algorithms.primarySpeedUnit === 'min_per_km'
          ? 'min/km'
          : activeProfile.algorithms.primarySpeedUnit === 'min_per_100m'
            ? 'min/100m'
            : activeProfile.algorithms.primarySpeedUnit === 'm_per_h_vam'
              ? 'm/h'
              : activeProfile.algorithms.primarySpeedUnit === 'knots'
                ? 'nd'
                : 'km/h';
      return { value: '0,0', unit: unitBySpec };
    }
    const formatted = formatPrimarySpeedMetric(activeProfile, {
      distanceM: summary.distanceM || 0,
      movingS: elapsedS,
      elevGainM,
      units,
    });
    return { value: formatted.valueText, unit: formatted.unitLabel };
  }, [activeProfile, elapsedS, elevGainM, summary.distanceM, units]);

  const trackGeo = useMemo<unknown>(() => {
    if (activityTrack) return activityTrack;
    if (points && points.length >= 2) {
      return {
        type: 'Feature',
        properties: { id: summaryId ?? `summary-${summary.startedAt}` },
        geometry: {
          type: 'LineString',
          coordinates: points.map((p) => [p.lng, p.lat]),
        },
      };
    }
    return summary.route?.geojson ?? null;
  }, [activityTrack, points, summary.route?.geojson, summary.startedAt, summaryId]);

  const resolvedPoints = useMemo<ReadonlyArray<ExplorerSummaryPoint>>(() => {
    if (points && points.length > 0) return points;
    return extractPointsFromGeoJson(trackGeo);
  }, [points, trackGeo]);

  const elevationBounds = useMemo(() => {
    if (resolvedPoints.length === 0) return null;
    let minEle = Infinity;
    let maxEle = -Infinity;
    for (const pt of resolvedPoints) {
      if (pt.ele !== null && pt.ele !== undefined && Number.isFinite(pt.ele)) {
        if (pt.ele < minEle) minEle = pt.ele;
        if (pt.ele > maxEle) maxEle = pt.ele;
      }
    }
    if (!Number.isFinite(minEle) || !Number.isFinite(maxEle)) return null;
    return { minM: Math.round(minEle), maxM: Math.round(maxEle) };
  }, [resolvedPoints]);

  const isSynced =
    summarySaved === 'saved' ||
    summarySaved === 'already_finished' ||
    summarySaved === 'already_finished_without_summary' ||
    summarySaved === 'local';
  const canRetry =
    summarySaved === 'failed' ||
    summarySaved === 'unauthenticated' ||
    summarySaved === 'conflict';

  const syncLabel =
    summarySaved === 'saved' || summarySaved === 'already_finished'
      ? 'Synchronisé'
      : summarySaved === 'local'
        ? 'Local'
        : summarySaved === 'unauthenticated'
          ? 'Connexion requise'
          : summarySaved === 'failed' || summarySaved === 'conflict'
            ? 'En attente'
            : 'Hors ligne';

  const hasTrackLine = resolvedPoints.length >= 2;
  const resolvedPhotosCount = photosCount ?? summary.capturedMedia?.length ?? 0;
  const resolvedWaypointsCount = waypoints?.length ?? 0;
  const activeRpeMeta = RPE_LEVELS[Math.max(0, Math.min(9, rpe - 1))];

  const carnetHref = summaryId
    ? `/communaute?create=carnet&fromOuting=1&attachSessionId=${encodeURIComponent(summaryId)}`
    : '/communaute?create=carnet&fromOuting=1';
  const communityPostHref = summaryId
    ? `/communaute?create=post&fromOuting=1&shareSession=${encodeURIComponent(summaryId)}`
    : '/communaute?create=post&fromOuting=1';
  const storyHref = '/communaute?create=story&fromOuting=1';
  const sortieHref = '/communaute?create=sortie&fromOuting=1';
  const kitCreateHref = '/communaute?create=kit&fromOuting=1';
  const clubCreateHref = '/communaute?create=club&fromOuting=1';

  // Persist the complete harvested outing telemetry live into sessionStorage so ANY form
  // opened from this summary (Carnet, Post, Story, Sortie, Kit, Club) auto-fills seamlessly!
  useEffect(() => {
    const rawPts =
      points && points.length >= 2 ? points : extractPointsFromGeoJson(trackGeo);
    const track = decimateTrackLngLat(rawPts, 350);
    let elevLossM = 0;
    for (let i = 1; i < rawPts.length; i += 1) {
      const prev = rawPts[i - 1]?.ele;
      const cur = rawPts[i]?.ele;
      if (typeof prev === 'number' && typeof cur === 'number' && cur < prev) {
        elevLossM += prev - cur;
      }
    }
    const resolvedCenter: [number, number] | null =
      track[0] ?? centerCoords ?? null;

    saveExplorerOutingHandoff({
      savedAt: Date.now(),
      sessionId: summaryId,
      title: title.trim() || defaultTitle,
      sport: summary.sport,
      sportLabel: resolvedSportLabel,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      distanceKm: Number((Math.max(0, summary.distanceM || 0) / 1000).toFixed(2)),
      movingS: elapsedS,
      elevGainM,
      elevLossM: Math.round(elevLossM),
      maxAltitudeM: elevationBounds?.maxM ?? null,
      minAltitudeM: elevationBounds?.minM ?? null,
      avgSpeedLabel: `${speedMetric.value} ${speedMetric.unit}`,
      caloriesKcal,
      rpe,
      notes: notes.trim(),
      locationLabel: locationLabel?.trim() || 'Explorer',
      center: resolvedCenter,
      weatherLabel: weatherLabel ?? null,
      track,
      waypoints: (waypoints ?? []).map((wp) => ({
        id: wp.id,
        kind: wp.kind,
        label: wp.label,
        lat: wp.lat,
        lng: wp.lng,
      })),
      photosCount: resolvedPhotosCount,
    });
  }, [
    caloriesKcal,
    centerCoords,
    defaultTitle,
    elapsedS,
    elevGainM,
    elevationBounds?.maxM,
    elevationBounds?.minM,
    locationLabel,
    notes,
    points,
    resolvedPhotosCount,
    resolvedSportLabel,
    rpe,
    speedMetric.unit,
    speedMetric.value,
    summary.distanceM,
    summary.endedAt,
    summary.sport,
    summary.startedAt,
    summaryId,
    title,
    trackGeo,
    waypoints,
    weatherLabel,
  ]);

  const handleSaveDetails = useCallback(async () => {
    if (!onSaveDetails || savingDetails) return;
    setSavingDetails(true);
    try {
      await onSaveDetails({
        title: title.trim() || defaultTitle,
        rpe,
        notes: notes.trim(),
      });
      setDirty(false);
      setSavedFeedback(true);
      window.setTimeout(() => setSavedFeedback(false), 2200);
    } finally {
      setSavingDetails(false);
    }
  }, [onSaveDetails, savingDetails, title, defaultTitle, rpe, notes]);

  const handleExportGpxClick = useCallback(() => {
    if (onExportGpx) {
      onExportGpx();
      return;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const exportPoints =
      points && points.length > 0 ? points : extractPointsFromGeoJson(trackGeo);
    const xml = buildGpxXml(title.trim() || defaultTitle, exportPoints, waypoints ?? []);
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug =
      (title.trim() || defaultTitle)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sortie';
    link.href = url;
    link.download = `${slug}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [onExportGpx, points, trackGeo, title, defaultTitle, waypoints]);

  const handleShareClick = useCallback(() => {
    if (onShareOuting) {
      onShareOuting();
      return;
    }
    const shareText = `${title.trim() || defaultTitle} — ${distanceMetric.value}${distanceMetric.suffix}, ${formatDurationClock(elapsedS)}, +${elevGainM} m D+`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      void navigator.share({ title: title.trim() || defaultTitle, text: shareText }).catch(() => {});
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(shareText).then(() => {
        setShareFeedback('Copié');
        window.setTimeout(() => setShareFeedback(null), 2000);
      });
    }
  }, [onShareOuting, title, defaultTitle, distanceMetric, elapsedS, elevGainM]);

  const handleSaveRouteClick = useCallback(() => {
    if (!onSaveAsRoute) return;
    onSaveAsRoute(title.trim() || defaultTitle);
    setRouteSavedFeedback(true);
    window.setTimeout(() => setRouteSavedFeedback(false), 2500);
  }, [onSaveAsRoute, title, defaultTitle]);

  return (
    <StackSlideView stackKey={`summary-${summaryId ?? summary.startedAt}`}>
      <div className="xp20-sum-root" data-testid="xp20-summary-sheet">
        {/* 1. Pinned Header */}
        <header className="xp20-sum-header">
          <div className="xp20-sum-header-left">
            <button
              type="button"
              className="xp20-close-pill xp20-tactile"
              onClick={onDone}
              aria-label="Fermer le résumé"
            >
              <X size={15} aria-hidden="true" />
            </button>
            <div className="xp20-sum-title-block">
              <strong>Sortie terminée</strong>
              <span>
                {resolvedSportLabel} · {formatOutingTimestamp(summary.startedAt)}
              </span>
            </div>
          </div>

          <div className="xp20-sum-header-pills">
            {xpEarned !== null && xpEarned > 0 ? (
              <span className="xp20-sum-xp-pill">
                <Sparkles size={11} aria-hidden="true" />+{Math.round(xpEarned)} XP
              </span>
            ) : null}
            <span className={`xp20-sum-sync-pill${isSynced ? ' is-ok' : ''}`}>
              {isSynced ? <Check size={11} aria-hidden="true" /> : <CloudOff size={11} aria-hidden="true" />}
              <span>{syncLabel}</span>
            </span>
          </div>
        </header>

        {/* 2. Clean 2-Tab Segmented Switcher (Bilan / Connecter à l'app) */}
        <div className="xp20-sum-seg-wrap">
          <div className="xp20-sum-seg" role="tablist" aria-label="Sections du résumé">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              className={`xp20-sum-seg-btn${activeTab === 'overview' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span>Bilan &amp; Notes</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'connect'}
              className={`xp20-sum-seg-btn${activeTab === 'connect' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('connect')}
            >
              <span>Connecter à l’app</span>
              <span className="xp20-sum-seg-count">13</span>
            </button>
          </div>
        </div>

        {/* 3. Scrollable Tab Body */}
        <div className="xp20-sum-scroll">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'overview' ? (
              <motion.div
                key="tab-overview"
                className="xp20-sum-pane"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {/* Hero Performance Card */}
                <section className="xp20-sum-hero" aria-label="Performance">
                  {hasTrackLine ? (
                    <div className="xp20-sum-trace-stage">
                      <RouteMiniTraceSvg geojson={trackGeo} width={340} height={96} />
                      <div className="xp20-sum-trace-badges">
                        {elevationBounds ? (
                          <span className="xp20-sum-mini-pill">
                            <Mountain size={10} aria-hidden="true" />
                            {elevationBounds.minM}–{elevationBounds.maxM} m
                          </span>
                        ) : null}
                        {resolvedWaypointsCount > 0 ? (
                          <span className="xp20-sum-mini-pill is-accent">
                            <MapPin size={10} aria-hidden="true" />
                            {resolvedWaypointsCount} repère{resolvedWaypointsCount > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {resolvedPhotosCount > 0 ? (
                          <span className="xp20-sum-mini-pill is-accent">
                            <Camera size={10} aria-hidden="true" />
                            {resolvedPhotosCount} photo{resolvedPhotosCount > 1 ? 's' : ''}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="xp20-sum-stats-grid">
                    <div className="xp20-sum-stat">
                      <span className="xp20-sum-stat-ico is-forest">
                        <Route size={15} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-stat-copy">
                        <strong>
                          <AnimatedNumber
                            value={distanceMetric.value}
                            suffix={distanceMetric.suffix}
                            maximumFractionDigits={distanceMetric.decimals}
                          />
                        </strong>
                        <span>Distance</span>
                      </div>
                    </div>

                    <div className="xp20-sum-stat">
                      <span className="xp20-sum-stat-ico is-sky">
                        <Clock size={15} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-stat-copy">
                        <strong>{formatDurationClock(elapsedS)}</strong>
                        <span>Durée</span>
                      </div>
                    </div>

                    <div className="xp20-sum-stat">
                      <span className="xp20-sum-stat-ico is-amber">
                        <TrendingUp size={15} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-stat-copy">
                        <strong>
                          <AnimatedNumber value={elevGainM} prefix="+" suffix=" m" />
                        </strong>
                        <span>Dénivelé D+</span>
                      </div>
                    </div>

                    <div className="xp20-sum-stat">
                      <span className="xp20-sum-stat-ico is-coral">
                        <Gauge size={15} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-stat-copy">
                        <strong>
                          {speedMetric.value} <small>{speedMetric.unit}</small>
                        </strong>
                        <span>
                          <Flame size={10} aria-hidden="true" /> {caloriesKcal} kcal
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Journal Card (Title + Effort RPE 1..10 + Notes) */}
                <section className="xp20-sum-card" aria-label="Détails de la sortie">
                  <div className="xp20-sum-field">
                    <label htmlFor="xp20-summary-title">Titre</label>
                    <input
                      id="xp20-summary-title"
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setDirty(true);
                      }}
                      placeholder={defaultTitle}
                    />
                  </div>

                  <div className="xp20-sum-field">
                    <div className="xp20-sum-rpe-head">
                      <span>Effort ressenti (RPE)</span>
                      <span
                        className="xp20-sum-rpe-pill"
                        style={{ color: activeRpeMeta.color, background: activeRpeMeta.bg }}
                      >
                        {rpe}/10 · {activeRpeMeta.label}
                      </span>
                    </div>
                    <div
                      className="xp20-sum-rpe-scale"
                      role="radiogroup"
                      aria-label="Niveau d'effort ressenti de 1 à 10"
                    >
                      {RPE_LEVELS.map((level) => {
                        const selected = rpe === level.value;
                        return (
                          <button
                            key={level.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`Effort ${level.value} sur 10 : ${level.label}`}
                            className={`xp20-sum-rpe-dot xp20-tactile${selected ? ' is-selected' : ''}`}
                            style={
                              selected
                                ? { background: level.color, borderColor: level.color, color: '#FFFFFF' }
                                : undefined
                            }
                            onClick={() => {
                              setRpe(level.value);
                              setDirty(true);
                            }}
                          >
                            {level.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="xp20-sum-field">
                    <label htmlFor="xp20-summary-notes">Notes de terrain</label>
                    <textarea
                      id="xp20-summary-notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Conditions du sentier, météo, sensations…"
                    />
                  </div>

                  {onSaveDetails && (dirty || savedFeedback) ? (
                    <button
                      type="button"
                      className={`xp20-sum-save-btn xp20-tactile${savedFeedback ? ' is-saved' : ''}`}
                      disabled={savingDetails || (!dirty && savedFeedback)}
                      onClick={() => void handleSaveDetails()}
                    >
                      <Check size={14} aria-hidden="true" />
                      <span>
                        {savingDetails
                          ? 'Enregistrement…'
                          : savedFeedback
                            ? 'Modifications enregistrées'
                            : 'Enregistrer les notes'}
                      </span>
                    </button>
                  ) : null}
                </section>

                {/* Clean 1-Row Quick Tools Strip (4 equal icon+label pills, zero overflow) */}
                <div className="xp20-sum-tools-bar" aria-label="Outils trace">
                  <button
                    type="button"
                    className="xp20-sum-tool-chip xp20-tactile"
                    data-testid="xp20-summary-analysis-trigger"
                    onClick={() => setAnalysisOpen(true)}
                  >
                    <BarChart3 size={16} aria-hidden="true" />
                    <span>Analyse</span>
                  </button>
                  <button
                    type="button"
                    className="xp20-sum-tool-chip xp20-tactile"
                    data-testid="xp20-summary-privacy-trigger"
                    onClick={() => setPrivacyOpen(true)}
                  >
                    <Scissors size={16} aria-hidden="true" />
                    <span>Crop</span>
                  </button>
                  <button
                    type="button"
                    className="xp20-sum-tool-chip xp20-tactile"
                    onClick={handleExportGpxClick}
                  >
                    <Download size={16} aria-hidden="true" />
                    <span>GPX</span>
                  </button>
                  <button
                    type="button"
                    className="xp20-sum-tool-chip xp20-tactile"
                    onClick={handleShareClick}
                  >
                    <Share2 size={16} aria-hidden="true" />
                    <span>{shareFeedback ?? 'Partager'}</span>
                  </button>
                </div>

                {/* Clean Callout to Interconnections Tab */}
                <button
                  type="button"
                  className="xp20-sum-bridge-banner xp20-card-press"
                  onClick={() => setActiveTab('connect')}
                >
                  <div className="xp20-sum-bridge-icons" aria-hidden="true">
                    <span style={{ background: '#FEF3C7', color: '#B45309' }}>
                      <BookOpen size={13} />
                    </span>
                    <span style={{ background: '#DCFCE7', color: '#15803D' }}>
                      <Video size={13} />
                    </span>
                    <span style={{ background: '#E0F2FE', color: '#0369A1' }}>
                      <Send size={13} />
                    </span>
                    <span style={{ background: '#F3E8FF', color: '#6D28D9' }}>
                      <Award size={13} />
                    </span>
                  </div>
                  <div className="xp20-sum-bridge-copy">
                    <strong>Connecter au reste de l’app</strong>
                    <span>Carnet, Communauté, Clubs, Voyages, Traceur, Sac…</span>
                  </div>
                  <ChevronRight size={16} className="xp20-sum-row-arrow" aria-hidden="true" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="tab-connect"
                className="xp20-sum-pane"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {/* Group 1: Raconter & Partager */}
                <div className="xp20-sum-group">
                  <span className="xp20-sum-group-label">Raconter &amp; Partager</span>
                  <div className="xp20-sum-list">
                    {onAddToCarnet ? (
                      <button type="button" className="xp20-sum-row" onClick={onAddToCarnet}>
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(217, 119, 6, 0.14)', color: '#B45309' }}>
                          <BookOpen size={16} aria-hidden="true" />
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>Créer un Carnet de voyage</strong>
                          <span>Récit illustré avec vos photos et la trace GPS</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </button>
                    ) : (
                      <Link href={carnetHref} className="xp20-sum-row">
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(217, 119, 6, 0.14)', color: '#B45309' }}>
                          <BookOpen size={16} aria-hidden="true" />
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>Créer un Carnet de voyage</strong>
                          <span>Récit illustré avec vos photos et la trace GPS</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </Link>
                    )}

                    <Link href={communityPostHref} className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(21, 128, 61, 0.14)', color: '#15803D' }}>
                        <Video size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Publier dans la Communauté</strong>
                        <span>Billet prérempli avec stats, lieu et notes</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>

                    <Link href={storyHref} className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(234, 88, 12, 0.13)', color: '#C2410C' }}>
                        <Camera size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Partager en Story</strong>
                        <span>Stickers lieu, distance, altitude &amp; météo</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>

                    <Link href={sortieHref} className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(79, 70, 229, 0.13)', color: '#4338CA' }}>
                        <Users size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Proposer cette Sortie en groupe</strong>
                        <span>Activité, tracé, niveau et sécurité préremplis</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>

                    <Link href={clubCreateHref} className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(99, 102, 241, 0.13)', color: '#3730A3' }}>
                        <Users size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Créer ou rejoindre un Club</strong>
                        <span>Zone, sport et message d’accueil préremplis</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Group 2: Carte, Voyages & Terrain */}
                <div className="xp20-sum-group">
                  <span className="xp20-sum-group-label">Carte, Voyages &amp; Terrain</span>
                  <div className="xp20-sum-list">
                    {onSaveAsRoute ? (
                      <button type="button" className="xp20-sum-row" onClick={handleSaveRouteClick}>
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(23, 64, 44, 0.14)', color: '#17402C' }}>
                          {routeSavedFeedback ? <Check size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>{routeSavedFeedback ? 'Tracé enregistré !' : 'Enregistrer comme itinéraire'}</strong>
                          <span>Sauver dans Mes parcours et ouvrir le traceur</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </button>
                    ) : (
                      <Link href="/itineraire" className="xp20-sum-row">
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(23, 64, 44, 0.14)', color: '#17402C' }}>
                          <Pencil size={16} aria-hidden="true" />
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>Enregistrer comme itinéraire</strong>
                          <span>Ouvrir dans le traceur sur la carte 3D</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </Link>
                    )}

                    <Link href="/hub/itineraire" className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(13, 148, 136, 0.14)', color: '#0F766E' }}>
                        <Compass size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Raccorder à un Voyage</strong>
                        <span>Ajouter cette étape dans votre Compas / Hub</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>

                    {onLaunchBottle ? (
                      <button type="button" className="xp20-sum-row" onClick={onLaunchBottle}>
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(2, 132, 199, 0.14)', color: '#0369A1' }}>
                          <Send size={16} aria-hidden="true" />
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>Déposer une Bouteille à la mer</strong>
                          <span>Laisser un message géolocalisé à cet endroit</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </button>
                    ) : null}

                    {onOpenSafetyReport ? (
                      <button type="button" className="xp20-sum-row" onClick={onOpenSafetyReport}>
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#B91C1C' }}>
                          <AlertTriangle size={16} aria-hidden="true" />
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>Signaler un point terrain</strong>
                          <span>Danger, arbre tombé, eau tarie ou sentier coupé</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Group 3: Équipement, Nature & Progression */}
                <div className="xp20-sum-group">
                  <span className="xp20-sum-group-label">Équipement, Nature &amp; Suivi</span>
                  <div className="xp20-sum-list">
                    <Link href={kitCreateHref} className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(180, 83, 9, 0.13)', color: '#9A3412' }}>
                        <Backpack size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Créer le Kit de cette sortie</strong>
                        <span>Saison, nom et contexte déjà renseignés</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>

                    {onOpenPokedex ? (
                      <button type="button" className="xp20-sum-row" onClick={onOpenPokedex}>
                        <span className="xp20-sum-row-ico" style={{ background: 'rgba(101, 163, 13, 0.15)', color: '#4D7C0F' }}>
                          <Leaf size={16} aria-hidden="true" />
                        </span>
                        <div className="xp20-sum-row-copy">
                          <strong>Pokédex Nature</strong>
                          <span>Consigner la faune et la flore observées</span>
                        </div>
                        <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                      </button>
                    ) : null}

                    <Link href="/progression" className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(124, 58, 237, 0.13)', color: '#6D28D9' }}>
                        <Award size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Progression &amp; Badges</strong>
                        <span>Consulter votre niveau, XP et défis</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>

                    <Link href="/compte/activites" className="xp20-sum-row">
                      <span className="xp20-sum-row-ico" style={{ background: 'rgba(23, 43, 36, 0.1)', color: '#172B24' }}>
                        <Activity size={16} aria-hidden="true" />
                      </span>
                      <div className="xp20-sum-row-copy">
                        <strong>Historique de mes sorties</strong>
                        <span>Toutes vos activités, filtres et statistiques</span>
                      </div>
                      <ChevronRight size={15} className="xp20-sum-row-arrow" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4. Sticky Frosted Footer */}
        <footer className="xp20-sum-footer">
          {confirmDiscard && onDiscard ? (
            <div className="xp20-sum-discard-bar" role="alert">
              <span>Supprimer cette sortie ?</span>
              <div className="xp20-sum-discard-actions">
                <button
                  type="button"
                  className="xp20-sum-discard-cancel"
                  onClick={() => setConfirmDiscard(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="xp20-sum-discard-confirm"
                  onClick={onDiscard}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : null}

          <div className="xp20-sum-footer-row">
            {onDiscard ? (
              <button
                type="button"
                className="xp20-sum-trash-btn xp20-tactile"
                onClick={() => setConfirmDiscard((v) => !v)}
                aria-label="Supprimer cette sortie"
                title="Supprimer cette sortie"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            ) : null}

            {canRetry ? (
              <button
                type="button"
                className="xp20-sum-retry-btn xp20-tactile"
                onClick={onRetrySync}
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Synchro</span>
              </button>
            ) : null}

            <button
              type="button"
              className="xp20-sum-done-btn xp20-tactile"
              onClick={onDone}
            >
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>Terminer</span>
            </button>
          </div>
        </footer>
      </div>

      {analysisOpen ? (
        <Suspense fallback={null}>
          <LazySummaryExpertAnalysisSubDrawer
            open={analysisOpen}
            onOpenChange={setAnalysisOpen}
            profile={activeProfile}
            summary={summary}
            points={resolvedPoints}
            distanceM={summary.distanceM || 0}
            movingS={elapsedS}
            elevGainM={elevGainM}
            rpe={rpe}
            units={units}
            title={title.trim() || defaultTitle}
            notes={notes.trim()}
            waypoints={waypoints ?? []}
            locationLabel={locationLabel}
            centerCoords={centerCoords}
            weather={weather}
            packWeightKg={packWeightKg}
            bodyWeightKg={bodyWeightKg}
            strengthLog={strengthLog}
            userId={userId}
            contrast={contrast}
            glovesMode={glovesMode}
            onProfileCursorChange={onProfileCursorChange}
            onHighlightSegment={onHighlightSegment}
          />
        </Suspense>
      ) : null}

      {privacyOpen ? (
        <Suspense fallback={null}>
          <LazySummaryPrivacyCropSubDrawer
            open={privacyOpen}
            onOpenChange={setPrivacyOpen}
            sessionId={summaryId}
            totalPoints={resolvedPoints.length}
            onExportGpx={handleExportGpxClick}
          />
        </Suspense>
      ) : null}
    </StackSlideView>
  );
}

export default ExplorerSummarySheet;
