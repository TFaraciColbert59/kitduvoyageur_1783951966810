'use client';

import React, { useId } from 'react';
import styles from './media-sharing.module.css';
import { projectPointInBounds, projectPoints, type LatLng } from './geometry';

export type MapPinTone = 'media' | 'meeting' | 'camera' | 'start' | 'finish';

export interface MapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  tone?: MapPinTone;
}

export interface TrackMiniMapProps {
  points: readonly LatLng[];
  pins?: readonly MapPin[];
  selectedPinId?: string | null;
  onSelectPin?: (pinId: string) => void;
  ariaLabel: string;
  height?: number;
  className?: string;
}

export function TrackMiniMap({
  points,
  pins = [],
  selectedPinId = null,
  onSelectPin,
  ariaLabel,
  height = 190,
  className = '',
}: TrackMiniMapProps) {
  const gradientId = useId().replace(/:/g, '');
  const width = 340;
  const projected = projectPoints(points, width, height, 22);

  if (projected.points.length === 0) {
    return (
      <div className={`${styles.mapEmpty} ${className}`} role="img" aria-label={ariaLabel}>
        <span>Trace non disponible</span>
      </div>
    );
  }

  const first = projected.points[0];
  const last = projected.points[projected.points.length - 1];
  const pinPositions = pins
    .map((pin) => {
      const location = projectPointInBounds(
        { lat: pin.lat, lng: pin.lng },
        projected.bounds,
        width,
        height,
        22,
      );
      return location ? { pin, location } : null;
    })
    .filter((entry): entry is { pin: MapPin; location: { x: number; y: number } } => entry !== null);

  return (
    <div className={`${styles.mapFrame} ${className}`}>
      <svg
        className={styles.mapSvg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lkv-forest-100)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--lkv-forest-50)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill={`url(#${gradientId})`} rx="18" />
        {Array.from({ length: 5 }).map((_, index) => (
          <line
            key={`h-${index}`}
            x1="0"
            x2={width}
            y1={(height / 5) * index}
            y2={(height / 5) * index}
            className={styles.mapGrid}
          />
        ))}
        {Array.from({ length: 7 }).map((_, index) => (
          <line
            key={`v-${index}`}
            y1="0"
            y2={height}
            x1={(width / 7) * index}
            x2={(width / 7) * index}
            className={styles.mapGrid}
          />
        ))}
        <path d={projected.path} className={styles.trackHalo} />
        <path d={projected.path} className={styles.trackLine} />
        <circle cx={first.x} cy={first.y} r="4.5" className={styles.trackStart} />
        <circle cx={last.x} cy={last.y} r="5.5" className={styles.trackFinish} />
      </svg>
      {pinPositions.map(({ pin, location }) => (
        <button
          key={pin.id}
          type="button"
          className={styles.mapPin}
          data-tone={pin.tone ?? 'media'}
          data-selected={selectedPinId === pin.id ? 'true' : 'false'}
          style={{
            left: `${(location.x / width) * 100}%`,
            top: `${(location.y / height) * 100}%`,
          }}
          aria-label={pin.label}
          aria-pressed={selectedPinId === null ? undefined : selectedPinId === pin.id}
          onClick={onSelectPin ? () => onSelectPin(pin.id) : undefined}
          disabled={!onSelectPin}
        >
          <span className={styles.mapPinDot} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
