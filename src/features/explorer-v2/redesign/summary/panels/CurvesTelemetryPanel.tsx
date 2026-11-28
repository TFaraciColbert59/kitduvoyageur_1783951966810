'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Mountain, RefreshCw, Satellite } from 'lucide-react';
import type { SummaryExpertAnalysisResult } from '../summaryAnalysisEngine';
import type { DemRecalibrationState } from '../useSummaryExpertAnalysis';
import { InlineInteractiveTraceSvg } from './InlineInteractiveTraceSvg';
import { HonestyBadge } from './panelFormatters';

export type TelemetryChannelKey =
  | 'altitude'
  | 'speed'
  | 'gap'
  | 'grade'
  | 'hr'
  | 'power'
  | 'cadence';

interface ChannelDef {
  readonly key: TelemetryChannelKey;
  readonly label: string;
  readonly unit: string;
  readonly color: string;
  readonly axis: 'left' | 'right';
}

const CHANNELS: readonly ChannelDef[] = [
  { key: 'altitude', label: 'Altitude', unit: 'm', color: '#17402c', axis: 'left' },
  { key: 'speed', label: 'Vitesse', unit: 'km/h', color: '#0284c7', axis: 'right' },
  { key: 'gap', label: 'GAP', unit: 'min/km', color: '#0e8f5b', axis: 'right' },
  { key: 'grade', label: 'Pente', unit: '%', color: '#d97706', axis: 'right' },
  { key: 'hr', label: 'FC', unit: 'bpm', color: '#dc2626', axis: 'right' },
  { key: 'power', label: 'Puissance', unit: 'W', color: '#7c3aed', axis: 'right' },
  { key: 'cadence', label: 'Cadence', unit: 'rpm', color: '#0f766e', axis: 'right' },
];

export interface CurvesTelemetryPanelProps {
  readonly analysis: SummaryExpertAnalysisResult;
  readonly cursorIndex: number | null;
  readonly onCursorIndexChange: (index: number | null) => void;
  readonly demStatus: DemRecalibrationState;
  readonly demMessage: string | null;
  readonly onRecalibrateDem: () => void;
}

