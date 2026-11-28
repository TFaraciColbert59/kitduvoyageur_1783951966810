'use client';

import React from 'react';
import NumberFlow, { NumberFlowGroup } from '@number-flow/react';

export interface TelemetryNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Lot 07 — Chiffre télémétrique odomètre iOS basé sur `@number-flow/react` (déjà installé).
 * Zéro saut de mise en page (`tabular-nums`), respecte `prefers-reduced-motion`.
 */
export function TelemetryNumber({
  value,
  decimals = 0,
  prefix,
  suffix,
  className,
  ariaLabel,
}: TelemetryNumberProps) {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <span
      className={className}
      aria-label={ariaLabel}
      style={{ fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'baseline' }}
    >
      <NumberFlow
        value={safe}
        locales="fr-FR"
        format={{
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }}
        prefix={prefix}
        suffix={suffix}
        respectMotionPreference
      />
    </span>
  );
}

export { NumberFlowGroup as TelemetryNumberGroup };
