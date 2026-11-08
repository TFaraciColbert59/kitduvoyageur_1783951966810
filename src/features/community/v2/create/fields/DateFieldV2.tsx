'use client';

import React from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FieldV2 } from './FieldV2';

/**
 * Dates et heures V2 : `input type="date"` / `time` en 16 px, libellés
 * visibles, une seule erreur. Le groupe date+heure d'une sortie est validé une
 * fois (`Sortie#16`).
 */
export function DateFieldV2({
  name,
  label,
  hint,
  required,
  min,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  min?: string;
  className?: string;
}) {
  const form = useFormContext();
  return (
    <FieldV2 name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="lkdv-cv2c-date">
          <CalendarDays size={16} aria-hidden="true" />
          <input
            id={id}
            type="date"
            min={min}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="lkdv-cv2-input"
            {...form.register(name)}
          />
        </div>
      )}
    </FieldV2>
  );
}

export function TimeFieldV2({
  name,
  label,
  hint,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  className?: string;
}) {
  const form = useFormContext();
  return (
    <FieldV2 name={name} label={label} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="lkdv-cv2c-date">
          <Clock size={16} aria-hidden="true" />
          <input
            id={id}
            type="time"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="lkdv-cv2-input"
            {...form.register(name)}
          />
        </div>
      )}
    </FieldV2>
  );
}

/** Paire début/fin (carnet, sortie) : deux champs, deux messages au plus. */
export function DateRangeV2({
  startName,
  endName,
  startLabel = 'Début',
  endLabel = 'Fin',
  hint,
}: {
  startName: string;
  endName: string;
  startLabel?: string;
  endLabel?: string;
  hint?: string;
}) {
  return (
    <div className="lkdv-cv2c-date-range">
      <DateFieldV2 name={startName} label={startLabel} />
      <DateFieldV2 name={endName} label={endLabel} hint={hint} />
    </div>
  );
}
