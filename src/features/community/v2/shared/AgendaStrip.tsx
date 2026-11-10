import React from 'react';
import type { AgendaCounts } from './types';
import { buildAgendaDays, formatDateFull } from './format';

export interface AgendaStripProps {
  /** Nombre de sorties par jour ISO (`YYYY-MM-DD`). */
  counts: AgendaCounts | null | undefined;
  /** Jour ISO sélectionné (filtre actif) ou `null`. */
  value: string | null;
  /** Toucher un jour filtre ; re-toucher le jour actif retire le filtre (`null`). */
  onChange: (iso: string | null) => void;
  /** Premier jour de la bande (défaut : aujourd'hui à Paris). */
  fromIso?: string;
  /** Nombre de jours affichés (défaut : 14). */
  days?: number;
  /** Libellé accessible du groupe. */
  label?: string;
  className?: string;
}

const MAX_DOTS = 3;

/**
 * Bande des 14 prochains jours en tête du volet Sorties.
 *
 * - un point par sortie (3 maximum par jour), aujourd'hui et week-ends marqués ;
 * - chaque jour est un bouton `aria-pressed` dont le libellé accessible donne la
 *   date complète en français et le nombre de sorties (« samedi 14 novembre ·
 *   2 sorties ») ;
 * - toucher un jour filtre la liste, re-toucher le jour actif retire le filtre ;
 * - défilement horizontal, cibles de 44 px, entièrement en jetons.
 */
export function AgendaStrip({
  counts,
  value,
  onChange,
  fromIso,
  days = 14,
  label = 'Agenda des prochains jours',
  className,
}: AgendaStripProps) {
  const items = buildAgendaDays(counts, fromIso, days);

  return (
    <div className={`lkdv-cv2-agenda${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {items.map((day) => {
        const active = value === day.iso;
        const dots = Math.min(day.count, MAX_DOTS);
        const fullDate = formatDateFull(`${day.iso}T12:00:00+01:00`);
        const countLabel =
          day.count > 0 ? `${day.count} ${day.count > 1 ? 'sorties' : 'sortie'}` : 'aucune sortie';
        const classes = [
          'lkdv-cv2-agenda-day',
          active ? 'is-active' : '',
          day.isToday ? 'is-today' : '',
          day.isWeekend ? 'is-weekend' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={day.iso}
            type="button"
            className={classes}
            aria-pressed={active}
            aria-label={`${fullDate} · ${countLabel}`}
            data-iso={day.iso}
            onClick={() => onChange(active ? null : day.iso)}
          >
            {/* Maquette (`.ag i`) : initiale du jour (D, L, M…) ; le nom complet est porté par le libellé du bouton. */}
            <i aria-hidden="true">{day.weekdayShort.charAt(0).toUpperCase()}</i>
            <b aria-hidden="true">{day.dayLabel}</b>
            <span className="lkdv-cv2-agenda-dots" aria-hidden="true">
              {Array.from({ length: dots }, (_, index) => (
                <u key={index} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default AgendaStrip;
