'use client';

import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { useFormContext } from 'react-hook-form';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFrShort(value: string | undefined): string {
  const d = parseIsoDate(value);
  if (!d) return 'Choisir';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const PRESETS = [
  { label: '1 jour', days: 1 },
  { label: 'Week-end · 2j', days: 2 },
  { label: '3 jours', days: 3 },
  { label: '5 jours', days: 5 },
  { label: '1 semaine', days: 7 },
] as const;

export interface DateRangeFieldV2Props {
  startName?: string;
  endName?: string;
  label?: string;
  onDaysPreset?: (days: number) => void;
}

/**
 * Sélecteur tactile de plage de dates (`react-day-picker`) avec raccourcis
 * horizontaux de durée pour éviter la saisie manuelle sur mobile.
 */
export function DateRangeFieldV2({
  startName = 'startDate',
  endName = 'endDate',
  label = 'Dates du carnet',
  onDaysPreset,
}: DateRangeFieldV2Props) {
  const form = useFormContext();
  const { haptic } = useHapticFeedback();
  const [open, setOpen] = useState(false);

  const startStr = form.watch(startName) as string | undefined;
  const endStr = form.watch(endName) as string | undefined;

  const selected = useMemo<DateRange | undefined>(() => {
    const from = parseIsoDate(startStr);
    const to = parseIsoDate(endStr);
    if (!from && !to) return undefined;
    return { from, to: to ?? from };
  }, [startStr, endStr]);

  const applyRange = (from: Date, to: Date) => {
    form.setValue(startName, toIsoDate(from), { shouldDirty: true, shouldValidate: true });
    form.setValue(endName, toIsoDate(to), { shouldDirty: true, shouldValidate: true });
    haptic('selection');
  };

  const applyPreset = (days: number) => {
    const base = parseIsoDate(startStr) ?? new Date();
    const end = new Date(base);
    end.setDate(base.getDate() + Math.max(0, days - 1));
    applyRange(base, end);
    onDaysPreset?.(days);
  };

  return (
    <div className="lkdv-cv2c-daterange" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="lkdv-cv2-field-label">{label}</span>
      <button
        type="button"
        className="lkdv-cv2c-date-trigger"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          haptic('light');
        }}
      >
        <span className="lkdv-cv2c-date-trigger-main">
          <CalendarIcon size={15} aria-hidden="true" />
          <span>
            {startStr
              ? `${formatFrShort(startStr)} → ${formatFrShort(endStr ?? startStr)}`
              : 'Choisir les dates sur le calendrier'}
          </span>
        </span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.16s ease' }}
        />
      </button>
      {open ? (
        <div className="lkdv-cv2c-calendar-pop">
          <DayPicker
            mode="range"
            locale={fr}
            selected={selected}
            style={
              {
                '--rdp-accent-color': '#172B24',
                '--rdp-accent-background-color': 'rgba(31, 74, 61, 0.12)',
                '--rdp-range_middle-background-color': 'rgba(31, 74, 61, 0.1)',
                '--rdp-range_middle-color': '#172B24',
                '--rdp-range_start-date-background-color': '#172B24',
                '--rdp-range_end-date-background-color': '#172B24',
                '--rdp-today-color': '#1F4A3D',
              } as React.CSSProperties
            }
            onSelect={(range) => {
              if (!range?.from) return;
              applyRange(range.from, range.to ?? range.from);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
