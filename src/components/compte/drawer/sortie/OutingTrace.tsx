'use client';

import React, { useMemo, useState } from 'react';
import { Award, Compass, Download, Flag, Flame, Gauge, MapPin, Palette, Play, Plus, Users, Wind, Zap } from 'lucide-react';
import { OutingTraceToolsPanel } from './OutingLifecyclePanels';
import { ActionPill } from '@/components/ui/ActionPill';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import {
  SegmentCreateEditForm,
  SegmentsDrawerPanel,
  type SegmentFormSubmission,
} from '@/components/segments';
import type { ActivityTraceForSegments, SegmentDefinition, SegmentEffort, SegmentSport } from '@/features/segments';
import type { MediaSharingTab } from '@/components/media-sharing/MediaSharingHub';
import type { OutingDetail, OutingPoint } from '@/features/compte/server/sorties';
import { analyzeSessionWeather } from '@/features/routes/analysis/sessionWeather';
import {
  analyzeOutingTelemetry,
  readLocalZoneSets,
  readOutingRpe,
  type AlignedTelemetryPoint,
} from '@/features/explorer-v2/metrics/telemetryAnalysis';
import type { ZoneTimeResult } from '@/features/explorer-v2/metrics/activityMetrics';
import {
  ElevationProfile,
  TraceMap,
  type TraceColorMode,
  formatDuration,
  formatNumber,
  hasVisibleTrace,
  metricDisplay,
  outingMetricVisible,
  traceUnavailableState,
  visibleTracePoints,
  visibleTraceSegments,
  weatherIcon,
} from './shared';
import {
  PowerCurveCard,
  SynchronizedTraceCurves,
  formatPaceMinPerKm,
} from './SynchronizedTraceCurves';
import {
  findComparableOutings,
  formatDurationDelta,
} from '@/features/compte/progression/comparableOutings';
import { resolveTimeZone } from '@/features/compte/progression/engine';
import { readProgressionSessionsSnapshot } from '../progression/ProgressionAdvancedSections';

export interface OutingTraceProps {
  detail: OutingDetail;
  onExport: (format?: 'gpx' | 'tcx') => void;
  onOpenMediaHub?: (tab: MediaSharingTab) => void;
  onUpdated?: () => void;
}

