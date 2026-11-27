'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BookOpen,
  Camera,
  Check,
  Clock,
  CloudOff,
  Download,
  Gauge,
  MapPin,
  Mountain,
  RefreshCw,
  Route,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatedNumber, StackSlideView } from '@/components/carnet/v2/CarnetDrawerMotion';
import type { SummarySavedState } from '../activity/finishOutcome';
import type { GeoCollection } from '../data/hooks';
import type { ActivityState, Sport } from '../state/types';
import { RouteMiniTraceSvg } from './components/RouteMiniTraceSvg';

export interface ExplorerSummaryPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  t?: number;
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
}

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

const RPE_LEVELS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Facile' },
  { value: 2, label: 'Modéré' },
  { value: 3, label: 'Soutenu' },
  { value: 4, label: 'Difficile' },
  { value: 5, label: 'Max' },
];

function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
}: ExplorerSummarySheetProps) {
  const resolvedSportLabel = sportLabel || summary.selection?.variantLabel || SPORT_FALLBACK_LABELS[summary.sport] || 'Sortie';
  const defaultTitle = useMemo(
    () => buildDefaultTitle(resolvedSportLabel, summary.startedAt, summary.route?.name),
    [resolvedSportLabel, summary.startedAt, summary.route?.name],
  );

  const [title, setTitle] = useState(defaultTitle);
  const [rpe, setRpe] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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

  const avgSpeedLabel = useMemo(() => {
    if (elapsedS < 5 || (summary.distanceM || 0) <= 0) return null;
    const kmh = (summary.distanceM / 1000) / (elapsedS / 3600);
    if (!Number.isFinite(kmh) || kmh <= 0) return null;
    if (units === 'imperial') {
      return `${(kmh * 0.621371).toFixed(1).replace('.', ',')} mph`;
    }
    return `${kmh.toFixed(1).replace('.', ',')} km/h`;
  }, [elapsedS, summary.distanceM, units]);

  const elevationBounds = useMemo(() => {
    if (!points || points.length === 0) return null;
    let minEle = Infinity;
    let maxEle = -Infinity;
    for (const pt of points) {
      if (pt.ele !== null && pt.ele !== undefined && Number.isFinite(pt.ele)) {
        if (pt.ele < minEle) minEle = pt.ele;
        if (pt.ele > maxEle) maxEle = pt.ele;
      }
    }
    if (!Number.isFinite(minEle) || !Number.isFinite(maxEle)) return null;
    return { minM: Math.round(minEle), maxM: Math.round(maxEle) };
  }, [points]);

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
      ? 'Enregistré'
      : summarySaved === 'local'
        ? 'Enregistré localement'
        : summarySaved === 'unauthenticated'
          ? 'Connexion requise'
          : summarySaved === 'failed' || summarySaved === 'conflict'
            ? 'En attente de synchro'
            : 'En attente hors ligne';

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

  const resolvedPhotosCount = photosCount ?? summary.capturedMedia?.length ?? 0;
  const resolvedWaypointsCount = waypoints?.length ?? 0;

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
      window.setTimeout(() => setSavedFeedback(false), 2000);
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
    const slug = (title.trim() || defaultTitle)
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

  const actionTileStyle: React.CSSProperties = {
    height: 42,
    padding: '0 12px',
    borderRadius: 15,
    border: '0.5px solid rgba(23, 64, 44, 0.14)',
    background: 'rgba(255, 255, 255, 0.86)',
    color: '#172B24',
    fontSize: 12.5,
    fontWeight: 700,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.92)',
  };

  return (
    <StackSlideView stackKey={`summary-${summaryId ?? summary.startedAt}`}>
      <div
        data-testid="xp20-summary-sheet"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '4px 12px 10px',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <button
              type="button"
              className="xp20-close-pill"
              onClick={onDone}
              aria-label="Fermer"
            >
              <X size={15} aria-hidden="true" />
            </button>
            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#172B24',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.15,
                }}
              >
                Sortie terminée
              </strong>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#56665D' }}>
                {resolvedSportLabel}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            {xpEarned !== null && xpEarned > 0 ? (
              <span
                style={{
                  height: 24,
                  padding: '0 8px',
                  borderRadius: 999,
                  background: 'rgba(185, 138, 46, 0.16)',
                  color: '#7C5610',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Sparkles size={11} aria-hidden="true" />+{Math.round(xpEarned)} XP
              </span>
            ) : null}

            <span
              style={{
                height: 24,
                padding: '0 9px',
                borderRadius: 999,
                background: isSynced
                  ? 'rgba(150, 186, 142, 0.28)'
                  : 'rgba(185, 138, 46, 0.16)',
                color: isSynced ? '#17402C' : '#7C5610',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isSynced ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <CloudOff size={12} aria-hidden="true" />
              )}
              <span>{syncLabel}</span>
            </span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 12px calc(36px + var(--safe-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 11,
          }}
        >
          {/* 3 Hero KPIs */}
          <div className="xp20-kpi-row">
            <div className="xp20-kpi-pill">
              <Route size={14} color="#17402C" aria-hidden="true" />
              <strong style={{ fontSize: 17, fontWeight: 800, color: '#172B24' }}>
                <AnimatedNumber
                  value={distanceMetric.value}
                  suffix={distanceMetric.suffix}
                  maximumFractionDigits={distanceMetric.decimals}
                />
              </strong>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#56665D' }}>Distance</span>
            </div>

            <div className="xp20-kpi-pill">
              <Clock size={14} color="#17402C" aria-hidden="true" />
              <strong style={{ fontSize: 17, fontWeight: 800, color: '#172B24' }}>
                {formatDurationClock(elapsedS)}
              </strong>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#56665D' }}>Durée</span>
            </div>

            <div className="xp20-kpi-pill">
              <TrendingUp size={14} color="#17402C" aria-hidden="true" />
              <strong style={{ fontSize: 17, fontWeight: 800, color: '#172B24' }}>
                <AnimatedNumber value={elevGainM} prefix="+" suffix=" m" />
              </strong>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#56665D' }}>D+</span>
            </div>
          </div>

          {/* Recorded track SVG preview + secondary elevation / waypoints / photos chips */}
          <div
            className="club-glass-card"
            style={{
              padding: 8,
              borderRadius: 20,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                width: '100%',
                height: 128,
                borderRadius: 14,
                background: '#EFF4EE',
                overflow: 'hidden',
              }}
            >
              <RouteMiniTraceSvg geojson={trackGeo} width={320} height={128} />
            </div>

            {avgSpeedLabel || elevationBounds || resolvedWaypointsCount > 0 || resolvedPhotosCount > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 2px 2px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#394D43',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {avgSpeedLabel ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.07)',
                    }}
                  >
                    <Gauge size={11} aria-hidden="true" />
                    {avgSpeedLabel}
                  </span>
                ) : null}
                {elevationBounds ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(23, 64, 44, 0.07)',
                    }}
                  >
                    <Mountain size={11} aria-hidden="true" />
                    {elevationBounds.minM}–{elevationBounds.maxM} m
                  </span>
                ) : null}
                {resolvedWaypointsCount > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(150, 186, 142, 0.24)',
                      color: '#17402C',
                    }}
                  >
                    <MapPin size={11} aria-hidden="true" />
                    {resolvedWaypointsCount} repère{resolvedWaypointsCount > 1 ? 's' : ''}
                  </span>
                ) : null}
                {resolvedPhotosCount > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(150, 186, 142, 0.24)',
                      color: '#17402C',
                    }}
                  >
                    <Camera size={11} aria-hidden="true" />
                    {resolvedPhotosCount} photo{resolvedPhotosCount > 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Editable Outing Details (Title + RPE Effort + Notes) */}
          <div
            className="club-glass-card"
            style={{
              borderRadius: 20,
              padding: '11px 12px',
              background: 'rgba(255, 255, 255, 0.82)',
              border: '0.5px solid rgba(23, 64, 44, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div>
              <label
                htmlFor="xp20-summary-title"
                style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#56665D', marginBottom: 4 }}
              >
                Titre de la sortie
              </label>
              <input
                id="xp20-summary-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                placeholder={defaultTitle}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 11px',
                  borderRadius: 12,
                  border: '0.5px solid rgba(23, 64, 44, 0.18)',
                  background: '#FFFFFF',
                  color: '#172B24',
                  fontSize: 13.5,
                  fontWeight: 700,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 5-level RPE Effort Selector */}
            <div>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#56665D', marginBottom: 5 }}>
                Ressenti d’effort (RPE)
              </span>
              <div
                role="radiogroup"
                aria-label="Niveau d'effort ressenti"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: 5,
                }}
              >
                {RPE_LEVELS.map((level) => {
                  const selected = rpe === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setRpe(level.value);
                        setDirty(true);
                      }}
                      style={{
                        height: 32,
                        borderRadius: 10,
                        border: selected
                          ? '1px solid #17402C'
                          : '0.5px solid rgba(23, 64, 44, 0.14)',
                        background: selected ? '#17402C' : 'rgba(255, 255, 255, 0.9)',
                        color: selected ? '#FBFAF6' : '#172B24',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '0 4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Short Notes */}
            <div>
              <label
                htmlFor="xp20-summary-notes"
                style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#56665D', marginBottom: 4 }}
              >
                Notes de terrain
              </label>
              <textarea
                id="xp20-summary-notes"
                rows={2}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setDirty(true);
                }}
                placeholder="Conditions du sentier, météo, sensations…"
                style={{
                  width: '100%',
                  padding: '8px 11px',
                  borderRadius: 12,
                  border: '0.5px solid rgba(23, 64, 44, 0.18)',
                  background: '#FFFFFF',
                  color: '#172B24',
                  fontSize: 12.5,
                  fontWeight: 500,
                  resize: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {onSaveDetails && (dirty || savedFeedback) ? (
              <button
                type="button"
                disabled={savingDetails || (!dirty && savedFeedback)}
                onClick={() => void handleSaveDetails()}
                style={{
                  height: 36,
                  borderRadius: 999,
                  border: 0,
                  background: savedFeedback ? 'rgba(46, 125, 79, 0.16)' : '#17402C',
                  color: savedFeedback ? '#17402C' : '#FBFAF6',
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: savingDetails ? 'default' : 'pointer',
                }}
              >
                <Check size={14} aria-hidden="true" />
                <span>
                  {savingDetails
                    ? 'Enregistrement…'
                    : savedFeedback
                      ? 'Détails enregistrés'
                      : 'Enregistrer les détails'}
                </span>
              </button>
            ) : null}
          </div>

          {/* 2x2 Action Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <button type="button" onClick={handleExportGpxClick} style={actionTileStyle}>
              <Download size={14} color="#17402C" aria-hidden="true" />
              <span>Exporter GPX</span>
            </button>

            {onAddToCarnet ? (
              <button type="button" onClick={onAddToCarnet} style={actionTileStyle}>
                <BookOpen size={14} color="#17402C" aria-hidden="true" />
                <span>Ajouter à un Carnet</span>
              </button>
            ) : (
              <Link href="/carnets" style={actionTileStyle}>
                <BookOpen size={14} color="#17402C" aria-hidden="true" />
                <span>Ajouter à un Carnet</span>
              </Link>
            )}

            <Link href="/compte/activites" style={actionTileStyle}>
              <Activity size={14} color="#17402C" aria-hidden="true" />
              <span>Mes sorties</span>
            </Link>

            <button type="button" onClick={handleShareClick} style={actionTileStyle}>
              <Share2 size={14} color="#17402C" aria-hidden="true" />
              <span>{shareFeedback ?? 'Partager'}</span>
            </button>
          </div>

          {/* Primary Footer Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {canRetry ? (
                <button
                  type="button"
                  onClick={onRetrySync}
                  style={{
                    flex: '0 0 auto',
                    height: 46,
                    padding: '0 16px',
                    borderRadius: 999,
                    border: '0.5px solid rgba(23, 64, 44, 0.2)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#17402C',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>Réessayer</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={onDone}
                style={{
                  flex: '1 1 auto',
                  height: 46,
                  borderRadius: 999,
                  border: 0,
                  background: 'linear-gradient(180deg, #1f543a, #17402c)',
                  color: '#FBFAF6',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(23, 64, 44, 0.22)',
                }}
              >
                Terminer
              </button>
            </div>

            {/* Subtle 2-tap inline discard button */}
            {onDiscard ? (
              confirmDiscard ? (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 14,
                    background: 'rgba(185, 28, 28, 0.08)',
                    border: '0.5px solid rgba(185, 28, 28, 0.25)',
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#991B1B' }}>
                    Supprimer cette sortie ?
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setConfirmDiscard(false)}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 999,
                        border: '0.5px solid rgba(23, 64, 44, 0.2)',
                        background: '#FFFFFF',
                        color: '#172B24',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={onDiscard}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 999,
                        border: 0,
                        background: '#991B1B',
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(true)}
                  style={{
                    height: 32,
                    border: 0,
                    background: 'transparent',
                    color: '#7C4242',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Ignorer / Supprimer</span>
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </StackSlideView>
  );
}

export default ExplorerSummarySheet;
