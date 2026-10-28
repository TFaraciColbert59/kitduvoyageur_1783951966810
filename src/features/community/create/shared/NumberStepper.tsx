'use client';

import React, { useId } from 'react';
import './create-shared.css';

export interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Stepper accessible : boutons − / +, saisie directe, bornes annoncées.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  disabled = false,
  id,
}: NumberStepperProps) {
  const reactId = useId();
  const inputId = id ?? `stepper-${reactId.replace(/:/g, '')}`;
  const labelId = `${inputId}-label`;

  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  const set = (next: number) => {
    if (Number.isFinite(next)) onChange(clamp(next));
  };

  return (
    <div className="lkdv-number-stepper" role="group" aria-labelledby={labelId}>
      <span id={labelId}>{label}</span>
      <div className="lkdv-number-stepper-row">
        <button
          type="button"
          aria-label={`Diminuer ${label}`}
          disabled={disabled || value <= min}
          onClick={() => set(value - step)}
        >
          −
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) set(next);
          }}
          onBlur={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) set(next);
          }}
        />
        <button
          type="button"
          aria-label={`Augmenter ${label}`}
          disabled={disabled || value >= max}
          onClick={() => set(value + step)}
        >
          +
        </button>
        {unit ? <span className="lkdv-number-stepper-unit">{unit}</span> : null}
      </div>
    </div>
  );
}

export default NumberStepper;
