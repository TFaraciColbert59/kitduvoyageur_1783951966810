'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDay, CarnetMomentItem } from '@/features/carnet/detail/types';

/** Aucun moment : référence partagée, sinon la ligne se redessinerait pour rien. */
const NO_MOMENTS: CarnetMomentItem[] = [];

export interface CarnetDayRowProps {
  day: CarnetDay;
  /** Moments réels du jour, quand le volet les porte (sous-drawer Jours). */
  moments?: CarnetMomentItem[];
}

function kmText(value: number | null): string | null {
  return value !== null && Number.isFinite(value) && value > 0
    ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
    : null;
}

function dplusText(value: number | null): string | null {
  return value !== null && Number.isFinite(value) && value > 0
    ? `${value.toLocaleString('fr-FR')} m D+`
    : null;
}

/**
 * Ligne de jour : 56 px de haut, pastille 22, trait 1 px, et deux colonnes de
 * chiffres 12/600 tabulaires alignées à droite. Le récit, la durée, la météo,
 * la nuit et les moments restent sous la ligne : rien ne quitte la fiche.
 * Une valeur absente est un tiret, jamais un zéro inventé.
 */
function CarnetDayRowBase({ day, moments = NO_MOMENTS }: CarnetDayRowProps) {
  const distance = kmText(day.distanceKm);
  const dplus = dplusText(day.elevationM);
  const hasBody = Boolean(day.durationText || day.weather || day.note || day.overnight) || moments.length > 0;

  return (
    <article className="ckp-day">
      <div className="ckp-day-head">
        <div className="ckp-day-rail" aria-hidden="true">
          <span className="ckp-day-badge">{day.dayNumber}</span>
          <span className="ckp-day-line" />
        </div>
        <div className="ckp-day-id">
          <span className="ckp-day-label">{day.label}</span>
          {day.from || day.to ? (
            <b className="ckp-day-title">{[day.from, day.to].filter(Boolean).join(' → ')}</b>
          ) : null}
        </div>
        {distance || dplus ? (
          <div className="ckp-day-nums">
            <b>{distance ?? '—'}</b>
            <b>{dplus ?? '—'}</b>
          </div>
        ) : null}
      </div>

      {hasBody ? (
        <div className="ckp-day-body">
          {day.durationText || day.weather ? (
            <div className="ckp-day-meta">
              {day.durationText ? <span>{day.durationText}</span> : null}
              {day.weather ? <span>{day.weather}</span> : null}
            </div>
          ) : null}
          {day.note ? <p className="ckp-day-note">{day.note}</p> : null}
          {day.overnight ? <span className="ckp-day-overnight">Nuit · {day.overnight}</span> : null}
          {moments.length > 0 ? (
            <ul className="ckp-moment-list" aria-label={`Moments du jour ${day.dayNumber}`}>
              {moments.map((moment) => (
                <li key={moment.id}>
                  <Icon name="image-plus" size={12} aria-hidden="true" />
                  <span className="ckp-moment-txt">
                    <span className="ckp-moment-meta">
                      {[moment.time, moment.place].filter(Boolean).join(' · ') || 'Moment'}
                    </span>
                    {moment.caption ? <span className="ckp-moment-caption">{moment.caption}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Mémoïsée sur `day` et `moments`, tous deux stables (ils viennent des données
 * du carnet) : une bascule d'engagement ou un tri de commentaires ne redessine
 * aucune ligne de jour.
 */
export const CarnetDayRow = React.memo(CarnetDayRowBase);

export default CarnetDayRow;
