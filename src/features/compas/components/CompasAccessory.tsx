'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatKm, formatMeters } from '../engine/format';
import { pointAt, sparkPath, type ElevationProfile } from '../engine/elevation';

/**
 * Accessoire de la carte (maquette finale), volontairement minimal : altitude
 * maximale et profil réel du tracé. Glisser sur le profil (ou les flèches au
 * clavier) lit l'altitude au kilomètre. Sans profil : dénivelé et distance.
 */
export function CompasAccessory({
  profile,
  gainM,
  distanceKm,
  days,
  stepsCount,
}: {
  profile: ElevationProfile | null;
  gainM: number | null;
  distanceKm: number | null;
  days: number;
  stepsCount: number;
}) {
  const [t, setT] = useState<number | null>(null);

  if (!profile) {
    return (
      <div
        className="cp-acc cp-glass"
        aria-label={`${days} jour${days > 1 ? 's' : ''}, ${stepsCount} étape${stepsCount > 1 ? 's' : ''}`}
      >
        <span className="cp-acc__v">
          <b>D+ {formatMeters(gainM)}</b>
          <span>{formatKm(distanceKm)}</span>
        </span>
      </div>
    );
  }

  const total = profile.points[profile.points.length - 1].km;
  const at = t == null ? null : pointAt(profile, t);
  const cursor = at && total > 0 ? (at.km / total) * 100 : null;
  const fromEvent = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return r.width > 0 ? (e.clientX - r.left) / r.width : 0;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = t ?? (total > 0 ? profile.maxAtKm / total : 0);
      setT(Math.min(1, Math.max(0, cur + (e.key === 'ArrowRight' ? step : -step))));
    } else if (e.key === 'Escape') setT(null);
  };

  return (
    <div className="cp-acc cp-glass">
      <span className="cp-acc__v cp-acc__ro" aria-live="polite">
        <b>{formatMeters(at ? at.m : profile.maxM)}</b>
        <span>{at ? `km ${String(at.km.toFixed(1)).replace('.', ',')}` : 'max'}</span>
      </span>
      <svg
        className="cp-spk"
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        role="slider"
        tabIndex={0}
        aria-label="Profil d’altitude du parcours"
        aria-valuemin={0}
        aria-valuemax={Math.round(total * 10) / 10}
        aria-valuenow={at ? at.km : profile.maxAtKm}
        aria-valuetext={
          at
            ? `${at.m} m au km ${at.km}`
            : `Altitude maximale ${profile.maxM} m, minimale ${profile.minM} m (${profile.source})`
        }
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setT(fromEvent(e));
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'touch') setT(fromEvent(e));
        }}
        onPointerUp={() => setT(null)}
        onPointerCancel={() => setT(null)}
        onKeyDown={onKey}
        onBlur={() => setT(null)}
      >
        <title>{profile.source}</title>
        <path className="cp-spk__fill" d={`${sparkPath(profile)} L100 28 L0 28 Z`} />
        <path className="cp-spk__line" d={sparkPath(profile)} vectorEffect="non-scaling-stroke" />
        {cursor != null && (
          <line
            className="cp-spk__cur"
            x1={cursor}
            x2={cursor}
            y1={0}
            y2={28}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