function altitudeRange(points: OutingPoint[]) {
  const values = points
    .map((point) => point.elevationM)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function ZoneBreakdownSection({
  title,
  testId,
  zoneResult,
}: {
  title: string;
  testId: string;
  zoneResult: ZoneTimeResult;
}) {
  if (zoneResult.status !== 'available' || zoneResult.zones.length === 0) return null;
  return (
    <section className="lkdv-sortie-section" data-testid={testId}>
      <header>
        <b>{title}</b>
        <span>
          {formatDuration(Math.round(zoneResult.window.sampledS))} analysées
        </span>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {zoneResult.zones.map((band) => {
          const secs = Math.round(band.seconds);
          const pct = Math.round(band.shareOfInZone * 100);
          return (
            <div key={band.zoneId} style={{ display: 'grid', gridTemplateColumns: '115px 1fr 68px', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {band.label}
              </span>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: '#17402C',
                  }}
                />
              </div>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(secs)} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
      {zoneResult.window.uncoveredS > 10 ? (
        <p className="lkdv-sortie-proof" style={{ marginTop: 6 }}>
          {formatDuration(Math.round(zoneResult.window.uncoveredS))} hors capteur ou coupure non interpolée.
        </p>
      ) : null}
    </section>
  );
}

function WeatherBlock({ detail }: { detail: OutingDetail }) {
  const weather = detail.weather;
  const firstDay = weather?.days?.[0];
  const snapshot = firstDay
    ? {
        tempC: firstDay.tMax ?? firstDay.tMin ?? null,
        condition: firstDay.label,
        windKmH: firstDay.windKmh ?? null,
        precipitationProbability: null,
        fetchedAt: weather?.fetchedAt ?? null,
        source: weather?.source ?? 'open-meteo',
        isAlert: (weather?.alerts?.length ?? 0) > 0,
        alertMessage: weather?.alerts?.[0] ?? null,
      }
    : null;
  const sessionWx = analyzeSessionWeather({
    session: {
      id: detail.id,
      startedAt: detail.startedAt ?? detail.date ?? new Date().toISOString(),
      endedAt: detail.endedAt,
      lat: weather?.latitude ?? null,
      lon: weather?.longitude ?? null,
      weather: snapshot,
    },
  });
  if (!weather || weather.days.length === 0) {
    return (
      <section className="lkdv-sortie-section">
        <header>
          <b>Météo de la sortie</b>
          <span>{sessionWx.label}</span>
        </header>
        {sessionWx.missing[0] ? (
          <p className="lkdv-sortie-notes">{sessionWx.missing[0].message}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="lkdv-sortie-section">
      <header>
        <b>Météo de la sortie · {sessionWx.label}</b>
        <span>Open-Meteo · {new Date(weather.fetchedAt).toLocaleDateString('fr-FR')}</span>
      </header>
      <div className="lkdv-sortie-weather">
        {weather.days.slice(0, 3).map((day) => (
          <div key={day.date} className="lkdv-sortie-weather-day">
            <span className="lkdv-sortie-weather-date">
              {new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="lkdv-sortie-weather-ico">{weatherIcon(day.icon, 20)}</span>
            <b>
              {day.tMax !== null ? `${Math.round(day.tMax)}°` : '—'}
              {day.tMin !== null ? <small>{Math.round(day.tMin)}°</small> : null}
            </b>
            <span className="lkdv-sortie-weather-label">{day.label}</span>
            <span className="lkdv-sortie-weather-meta">
              {day.precipMm !== null ? `${day.precipMm.toFixed(1)} mm` : '—'}
              {day.windKmh !== null ? ` · ${Math.round(day.windKmh)} km/h` : ''}
            </span>
          </div>
        ))}
      </div>
      {weather.alerts.length > 0 ? (
        <ul className="lkdv-sortie-alerts">
          {weather.alerts.map((alert) => (
            <li key={alert}>
              <Wind size={13} aria-hidden="true" /> {alert}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function mapOutingSport(rawSport: string | null): SegmentSport {
  const s = (rawSport ?? '').toLowerCase();
  if (s === 'velo' || s === 'cycling' || s === 'route') return 'cycling';
  if (s === 'gravel') return 'gravel';
  if (s === 'vtt' || s === 'mtb') return 'mtb';
  if (s === 'trail') return 'trail';
  if (s === 'course' || s === 'running' || s === 'run') return 'running';
  if (s === 'ski' || s === 'ski_rando') return 'ski';
  if (s === 'marche' || s === 'walking') return 'walking';
  return 'hiking';
}

export function OutingTrace({ detail, onExport, onOpenMediaHub, onUpdated }: OutingTraceProps) {
  const [colorMode, setColorMode] = useState<TraceColorMode>('default');
  const [detectedEfforts, setDetectedEfforts] = useState<SegmentEffort[] | null>(null);
  const [detectBusy, setDetectBusy] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  const segments = visibleTraceSegments(detail);
  const points = visibleTracePoints(detail);
  const canElevation = outingMetricVisible(detail, 'elevation');
  const canPace = outingMetricVisible(detail, 'pace');
  const altitude = canElevation ? altitudeRange(points) : null;
  const ownerUserId = detail.participants.find((p) => p.isOwner)?.userId ?? '';
  const activityForSegments = useMemo<ActivityTraceForSegments | null>(() => {
    if (!detail.canEdit || !ownerUserId || points.length < 3) return null;
    const baseMs = detail.startedAt ? Date.parse(detail.startedAt) : Date.now() - points.length * 5000;
    const startMs = Number.isFinite(baseMs) ? baseMs : Date.now() - points.length * 5000;
    return {
      activityId: detail.id,
      activityVersion: 1,
      userId: ownerUserId,
      sport: mapOutingSport(detail.sport),
      visibility: detail.visibility === 'public' ? 'public' : detail.visibility === 'followers' ? 'followers' : 'private',
      points: points.map((pt, idx) => ({
        lat: pt.lat,
        lng: pt.lng,
        ele: pt.elevationM,
        timestamp: pt.timestamp ?? new Date(startMs + idx * 5000).toISOString(),
      })),
    };
  }, [detail.canEdit, detail.id, detail.sport, detail.startedAt, detail.visibility, ownerUserId, points]);

  const detectSegments = async () => {
    if (!activityForSegments || detectBusy) return;
    setDetectBusy(true);
    setDetectError(null);
    try {
      const res = await fetch('/api/segments/detect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ activity: activityForSegments }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Détection des segments impossible.');
      }
      const data = (await res.json()) as { allDetected?: SegmentEffort[] };
      setDetectedEfforts(data.allDetected ?? []);
    } catch (caught) {
      setDetectError(caught instanceof Error ? caught.message : 'Erreur de détection.');
    } finally {
      setDetectBusy(false);
    }
  };

  const handleCreateSegment = async (submission: SegmentFormSubmission) => {
    const act = submission.activity ?? activityForSegments;
    if (!act || createBusy) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: submission.name,
          activity: act,
          startPointIndex: submission.startPointIndex ?? 0,
          endPointIndex: submission.endPointIndex ?? Math.max(0, act.points.length - 1),
          visibility: submission.visibility,
          sport: submission.sport,
          surface: submission.surface,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Création du segment impossible.');
      }
      const data = (await res.json()) as { segment: SegmentDefinition; mergedInto?: string | null };
      setCreateOpen(false);
      setCreatedNotice(
        data.mergedInto
          ? `Segment fusionné avec ${data.segment.name}`
          : `Segment « ${data.segment.name} » créé`
      );
      setSelectedSegmentId(data.segment.id);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : 'Création impossible.');
    } finally {
      setCreateBusy(false);
    }
  };
  const [splitUnit, setSplitUnit] = useState<'km' | 'mi'>('km');
  const [cursorPoint, setCursorPoint] = useState<AlignedTelemetryPoint | null>(null);
  const slope =
    outingMetricVisible(detail, 'elevationGain') &&
    outingMetricVisible(detail, 'distance') &&
    typeof detail.km === 'number' &&
    Number.isFinite(detail.km) &&
    typeof detail.dplus === 'number' &&
    Number.isFinite(detail.dplus) &&
    detail.km > 0
      ? (detail.dplus / (detail.km * 1000)) * 100
      : null;

  const telemetry = useMemo(() => {
    const zoneSets = readLocalZoneSets(detail.sport ?? undefined);
    const savedRpe = readOutingRpe(detail.id);
    return analyzeOutingTelemetry({
      outingId: detail.id,
      sport: detail.sport,
      segments,
      samples: detail.samples ?? null,
      summary: detail.summary ?? null,
      durationS: detail.durationS,
      movingTimeS: detail.movingTimeS,
      measuredHrBpm: outingMetricVisible(detail, 'heartRate') ? detail.heartRateBpm : null,
      measuredCaloriesKcal: outingMetricVisible(detail, 'calories') ? detail.caloriesKcal : null,
      zoneSets,
      rpe: savedRpe,
    });
  }, [detail, segments]);

  /* Jamais de recalcul client de l'allure publiable : on respecte les visibilités. */
  const effortRows: Array<{ label: string; value: string }> = [];
  if (outingMetricVisible(detail, 'heartRate') && typeof detail.heartRateBpm === 'number' && Number.isFinite(detail.heartRateBpm)) {
    effortRows.push({ label: 'FC moyenne', value: `${formatNumber(detail.heartRateBpm)} bpm` });
  }
  if (outingMetricVisible(detail, 'power') && telemetry.powerAnalysis.status === 'available' && telemetry.powerAnalysis.averageW !== null) {
    effortRows.push({
      label: telemetry.powerAnalysis.quality === 'measured' ? 'Puissance mesurée' : 'Puissance estimée',
      value: `${formatNumber(telemetry.powerAnalysis.averageW)} W`,
    });
  } else if (outingMetricVisible(detail, 'power') && typeof detail.powerW === 'number' && Number.isFinite(detail.powerW)) {
    effortRows.push({ label: 'Puissance', value: `${formatNumber(detail.powerW)} W` });
  }
  if (outingMetricVisible(detail, 'cadence') && typeof detail.cadenceRpm === 'number' && Number.isFinite(detail.cadenceRpm)) {
    effortRows.push({ label: 'Cadence', value: `${formatNumber(detail.cadenceRpm)} rpm` });
  }
  if (outingMetricVisible(detail, 'calories') && telemetry.energyAndSteps.caloriesKcal !== null) {
    effortRows.push({
      label: telemetry.energyAndSteps.caloriesQuality === 'measured' ? 'Calories mesurées' : 'Calories estimées',
      value: `${formatNumber(telemetry.energyAndSteps.caloriesKcal)} kcal`,
    });
  }

  const visibleTrace = hasVisibleTrace(detail);
  const comparableOutings = useMemo(
    () =>
      visibleTrace
        ? findComparableOutings(detail, readProgressionSessionsSnapshot(), resolveTimeZone().timeZone)
        : [],
    [detail, visibleTrace],
  );

  if (!visibleTrace) {
    const state = traceUnavailableState(detail);
    return (
      <div className="lkdv-sortie-pane">
        <div className="lkdv-sortie-state">
          <span aria-hidden="true">
            <MapPin size={22} />
          </span>
          <b>{state.title}</b>
          <p>{state.body}</p>
        </div>
        <WeatherBlock detail={detail} />
      </div>
    );
  }

  const splits = splitUnit === 'km' ? telemetry.kmSplits : telemetry.miSplits;

  return (
    <div className="lkdv-sortie-pane">
      <section className="lkdv-sortie-section">
        <header>
          <b>Trace enregistrée</b>
          <span>{points.length} points</span>
        </header>
        <div className="lkdv-sortie-map-wrap">
          <TraceMap
            segments={segments}
            colorMode={colorMode}
            activeCoord={cursorPoint ? { lat: cursorPoint.lat, lng: cursorPoint.lng } : null}
          />
          <div className="lkdv-sortie-map-legend" aria-hidden="true">
            <span><i className="start" /> Départ</span>
            <span><i className="end" /> Arrivée</span>
          </div>
        </div>
        <div
          className="lkdv-apill-row"
          role="radiogroup"
          aria-label="Coloration du tracé (S3.15)"
          style={{ marginTop: 8, flexWrap: 'wrap' }}
        >
          {(
            [
              { id: 'default', label: 'Tracé', allowed: true },
              { id: 'slope', label: 'Pente', allowed: canElevation },
              { id: 'pace', label: 'Vitesse / Allure', allowed: canPace },
              { id: 'elevation', label: 'Altitude', allowed: canElevation },
            ] as const
          ).map((mode) => (
            <ActionPill
              key={mode.id}
              tone={colorMode === mode.id ? 'primary' : 'glass'}
              label={mode.allowed ? mode.label : `${mode.label} (masqué)`}
              icon={<Palette size={13} aria-hidden="true" />}
              text={mode.allowed ? mode.label : `${mode.label} · masqué`}
              disabled={!mode.allowed}
              onClick={() => {
                if (mode.allowed) setColorMode(mode.id);
              }}
            />
          ))}
        </div>
      </section>

      <SynchronizedTraceCurves bundle={telemetry} onCursorPoint={setCursorPoint} />

      <div className="lkdv-sortie-grid">
        <div>
          <small>Altitude min.</small>
          <b>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Masqué'
              : altitude
                ? `${formatNumber(altitude.min)} m`
                : '—'}
          </b>
        </div>
        <div>
          <small>Altitude max.</small>
          <b>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Masqué'
              : altitude
                ? `${formatNumber(altitude.max)} m`
                : '—'}
          </b>
        </div>
        <div>
          <small>Pente moyenne</small>
          <b>
            {!outingMetricVisible(detail, 'elevationGain') ||
            !outingMetricVisible(detail, 'distance')
              ? 'Masqué'
              : slope !== null
                ? `${formatNumber(slope)} %`
                : '—'}
          </b>
        </div>
        <div>
          <small>Temps en mouvement</small>
          <b>
            {metricDisplay(detail, 'movingTime', detail.movingTimeS, (value) =>
              formatDuration(value)
            )}
          </b>
        </div>
        <div>
          <small>Durée totale (écoulée)</small>
          <b>
            {metricDisplay(detail, 'duration', detail.elapsedS ?? detail.durationS, (value) =>
              formatDuration(value)
            )}
          </b>
        </div>
        <div>
          <small>Allure moyenne</small>
          <b>
            {metricDisplay(detail, 'pace', detail.paceMinPerKm, (value) =>
              `${formatNumber(value)} min/km`
            )}
          </b>
        </div>
      </div>

      {effortRows.length > 0 ? (
        <div className="lkdv-sortie-grid">
          {effortRows.map((row) => (
            <div key={row.label}>
              <small>{row.label}</small>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
      ) : null}

      {telemetry.gap && telemetry.gap.status === 'available' && outingMetricVisible(detail, 'pace') ? (
        <section className="lkdv-sortie-section" data-testid="outing-gap-section">
          <header>
            <b>Allure ajustée à la pente (GAP)</b>
            <span>Estimée · {telemetry.gap.method}</span>
          </header>
          <div className="lkdv-sortie-grid">
            <div>
              <small>GAP équivalente plat</small>
              <b>{formatPaceMinPerKm(telemetry.gap.gapPaceSecondsPerKm / 60)}</b>
            </div>
            <div>
              <small>Allure brute</small>
              <b>{formatPaceMinPerKm(telemetry.gap.rawPaceSecondsPerKm / 60)}</b>
            </div>
            <div>
              <small>Facteur pente</small>
              <b>×{telemetry.gap.gradeFactor.toFixed(2)}</b>
            </div>
          </div>
          <p className="lkdv-sortie-proof">
            Coût énergétique Minetti (2002) estimé sur {telemetry.gap.segments.length} segments lissés. Aucune équivalence propriétaire revendiquée.
          </p>
        </section>
      ) : null}

      {splits.length > 0 && outingMetricVisible(detail, 'pace') ? (
        <section className="lkdv-sortie-section" data-testid="outing-splits-section">
          <header>
            <b>Découpage (splits)</b>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                aria-pressed={splitUnit === 'km'}
                onClick={() => setSplitUnit('km')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  border: '1px solid rgba(15,23,42,0.16)',
                  background: splitUnit === 'km' ? '#17402C' : 'transparent',
                  color: splitUnit === 'km' ? '#fff' : 'inherit',
                  cursor: 'pointer',
                }}
              >
                km
              </button>
              <button
                type="button"
                aria-pressed={splitUnit === 'mi'}
                onClick={() => setSplitUnit('mi')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  border: '1px solid rgba(15,23,42,0.16)',
                  background: splitUnit === 'mi' ? '#17402C' : 'transparent',
                  color: splitUnit === 'mi' ? '#fff' : 'inherit',
                  cursor: 'pointer',
                }}
              >
                mi
              </button>
            </div>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {splits.map((sp) => (
              <div
                key={`${sp.unit}-${sp.index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 70px 58px',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: 12,
                  padding: '4px 6px',
                  borderRadius: 8,
                  background: sp.isFastest ? 'rgba(22, 163, 74, 0.12)' : 'transparent',
                }}
              >
                <b>
                  {sp.unit} {sp.index}
                  {sp.isFastest ? (
                    <Award size={12} aria-label="Meilleur split" style={{ marginLeft: 4, color: '#15803D', verticalAlign: '-2px' }} />
                  ) : null}
                </b>
                <span>
                  {sp.paceMinPerKm !== null ? formatPaceMinPerKm(sp.paceMinPerKm) : '—'}
                  {sp.isFastest ? ' · Plus rapide' : ''}
                </span>
                <span style={{ opacity: 0.78 }}>
                  {sp.elevationGainM !== null ? `+${sp.elevationGainM}m` : '—'}
                </span>
                <span style={{ textAlign: 'right', opacity: 0.78 }}>
                  {sp.averageHrBpm !== null ? `${sp.averageHrBpm} bpm` : formatDuration(sp.durationS)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {telemetry.intervals.length > 0 ? (
        <section className="lkdv-sortie-section" data-testid="outing-intervals-section">
          <header>
            <b>Intervalles détectés</b>
            <span>{telemetry.intervals.length} phases</span>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            {telemetry.intervals.map((iv) => (
              <div key={iv.index} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>
                  <b>{iv.kind === 'effort' ? 'Effort' : 'Récup.'} #{iv.index}</b> ({iv.startKm.toFixed(2)}–{iv.endKm.toFixed(2)} km)
                </span>
                <span>
                  {formatDuration(iv.durationS)}
                  {iv.averagePaceMinPerKm ? ` · ${formatPaceMinPerKm(iv.averagePaceMinPerKm)}` : ''}
                  {iv.averagePowerW ? ` · ${iv.averagePowerW} W` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {telemetry.powerAnalysis.status === 'available' && outingMetricVisible(detail, 'power') ? (
        <section className="lkdv-sortie-section" data-testid="outing-cycling-power">
          <header>
            <b>
              <Zap size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Puissance vélo ({telemetry.powerAnalysis.quality === 'measured' ? 'mesurée' : 'estimée'})
            </b>
            <span>{telemetry.powerAnalysis.method}</span>
          </header>
          <div className="lkdv-sortie-grid">
            <div>
              <small>Moyenne</small>
              <b>{telemetry.powerAnalysis.averageW !== null ? `${telemetry.powerAnalysis.averageW} W` : '—'}</b>
            </div>
            <div>
              <small>Pic</small>
              <b>{telemetry.powerAnalysis.maxW !== null ? `${telemetry.powerAnalysis.maxW} W` : '—'}</b>
            </div>
            <div>
              <small>Normalisée (NP)</small>
              <b>{telemetry.powerAnalysis.normalizedW !== null ? `${telemetry.powerAnalysis.normalizedW} W` : '—'}</b>
            </div>
          </div>
        </section>
      ) : null}

      {outingMetricVisible(detail, 'power') &&
      (telemetry.powerAnalysis.curve.status === 'available' || detail.sport === 'velo') ? (
        <PowerCurveCard
          powerCurve={telemetry.powerAnalysis.curve}
          estimatedFtp={telemetry.powerAnalysis.estimatedFtp}
        />
      ) : null}

      {telemetry.hrZones && outingMetricVisible(detail, 'heartRate') ? (
        <ZoneBreakdownSection
          title="Zones cardiaques"
          testId="outing-hr-zones"
          zoneResult={telemetry.hrZones}
        />
      ) : null}

      {telemetry.paceZones && outingMetricVisible(detail, 'pace') ? (
        <ZoneBreakdownSection
          title="Zones d’allure"
          testId="outing-pace-zones"
          zoneResult={telemetry.paceZones}
        />
      ) : null}

      {telemetry.powerZones && outingMetricVisible(detail, 'power') ? (
        <ZoneBreakdownSection
          title="Zones de puissance"
          testId="outing-power-zones"
          zoneResult={telemetry.powerZones}
        />
      ) : null}

      {telemetry.sensorChannels.length > 0 || telemetry.energyAndSteps.steps !== null ? (
        <section className="lkdv-sortie-section" data-testid="outing-sensors-energy">
          <header>
            <b>
              <Gauge size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Capteurs &amp; dépense énergétique
            </b>
            <span>Couverture réelle</span>
          </header>
          {telemetry.sensorChannels.length > 0 ? (
            <div className="lkdv-sortie-grid">
              {telemetry.sensorChannels.map((ch) => (
                <div key={ch.key}>
                  <small>{ch.label} ({ch.qualityLabel} · {ch.coveragePct}%)</small>
                  <b>moy {ch.avg} {ch.unit} · max {ch.max}</b>
                </div>
              ))}
            </div>
          ) : null}
          <p className="lkdv-sortie-proof" style={{ marginTop: 6 }}>
            <Flame size={12} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
            {telemetry.energyAndSteps.caloriesKcal !== null
              ? `${telemetry.energyAndSteps.caloriesKcal} kcal (${telemetry.energyAndSteps.caloriesNote}) `
              : `${telemetry.energyAndSteps.caloriesNote} `}
            {telemetry.energyAndSteps.steps !== null
              ? `· ${formatNumber(telemetry.energyAndSteps.steps)} pas (${telemetry.energyAndSteps.stepsNote})`
              : `· ${telemetry.energyAndSteps.stepsNote}`}
          </p>
        </section>
      ) : null}

      <section className="lkdv-sortie-section">
        <header>
          <b>Relief</b>
          <span>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Non partagé'
              : altitude
                ? `de ${Math.round(altitude.min)} à ${Math.round(altitude.max)} m`
                : '—'}
          </span>
        </header>
        {outingMetricVisible(detail, 'elevation') ? (
          <ElevationProfile segments={segments} />
        ) : (
          <div className="lkdv-sortie-trace-empty">Profil altimétrique non partagé</div>
        )}
      </section>

      <WeatherBlock detail={detail} />

      <OutingTraceToolsPanel
        outingId={detail.id}
        canEdit={detail.canEdit}
        onUpdated={onUpdated ?? (() => undefined)}
      />

      {activityForSegments ? (
        <section className="lkdv-sortie-section">
          <header>
            <b>Segments sur cette trace</b>
            <span>
              {detectedEfforts ? `${detectedEfforts.length} passage(s)` : 'S01 / S02'}
            </span>
          </header>
          <div className="lkdv-apill-row">
            <ActionPill
              label="Détecter les segments"
              icon={<Flag />}
              text={detectBusy ? 'Analyse…' : 'Détecter'}
              onClick={() => void detectSegments()}
              disabled={detectBusy}
            />
            <ActionPill
              label="Créer un segment depuis cette trace"
              icon={<Plus />}
              text="Créer un segment"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            />
          </div>
          {detectError ? (
            <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--lkv-danger)' }}>
              {detectError}
            </p>
          ) : null}
          {createdNotice ? (
            <p role="status" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--forest)' }}>
              {createdNotice}
            </p>
          ) : null}
          {detectedEfforts && detectedEfforts.length === 0 ? (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--label2)' }}>
              Aucun segment existant croisé sur cette trace. Tu peux en créer un ci-dessus.
            </p>
          ) : null}
          {detectedEfforts && detectedEfforts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {detectedEfforts.map((eff) => (
                <button
                  key={eff.effortId}
                  type="button"
                  onClick={() => setSelectedSegmentId(eff.segmentId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 12,
                    border: '0.5px solid rgba(23,43,36,.12)',
                    background: 'rgba(255,255,255,.72)',
                    textAlign: 'left',
                    fontSize: 12,
                  }}
                >
                  <span>
                    <strong>{eff.segmentId}</strong> · {Math.round(eff.elapsedDurationS)} s · {eff.avgSpeedKmh.toFixed(1)} km/h
                  </span>
                  <span style={{ fontSize: 11, color: eff.status === 'valid' ? 'var(--forest)' : 'var(--label2)' }}>
                    {eff.status === 'valid' ? 'Validé' : eff.status}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="lkdv-apill-row" style={{ flexWrap: 'wrap' }}>
        <ActionPill
          tone="primary"
          label="Télécharger le GPX"
          icon={<Download />}
          text="GPX"
          onClick={() => onExport('gpx')}
        />
        <ActionPill
          label="Télécharger le TCX"
          icon={<Download />}
          text="TCX"
          onClick={() => onExport('tcx')}
        />
        {onOpenMediaHub ? (
          <>
            <ActionPill
              label="Lancer Flyover 3D (K5.12 / S3.20)"
              icon={<Compass />}
              text="Flyover 3D"
              onClick={() => onOpenMediaHub('flyover')}
            />
            <ActionPill
              label="Replay de la sortie (S3.21)"
              icon={<Play />}
              text="Replay"
              onClick={() => onOpenMediaHub('replay')}
            />
            <ActionPill
              label="Flyby croisés (S3.22)"
              icon={<Users />}
              text="Flyby"
              onClick={() => onOpenMediaHub('flyby')}
            />
          </>
        ) : null}
      </div>

      {comparableOutings.length > 0 ? (
        <section className="lkdv-sortie-section" data-testid="outing-comparable-section">
          <header>
            <b>Sorties comparables sur cet itinéraire</b>
            <span>{comparableOutings.length} repérée{comparableOutings.length > 1 ? 's' : ''}</span>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {comparableOutings.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(15,23,42,0.04)',
                }}
              >
                <div>
                  <b>{item.title}</b>
                  <div style={{ opacity: 0.72, fontSize: 11 }}>
                    {item.dateKey ?? 'Date inconnue'}
                    {item.distanceKm !== null ? ` · ${item.distanceKm.toFixed(1)} km` : ''}
                    {item.dplusM !== null ? ` · +${Math.round(item.dplusM)} m` : ''}
                  </div>
                </div>
                <span style={{ fontWeight: 600 }}>
                  {formatDurationDelta(item.deltaDurationS)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {createOpen && activityForSegments ? (
        <OverlaySheet
          title="Créer un segment"
          subtitle={detail.title}
          onClose={() => {
            if (!createBusy) setCreateOpen(false);
          }}
          nested
        >
          <SegmentCreateEditForm
            mode="create"
            viewerUserId={ownerUserId}
            activity={activityForSegments}
            initialStartPointIndex={0}
            initialEndPointIndex={Math.max(2, activityForSegments.points.length - 1)}
            busy={createBusy}
            serverError={createError}
            onSubmit={(_seg, submission) => void handleCreateSegment(submission)}
            onCancel={() => setCreateOpen(false)}
          />
        </OverlaySheet>
      ) : null}

      {selectedSegmentId ? (
        <OverlaySheet
          title="Détail du segment"
          subtitle={detail.title}
          onClose={() => setSelectedSegmentId(null)}
          nested
        >
          <SegmentsDrawerPanel
            viewerUserId={ownerUserId || undefined}
            sourceActivity={activityForSegments ?? undefined}
            initialSelectedSegmentId={selectedSegmentId}
            hideSearchList
            onCloseSelected={() => setSelectedSegmentId(null)}
          />
        </OverlaySheet>
      ) : null}
    </div>
  );
}

export default OutingTrace;
