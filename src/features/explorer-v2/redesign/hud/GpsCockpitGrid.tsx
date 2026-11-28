'use client';

import React from 'react';
import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import { formatPrimarySpeedMetric } from '../../specs/resolveActivityProfile';
import { TelemetryNumber, TelemetryNumberGroup } from '../primitives/TelemetryNumber';

export interface LiveTelemetrySnapshot {
  distanceM: number;
  movingS: number;
  elevGainM: number;
  elevLossM?: number;
  altitudeM?: number | null;
  heartRateBpm?: number | null;
  cadenceRpm?: number | null;
  powerW?: number | null;
  gradePct?: number | null;
  gapPaceMinKm?: number | null;
  co2SavedG?: number | null;
}

export interface GpsCockpitGridProps {
  profile: ActivityProfileSpec;
  telemetry: LiveTelemetrySnapshot;
  units?: 'metric' | 'imperial';
  customFieldOrder?: readonly string[] | null;
}

export const COCKPIT_FIELD_LABELS: Record<string, string> = {
  distance: 'Distance',
  duration: 'Durée',
  elev_gain: 'Dénivelé +',
  elev_loss: 'Dénivelé −',
  altitude: 'Altitude',
  pace_or_speed: 'Allure / Vitesse',
  gap: 'Allure GAP',
  vam: 'VAM',
  heart_rate: 'Fréq. cardiaque',
  cadence: 'Cadence',
  power: 'Puissance',
  grade: 'Pente',
  co2_saved: 'CO₂ évité',
};

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GpsCockpitGrid({
  profile,
  telemetry,
  units = 'metric',
  customFieldOrder = null,
}: GpsCockpitGridProps) {
  const fields = (
    customFieldOrder && customFieldOrder.length > 0
      ? customFieldOrder
      : profile.ui.cockpitGridFields
  ).slice(0, 6);

  const primarySpeed = formatPrimarySpeedMetric(profile, {
    distanceM: telemetry.distanceM,
    movingS: telemetry.movingS,
    elevGainM: telemetry.elevGainM,
    powerW: telemetry.powerW,
    units,
  });

  const renderFieldValue = (fieldId: string): React.ReactNode => {
    switch (fieldId) {
      case 'distance': {
        const val =
          units === 'imperial'
            ? Number((telemetry.distanceM / 1609.344).toFixed(2))
            : Number((telemetry.distanceM / 1000).toFixed(2));
        return (
          <TelemetryNumber
            value={val}
            decimals={2}
            suffix={units === 'imperial' ? ' mi' : ' km'}
          />
        );
      }
      case 'duration':
        return <span>{formatClock(telemetry.movingS)}</span>;
      case 'elev_gain':
        return <TelemetryNumber value={Math.round(telemetry.elevGainM)} prefix="+" suffix=" m" />;
      case 'elev_loss':
        return (
          <TelemetryNumber value={Math.round(telemetry.elevLossM ?? 0)} prefix="−" suffix=" m" />
        );
      case 'altitude':
        return (
          <TelemetryNumber
            value={
              telemetry.altitudeM !== null && telemetry.altitudeM !== undefined
                ? Math.round(telemetry.altitudeM)
                : 0
            }
            suffix=" m"
          />
        );
      case 'heart_rate':
        return (
          <TelemetryNumber
            value={telemetry.heartRateBpm ? Math.round(telemetry.heartRateBpm) : 0}
            suffix=" bpm"
          />
        );
      case 'cadence':
        return (
          <TelemetryNumber
            value={telemetry.cadenceRpm ? Math.round(telemetry.cadenceRpm) : 0}
            suffix=" rpm"
          />
        );
      case 'power':
        return (
          <TelemetryNumber
            value={telemetry.powerW ? Math.round(telemetry.powerW) : 0}
            suffix=" W"
          />
        );
      case 'grade':
        return telemetry.gradePct !== null && telemetry.gradePct !== undefined ? (
          <TelemetryNumber value={Number(telemetry.gradePct.toFixed(1))} decimals={1} suffix=" %" />
        ) : (
          <span>0,0 %</span>
        );
      case 'vam': {
        const vam =
          telemetry.movingS >= 30 && telemetry.elevGainM > 0
            ? Math.round(telemetry.elevGainM / (telemetry.movingS / 3600))
            : 0;
        return <TelemetryNumber value={vam} suffix=" m/h" />;
      }
      case 'co2_saved':
        return (
          <TelemetryNumber
            value={Number(((telemetry.co2SavedG ?? 0) / 1000).toFixed(2))}
            decimals={2}
            suffix=" kg"
          />
        );
      case 'gap':
        return telemetry.gapPaceMinKm ? (
          <span>{telemetry.gapPaceMinKm.toFixed(2)} /km</span>
        ) : (
          <span>
            {primarySpeed.valueText} {primarySpeed.unitLabel}
          </span>
        );
      default:
        return (
          <span>
            {primarySpeed.valueText} <span className="text-[12px]">{primarySpeed.unitLabel}</span>
          </span>
        );
    }
  };

  return (
    <TelemetryNumberGroup>
      <div
        data-testid="xp20-cockpit-grid"
        data-base-ui-swipe-ignore="x"
        className="grid grid-cols-2 gap-2"
      >
        {fields.map((fieldId) => (
          <div
            key={fieldId}
            className="flex flex-col justify-between rounded-2xl px-3 py-2.5"
            style={{
              background: 'var(--lkv-surface-elevated, #ffffff)',
              border: '0.5px solid var(--xp-hud-border)',
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--xp-hud-ink-muted)' }}
            >
              {COCKPIT_FIELD_LABELS[fieldId] ?? fieldId}
            </span>
            <strong
              className="mt-1 text-[20px] font-black leading-tight tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--xp-hud-ink)' }}
            >
              {renderFieldValue(fieldId)}
            </strong>
          </div>
        ))}
      </div>
    </TelemetryNumberGroup>
  );
}
