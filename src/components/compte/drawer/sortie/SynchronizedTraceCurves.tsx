'use client';

import React, { useMemo, useState } from 'react';
import { Activity, Zap } from 'lucide-react';
import type {
  AlignedTelemetryPoint,
  OutingTelemetryBundle,
} from '@/features/explorer-v2/metrics/telemetryAnalysis';
import type { EstimatedFtpResult, PowerCurveResult } from '@/features/explorer-v2/metrics/powerCurve';

type CurveChannelId = 'elevation' | 'pace' | 'gap' | 'heartRate' | 'power' | 'cadence';

export function formatPaceMinPerKm(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '—';
  const totalS = Math.round(minPerKm * 60);
  const mins = Math.floor(totalS / 60);
  const secs = totalS % 60;
  return `${mins}:${String(secs).padStart(2, '0')} min/km`;
}

interface ChannelMeta {
  id: CurveChannelId;
  label: string;
  color: string;
  provenance: string;
  invert?: boolean;
  read: (p: AlignedTelemetryPoint) => number | null;
  format: (v: number) => string;
}

const CHANNELS: ChannelMeta[] = [
  {
    id: 'elevation',
    label: 'Altitude',
    color: '#17402C',
    provenance: 'mesurée GPS',
    read: (p) => p.altitudeM,
    format: (v) => `${Math.round(v)} m`,
  },
  {
    id: 'pace',
    label: 'Allure',
    color: '#0284C7',
    provenance: 'calculée',
    invert: true,
    read: (p) => p.paceMinPerKm,
    format: (v) => formatPaceMinPerKm(v),
  },
  {
    id: 'gap',
    label: 'GAP',
    color: '#0D9488',
    provenance: 'estimée (Minetti)',
    invert: true,
    read: (p) => p.gapPaceMinPerKm,
    format: (v) => formatPaceMinPerKm(v),
  },
  {
    id: 'heartRate',
    label: 'Cardio',
    color: '#DC2626',
    provenance: 'mesurée capteur',
    read: (p) => p.heartRateBpm,
    format: (v) => `${Math.round(v)} bpm`,
  },
  {
    id: 'power',
    label: 'Puissance',
    color: '#D97706',
    provenance: 'capteur ou estimée',
    read: (p) => p.powerW,
    format: (v) => `${Math.round(v)} W`,
  },
  {
    id: 'cadence',
    label: 'Cadence',
    color: '#7C3AED',
    provenance: 'mesurée capteur',
    read: (p) => p.cadence,
    format: (v) => `${Math.round(v)}`,
  },
];

function buildPolyline(
  points: readonly AlignedTelemetryPoint[],
  read: (p: AlignedTelemetryPoint) => number | null,
  invert: boolean | undefined,
  maxDistKm: number
) {
  const valid = points
    .map((p, index) => ({ p, index, value: read(p) }))
    .filter(
      (item): item is { p: AlignedTelemetryPoint; index: number; value: number } =>
        item.value !== null && Number.isFinite(item.value)
    );
  if (valid.length < 2) return null;
  const vals = valid.map((v) => v.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 0.001);
  const coords = valid.map((item) => {
    const x =
      maxDistKm > 0
        ? (item.p.distanceKm / maxDistKm) * 100
        : (item.index / Math.max(1, points.length - 1)) * 100;
    const ratio = (item.value - min) / span;
    const y = invert ? 6 + ratio * 34 : 40 - ratio * 34;
    return { x, y, index: item.index };
  });
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');
  return { d, min, max, coords };
}

