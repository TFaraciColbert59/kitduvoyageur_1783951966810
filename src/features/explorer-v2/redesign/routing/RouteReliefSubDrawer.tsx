'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Droplets,
  Flame,
  Mountain,
  Route,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ComputedItinerary, ItineraryElevationPoint } from '../../routing/types';

export interface RouteReliefSubDrawerProps {
  itinerary: ComputedItinerary;
  onProfileCursorChange?: (
    cursor: { lon: number; lat: number; distanceM: number; elevationM: number | null } | null,
  ) => void;
}

export function RouteReliefSubDrawer({
  itinerary,
  onProfileCursorChange,
}: RouteReliefSubDrawerProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const profile = itinerary.elevationProfile;
  const sb = itinerary.explanation.surfaceBreakdownPct;

  const chart = useMemo(() => {
    if (profile.length < 2) return null;
    const width = 340;
    const height = 104;
    const padX = 10;
    const padY = 12;
    const eles = profile.map((p) => p.ele);
    const minE = Math.min(...eles);
    const maxE = Math.max(...eles);
    const spanE = Math.max(20, maxE - minE);
    const maxKm = Math.max(0.1, profile[profile.length - 1]!.km);

    let peakIdx = 0;
    let lowIdx = 0;
    let sumPosSlope = 0;
    let countPosSlope = 0;
    let maxPosSlopePct = 0;

    const pts = profile.map((p, idx) => {
      if (p.ele >= profile[peakIdx]!.ele) peakIdx = idx;
      if (p.ele <= profile[lowIdx]!.ele) lowIdx = idx;
      if (p.slopePct > 1) {
        sumPosSlope += p.slopePct;
        countPosSlope += 1;
        if (p.slopePct > maxPosSlopePct) maxPosSlopePct = p.slopePct;
      }
      const x = padX + (p.km / maxKm) * (width - padX * 2);
      const y = height - padY - ((p.ele - minE) / spanE) * (height - padY * 2);
      return { x, y, p };
    });

    const linePath = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${pts[pts.length - 1]!.x.toFixed(1)},${height - padY} L${pts[0]!.x.toFixed(1)},${height - padY} Z`;
    const avgUpPct = countPosSlope > 0 ? Math.round(sumPosSlope / countPosSlope) : 0;

    return {
      width,
      height,
      pts,
      peakPt: pts[peakIdx]!,
      lowPt: pts[lowIdx]!,
      linePath,
      areaPath,
      minE,
      maxE,
      avgUpPct,
      maxPosSlopePct,
    };
  }, [profile]);

  const handlePointer = (clientX: number, rect: DOMRect) => {
    if (!chart) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.min(chart.pts.length - 1, Math.max(0, Math.round(ratio * (chart.pts.length - 1))));
    setHoverIdx(idx);
    const pt: ItineraryElevationPoint | undefined = chart.pts[idx]?.p;
    if (pt) {
      onProfileCursorChange?.({
        lon: pt.lng,
        lat: pt.lat,
        distanceM: pt.km * 1000,
        elevationM: pt.ele,
      });
    }
  };

  const activePt = chart && hoverIdx !== null ? chart.pts[hoverIdx] : null;

  return (
    <div className="xp20-sub-pane" role="region" aria-label="Données techniques et profil altimétrique">
      {/* High-Resolution Interactive Elevation Chart */}
      {chart ? (
        <div className="xp20-route-elev-wrap">
          <div className="xp20-route-elev-meta">
            <span>
              <Mountain size={12} aria-hidden="true" /> {Math.round(chart.minE)} m → {Math.round(chart.maxE)} m
            </span>
            <strong className="xp20-elev-cursor-pill">
              {activePt
                ? `${activePt.p.km.toFixed(2)} km · ${activePt.p.ele} m (${activePt.p.slopePct > 0 ? '+' : ''}${activePt.p.slopePct}%)`
                : `Pente max ${itinerary.explanation.maxSlopeDeg}°`}
            </strong>
          </div>
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="xp20-route-elev-svg xp20-route-elev-svg-tall"
            role="img"
            aria-label={`Profil technique de ${Math.round(chart.minE)} à ${Math.round(chart.maxE)} mètres`}
            onPointerMove={(e) => handlePointer(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => {
              setHoverIdx(null);
              onProfileCursorChange?.(null);
            }}
          >
            <defs>
              <linearGradient id="xp20ElevTechFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0E8F5B" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#0E8F5B" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {/* Horizontal reference grid */}
            <line x1="10" y1="26" x2="330" y2="26" stroke="rgba(23,64,44,0.08)" strokeDasharray="3 3" />
            <line x1="10" y1="56" x2="330" y2="56" stroke="rgba(23,64,44,0.08)" strokeDasharray="3 3" />
            <line x1="10" y1="86" x2="330" y2="86" stroke="rgba(23,64,44,0.08)" strokeDasharray="3 3" />

            <path d={chart.areaPath} fill="url(#xp20ElevTechFill)" />
            <path d={chart.linePath} fill="none" stroke="#0E8F5B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

            {/* Peak & Low markers */}
            <circle cx={chart.peakPt.x} cy={chart.peakPt.y} r="3.5" fill="#17402C" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx={chart.lowPt.x} cy={chart.lowPt.y} r="3" fill="#0369A1" stroke="#FFFFFF" strokeWidth="1.4" />

            {activePt ? (
              <>
                <line
                  x1={activePt.x}
                  y1={8}
                  x2={activePt.x}
                  y2={chart.height - 8}
                  stroke="#17402C"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                <circle cx={activePt.x} cy={activePt.y} r="4.5" fill="#0E8F5B" stroke="#FFFFFF" strokeWidth="2" />
              </>
            ) : null}
          </svg>
        </div>
      ) : null}

      {/* 6 Technical Telemetry Visual Tiles */}
      <div className="xp20-tech-grid">
        <div className="xp20-tech-tile">
          <TrendingUp size={13} color="#0E8F5B" aria-hidden="true" />
          <strong>+{itinerary.dplusM} m</strong>
          <span>D+ · moy {chart?.avgUpPct ?? 0}%</span>
        </div>
        <div className="xp20-tech-tile">
          <TrendingDown size={13} color="#0369A1" aria-hidden="true" />
          <strong>-{itinerary.dminusM} m</strong>
          <span>D- · min {itinerary.minAltM ?? '—'} m</span>
        </div>
        <div className="xp20-tech-tile">
          <AlertTriangle size={13} color={itinerary.explanation.maxSlopeDeg >= 30 ? '#DC2626' : '#D97706'} aria-hidden="true" />
          <strong>{itinerary.explanation.maxSlopeDeg}°</strong>
          <span>≥30° : {itinerary.explanation.exposedSlope30PlusM} m</span>
        </div>
        <div className="xp20-tech-tile">
          <Route size={13} color="#17402C" aria-hidden="true" />
          <strong>{itinerary.explanation.maxSacGradeLabel}</strong>
          <span>Max {itinerary.maxAltM ?? '—'} m</span>
        </div>
        <div className="xp20-tech-tile">
          <Activity size={13} color="#0E8F5B" aria-hidden="true" />
          <strong>{itinerary.relativeEffortPct}%</strong>
          <span>Effort eCRF</span>
        </div>
        <div className="xp20-tech-tile">
          <Flame size={13} color="#D97706" aria-hidden="true" />
          <strong>{itinerary.estimatedKcal}</strong>
          <span>
            <Droplets size={10} aria-hidden="true" /> {itinerary.hydrationLiters.toFixed(1)} L
          </span>
        </div>
      </div>

      {/* Stacked Surface Breakdown Visual Bar */}
      <div className="xp20-route-surface-box">
        <div className="xp20-route-surface-bar" aria-label="Revêtements du tracé">
          {sb.trail > 0 ? <span style={{ width: `${sb.trail}%`, background: '#0E8F5B' }} /> : null}
          {sb.gravel > 0 ? <span style={{ width: `${sb.gravel}%`, background: '#D97706' }} /> : null}
          {sb.paved > 0 ? <span style={{ width: `${sb.paved}%`, background: '#475569' }} /> : null}
          {sb.technical > 0 ? <span style={{ width: `${sb.technical}%`, background: '#B45309' }} /> : null}
        </div>
        <div className="xp20-surface-legend">
          <span><i style={{ background: '#0E8F5B' }} />Sentier {sb.trail}%</span>
          <span><i style={{ background: '#D97706' }} />Piste {sb.gravel}%</span>
          <span><i style={{ background: '#475569' }} />Bitume {sb.paved}%</span>
          {sb.technical > 0 ? <span><i style={{ background: '#B45309' }} />Tech {sb.technical}%</span> : null}
        </div>
      </div>
    </div>
  );
}
