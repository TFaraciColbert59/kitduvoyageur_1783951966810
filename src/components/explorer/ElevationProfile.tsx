'use client';

import React from 'react';

interface ElevationProfileProps {
  elevationGain: number | null | undefined;
  distanceKm: number | null | undefined;
  difficulty?: string | null | undefined;
  /** Optional array of elevation samples for a real chart */
  profile?: { dist: number; elev: number }[];
}

function getDifficultyColor(difficulty: string | null | undefined): string {
  switch ((difficulty || '').toLowerCase()) {
    case 'facile': return '#22c55e';
    case 'modérée':
    case 'moderee':
    case 'moderate': return '#f97316';
    case 'difficile':
    case 'difficult': return '#ef4444';
    case 'expert':
    case 'très difficile': return '#7c3aed';
    default: return '#6b7280';
  }
}

function getDifficultyGradient(difficulty: string | null | undefined): string {
  switch ((difficulty || '').toLowerCase()) {
    case 'facile': return '#86efac';
    case 'modérée':
    case 'moderate': return '#fdba74';
    case 'difficile':
    case 'difficult': return '#fca5a5';
    case 'expert':
    case 'très difficile': return '#c4b5fd';
    default: return '#94a3b8';
  }
}

/** Generate a synthetic elevation profile when real data isn't available */
function generateSyntheticProfile(
  distanceKm: number,
  elevationGain: number
): { dist: number; elev: number }[] {
  const steps = 20;
  const profile: { dist: number; elev: number }[] = [];
  const segmentLength = distanceKm / steps;

  let currentDist = 0;
  let currentElev = 0;
  const remaining = elevationGain;

  for (let i = 0; i <= steps; i++) {
    // Simulate realistic terrain: some flats, some steep sections
    const phase = Math.sin((i / steps) * Math.PI * 3) * 0.3 + 0.5;
    const stepGain = (remaining / (steps - i)) * Math.max(0.1, phase);
    currentElev += Math.max(0, stepGain * 0.5);
    profile.push({ dist: currentDist, elev: Math.round(currentElev) });
    currentDist += segmentLength;
  }

  // Normalize to match actual elevation gain
  const maxElev = profile[profile.length - 1]?.elev || elevationGain;
  if (maxElev > 0) {
    const scale = elevationGain / maxElev;
    for (const p of profile) {
      p.elev = Math.round(p.elev * scale);
    }
  }

  return profile;
}

export default function ElevationProfile({
  elevationGain,
  distanceKm,
  difficulty,
  profile,
}: ElevationProfileProps) {
  const hasData = elevationGain !== null && elevationGain !== undefined && elevationGain > 0;
  const hasDistance = distanceKm !== null && distanceKm !== undefined && distanceKm > 0;
  const diffColor = getDifficultyColor(difficulty);
  const gradColor = getDifficultyGradient(difficulty);

  if (!hasData || !hasDistance) {
    return null;
  }

  const elevPoints =
    profile && profile.length >= 2
      ? profile
      : generateSyntheticProfile(distanceKm!, elevationGain!);

  const maxElev = Math.max(...elevPoints.map((p) => p.elev), 1);
  const minElev = Math.min(...elevPoints.map((p) => p.elev), 0);
  const elevRange = Math.max(maxElev - minElev, 10);
  const chartHeight = 80;
  const chartWidth = 280;

  // Build polyline points string
  const points = elevPoints
    .map((p, i) => {
      const x = (i / (elevPoints.length - 1)) * chartWidth;
      const y = chartHeight - ((p.elev - minElev) / elevRange) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Area fill
  const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  // Calculate grade
  const avgGrade =
    distanceKm! > 0
      ? ((elevationGain! / (distanceKm! * 1000)) * 100).toFixed(1)
      : '0';

  return (
    <div className="bg-[#F5F2EA] rounded-xl p-4 border border-[#E4E0D4]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[#1C2620] uppercase tracking-widest">
          Profil d&apos;altitude
        </h3>
        <span className="text-[10px] font-mono text-[#7A8A7D]">
          Pente moy. {avgGrade}%
        </span>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        style={{ height: '80px' }}
        preserveAspectRatio="none"
        aria-label="Profil d'altitude"
      >
        {/* Grid lines */}
        <line
          x1="0" y1={chartHeight * 0.75}
          x2={chartWidth} y2={chartHeight * 0.75}
          stroke="#E4E0D4" strokeWidth="0.5"
        />
        <line
          x1="0" y1={chartHeight * 0.5}
          x2={chartWidth} y2={chartHeight * 0.5}
          stroke="#E4E0D4" strokeWidth="0.5"
        />
        <line
          x1="0" y1={chartHeight * 0.25}
          x2={chartWidth} y2={chartHeight * 0.25}
          stroke="#E4E0D4" strokeWidth="0.5"
        />

        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill={`url(#elevGradient)`}
          opacity="0.25"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={diffColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={diffColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={diffColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start marker */}
        <circle
          cx={elevPoints[0] ? (0 / (elevPoints.length - 1)) * chartWidth : 0}
          cy={
            chartHeight -
            ((elevPoints[0]?.elev || 0) / elevRange) * chartHeight
          }
          r="3"
          fill={gradColor}
          stroke="white"
          strokeWidth="1.5"
        />

        {/* End marker */}
        <circle
          cx={chartWidth}
          cy={
            chartHeight -
            ((elevPoints[elevPoints.length - 1]?.elev || 0) / elevRange) *
              chartHeight
          }
          r="3"
          fill={diffColor}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Labels */}
      <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-[#7A8A7D]">
        <span>{distanceKm!.toFixed(1)} km</span>
        <span>+{elevationGain} m D+</span>
      </div>

      {/* Effort indicator */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#E4E0D8] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (elevationGain / (distanceKm! * 10)) * 10)}%`,
              backgroundColor: diffColor,
            }}
          />
        </div>
        <span className="text-[9px] font-mono text-[#7A8A7D] flex-shrink-0">
          {parseFloat(avgGrade) > 8
            ? 'Très pentu'
            : parseFloat(avgGrade) > 5
              ? 'Pentu'
              : parseFloat(avgGrade) > 3
                ? 'Modéré'
                : 'Relatif'}
        </span>
      </div>
    </div>
  );
}
