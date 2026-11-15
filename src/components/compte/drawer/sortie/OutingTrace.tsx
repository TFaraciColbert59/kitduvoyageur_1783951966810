'use client';

import React, { useMemo, useState } from 'react';
import { Compass, Download, Flag, MapPin, Play, Plus, Users, Wind } from 'lucide-react';
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
import type { OutingWeather } from '@/features/compte/server/weather';
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

function WeatherBlock({ weather }: { weather: OutingWeather | null }) {
  if (!weather || weather.days.length === 0) {
    return (
      <section className="lkdv-sortie-section">
        <header>
          <b>Météo</b>
          <span>Aucune donnée</span>
        </header>
      </section>
    );
  }

  return (
    <section className="lkdv-sortie-section">
      <header>
        <b>Météo au départ</b>
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
  /* Jamais de recalcul client : le serveur seul décide de l'allure publiable. */
  const effortRows: Array<{ label: string; value: string }> = [];
  if (outingMetricVisible(detail, 'heartRate') && typeof detail.heartRateBpm === 'number' && Number.isFinite(detail.heartRateBpm)) {
    effortRows.push({ label: 'FC moyenne', value: `${formatNumber(detail.heartRateBpm)} bpm` });
  }
  if (outingMetricVisible(detail, 'power') && typeof detail.powerW === 'number' && Number.isFinite(detail.powerW)) {
    effortRows.push({ label: 'Puissance', value: `${formatNumber(detail.powerW)} W` });
  }
  if (outingMetricVisible(detail, 'cadence') && typeof detail.cadenceRpm === 'number' && Number.isFinite(detail.cadenceRpm)) {
    effortRows.push({ label: 'Cadence', value: `${formatNumber(detail.cadenceRpm)} rpm` });
  }
  if (outingMetricVisible(detail, 'calories') && typeof detail.caloriesKcal === 'number' && Number.isFinite(detail.caloriesKcal)) {
    effortRows.push({ label: 'Calories', value: `${formatNumber(detail.caloriesKcal)} kcal` });
  }

  if (!hasVisibleTrace(detail)) {
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
        <WeatherBlock weather={detail.weather} />
      </div>
    );
  }

  return (
    <div className="lkdv-sortie-pane">
      <section className="lkdv-sortie-section">
        <header>
          <b>Trace enregistrée</b>
          <span>{points.length} points</span>
        </header>
        <div className="lkdv-sortie-map-wrap">
          <TraceMap segments={segments} colorMode={colorMode} />
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
              tone={colorMode === mode.id ? 'primary' : 'default'}
              label={mode.allowed ? mode.label : `${mode.label} (masqué)`}
              text={mode.allowed ? mode.label : `${mode.label} · masqué`}
              disabled={!mode.allowed}
              onClick={() => {
                if (mode.allowed) setColorMode(mode.id);
              }}
            />
          ))}
        </div>
      </section>

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

      <WeatherBlock weather={detail.weather} />

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
