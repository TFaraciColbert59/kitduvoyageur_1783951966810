'use client';

import React, { useMemo } from 'react';
import type { AlignedTelemetryPoint } from '../../../metrics/telemetryAnalysis';

export interface HighlightedTraceRange {
  readonly fromM: number;
  readonly toM: number;
  readonly label?: string;
}

export interface InlineInteractiveTraceSvgProps {
  readonly points: readonly AlignedTelemetryPoint[];
  readonly cursorIndex?: number | null;
  readonly highlightedRange?: HighlightedTraceRange | null;
  readonly onSelectIndex?: (index: number | null) => void;
  readonly height?: number;
}

const VIEW_W = 340;
const VIEW_H = 112;
const PAD = 14;

export function InlineInteractiveTraceSvg({
  points,
  cursorIndex = null,
  highlightedRange = null,
  onSelectIndex,
  height = 112,
}: InlineInteractiveTraceSvgProps) {
  const projected = useMemo(() => {
    if (points.length < 2) return null;

    // Decimate to <= 220 vertices for crisp 60fps SVG rendering
    const step = Math.max(1, Math.floor(points.length / 220));
    const sampled: Array<{ pt: AlignedTelemetryPoint; origIndex: number }> = [];
    for (let i = 0; i < points.length; i += step) {
      sampled.push({ pt: points[i], origIndex: i });
    }
    if (sampled[sampled.length - 1]?.origIndex !== points.length - 1) {
      sampled.push({ pt: points[points.length - 1], origIndex: points.length - 1 });
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const { pt } of sampled) {
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lng < minLng) minLng = pt.lng;
      if (pt.lng > maxLng) maxLng = pt.lng;
    }

    const meanLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
    const cosLat = Math.max(0.2, Math.cos(meanLatRad));
    const spanX = Math.max(1e-6, (maxLng - minLng) * cosLat);
    const spanY = Math.max(1e-6, maxLat - minLat);

    const drawW = VIEW_W - PAD * 2;
    const drawH = VIEW_H - PAD * 2;
    const scale = Math.min(drawW / spanX, drawH / spanY);
    const offsetX = PAD + (drawW - spanX * scale) / 2;
    const offsetY = PAD + (drawH - spanY * scale) / 2;

    const project = (lat: number, lng: number) => ({
      x: Number((offsetX + (lng - minLng) * cosLat * scale).toFixed(1)),
      y: Number((offsetY + (maxLat - lat) * scale).toFixed(1)),
    });

    const vertices = sampled.map(({ pt, origIndex }) => {
      const xy = project(pt.lat, pt.lng);
      return { ...xy, origIndex, pt };
    });

    const fullPath = vertices
      .map((v, idx) => `${idx === 0 ? 'M' : 'L'}${v.x} ${v.y}`)
      .join(' ');

    return { vertices, fullPath, project };
  }, [points]);

  const highlightPath = useMemo(() => {
    if (!projected || !highlightedRange) return null;
    const seg = projected.vertices.filter((v) => {
      const dM = v.pt.distanceKm * 1000;
      return dM >= highlightedRange.fromM && dM <= highlightedRange.toM;
    });
    if (seg.length < 2) return null;
    return seg.map((v, idx) => `${idx === 0 ? 'M' : 'L'}${v.x} ${v.y}`).join(' ');
  }, [projected, highlightedRange]);

  const cursorCoord = useMemo(() => {
    if (!projected || cursorIndex === null || cursorIndex === undefined) return null;
    const clamped = Math.max(0, Math.min(points.length - 1, cursorIndex));
    const pt = points[clamped];
    if (!pt) return null;
    return { ...projected.project(pt.lat, pt.lng), pt };
  }, [projected, cursorIndex, points]);

  if (!projected) {
    return (
      <div className="xp20-exp-trace-empty" data-testid="xp20-exp-inline-trace-empty">
        <span>Tracé GPS non disponible pour cette sortie.</span>
      </div>
    );
  }

  const startV = projected.vertices[0];
  const endV = projected.vertices[projected.vertices.length - 1];

  const handlePointerPick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onSelectIndex) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xSvg = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const ySvg = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    let bestIdx = projected.vertices[0].origIndex;
    let bestDistSq = Infinity;
    for (const v of projected.vertices) {
      const dSq = (v.x - xSvg) ** 2 + (v.y - ySvg) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = v.origIndex;
      }
    }
    onSelectIndex(bestIdx);
  };

  return (
    <div className="xp20-exp-trace-wrap" data-testid="xp20-exp-inline-trace">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height={height}
        className="xp20-exp-trace-svg"
        role="img"
        aria-label="Mini-tracé GPS interactif synchronisé"
        onPointerDown={(e) => {
          handlePointerPick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1 || e.pointerType === 'touch') {
            handlePointerPick(e);
          }
        }}
      >
        <defs>
          <linearGradient id="xp20-exp-trace-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--xp-hud-accent, #17402c)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0e8f5b" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Subtle topographic guide lines */}
        <g opacity="0.14" stroke="var(--xp-hud-ink, #172b24)" strokeWidth="0.6" strokeDasharray="3 4">
          <line x1="0" y1="28" x2={VIEW_W} y2="28" />
          <line x1="0" y1="56" x2={VIEW_W} y2="56" />
          <line x1="0" y1="84" x2={VIEW_W} y2="84" />
        </g>

        {/* Base track soft halo */}
        <path
          d={projected.fullPath}
          fill="none"
          stroke="var(--xp-hud-accent, #17402c)"
          strokeOpacity="0.18"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Base track stroke */}
        <path
          d={projected.fullPath}
          fill="none"
          stroke="url(#xp20-exp-trace-grad)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Highlighted climb / descent segment */}
        {highlightPath ? (
          <>
            <path
              d={highlightPath}
              fill="none"
              stroke="#d97706"
              strokeOpacity="0.28"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={highlightPath}
              fill="none"
              stroke="#d97706"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {/* Start & Finish pins */}
        <circle cx={startV.x} cy={startV.y} r="4.2" fill="#0e8f5b" stroke="#ffffff" strokeWidth="1.6" />
        <circle cx={endV.x} cy={endV.y} r="4.2" fill="#dc2626" stroke="#ffffff" strokeWidth="1.6" />

        {/* Live synced cursor */}
        {cursorCoord ? (
          <g>
            <circle
              cx={cursorCoord.x}
              cy={cursorCoord.y}
              r="9"
              fill="var(--xp-hud-accent, #0284c7)"
              fillOpacity="0.22"
            />
            <circle
              cx={cursorCoord.x}
              cy={cursorCoord.y}
              r="4.6"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>

      {/* Overlay micro readout */}
      <div className="xp20-exp-trace-meta">
        {cursorCoord ? (
          <span className="xp20-exp-trace-chip is-cursor">
            km {cursorCoord.pt.distanceKm.toFixed(2)}
            {cursorCoord.pt.altitudeM !== null ? ` · ${Math.round(cursorCoord.pt.altitudeM)} m` : ''}
            {cursorCoord.pt.gradePct !== null ? ` · ${cursorCoord.pt.gradePct > 0 ? '+' : ''}${cursorCoord.pt.gradePct.toFixed(1)} %` : ''}
          </span>
        ) : highlightedRange?.label ? (
          <span className="xp20-exp-trace-chip is-highlight">{highlightedRange.label}</span>
        ) : (
          <span className="xp20-exp-trace-chip">Touchez ou survolez la courbe pour suivre la trace</span>
        )}
      </div>
    </div>
  );
}
