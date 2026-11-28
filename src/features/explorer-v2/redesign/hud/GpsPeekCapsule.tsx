'use client';

import React from 'react';
import { Camera, ChevronUp, Lock, MapPin, Pause, Play } from 'lucide-react';
import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import { formatPrimarySpeedMetric } from '../../specs/resolveActivityProfile';
import { HoldToConfirmButton } from '../primitives/HoldToConfirmButton';
import { TelemetryNumber, TelemetryNumberGroup } from '../primitives/TelemetryNumber';

export interface GpsPeekCapsuleProps {
  profile: ActivityProfileSpec;
  distanceM: number;
  movingS: number;
  elevGainM: number;
  paused: boolean;
  rainLockActive?: boolean;
  units?: 'metric' | 'imperial';
  powerW?: number | null;
  onTogglePause: () => void;
  onCapturePhoto?: () => void;
  onMarkWaypoint: () => void;
  onExpandCockpit: () => void;
  onUnlockRainLock?: () => void;
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Lot 07 — Capsule Peek (Detent 1, ~136 px) :
 * 3 KPIs essentiels + 3 gestes terrain (Pause, Photo, Repère) sans jamais encombrer la carte.
 * Sous pluie battante (`rainLockActive`), verrouille les taps accidentels et affiche un bouton maintien 1,5 s.
 */
export function GpsPeekCapsule({
  profile,
  distanceM,
  movingS,
  elevGainM,
  paused,
  rainLockActive = false,
  units = 'metric',
  powerW = null,
  onTogglePause,
  onCapturePhoto,
  onMarkWaypoint,
  onExpandCockpit,
  onUnlockRainLock,
}: GpsPeekCapsuleProps) {
  const distDisplay =
    units === 'imperial'
      ? { value: Number((distanceM / 1609.344).toFixed(2)), decimals: 2, suffix: ' mi' }
      : distanceM < 1000
        ? { value: Math.round(distanceM), decimals: 0, suffix: ' m' }
        : { value: Number((distanceM / 1000).toFixed(2)), decimals: 2, suffix: ' km' };

  const primarySpeed = formatPrimarySpeedMetric(profile, {
    distanceM,
    movingS,
    elevGainM,
    powerW,
    units,
  });

  return (
    <div
      data-testid="xp20-gps-peek-capsule"
      className="flex flex-col gap-2.5"
      style={{ minHeight: 118 }}
    >
      {/* 3 Hero KPIs */}
      <TelemetryNumberGroup>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center">
            <span className="text-[22px] font-black leading-none tracking-tight">
              <TelemetryNumber
                value={distDisplay.value}
                decimals={distDisplay.decimals}
                suffix={distDisplay.suffix}
              />
            </span>
            <span
              className="mt-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--xp-hud-ink-muted)' }}
            >
              Distance
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span
              className="text-[22px] font-black leading-none tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatClock(movingS)}
            </span>
            <span
              className="mt-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--xp-hud-ink-muted)' }}
            >
              {paused ? 'En pause' : 'Durée'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span
              className="text-[22px] font-black leading-none tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {primarySpeed.valueText}
              <span className="ml-0.5 text-[11px] font-bold">{primarySpeed.unitLabel}</span>
            </span>
            <span
              className="mt-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--xp-hud-ink-muted)' }}
            >
              {primarySpeed.unitKind === 'm_per_h_vam' ? 'VAM' : 'Allure / Vit.'}
            </span>
          </div>
        </div>
      </TelemetryNumberGroup>

      {/* Controls or Rain-Lock unlock */}
      {rainLockActive ? (
        <div className="flex items-center justify-center pt-0.5">
          <HoldToConfirmButton
            label="Déverrouiller écran pluie"
            holdHint="Maintenir 1,5 s"
            holdMs={1500}
            tone="neutral"
            icon={<Lock size={15} aria-hidden="true" />}
            onConfirm={() => onUnlockRainLock?.()}
            className="w-full"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? 'Reprendre la sortie' : 'Mettre en pause'}
            className="xp20-hud-btn flex flex-1 items-center justify-center gap-2 text-[14px] font-extrabold"
            style={{
              background: 'var(--xp-hud-accent)',
              color: 'var(--xp-hud-accent-fg)',
            }}
          >
            {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            <span>{paused ? 'Reprendre' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={onMarkWaypoint}
            aria-label="Poser un repère"
            className="xp20-hud-btn inline-flex items-center justify-center px-3.5"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              color: 'var(--xp-hud-ink)',
            }}
          >
            <MapPin size={17} aria-hidden="true" />
          </button>

          {onCapturePhoto ? (
            <button
              type="button"
              onClick={onCapturePhoto}
              aria-label="Prendre une photo géolocalisée"
              className="xp20-hud-btn inline-flex items-center justify-center px-3.5"
              style={{
                background: 'var(--lkv-surface-muted, #edf1ea)',
                color: 'var(--xp-hud-ink)',
              }}
            >
              <Camera size={17} aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onExpandCockpit}
            aria-label="Ouvrir le cockpit complet"
            className="xp20-hud-btn inline-flex items-center justify-center px-3"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              color: 'var(--xp-hud-ink)',
            }}
          >
            <ChevronUp size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
