'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FieldV2 } from './FieldV2';

/** Stepper numérique V2 : boutons 44 px, valeur lisible, bornes visibles (`Sortie#8`). */
export function NumberStepperV2({
  name,
  label,
  min = 0,
  max = 99,
  step = 1,
  unit,
  hint,
  className,
}: {
  name: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  className?: string;
}) {
  const form = useFormContext();
  const raw = form.watch(name);
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : min;
  const setValue = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    form.setValue(name, clamped, { shouldDirty: true, shouldValidate: true });
  };
  return (
    <FieldV2 name={name} label={label} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <div className="lkdv-cv2c-stepper-row">
          <div className="lkdv-cv2-stepper" data-field={name} aria-describedby={describedBy}>
            <button
              type="button"
              onClick={() => setValue(value - step)}
              disabled={value <= min}
              aria-label={`Diminuer ${label}`}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <output id={id} aria-live="polite">
              {value}
              {unit ? <span className="lkdv-cv2c-unit">{unit}</span> : null}
            </output>
            <button
              type="button"
              onClick={() => setValue(value + step)}
              disabled={value >= max}
              aria-label={`Augmenter ${label}`}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <span className="lkdv-cv2-field-hint">
            {min} – {max}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      )}
    </FieldV2>
  );
}

/** Champ numérique simple (poids en g) avec suffixe lisible. */
export function NumberFieldV2({
  name,
  label,
  min = 0,
  max = 60_000,
  step = 1,
  unit,
  placeholder,
  hint,
  className,
}: {
  name: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const form = useFormContext();
  return (
    <FieldV2 name={name} label={label} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="lkdv-cv2c-number-row">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="lkdv-cv2-input"
            {...form.register(name, { valueAsNumber: true })}
          />
          {unit ? <span className="lkdv-cv2c-unit lkdv-cv2c-number-unit">{unit}</span> : null}
        </div>
      )}
    </FieldV2>
  );
}
