'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

export interface PrepCalendarProps {
  /** Date selectionnee au format ISO `yyyy-mm-dd` (chaine vide si aucune). */
  value: string;
  onChange: (iso: string) => void;
  /** Date ISO minimale selectionnable (tout avant est desactive). */
  min?: string;
  /** Si renseigne, met en valeur l'intervalle `value` -> `rangeEnd`. */
  rangeEnd?: string | null;
}

/** Jour de la semaine, lundi = 0 (convention FR). */
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

const parseIso = (iso: string): Date => new Date(`${iso}T12:00:00`);
const toIso = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Lundi de la semaine qui contient `date`. */
const startOfWeek = (date: Date): Date => {
  const copy = new Date(date);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
};

const todayIso = (): string => toIso(new Date());

/**
 * Calendrier mensuel stylise (remplace l'<input type="date"> natif, illisible
 * et non stylable sur iOS). Pose en Liquid Glass : grille 7 colonnes, entetes
 * de jours, selection pleine, plage mise en valeur, desactivation du passe,
 * navigation mois par mois. Aucune donnee statique : la grille est calculee
 * depuis la vraie date du jour et la valeur reelle du draft.
 */
export function PrepCalendar({ value, onChange, min, rangeEnd }: PrepCalendarProps) {
  const today = todayIso();
  const floor = min ?? today;

  // Le mois affiche suit la valeur, et retombe sur le mois courant si vide.
  const [cursor, setCursor] = useState(() => {
    const base = value ? parseIso(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Quand la valeur change (ex. l'utilisateur vient de poser une date de
  // depart, ce qui recalcule la date de retour affichee par le second
  // calendrier), le mois affiche doit suivre la selection — sinon la grille
  // resterait bloquee sur le mois initial pendant que la valeur bouge.
  React.useEffect(() => {
    if (!value) return;
    const next = parseIso(value);
    setCursor((c) =>
      c.getFullYear() === next.getFullYear() && c.getMonth() === next.getMonth()
        ? c
        : new Date(next.getFullYear(), next.getMonth(), 1),
    );
  }, [value]);

  const selected = value ? parseIso(value) : null;
  const end = rangeEnd ? parseIso(rangeEnd) : null;

  // Grille : 6 semaines depuis le lundi precedent le 1er du mois.
  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const days: { iso: string; date: Date; disabled: boolean }[] = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const iso = toIso(date);
      days.push({ iso, date, disabled: iso < floor });
    }
    return days;
  }, [cursor, floor]);

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const canGoBack = toIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) > floor.slice(0, 8) + '01';

  const inRange = (iso: string) => {
    if (!selected || !end) return false;
    return iso > toIso(selected) && iso < toIso(end);
  };

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <div className="prepcal" role="group" aria-label="Calendrier">
      <div className="prepcal__head">
        <button
          type="button"
          className="prepcal__nav"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="Mois précédent"
        >
          <Icon name="ChevronLeftIcon" size={18} aria-hidden="true" />
        </button>
        <div className="prepcal__month" aria-live="polite">
          {monthLabel}
        </div>
        <button
          type="button"
          className="prepcal__nav"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
        >
          <Icon name="ChevronRightIcon" size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="prepcal__grid" role="grid">
        {WEEKDAYS.map((label, index) => (
          <div key={`${label}-${index}`} className="prepcal__weekday" role="columnheader">
            {label}
          </div>
        ))}
        {weeks.map(({ iso, date, disabled }) => {
          const outside = date.getMonth() !== cursor.getMonth();
          const isSelected = value === iso;
          const isToday = today === iso;
          const cls = [
            'prepcal__day',
            outside && 'is-outside',
            isSelected && 'is-selected',
            inRange(iso) && 'is-range',
            isToday && !isSelected && 'is-today',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              className={cls}
              disabled={disabled}
              onClick={() => onChange(iso)}
              aria-pressed={isSelected}
              aria-label={date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PrepCalendar;