export function SynchronizedTraceCurves({
  bundle,
  onCursorPoint,
}: {
  bundle: OutingTelemetryBundle;
  onCursorPoint: (point: AlignedTelemetryPoint | null) => void;
}) {
  const availableChannels = useMemo(
    () => CHANNELS.filter((ch) => bundle.aligned.filter((p) => ch.read(p) !== null).length >= 2),
    [bundle.aligned]
  );

  const [selected, setSelected] = useState<CurveChannelId[]>(() =>
    availableChannels.slice(0, 2).map((c) => c.id)
  );
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);

  const activeChannels = useMemo(() => {
    const picked = availableChannels.filter((c) => selected.includes(c.id));
    return picked.length > 0 ? picked : availableChannels.slice(0, 1);
  }, [availableChannels, selected]);

  const maxDistKm = bundle.aligned[bundle.aligned.length - 1]?.distanceKm ?? 0;
  const cursorPoint = cursorIndex !== null ? bundle.aligned[cursorIndex] ?? null : null;

  const setCursor = (idx: number | null) => {
    setCursorIndex(idx);
    onCursorPoint(idx !== null ? bundle.aligned[idx] ?? null : null);
  };

  if (bundle.aligned.length < 2 || availableChannels.length === 0) {
    return null;
  }

  const toggleChannel = (id: CurveChannelId) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id].slice(-3)
    );
  };

  return (
    <section className="lkdv-sortie-section" data-testid="synchronized-trace-curves">
      <header>
        <b>
          <Activity size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Courbes synchronisées avec la trace
        </b>
        <span>{bundle.aligned.length} points alignés</span>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {availableChannels.map((ch) => {
          const active = activeChannels.some((item) => item.id === ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleChannel(ch.id)}
              style={{
                padding: '4px 9px',
                borderRadius: 999,
                fontSize: 11.5,
                border: active ? `1px solid ${ch.color}` : '1px solid rgba(15,23,42,0.14)',
                background: active ? `${ch.color}18` : 'transparent',
                color: active ? ch.color : 'inherit',
                cursor: 'pointer',
              }}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      <svg
        viewBox="0 0 100 46"
        preserveAspectRatio="none"
        role="img"
        aria-label="Courbes télémétriques synchronisées"
        style={{ width: '100%', height: 110, display: 'block', cursor: 'crosshair' }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
          const idx = Math.round(ratio * (bundle.aligned.length - 1));
          setCursor(idx);
        }}
        onMouseLeave={() => setCursor(null)}
      >
        {activeChannels.map((ch) => {
          const path = buildPolyline(bundle.aligned, ch.read, ch.invert, maxDistKm);
          if (!path) return null;
          return (
            <path
              key={ch.id}
              d={path.d}
              fill="none"
              stroke={ch.color}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {cursorPoint && cursorIndex !== null ? (
          <line
            x1={
              maxDistKm > 0
                ? (cursorPoint.distanceKm / maxDistKm) * 100
                : (cursorIndex / Math.max(1, bundle.aligned.length - 1)) * 100
            }
            x2={
              maxDistKm > 0
                ? (cursorPoint.distanceKm / maxDistKm) * 100
                : (cursorIndex / Math.max(1, bundle.aligned.length - 1)) * 100
            }
            y1={2}
            y2={44}
            stroke="#EA580C"
            strokeWidth="0.9"
            strokeDasharray="1.8 1.5"
          />
        ) : null}
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <label htmlFor="lkdv-trace-scrub" style={{ fontSize: 11.5, opacity: 0.78 }}>
          Curseur trace
        </label>
        <input
          id="lkdv-trace-scrub"
          type="range"
          min={0}
          max={bundle.aligned.length - 1}
          value={cursorIndex ?? 0}
          aria-label="Parcourir la trace et les courbes"
          style={{ flex: 1 }}
          onChange={(event) => setCursor(Number(event.target.value))}
        />
        {cursorIndex !== null ? (
          <button
            type="button"
            onClick={() => setCursor(null)}
            style={{
              fontSize: 11,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Effacer
          </button>
        ) : null}
      </div>

      {cursorPoint ? (
        <div
          data-testid="synchronized-cursor-readout"
          style={{
            marginTop: 6,
            padding: '6px 9px',
            borderRadius: 10,
            background: 'rgba(15,23,42,0.05)',
            fontSize: 11.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 12px',
          }}
        >
          <span>
            <b>{cursorPoint.distanceKm.toFixed(2)} km</b>
          </span>
          {cursorPoint.gradePct !== null ? (
            <span>Pente {cursorPoint.gradePct.toFixed(1)} %</span>
          ) : null}
          {activeChannels.map((ch) => {
            const val = ch.read(cursorPoint);
            if (val === null) return null;
            return (
              <span key={ch.id} style={{ color: ch.color }}>
                {ch.label} : <b>{ch.format(val)}</b> ({ch.provenance})
              </span>
            );
          })}
        </div>
      ) : (
        <p className="lkdv-sortie-proof" style={{ marginTop: 4 }}>
          Déplace le curseur pour inspecter un point simultanément sur la carte et les courbes.
        </p>
      )}
    </section>
  );
}

export function PowerCurveCard({
  powerCurve,
  estimatedFtp,
}: {
  powerCurve: PowerCurveResult;
  estimatedFtp: EstimatedFtpResult;
}) {
  if (powerCurve.status === 'unavailable') {
    return (
      <section className="lkdv-sortie-section" data-testid="power-curve-unavailable">
        <header>
          <b>
            <Zap size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Courbe de puissance &amp; FTP
          </b>
          <span>Indisponible</span>
        </header>
        <p className="lkdv-sortie-proof">{powerCurve.reason}</p>
      </section>
    );
  }

  const maxW = Math.max(...powerCurve.points.map((p) => p.watts), 1);

  return (
    <section className="lkdv-sortie-section" data-testid="power-curve-card">
      <header>
        <b>
          <Zap size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Courbe de puissance
        </b>
        <span>
          {powerCurve.quality === 'measured' ? 'Capteur mesuré' : 'Puissance estimée'}
          {estimatedFtp.status === 'available' && estimatedFtp.ftpW !== null
            ? ` · FTP est. ${estimatedFtp.ftpW} W`
            : ''}
        </span>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${powerCurve.points.length}, minmax(0, 1fr))`,
          gap: 6,
          alignItems: 'end',
          height: 82,
          padding: '8px 4px 2px',
        }}
      >
        {powerCurve.points.map((pt) => {
          const pct = Math.max(10, Math.round((pt.watts / maxW) * 100));
          return (
            <div
              key={pt.durationS}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600 }}>{Math.round(pt.watts)}W</span>
              <div
                style={{
                  width: '100%',
                  height: `${pct}%`,
                  minHeight: 6,
                  borderRadius: '4px 4px 2px 2px',
                  background: powerCurve.quality === 'measured' ? '#D97706' : '#F59E0B',
                  opacity: powerCurve.quality === 'measured' ? 0.92 : 0.72,
                }}
              />
              <span style={{ fontSize: 10, opacity: 0.7 }}>{pt.label}</span>
            </div>
          );
        })}
      </div>
      <p className="lkdv-sortie-proof" style={{ marginTop: 4 }}>
        {estimatedFtp.status === 'available' && estimatedFtp.ftpW !== null
          ? `FTP estimée à ${estimatedFtp.ftpW} W (0,95 × MMP 20 min = ${estimatedFtp.mmp20MinW} W, méthode ${estimatedFtp.method}).`
          : estimatedFtp.reason}
      </p>
    </section>
  );
}
