'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { readSessionPoints } from '../activity/localSession';
import type { GapTracePoint } from '../activity/slopeAdjustedPace';
import { computePowerCurve, estimateFtpFromPowerCurve } from '../metrics/powerCurve';
import {
  DEFAULT_CARDIO_WEIGHTS,
  buildDefaultZoneSet,
  readLocalZoneSets,
  readOutingRpe,
  saveOutingRpe,
} from '../metrics/telemetryAnalysis';
import {
  computeHeartRateZoneTimes,
  computeRelativeEffort,
  normalizePerceivedEffort,
} from '../metrics/activityMetrics';
import type { ActivityState, MetricSeries } from '../state/types';
import { XpChips, XpEyebrow, XpRow, XpRows } from './blocks';
import { SlopeAdjustedPacePanel } from './SlopeAdjustedPace';
import { OutingInsightBridge } from '@/features/ai-assistant/ui/OutingInsightBridge';
import type { MetricUnits } from '../activity/metrics';

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function ExplorerSummaryEffortAndSplits({
  summary,
  units,
}: {
  summary: ActivityState & { endedAt: number };
  units: MetricUnits;
}) {
  const id = summary.sessionId ?? summary.clientSessionId ?? `local-${summary.startedAt}`;
  const [rpe, setRpe] = useState<number | null>(() => readOutingRpe(id));
  const [unit, setUnit] = useState<'km' | 'mi'>(units === 'imperial' ? 'mi' : 'km');

  useEffect(() => {
    setRpe(readOutingRpe(id));
  }, [id]);

  const activeMin = (summary.movingS || (summary.endedAt - summary.startedAt) / 1000) / 60;
  const sRpeLoad = rpe !== null && activeMin > 0 ? Math.round(rpe * activeMin * 0.25) : null;
  const perceived =
    rpe !== null
      ? normalizePerceivedEffort(
          {
            value: rpe,
            scale: { min: 1, max: 10, label: 'RPE 1-10' },
            recordedAtMs: summary.endedAt,
            source: { kind: 'manual', id },
          },
          summary.endedAt
        )
      : null;
  const perceivedNormalized100 =
    perceived && perceived.status === 'available' && perceived.value !== null && perceived.scale
      ? Math.round(
          ((perceived.value - perceived.scale.min) / (perceived.scale.max - perceived.scale.min)) *
            100
        )
      : null;

  const splits = unit === 'km' ? summary.splits ?? [] : summary.mileSplits ?? [];

  return (
    <>
      <XpEyebrow>Ressenti &amp; charge (RPE)</XpEyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }} role="group" aria-label="Ressenti RPE">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
          const active = rpe === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => {
                const next = active ? null : v;
                setRpe(next);
                saveOutingRpe(id, next);
              }}
              style={{
                minWidth: 28,
                height: 26,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                border: '1px solid var(--xp-bdr)',
                background: active ? 'var(--xp-good)' : 'transparent',
                color: active ? '#fff' : 'inherit',
                cursor: 'pointer',
              }}
            >
              {v}
            </button>
          );
        })}
      </div>
      {perceived && perceived.status === 'available' && perceived.value !== null ? (
        <XpRows>
          <XpRow
            icon="gauge"
            title={`Ressenti ${perceived.value}/10 (${perceivedNormalized100 ?? 0}/100)`}
            sub={sRpeLoad !== null ? `Charge sRPE estimée : ${sRpeLoad} ua` : 'Effort déclaré'}
            badge={{ label: 'déclaré', tone: 'muted' }}
          />
        </XpRows>
      ) : null}

      {(summary.splits && summary.splits.length > 0) || (summary.mileSplits && summary.mileSplits.length > 0) ? (
        <>
          <XpEyebrow>Splits</XpEyebrow>
          <XpChips
            items={[
              { id: 'km', label: 'Par km' },
              { id: 'mi', label: 'Par mile' },
            ]}
            value={unit}
            onChange={(next) => setUnit(next as 'km' | 'mi')}
            ariaLabel="Unité des splits"
          />
          <XpRows>
            {splits.map((sp) => {
              const paceSec = sp.distanceM > 0 ? (sp.movingS * 1000) / sp.distanceM : 0;
              return (
                <XpRow
                  key={`${unit}-${sp.index}`}
                  icon="route"
                  title={`${unit === 'km' ? 'Km' : 'Mi'} ${sp.index} · ${formatClock(sp.movingS)}`}
                  sub={`Allure ${paceSec > 0 ? `${formatClock(paceSec)}/km` : '—'} · ${(sp.distanceM / 1000).toFixed(2)} km`}
                />
              );
            })}
          </XpRows>
        </>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <OutingInsightBridge
          session={{
            id,
            started_at: new Date(summary.startedAt).toISOString(),
            ended_at: new Date(summary.endedAt).toISOString(),
            distance_km:
              typeof summary.distanceM === 'number' && Number.isFinite(summary.distanceM)
                ? summary.distanceM / 1000
                : null,
            duration_seconds:
              typeof summary.movingS === 'number' && Number.isFinite(summary.movingS)
                ? summary.movingS
                : Math.max(0, Math.round((summary.endedAt - summary.startedAt) / 1000)),
            elevation_gain_m:
              typeof summary.elevGainM === 'number' && Number.isFinite(summary.elevGainM)
                ? summary.elevGainM
                : null,
            route_name: summary.route?.status === 'ready' ? summary.route.name : null,
          }}
          telemetry={{
            splitsCount: splits.length,
            rpe,
          }}
        />
      </div>
    </>
  );
}

