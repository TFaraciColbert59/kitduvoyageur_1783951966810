'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface ProfilePoint {
  d: number;
  ele: number | null;
}

interface ProfilePayload {
  points: ProfilePoint[];
  distance_m: number;
  gain_m: number;
  min_m: number | null;
  max_m: number | null;
  source: string;
}

/**
 * Profil altimétrique (03_ECRANS « Rando »).
 *
 * Le relief réel est échantillonné **côté serveur** depuis le DEM AWS Terrarium
 * (`POST /api/explorer/v2/profile`) : pas de décodage d'image dans le
 * navigateur, résultat cacheable, et l'appareil ne paie que l'affichage.
 */
export function ElevationProfile({
  positions,
  height = 72,
}: {
  positions: Array<[number, number]>;
  height?: number;
}) {
  const [requested, setRequested] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
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
    const step = 100 / (profile.points.length - 1);
    const coords = profile.points
      .map((point, index) => {
        if (point.ele === null) return null;
        const x = index * step;
        const y = height - ((point.ele - min) / span) * (height - 10) - 5;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .filter(Boolean)
      .join(' ');
    return { coords, min, max, gain: profile.gain_m };
  }, [profile, height]);

  if (!requested) {
    return (
      <button
        type="button"
        className="xp-profile xp-profile-trigger"
        onClick={() => setRequested(true)}
        disabled={!usable}
      >
        {usable ? 'Calculer le profil altimétrique' : 'Profil indisponible pour cette trace'}
        <span className="xp-profile-hint">relief réel · AWS Terrain Tiles</span>
      </button>
    );
  }

  if (state === 'loading' || state === 'idle') {
    return <div className="xp-profile xp-profile-loading" aria-busy="true" />;
  }
  if (state === 'error' || !shape) {
    return (
      <div className="xp-profile xp-profile-empty">
        <span>Profil altimétrique indisponible pour cette trace</span>
      </div>
    );
  }

  return (
    <div className="xp-profile">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Profil altimétrique : ${Math.round(shape.min)} à ${Math.round(shape.max)} mètres, ${shape.gain} mètres de dénivelé positif`}
      >
        <polygon points={`0,${height} ${shape.coords} 100,${height}`} fill="rgba(47, 111, 120, 0.16)" />
        <polyline
          points={shape.coords}
          fill="none"
          stroke="#2F6F78"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="xp-profile-legend">
        <span>{Math.round(shape.min)} m</span>
        <span>D+ {shape.gain} m</span>
        <span>{Math.round(shape.max)} m</span>
      </div>
    </div>
  );
}
