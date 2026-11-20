'use client';

import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { Flame, Mountain, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { elevationProfileGain } from '@/features/carnet/detail/elevationProfile';
import { CarnetAltitude } from './CarnetAltitude';
import { AnimatedNumber, CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

interface CarnetAltitudeDrawerBodyProps {
  detail: CarnetDetail;
  onFocusMap?: (lat: number, lng: number, zoom?: number) => void;
}

interface ChartPoint {
  km: number;
  alt: number;
  slopePct: number;
  lat: number;
  lng: number;
}

function slopeColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs >= 12) return '#dc2626';
  if (abs >= 6) return '#d97706';
  return '#1b4332';
}

function alpineZoneLabel(altM: number): string {
  if (altM >= 2200) return 'Étage alpin';
  if (altM >= 1500) return 'Étage subalpin';
  return 'Étage montagnard';
}

export function CarnetAltitudeDrawerBody({
  detail,
  onFocusMap,
}: CarnetAltitudeDrawerBodyProps) {
  const canObserveResize = typeof ResizeObserver !== 'undefined';

  const chartPoints = useMemo<ChartPoint[]>(() => {
    const pts = detail.elevationProfile ?? [];
    if (pts.length < 2) return [];
    const step = Math.max(1, Math.floor(pts.length / 56));
    const sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    return sampled.map((p, idx) => {
      const prev = idx > 0 ? sampled[idx - 1] : p;
      const dk = Math.max(0.02, p.distanceKm - prev.distanceKm);
      const slopePct = idx > 0 ? ((p.elevationM - prev.elevationM) / (dk * 1000)) * 100 : 0;
      return {
        km: Number(p.distanceKm.toFixed(1)),
        alt: Math.round(p.elevationM),
        slopePct: Number(slopePct.toFixed(1)),
        lat: p.lat,
        lng: p.lng,
      };
    });
  }, [detail.elevationProfile]);

  const stats = useMemo(() => {
    const pts = detail.elevationProfile ?? [];
    if (pts.length < 2) return null;

    let maxAlt = -Infinity;
    let minAlt = Infinity;
    let maxPoint = pts[0];
    let loss = 0;
    let maxSlope = 0;
    let longestClimb = 0;
    let currentClimb = 0;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.elevationM > maxAlt) {
        maxAlt = p.elevationM;
        maxPoint = p;
      }
      if (p.elevationM < minAlt) minAlt = p.elevationM;
      if (i > 0) {
        const prev = pts[i - 1];
        const diff = p.elevationM - prev.elevationM;
        if (diff > 0) {
          currentClimb += diff;
          if (currentClimb > longestClimb) longestClimb = currentClimb;
        } else {
          loss += Math.abs(diff);
          if (diff < -15) currentClimb = 0;
        }
        const distM = Math.max(20, (p.distanceKm - prev.distanceKm) * 1000);
        const slope = Math.abs((diff / distM) * 100);
        if (slope > maxSlope && slope < 65) maxSlope = slope;
      }
    }

    const gain = Math.round(elevationProfileGain(pts));
    const totalDist = Number((pts[pts.length - 1]?.distanceKm ?? 0).toFixed(1));
    const effortKm = Math.round(totalDist + gain / 100);
    const eiffelCount = Number((gain / 330).toFixed(1));

    const total = chartPoints.length || 1;
    const lowPct = Math.round((chartPoints.filter((p) => p.alt < 1500).length / total) * 100);
    const midPct = Math.round(
      (chartPoints.filter((p) => p.alt >= 1500 && p.alt < 2200).length / total) * 100,
    );
    const highPct = Math.max(0, 100 - lowPct - midPct);

    return {
      maxAlt: Math.round(maxAlt),
      minAlt: Math.round(minAlt),
      maxPoint,
      gain,
      loss: Math.round(loss),
      totalDist,
      maxSlope: Math.round(maxSlope),
      longestClimb: Math.round(longestClimb),
      effortKm,
      eiffelCount,
      bands: [
        { label: 'Montagnard (< 1 500 m)', pct: lowPct, color: '#52b788' },
        { label: 'Subalpin (1 500 – 2 200 m)', pct: midPct, color: '#2d6a4f' },
        { label: 'Alpin (> 2 200 m)', pct: highPct, color: '#1b4332' },
      ],
    };
  }, [chartPoints, detail.elevationProfile]);

  const dayDividersKm = useMemo(() => {
    if (!stats || detail.etapes.length <= 1) return [];
    let cum = 0;
    const out: Array<{ day: number; km: number }> = [];
    for (let i = 0; i < detail.etapes.length - 1; i++) {
      cum += detail.etapes[i].distanceKm ?? stats.totalDist / detail.etapes.length;
      if (cum > 0 && cum < stats.totalDist) {
        out.push({ day: detail.etapes[i + 1].dayNumber, km: Number(cum.toFixed(1)) });
      }
    }
    return out;
  }, [detail.etapes, stats]);

  if (chartPoints.length < 2 || !stats) {
    return (
      <div className="lkdv-carnet-empty-card">
        <Mountain size={22} aria-hidden="true" />
        <b>Profil altimétrique indisponible</b>
        <p>Ajoutez une trace GPX pour afficher l’analyse complète du dénivelé.</p>
      </div>
    );
  }

  return (
    <StaggerList className="lkdv-carnet-drawer-pane">
      {/* 1. Grille 6 KPIs d'altitude */}
      <StaggerCard className="lkdv-carnet-kpi-grid-3">
        <button
          type="button"
          className="lkdv-carnet-kpi-mini"
          style={{ border: 0, textAlign: 'left', cursor: onFocusMap ? 'pointer' : 'default' }}
          onClick={() => onFocusMap?.(stats.maxPoint.lat, stats.maxPoint.lng, 13)}
        >
          <small>Point haut</small>
          <b>
            <AnimatedNumber value={stats.maxAlt} suffix=" m" />
          </b>
        </button>
        <div className="lkdv-carnet-kpi-mini">
          <small>D+ cumulé</small>
          <b>
            <AnimatedNumber value={stats.gain} prefix="+" suffix=" m" />
          </b>
        </div>
        <div className="lkdv-carnet-kpi-mini">
          <small>D− cumulé</small>
          <b>
            <AnimatedNumber value={stats.loss} prefix="−" suffix=" m" />
          </b>
        </div>
        <div className="lkdv-carnet-kpi-mini">
          <small>Point bas</small>
          <b>
            <AnimatedNumber value={stats.minAlt} suffix=" m" />
          </b>
        </div>
        <div className="lkdv-carnet-kpi-mini">
          <small>Pente max</small>
          <b>
            <AnimatedNumber value={stats.maxSlope} suffix=" %" />
          </b>
        </div>
        <div className="lkdv-carnet-kpi-mini">
          <small>Plus longue montée</small>
          <b>
            <AnimatedNumber value={stats.longestClimb} prefix="+" suffix=" m" />
          </b>
        </div>
      </StaggerCard>

      {/* 2. Courbe interactive Recharts avec gradient par pente & séparateurs de jours */}
      <StaggerCard className="lkdv-carnet-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="lkdv-carnet-kit-eyebrow">Profil & pentes du tracé</span>
          {stats.maxAlt >= 2500 ? (
            <span className="lkdv-carnet-chip-soft">
              <Sparkles size={10} /> Haute altitude
            </span>
          ) : null}
        </div>
        {canObserveResize ? (
          <div style={{ width: '100%', height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartPoints}
                margin={{ top: 12, right: 10, left: -18, bottom: 0 }}
                onClick={(state) => {
                  const pt = (state as { activePayload?: Array<{ payload?: ChartPoint }> })
                    ?.activePayload?.[0]?.payload;
                  if (pt && onFocusMap) onFocusMap(pt.lat, pt.lng, 13);
                }}
              >
                <defs>
                  <linearGradient id="carnetAltStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                    {chartPoints.map((pt, i) => (
                      <stop
                        key={i}
                        offset={`${Math.round((i / Math.max(1, chartPoints.length - 1)) * 100)}%`}
                        stopColor={slopeColor(pt.slopePct)}
                      />
                    ))}
                  </linearGradient>
                  <linearGradient id="carnetAltFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1b4332" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#1b4332" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="km"
                  tick={{ fontSize: 10, fill: '#56665d' }}
                  tickFormatter={(v) => `${v} km`}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#56665d' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 80', 'dataMax + 120']}
                />
                {dayDividersKm.map((div) => (
                  <ReferenceLine
                    key={div.day}
                    x={div.km}
                    stroke="rgba(27, 67, 50, 0.28)"
                    strokeDasharray="3 3"
                    label={{
                      value: `J${div.day}`,
                      position: 'top',
                      fill: '#1b4332',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                ))}
                <ReferenceDot
                  x={Number(stats.maxPoint.distanceKm.toFixed(1))}
                  y={stats.maxAlt}
                  r={4}
                  fill="#1b4332"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0]?.payload as ChartPoint | undefined;
                    if (!pt) return null;
                    return (
                      <div className="lkdv-carnet-alt-tooltip">
                        <b>{pt.alt} m</b>
                        <span>
                          Km {pt.km} · Pente {pt.slopePct > 0 ? `+${pt.slopePct}` : pt.slopePct} %
                        </span>
                        <small>{alpineZoneLabel(pt.alt)}</small>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="alt"
                  stroke="url(#carnetAltStrokeGrad)"
                  strokeWidth={2.4}
                  fill="url(#carnetAltFillGrad)"
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <CarnetAltitude
            points={detail.elevationProfile ?? []}
            elevationM={detail.elevationM}
          />
        )}
      </StaggerCard>

      {/* 3. Étages bioclimatiques */}
      <StaggerCard className="lkdv-carnet-chart-card">
        <span className="lkdv-carnet-kit-eyebrow">Étages alpins parcourus</span>
        <div className="lkdv-carnet-kit-bars">
          {stats.bands.map((b) => (
            <div key={b.label} className="lkdv-carnet-kit-bar-row">
              <span className="lkdv-carnet-kit-bar-label" style={{ width: 138 }}>
                {b.label}
              </span>
              <div className="lkdv-carnet-kit-bar-track">
                <motion.div
                  className="lkdv-carnet-kit-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, b.pct)}%` }}
                  transition={CARNET_SPRING}
                  style={{ background: b.color }}
                />
              </div>
              <span className="lkdv-carnet-kit-bar-val">{b.pct} %</span>
            </div>
          ))}
        </div>
      </StaggerCard>

      {/* 4. Effort & Équivalents */}
      <StaggerCard className="lkdv-carnet-kpi-hero" style={{ padding: '13px 14px' }}>
        <div className="lkdv-carnet-kpi-hero-top">
          <span className="lkdv-carnet-kpi-ico">
            <Flame size={15} aria-hidden="true" />
          </span>
          <span className="lkdv-carnet-kit-eyebrow">Indice d’effort & repère</span>
        </div>
        <div className="lkdv-carnet-kpi-subrow">
          <span>
            <TrendingUp size={12} style={{ display: 'inline', marginRight: 3 }} />
            Effort équivalent : <b>{stats.effortKm} km-effort</b>
          </span>
          <span>
            <TrendingDown size={12} style={{ display: 'inline', marginRight: 3 }} />
            D+ ≈ <b>{stats.eiffelCount} Tours Eiffel</b>
          </span>
        </div>
      </StaggerCard>
    </StaggerList>
  );
}