export function CurvesTelemetryPanel({
  analysis,
  cursorIndex,
  onCursorIndexChange,
  demStatus,
  demMessage,
  onRecalibrateDem,
}: CurvesTelemetryPanelProps) {
  const { telemetry, gpsAudit } = analysis;

  const availability = useMemo<Record<TelemetryChannelKey, boolean>>(() => {
    const pts = telemetry.aligned;
    return {
      altitude: pts.some((p) => p.altitudeM !== null),
      speed: pts.some((p) => p.speedKmh !== null),
      gap: pts.some((p) => p.gapPaceMinPerKm !== null),
      grade: pts.some((p) => p.gradePct !== null),
      hr: pts.some((p) => p.heartRateBpm !== null),
      power: pts.some((p) => p.powerW !== null),
      cadence: pts.some((p) => p.cadence !== null),
    };
  }, [telemetry.aligned]);

  const [selectedChannels, setSelectedChannels] = useState<TelemetryChannelKey[]>(() => {
    const defaults: TelemetryChannelKey[] = [];
    if (telemetry.aligned.some((p) => p.altitudeM !== null)) defaults.push('altitude');
    if (telemetry.aligned.some((p) => p.heartRateBpm !== null)) defaults.push('hr');
    else if (telemetry.aligned.some((p) => p.powerW !== null)) defaults.push('power');
    else if (telemetry.aligned.some((p) => p.speedKmh !== null)) defaults.push('speed');
    return defaults;
  });

  // Keep selected channels valid when availability changes (IndexedDB hydration or DEM recalibration)
  useEffect(() => {
    setSelectedChannels((prev) => {
      const valid = prev.filter((k) => availability[k]);
      if (valid.length > 0) return valid;
      const fallback: TelemetryChannelKey[] = [];
      if (availability.altitude) fallback.push('altitude');
      if (availability.hr) fallback.push('hr');
      else if (availability.power) fallback.push('power');
      else if (availability.speed) fallback.push('speed');
      else if (availability.grade) fallback.push('grade');
      return fallback;
    });
  }, [availability]);

  // Automatically enable altitude curve once DEM recalibration succeeds
  useEffect(() => {
    if (demStatus === 'applied' && availability.altitude) {
      setSelectedChannels((prev) =>
        prev.includes('altitude')
          ? prev
          : prev.length >= 3
            ? ['altitude', ...prev.slice(0, 2)]
            : ['altitude', ...prev],
      );
    }
  }, [availability.altitude, demStatus]);

  const toggleChannel = (key: TelemetryChannelKey) => {
    setSelectedChannels((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), key];
      }
      return [...prev, key];
    });
  };

  const chartSeries = useMemo(() => {
    const pts = telemetry.aligned;
    if (pts.length < 2) return [];
    const step = Math.max(1, Math.floor(pts.length / 140));
    const rows: Array<{
      origIndex: number;
      km: number;
      altitude: number | null;
      speed: number | null;
      gap: number | null;
      grade: number | null;
      hr: number | null;
      power: number | null;
      cadence: number | null;
    }> = [];
    for (let i = 0; i < pts.length; i += step) {
      const p = pts[i];
      rows.push({
        origIndex: i,
        km: Number(p.distanceKm.toFixed(2)),
        altitude: p.altitudeM !== null ? Math.round(p.altitudeM) : null,
        speed: p.speedKmh !== null ? Number(p.speedKmh.toFixed(1)) : null,
        gap: p.gapPaceMinPerKm !== null ? Number(p.gapPaceMinPerKm.toFixed(2)) : null,
        grade: p.gradePct !== null ? Number(p.gradePct.toFixed(1)) : null,
        hr: p.heartRateBpm !== null ? Math.round(p.heartRateBpm) : null,
        power: p.powerW !== null ? Math.round(p.powerW) : null,
        cadence: p.cadence !== null ? Math.round(p.cadence) : null,
      });
    }
    const lastIdx = pts.length - 1;
    if (rows[rows.length - 1]?.origIndex !== lastIdx) {
      const p = pts[lastIdx];
      rows.push({
        origIndex: lastIdx,
        km: Number(p.distanceKm.toFixed(2)),
        altitude: p.altitudeM !== null ? Math.round(p.altitudeM) : null,
        speed: p.speedKmh !== null ? Number(p.speedKmh.toFixed(1)) : null,
        gap: p.gapPaceMinPerKm !== null ? Number(p.gapPaceMinPerKm.toFixed(2)) : null,
        grade: p.gradePct !== null ? Number(p.gradePct.toFixed(1)) : null,
        hr: p.heartRateBpm !== null ? Math.round(p.heartRateBpm) : null,
        power: p.powerW !== null ? Math.round(p.powerW) : null,
        cadence: p.cadence !== null ? Math.round(p.cadence) : null,
      });
    }
    return rows;
  }, [telemetry.aligned]);

  const activeDefs = CHANNELS.filter((c) => selectedChannels.includes(c.key) && availability[c.key]);
  const hasLeftAxis = activeDefs.some((c) => c.axis === 'left');
  const hasRightAxis = activeDefs.some((c) => c.axis === 'right');

  return (
    <div className="xp20-exp-stack" data-testid="xp20-exp-panel-curves">
      {/* 1. Synchronized Interactive Mini-Trace SVG */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Mountain size={14} aria-hidden="true" />
            <span>Tracé synchronisé carte &amp; courbes</span>
          </div>
          <button
            type="button"
            className="xp20-exp-action-btn"
            data-testid="xp20-exp-dem-recalibrate-btn"
            disabled={demStatus === 'loading' || gpsAudit.pointCount < 2}
            onClick={onRecalibrateDem}
          >
            <RefreshCw
              size={12}
              className={demStatus === 'loading' ? 'animate-spin' : undefined}
              aria-hidden="true"
            />
            <span>
              {demStatus === 'loading'
                ? 'Recalage DEM…'
                : demStatus === 'applied'
                  ? 'Altitude DEM recalée'
                  : 'Recaler altitude DEM'}
            </span>
          </button>
        </div>

        <InlineInteractiveTraceSvg
          points={telemetry.aligned}
          cursorIndex={cursorIndex}
          onSelectIndex={onCursorIndexChange}
        />

        {demMessage ? (
          <p className="xp20-exp-note" data-testid="xp20-exp-dem-message">
            {demMessage}
          </p>
        ) : null}
      </section>

      {/* 2. Multi-Channel Recharts ComposedChart (up to 3 overlaid channels) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Activity size={14} aria-hidden="true" />
            <span>Courbes multi-canaux (max 3)</span>
          </div>
          <span className="xp20-exp-micro-muted">{activeDefs.length}/3 actives</span>
        </div>

        <div className="xp20-exp-channel-pills" role="group" aria-label="Canaux télémétriques">
          {CHANNELS.map((ch) => {
            const active = selectedChannels.includes(ch.key);
            const hasData = availability[ch.key];
            return (
              <button
                key={ch.key}
                type="button"
                className={`xp20-exp-chip-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                disabled={!hasData}
                data-testid={`xp20-exp-channel-${ch.key}`}
                onClick={() => toggleChannel(ch.key)}
              >
                <span
                  className="xp20-exp-chip-dot"
                  style={{ background: hasData ? ch.color : '#94a3b8' }}
                  aria-hidden="true"
                />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>

        {chartSeries.length < 2 ? (
          <p className="xp20-exp-note">
            Trace GPS insuffisante (&lt; 2 points) pour afficher les courbes continues.
          </p>
        ) : (
          <div className="xp20-exp-chart-box">
            <ResponsiveContainer width="100%" height={206}>
              <ComposedChart
                data={chartSeries}
                margin={{ top: 8, right: 6, left: -16, bottom: 0 }}
                onMouseMove={(state) => {
                  const payload = (
                    state as unknown as {
                      activePayload?: Array<{ payload?: { origIndex?: number } }>;
                    }
                  )?.activePayload;
                  const origIdx = payload?.[0]?.payload?.origIndex;
                  if (typeof origIdx === 'number') {
                    onCursorIndexChange(origIdx);
                  }
                }}
                onMouseLeave={() => onCursorIndexChange(null)}
              >
                <XAxis dataKey="km" tick={{ fontSize: 10 }} unit=" km" />
                {hasLeftAxis ? <YAxis yAxisId="left" tick={{ fontSize: 10 }} /> : null}
                {hasRightAxis ? (
                  <YAxis
                    yAxisId="right"
                    orientation={hasLeftAxis ? 'right' : 'left'}
                    tick={{ fontSize: 10 }}
                  />
                ) : null}
                <Tooltip
                  formatter={(value, name) => [
                    typeof value === 'number' ? value : '—',
                    String(name ?? ''),
                  ]}
                  labelFormatter={(km) => `Km ${String(km)}`}
                />
                {activeDefs.map((ch) =>
                  ch.key === 'altitude' ? (
                    <Area
                      key={ch.key}
                      yAxisId="left"
                      type="monotone"
                      dataKey="altitude"
                      name={`${ch.label} (${ch.unit})`}
                      stroke={ch.color}
                      fill={ch.color}
                      fillOpacity={0.18}
                      strokeWidth={2}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      key={ch.key}
                      yAxisId={ch.axis}
                      type="monotone"
                      dataKey={ch.key}
                      name={`${ch.label} (${ch.unit})`}
                      stroke={ch.color}
                      dot={false}
                      strokeWidth={2}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 3. GPS Quality & Sensor Coverage Audit (C-MET) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Satellite size={14} aria-hidden="true" />
            <span>Audit qualité GPS &amp; capteurs (C-MET)</span>
          </div>
          <HonestyBadge
            quality={gpsAudit.pointCount >= 2 ? 'measured' : 'unavailable'}
            label={gpsAudit.qualityLabel}
          />
        </div>

        <div className="xp20-exp-bench-grid">
          <div className="xp20-exp-kpi-box">
            <span>Points GPS</span>
            <strong>{gpsAudit.pointCount}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Couv. altitude</span>
            <strong>{gpsAudit.elevationCoveragePct} %</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Précision moy.</span>
            <strong>{gpsAudit.avgAccuracyM !== null ? `±${gpsAudit.avgAccuracyM} m` : '—'}</strong>
          </div>
        </div>

        {telemetry.sensorChannels.length > 0 ? (
          <div className="xp20-exp-sensor-list">
            {telemetry.sensorChannels.map((ch) => (
              <div key={ch.key} className="xp20-exp-sensor-row">
                <div>
                  <strong>{ch.label}</strong>
                  <span>
                    Moy {ch.avg} · Max {ch.max} {ch.unit} ({ch.coveragePct} %)
                  </span>
                </div>
                <HonestyBadge
                  quality={ch.qualityLabel === 'mesurée' ? 'measured' : 'estimated'}
                  label={ch.qualityLabel === 'mesurée' ? 'Mesurée' : 'Estimée'}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="xp20-exp-note">
            Aucun capteur biométrique (FC, cadence, puissance) appairé sur cette séance : aucune valeur inventée.
          </p>
        )}
      </section>
    </div>
  );
}
