'use client';

import React, { useId } from 'react';
import './create-shared.css';

export interface DateRangeFieldProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  label?: string;
  startLabel?: string;
  endLabel?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Erreur externe (schéma), prioritaire sur la validation locale. */
  error?: string | null;
  idPrefix?: string;
}

/** Compare deux dates ISO `AAAA-MM-JJ` sans passer par les fuseaux. */
export function validateDateRange(start: string, end: string): string | null {
  if (!start || !end) return null;
  if (end < start) return 'La date de fin ne peut pas précéder la date de début.';
  return null;
}

/**
 * Plage de dates accessible, native (`input type="date"`).
 *
 * `react-day-picker` n’est pas installé dans ce lot : le champ natif reste le
 * contrôle le plus fiable au clavier et sur mobile. La validation locale est
 * immédiate et l’erreur est reliée aux deux champs via `aria-describedby`.
 */
export function DateRangeField({
  start,
  end,
  onStartChange,
  onEndChange,
  label = 'Dates',
  startLabel = 'Début',
  endLabel = 'Fin',
  min,
  max,
  disabled = false,
  error,
  idPrefix,
}: DateRangeFieldProps) {
  const reactId = useId();
  const prefix = idPrefix ?? `date-range-${reactId.replace(/:/g, '')}`;
  const startId = `${prefix}-start`;
  const endId = `${prefix}-end`;
  const errorId = `${prefix}-error`;
  const shownError = error ?? validateDateRange(start, end);
  const describedBy = shownError ? errorId : undefined;

  return (
    <fieldset className="lkdv-date-range">
      <legend>{label}</legend>
      <div className="lkdv-date-range-fields">
        <label htmlFor={startId}>
          <span className="lkdv-date-caption">{startLabel}</span>
          <input
            id={startId}
            type="date"
            aria-label={startLabel}
            value={start}
            min={min}
            max={max}
            disabled={disabled}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onStartChange(event.target.value)}
          />
        </label>
        <label htmlFor={endId}>
          <span className="lkdv-date-caption">{endLabel}</span>
          <input
            id={endId}
            type="date"
            aria-label={endLabel}
            value={end}
            min={start || min}
            max={max}
            disabled={disabled}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onEndChange(event.target.value)}
          />
        </label>
      </div>
      {shownError ? (
        <p className="lkdv-date-range-error" id={errorId} role="alert">
          {shownError}
        </p>
      ) : null}
    </fieldset>
  );
}

export default DateRangeField;
