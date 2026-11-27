'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Compass, Pause, Play, Sparkles, Sun, X } from 'lucide-react';
import type { ClubMapOutingTrack } from './clubMapTypes';
import {
  computeNearbyAlpinePeaks,
  computeTrackSlopeAt,
  type NearbyAlpinePeak,
} from './clubCameraChoreography';
import { snapPointAlongTrack } from './clubTrackGeometry';

export interface ClubOutingScrubberHudProps {
  outing: ClubMapOutingTrack;
  progress: number;
  onScrub: (nextProgress: number) => void;
  isDronePlaying: boolean;
  onToggleDrone: () => void;
  isSummit360Active: boolean;
  onToggleSummit360: () => void;
  solarHour: number | null;
  onSolarHourChange: (hour: number | null) => void;
  pillarsEnabled: boolean;
  onTogglePillars: () => void;
  bearing: number;
  onFocusPeak?: (peak: NearbyAlpinePeak) => void;
  onCloseOuting?: () => void;
  hidden?: boolean;
}

function formatHourLabel(hour: number): string {
  const whole = Math.floor(hour);
  const mins = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, '0')}h${mins > 0 ? String(mins).padStart(2, '0') : ''}`;
}

export function ClubOutingScrubberHud({
  outing,
  progress,
  onScrub,
  isDronePlaying,
  onToggleDrone,
  isSummit360Active,
  onToggleSummit360,
  solarHour,
  onSolarHourChange,
  pillarsEnabled,
  onTogglePillars,
  bearing,
  onFocusPeak,
  onCloseOuting,
  hidden = false,
}: ClubOutingScrubberHudProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [solarOpen, setSolarOpen] = useState(false);

  const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  const profileSvg = useMemo(() => {
    const coords = outing.coords;
    if (coords.length < 2) {
      return {
        linePath: 'M 0 28 L 240 28',
        areaPath: 'M 0 36 L 0 28 L 240 28 L 240 36 Z',
        minEle: 1000,
        maxEle: outing.maxAlt || 2400,
      };
    }
    const eles = coords.map((pt, idx) =>
      typeof pt[2] === 'number' && Number.isFinite(pt[2])
        ? pt[2]
        : Math.round(1200 + Math.sin((idx / (coords.length - 1)) * Math.PI) * Math.max(300, outing.dplus || 800)),
    );
    const minEle = Math.min(...eles);
    const maxEle = Math.max(...eles);
    const span = Math.max(40, maxEle - minEle);

    const w = 240;
    const h = 34;
    const padTop = 4;
    const padBottom = 4;

    const pts = eles.map((ele, idx) => {
      const x = (idx / (eles.length - 1)) * w;
      const y = h - padBottom - ((ele - minEle) / span) * (h - padTop - padBottom);
      return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
    });

    const linePath = pts.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
    const areaPath = `M 0 ${h} ${pts.map(([x, y]) => `L ${x} ${y}`).join(' ')} L ${w} ${h} Z`;
    return { linePath, areaPath, minEle, maxEle };
  }, [outing.coords, outing.dplus, outing.maxAlt]);

  const currentPoint = useMemo(
    () => snapPointAlongTrack(outing.coords, clampedProgress),
    [outing.coords, clampedProgress],
  );
  const currentSlope = useMemo(
    () => Math.round(computeTrackSlopeAt(outing.coords, clampedProgress)),
    [outing.coords, clampedProgress],
  );

  const nearbyPeaks = useMemo(() => {
    if (!isSummit360Active) return [];
    return computeNearbyAlpinePeaks(outing.peak[0], outing.peak[1], 5);
  }, [isSummit360Active, outing.peak]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const next = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onScrub(next);
    },
    [onScrub],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.buttons & 1) === 0 && event.pointerType === 'mouse') return;
      if (event.buttons === 0 && event.pointerType !== 'touch') return;
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        onScrub(Math.min(1, clampedProgress + 0.05));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        onScrub(Math.max(0, clampedProgress - 0.05));
      }
    },
    [clampedProgress, onScrub],
  );

  if (hidden) return null;

  const currentEle = Math.round(currentPoint[2] || outing.maxAlt);
  const currentKm = (outing.km * clampedProgress).toFixed(1);
  const dotY =
    34 -
    4 -
    ((currentEle - profileSvg.minEle) / Math.max(40, profileSvg.maxEle - profileSvg.minEle)) * 26;

  return (
    <div
      className="lkdv-map-scrubber"
      role="region"
      aria-label={`Profil 3D de ${outing.title}`}
    >
      <div className="lkdv-map-scrubber-head">
        <div className="lkdv-map-scrubber-title">
          <strong>{outing.title}</strong>
          <span>
            {currentKm}/{outing.km} km · {currentEle} m
            {currentSlope !== 0 ? ` · ${currentSlope > 0 ? '+' : ''}${currentSlope}%` : ''}
          </span>
        </div>
        {onCloseOuting ? (
          <button
            type="button"
            className="lkdv-map-scrubber-close"
            onClick={onCloseOuting}
            aria-label="Quitter la trace active"
            title="Quitter la trace active"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div
        ref={trackRef}
        className="lkdv-map-scrubber-profile"
        role="slider"
        tabIndex={0}
        aria-label="Position sur le profil altimétrique"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedProgress * 100)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      >
        <svg viewBox="0 0 240 34" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="lkdv-ele-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(91, 127, 85, 0.5)" />
              <stop offset="100%" stopColor="rgba(91, 127, 85, 0.04)" />
            </linearGradient>
          </defs>
          <path d={profileSvg.areaPath} fill="url(#lkdv-ele-fill)" />
          <path
            d={profileSvg.linePath}
            fill="none"
            stroke="#17402C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={clampedProgress * 240}
            y1="2"
            x2={clampedProgress * 240}
            y2="34"
            stroke="#e09f3e"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <circle
            cx={clampedProgress * 240}
            cy={Math.max(4, Math.min(30, dotY))}
            r="4"
            fill="#f5c451"
            stroke="#17402C"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="lkdv-map-scrubber-actions">
        <button
          type="button"
          className={`lkdv-map-scrubber-btn${isDronePlaying ? ' is-active' : ''}`}
          aria-pressed={isDronePlaying}
          onClick={onToggleDrone}
        >
          {isDronePlaying ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
          <span>{isDronePlaying ? 'Pause' : 'Drone 3D'}</span>
        </button>

        <button
          type="button"
          className={`lkdv-map-scrubber-btn${isSummit360Active ? ' is-active' : ''}`}
          aria-pressed={isSummit360Active}
          onClick={onToggleSummit360}
        >
          <Compass size={12} aria-hidden="true" />
          <span>360°</span>
        </button>

        <button
          type="button"
          className={`lkdv-map-scrubber-btn${pillarsEnabled ? ' is-active' : ''}`}
          aria-pressed={pillarsEnabled}
          onClick={onTogglePillars}
          title="Piliers lumineux 3D Three.js"
        >
          <Sparkles size={12} aria-hidden="true" />
          <span>Piliers</span>
        </button>

        <button
          type="button"
          className={`lkdv-map-scrubber-btn${solarOpen || solarHour !== null ? ' is-active' : ''}`}
          aria-expanded={solarOpen}
          onClick={() => {
            if (!solarOpen && solarHour === null) onSolarHourChange(10);
            setSolarOpen((prev) => !prev);
          }}
        >
          <Sun size={12} aria-hidden="true" />
          <span>{solarHour !== null ? formatHourLabel(solarHour) : 'Ombre'}</span>
        </button>
      </div>

      {solarOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="lkdv-map-solar-row">
            <span className="lkdv-map-solar-label">
              ☀️ {solarHour !== null ? formatHourLabel(solarHour) : '13h'}
            </span>
            <input
              type="range"
              min={6}
              max={21}
              step={0.5}
              value={solarHour ?? 13}
              aria-label="Heure d'illumination solaire du relief 3D"
              onChange={(e) => onSolarHourChange(parseFloat(e.target.value))}
            />
            {solarHour !== null ? (
              <button
                type="button"
                className="lkdv-map-solar-reset"
                onClick={() => {
                  onSolarHourChange(null);
                  setSolarOpen(false);
                }}
              >
                Auto
              </button>
            ) : null}
          </div>
          {solarHour !== null ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 10.5,
                fontWeight: 600,
                color: '#1f427a',
                padding: '0 2px',
              }}
            >
              <span>
                Soleil :{' '}
                {solarHour < 10
                  ? 'Est'
                  : solarHour < 12
                    ? 'Sud-Est'
                    : solarHour < 14
                      ? 'Sud'
                      : solarHour < 17
                        ? 'Sud-Ouest'
                        : 'Ouest'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#0a1e4a',
                    display: 'inline-block',
                  }}
                />
                Versants à l’ombre :{' '}
                {solarHour < 10
                  ? 'O / NO'
                  : solarHour < 12
                    ? 'NO / N'
                    : solarHour < 14
                      ? 'Nord'
                      : solarHour < 17
                        ? 'N / NE'
                        : 'E / SE'}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {isSummit360Active && nearbyPeaks.length > 0 ? (
        <div className="lkdv-map-summit-strip" aria-label="Table d'orientation 360°">
          {nearbyPeaks.map((pk) => {
            const angularDiff = Math.abs((((pk.bearing - bearing) % 360) + 540) % 360 - 180);
            const inFront = angularDiff <= 38;
            return (
              <button
                key={pk.id}
                type="button"
                className={`lkdv-map-summit-chip${inFront ? ' is-front' : ''}`}
                onClick={() => onFocusPeak?.(pk)}
                title={`${pk.name} (${pk.alt} m) · ${pk.distanceKm} km · ${pk.bearing}°`}
              >
                <span>🏔️ {pk.name}</span>
                <b>{pk.distanceKm} km</b>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default ClubOutingScrubberHud;
