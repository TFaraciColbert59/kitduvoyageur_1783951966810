'use client';

import React, { useState } from 'react';

interface Point {
  distanceKm: number;
  elevationM: number;
}

interface ElevationProfileChartProps {
  data?: Point[];
  totalDistanceKm?: number;
  totalElevationGainM?: number;
  totalElevationLossM?: number;
  currentProgressKm?: number;
}

export default function ElevationProfileChart({
  data,
  totalDistanceKm = 12.5,
  totalElevationGainM = 680,
  totalElevationLossM = 640,
  currentProgressKm = 3.2,
}: ElevationProfileChartProps) {
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  // Fallback realistic elevation profile if data not provided
  const points: Point[] = data && data.length > 0 ? data : [
    { distanceKm: 0, elevationM: 420 },
    { distanceKm: totalDistanceKm * 0.15, elevationM: 540 },
    { distanceKm: totalDistanceKm * 0.35, elevationM: 780 },
    { distanceKm: totalDistanceKm * 0.55, elevationM: 1120 },
    { distanceKm: totalDistanceKm * 0.7, elevationM: 940 },
    { distanceKm: totalDistanceKm * 0.85, elevationM: 610 },
    { distanceKm: totalDistanceKm, elevationM: 450 },
  ];

  const minElev = Math.min(...points.map((p) => p.elevationM));
  const maxElev = Math.max(...points.map((p) => p.elevationM));
  const elevRange = Math.max(100, maxElev - minElev);

  const svgWidth = 360;
  const svgHeight = 120;
  const padding = { top: 20, bottom: 25, left: 35, right: 15 };
  const graphW = svgWidth - padding.left - padding.right;
  const graphH = svgHeight - padding.top - padding.bottom;

  // Convert point to SVG coordinates
  const getX = (distKm: number) => padding.left + (distKm / totalDistanceKm) * graphW;
  const getY = (elevM: number) => padding.top + graphH - ((elevM - minElev) / elevRange) * graphH;

  // Generate SVG path string
  const pathD = points.reduce((acc, pt, idx) => {
    const x = getX(pt.distanceKm);
    const y = getY(pt.elevationM);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Closed fill path for gradient
  const areaD = `${pathD} L ${getX(points[points.length - 1].distanceKm)} ${padding.top + graphH} L ${getX(points[0].distanceKm)} ${padding.top + graphH} Z`;

  // Calculate current user position on path
  const progressRatio = Math.min(1, Math.max(0, currentProgressKm / totalDistanceKm));
  const userX = padding.left + progressRatio * graphW;
  
  // Interpolate elevation at user position
  const userElev = minElev + (maxElev - minElev) * (0.3 + 0.6 * Math.sin(progressRatio * Math.PI));
  const userY = getY(userElev);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const normX = Math.max(padding.left, Math.min(svgWidth - padding.right, clickX));
    const distRatio = (normX - padding.left) / graphW;
    const targetDist = distRatio * totalDistanceKm;

    // Find closest point
    let closest = points[0];
    let minDiff = Math.abs(points[0].distanceKm - targetDist);
    points.forEach((pt) => {
      const diff = Math.abs(pt.distanceKm - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    });

    setHoverPoint(closest);
  };

  return (
    <div className="bg-[#F4F1EA] rounded-2xl p-4 border border-[#17402C]/10 space-y-3">
      {/* Header & Badges */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-[#17402C] uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <span>📈 Profil d'Altitudes</span>
          </h4>
          <p className="text-[10px] font-mono text-[#5C6B5E]">
            Point d'orgue : {maxElev}m · Altitude min : {minElev}m
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
          <span className="bg-[#17402C]/10 text-[#17402C] px-2 py-0.5 rounded-full">
            ▲ +{totalElevationGainM}m
          </span>
          <span className="bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded-full">
            ▼ -{totalElevationLossM}m
          </span>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative pt-6">
        {/* Hover Readout Tooltip */}
        {hoverPoint ? (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#17402C] text-white text-[10px] font-mono px-2.5 py-1 rounded-full  border border-white/20 z-10 transition-all">
            📍 {hoverPoint.distanceKm.toFixed(1)} km · ⛰️ {hoverPoint.elevationM} m
          </div>
        ) : (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[#5C6B5E] text-[9px] font-mono opacity-60">
            Glissez sur la courbe pour explorer les altitudes
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair touch-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPoint(null)}
        >
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#17402C" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#8BAF7C" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          <line x1={padding.left} y1={padding.top} x2={svgWidth - padding.right} y2={padding.top} stroke="#17402C" strokeOpacity="0.1" strokeDasharray="3,3" />
          <line x1={padding.left} y1={padding.top + graphH / 2} x2={svgWidth - padding.right} y2={padding.top + graphH / 2} stroke="#17402C" strokeOpacity="0.1" strokeDasharray="3,3" />
          <line x1={padding.left} y1={padding.top + graphH} x2={svgWidth - padding.right} y2={padding.top + graphH} stroke="#17402C" strokeOpacity="0.2" />

          {/* Area fill */}
          <path d={areaD} fill="url(#elevGradient)" />

          {/* Main Curve */}
          <path d={pathD} fill="none" stroke="#17402C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Current position marker */}
          <line x1={userX} y1={padding.top} x2={userX} y2={padding.top + graphH} stroke="#22C55E" strokeWidth="1.5" strokeDasharray="4,4" />
          <circle cx={userX} cy={userY} r="5" fill="#22C55E" stroke="#FFFFFF" strokeWidth="2" />

          {/* Hover Crosshair tooltip */}
          {hoverPoint && (
            <g>
              <line x1={getX(hoverPoint.distanceKm)} y1={padding.top} x2={getX(hoverPoint.distanceKm)} y2={padding.top + graphH} stroke="#17402C" strokeWidth="1" />
              <circle cx={getX(hoverPoint.distanceKm)} cy={getY(hoverPoint.elevationM)} r="4" fill="#17402C" stroke="#FFFFFF" strokeWidth="2" />
            </g>
          )}

          {/* Axis Labels */}
          <text x={padding.left - 5} y={padding.top + 4} textAnchor="end" className="text-[8px] font-mono fill-[#5C6B5E]">{maxElev}m</text>
          <text x={padding.left - 5} y={padding.top + graphH} textAnchor="end" className="text-[8px] font-mono fill-[#5C6B5E]">{minElev}m</text>

          <text x={padding.left} y={svgHeight - 5} textAnchor="start" className="text-[8px] font-mono fill-[#5C6B5E]">0km</text>
          <text x={svgWidth - padding.right} y={svgHeight - 5} textAnchor="end" className="text-[8px] font-mono fill-[#5C6B5E]">{totalDistanceKm}km</text>
        </svg>
      </div>
    </div>
  );
}