export function ExplorerStatsTelemetryBridge({
  summary,
  units,
}: {
  summary: ActivityState & { endedAt: number };
  units: MetricUnits;
}) {
  const id = summary.sessionId ?? summary.clientSessionId ?? `local-${summary.startedAt}`;
  const [points, setPoints] = useState<GapTracePoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!summary.clientSessionId) {
      setPoints([]);
      return;
    }
    readSessionPoints(summary.clientSessionId)
      .then((pts) => {
        if (cancelled) return;
        setPoints(
          pts.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            elevationM: p.ele ?? null,
            timestampMs: p.t,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [summary.clientSessionId]);

  const series: readonly MetricSeries[] = summary.metricSeries ?? [];
  const powerSeries = series.find((s) => s.key === 'power');
  const powerCurve = useMemo(() => {
    if (!powerSeries || powerSeries.samples.length < 2) return null;
    const timed = powerSeries.samples.map((s) => ({
      atMs: s.t,
      watts: s.value,
      quality: (s.quality === 'estimated' ? 'estimated' : 'measured') as 'measured' | 'estimated',
    }));
    const curve = computePowerCurve(timed);
    const ftp = estimateFtpFromPowerCurve(curve);
    return { curve, ftp };
  }, [powerSeries]);

  const hrSeries = series.find((s) => s.key === 'heartRate');
  const zoneSummary = useMemo(() => {
    if (!hrSeries || hrSeries.samples.length < 2) return null;
    const zones = readLocalZoneSets(summary.sport);
    const hrSet = zones.find((z) => z.metric === 'heartRate') ?? buildDefaultZoneSet('heartRate', summary.sport);
    const samples = hrSeries.samples.map((s) => ({ atMs: s.t, bpm: s.value }));
    return computeHeartRateZoneTimes(samples, hrSet, {
      fromMs: samples[0].atMs,
      toMs: samples[samples.length - 1].atMs,
      maxHoldMs: 15_000,
      source: { kind: 'sensor', id: id },
      computedAtMs: summary.endedAt,
    });
  }, [hrSeries, summary.sport, summary.endedAt, id]);

  const relEffort = useMemo(() => {
    if (!zoneSummary || zoneSummary.status !== 'available') return null;
    return computeRelativeEffort(zoneSummary, {
      weights: DEFAULT_CARDIO_WEIGHTS,
      computedAtMs: summary.endedAt,
    });
  }, [zoneSummary, summary.endedAt]);

  return (
    <>
      <SlopeAdjustedPacePanel sport={summary.sport} points={points} units={units} />

      {powerCurve && powerCurve.curve.status === 'available' ? (
        <>
          <XpEyebrow>Courbe de puissance &amp; FTP</XpEyebrow>
          <XpRows>
            <XpRow
              icon="gauge"
              title={
                powerCurve.ftp.status === 'available' && powerCurve.ftp.ftpW
                  ? `FTP estimée : ${powerCurve.ftp.ftpW} W`
                  : 'Courbe de puissance vélo'
              }
              sub={powerCurve.curve.points
                .slice(0, 5)
                .map((p) => `${p.label}: ${Math.round(p.watts)}W`)
                .join(' · ')}
              badge={{
                label: powerCurve.curve.quality === 'measured' ? 'mesurée' : 'estimée',
                tone: powerCurve.curve.quality === 'measured' ? 'good' : 'muted',
              }}
            />
          </XpRows>
        </>
      ) : null}

      {zoneSummary && zoneSummary.status === 'available' ? (
        <>
          <XpEyebrow>
            Zones cardiaques
            {relEffort?.score !== null && relEffort?.score !== undefined
              ? ` · Effort ${Math.round(relEffort.score)}`
              : ''}
          </XpEyebrow>
          <XpRows>
            {zoneSummary.zones.map((band) => (
              <XpRow
                key={band.zoneId}
                icon="heart"
                title={band.label}
                sub={`${formatClock(band.seconds)} (${Math.round(band.shareOfInZone * 100)}%)`}
              />
            ))}
          </XpRows>
        </>
      ) : null}
    </>
  );
}
