'use client';

import React, { useId } from 'react';
import { useFormContext } from 'react-hook-form';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface DateRangeFieldV2Props {
  startName?: string;
  endName?: string;
  label?: string;
  onDaysPreset?: (days: number) => void;
  onDatesChange?: (start: string, end: string) => void;
}

/**
 * Sélecteur de plage de dates utilisant les pickers natifs iOS (`<input type="date">`).
 */
export function DateRangeFieldV2({
  startName = 'startDate',
  endName = 'endDate',
  label = 'Dates du carnet',
  onDatesChange,
}: DateRangeFieldV2Props) {
  const form = useFormContext();
  const { haptic } = useHapticFeedback();
  const baseId = useId();

  const startStr = (form.watch(startName) as string | undefined) ?? '';
  const endStr = (form.watch(endName) as string | undefined) ?? '';

  const handleStart = (nextStart: string) => {
    const nextEnd = !endStr || (nextStart && endStr < nextStart) ? nextStart : endStr;
    form.setValue(startName, nextStart, { shouldDirty: true, shouldValidate: true });
    if (nextEnd !== endStr) {
      form.setValue(endName, nextEnd, { shouldDirty: true, shouldValidate: true });
    }
    onDatesChange?.(nextStart, nextEnd);
    haptic('selection');
  };

  const handleEnd = (nextEnd: string) => {
    const clampedEnd = startStr && nextEnd && nextEnd < startStr ? startStr : nextEnd;
    form.setValue(endName, clampedEnd, { shouldDirty: true, shouldValidate: true });
    onDatesChange?.(startStr, clampedEnd);
    haptic('selection');
  };

  return (
    <div className="lkdv-cv2c-daterange" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="lkdv-cv2-field-label">{label}</span>
      <div className="lkdv-cv2c-row-2">
        <div className="lkdv-cv2-field">
          <label className="lkdv-cv2-field-label" htmlFor={`${baseId}-start`}>
            Début
          </label>
          <input
            id={`${baseId}-start`}
            type="date"
            className="lkdv-cv2-input"
            value={startStr}
            onChange={(e) => handleStart(e.target.value)}
          />
        </div>
        <div className="lkdv-cv2-field">
          <label className="lkdv-cv2-field-label" htmlFor={`${baseId}-end`}>
            Fin
          </label>
          <input
            id={`${baseId}-end`}
            type="date"
            className="lkdv-cv2-input"
            value={endStr}
            min={startStr || undefined}
            onChange={(e) => handleEnd(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default DateRangeFieldV2;
