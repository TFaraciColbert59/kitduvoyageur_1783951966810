'use client';

import React from 'react';
import Link from 'next/link';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetStorySectionProps {
  detail: CarnetDetail;
}

function formatKm(value: number | null): string | null {
  if (!value || value <= 0) return null;
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

function formatElevation(value: number | null): string | null {
  if (!value || value <= 0) return null;
  return `${value.toLocaleString('fr-FR')} m D+`;
}

/** Récit complet et timeline des étapes. Aucune étape synthétique. */
export function CarnetStorySection({ detail }: CarnetStorySectionProps) {
  const isEmpty = !detail.description && detail.days.length === 0;

  return (
    <section id="ckp-recit" className="ckp-section" aria-labelledby="ckp-recit-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-recit-title">
          Récit
          {detail.days.length > 0 ? (
            <small>
              {detail.days.length} étape{detail.days.length > 1 ? 's' : ''}
            </small>
          ) : null}
        </h2>
      </div>

      {detail.description ? <p className="ckp-text">{detail.description}</p> : null}

      {detail.days.length > 0 ? (
        <div className="ckp-daylist">
          {detail.days.map((day) => {
            const km = formatKm(day.distanceKm);
            const elevation = formatElevation(day.elevationM);
            return (
              <article className="ckp-day" key={day.id}>
                <div className="ckp-day-rail">
                  <span className="ckp-day-badge">{day.dayNumber}</span>
                  <span className="ckp-day-line" aria-hidden="true" />
                </div>
                <div className="ckp-day-body">
                  <span className="ckp-day-label">{day.label}</span>
                  {day.from || day.to ? (
                    <b className="ckp-day-title">
                      {[day.from, day.to].filter(Boolean).join(' → ')}
                    </b>
                  ) : null}
                  <div className="ckp-day-meta">
                    {km ? <span>{km}</span> : null}
                    {elevation ? <span>{elevation}</span> : null}
                    {day.durationText ? <span>{day.durationText}</span> : null}
                    {day.weather ? <span>{day.weather}</span> : null}
                  </div>
                  {day.note ? <p className="ckp-day-note">{day.note}</p> : null}
                  {day.overnight ? (
                    <span className="ckp-day-overnight">Nuit · {day.overnight}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {isEmpty ? (
        <div
          className="ckp-empty"
          style={{ marginTop: 10, boxShadow: 'none', background: 'transparent', padding: '18px 0' }}
        >
          <b>Aucun récit pour l’instant.</b>
          <p>
            {detail.isOwner
              ? 'Complétez votre carnet pour raconter l’expédition.'
              : 'L’auteur n’a pas encore écrit le récit.'}
          </p>
          {detail.isOwner ? (
            <Link className="ckp-pill" href="/carnets">
              Modifier le carnet
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default CarnetStorySection;
