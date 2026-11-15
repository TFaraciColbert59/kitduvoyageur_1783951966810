'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { GradientSection } from '@/features/routes/analysis/climbs';
import type { SurfaceAnalysis } from '@/features/routes/analysis/surfaces';

export interface ProfilePoint {
  d: number;
  ele: number | null;
}

export interface ProfilePayload {
  points: ProfilePoint[];
  distance_m: number;
  gain_m: number;
  loss_m?: number;
  min_m: number | null;
  max_m: number | null;
  source: string;
}

const SURFACE_LABELS: Record<string, { label: string; color: string }> = {
  paved: { label: 'Asphalte / pavé', color: '#4B5563' },
  unpaved: { label: 'Piste / gravier', color: '#C89A3B' },
  natural: { label: 'Sentier naturel', color: '#2F6F78' },
  steps: { label: 'Escaliers', color: '#DC2626' },
  ferry: { label: 'Ferry', color: '#2563EB' },
};

/**
 * Profil altimétrique (R02 · K2.19 / K2.20).
 *
 * Échantillonné côté serveur depuis le DEM AWS Terrarium (`POST /api/explorer/v2/profile`),
 * puis synchronisé au curseur avec la carte (distance -> position) et les montées/descentes.
 */
export function ElevationProfile({
  positions,
  height = 84,
  onProfileLoaded,
  onCursorChange,
  climbs = [],
  surfaces,
  highlightedClimbId = null,
  onSelectClimb,
}: {
  positions: Array<[number, number]>;
  height?: number;
  onProfileLoaded?: (payload: ProfilePayload) => void;
  onCursorChange?: (cursor: { lon: number; lat: number; distanceM: number; elevationM: number | null } | null) => void;
  climbs?: readonly GradientSection[];
  surfaces?: SurfaceAnalysis | null;
  highlightedClimbId?: string | null;
  onSelectClimb?: (section: GradientSection) => void;
}) {
  const [requested, setRequested] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const usable = positions.length > 1 && positions.length <= 6000;

  useEffect(() => {
    if (!requested || !usable) return;
    let cancelled = false;
    setState('loading');
    fetch('/api/explorer/v2/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload: ProfilePayload) => {
        if (cancelled) return;
        setProfile(payload);
        setState('ready');
        onProfileLoaded?.(payload);
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, usable, positions.length]);

  const shape = useMemo(() => {
    if (!profile || profile.points.length < 2) return null;
    const known = profile.points
      .map((point) => point.ele)
      .filter((value): value is number => value !== null);
    if (known.length < 2) return null;
    const min = Math.min(...known);
    const max = Math.max(...known);
    const span = Math.max(1, max - min);
    const totalD = Math.max(1, profile.points[profile.points.length - 1]?.d ?? profile.distance_m ?? 1);
    const coords = profile.points
      .map((point) => {
        if (point.ele === null) return null;
        const x = (point.d / totalD) * 100;
        const y = height - ((point.ele - min) / span) * (height - 12) - 6;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .filter(Boolean)
      .join(' ');
    return { coords, min, max, span, gain: profile.gain_m, totalD };
  }, [profile, height]);

  const emitCursorForIndex = (idx: number | null) => {
    setHoverIdx(idx);
    if (!onCursorChange || !profile || idx === null) {
      onCursorChange?.(null);
      return;
    }
    const pt = profile.points[idx];
    if (!pt) return;
    const ratio = shape ? Math.min(1, Math.max(0, pt.d / shape.totalD)) : 0;
    const posIndex = Math.min(positions.length - 1, Math.max(0, Math.round(ratio * (positions.length - 1))));
    const coord = positions[posIndex];
    if (!coord) return;
    onCursorChange({
      lon: coord[0],
      lat: coord[1],
      distanceM: pt.d,
      elevationM: pt.ele,
    });
  };

  if (!requested) {
    return (
      <button
        type="button"
        className="xp-profile xp-profile-trigger"
        onClick={() => setRequested(true)}
        disabled={!usable}
      >
        {usable ? 'Calculer le profil altimétrique & analyse' : 'Profil indisponible pour cette trace'}
        <span className="xp-profile-hint">relief réel · AWS Terrain Tiles</span>
      </button>
    );
  }

  if (state === 'loading' || state === 'idle') {
    return <div className="xp-profile xp-profile-loading" aria-busy="true" />;
  }
  if (state === 'error' || !shape || !profile) {
    return (
      <div className="xp-profile xp-profile-empty">
        <span>Profil altimétrique indisponible pour cette trace</span>
      </div>
    );
  }

  const activePt = hoverIdx !== null ? profile.points[hoverIdx] : null;
  const activeX = activePt ? (activePt.d / shape.totalD) * 100 : null;
  const activeY =
    activePt && activePt.ele !== null
      ? height - ((activePt.ele - shape.min) / shape.span) * (height - 12) - 6
      : null;

  return (
    <div className="xp-profile" onMouseLeave={() => emitCursorForIndex(null)}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        role="img"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        aria-label={`Profil altimétrique : ${Math.round(shape.min)} à ${Math.round(shape.max)} mètres, ${shape.gain} mètres de dénivelé positif`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          const idx = Math.round(ratio * (profile.points.length - 1));
          emitCursorForIndex(idx);
        }}
      >
        {climbs.map((c) => {
          const x1 = (c.fromM / shape.totalD) * 100;
          const x2 = (c.toM / shape.totalD) * 100;
          const selected = highlightedClimbId === c.id;
          return (
            <rect
              key={c.id}
              x={x1}
              y={0}
              width={Math.max(1, x2 - x1)}
              height={height}
              fill={
                selected
                  ? 'rgba(200, 154, 59, 0.34)'
                  : c.kind === 'climb'
                    ? 'rgba(220, 38, 38, 0.12)'
                    : 'rgba(37, 99, 235, 0.09)'
              }
              onClick={() => onSelectClimb?.(c)}
            />
          );
        })}
        <polygon points={`0,${height} ${shape.coords} 100,${height}`} fill="rgba(47, 111, 120, 0.16)" />
        <polyline
          points={shape.coords}
          fill="none"
          stroke="#2F6F78"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
        {activeX !== null && activeY !== null ? (
          <>
            <line
              x1={activeX}
              y1={0}
              x2={activeX}
              y2={height}
              stroke="#172B24"
              strokeWidth="0.5"
              strokeDasharray="1.5,1.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={activeX} cy={activeY} r="1.8" fill="#172B24" />
          </>
        ) : null}
      </svg>

      {surfaces && surfaces.sections.length > 0 ? (
        <div
          aria-label="Répartition des surfaces sur le profil"
          style={{
            display: 'flex',
            height: 6,
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 4,
            background: 'rgba(23, 43, 36, 0.08)',
          }}
        >
          {surfaces.sections.map((sec, i) => {
            const pct = surfaces.totalLengthM > 0 ? (sec.lengthM / surfaces.totalLengthM) * 100 : 0;
            const meta = SURFACE_LABELS[sec.category];
            return (
              <div
                key={`${sec.category}-${i}`}
                title={`${meta?.label ?? 'Surface inconnue'} · ${Math.round(sec.lengthM)} m`}
                style={{
                  width: `${Math.max(1, pct)}%`,
                  background: meta?.color ?? 'rgba(23,43,36,0.22)',
                }}
              />
            );
          })}
        </div>
      ) : null}

      <div className="xp-profile-legend">
        <span>{Math.round(shape.min)} m</span>
        {activePt ? (
          <strong>
            {(activePt.d / 1000).toFixed(1)} km · {activePt.ele != null ? `${Math.round(activePt.ele)} m` : '—'}
          </strong>
        ) : (
          <span>D+ {shape.gain} m</span>
        )}
        <span>{Math.round(shape.max)} m</span>
      </div>
    </div>
  );
}
