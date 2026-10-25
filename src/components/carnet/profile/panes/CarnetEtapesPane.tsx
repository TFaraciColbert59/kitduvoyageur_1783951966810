'use client';

import React from 'react';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetEtapesPaneProps {
  detail: CarnetDetail;
}

function km(value: number | null) {
  return value && value > 0 ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : null;
}
function dplus(value: number | null) {
  return value && value > 0 ? `${value.toLocaleString('fr-FR')} m D+` : null;
}

export function CarnetEtapesPane({ detail }: CarnetEtapesPaneProps) {
  if (detail.days.length === 0) {
    return <p className="ckp-pane-empty">Aucune étape enregistrée.</p>;
  }

  return (
    <div className="ckp-pane">
      <div className="ckp-daylist">
        {detail.days.map((day) => (
          <article className="ckp-day" key={day.id}>
            <div className="ckp-day-rail">
              <span className="ckp-day-badge">{day.dayNumber}</span>
              <span className="ckp-day-line" aria-hidden="true" />
            </div>
            <div className="ckp-day-body">
              <span className="ckp-day-label">{day.label}</span>
              {day.from || day.to ? (
                <b className="ckp-day-title">{[day.from, day.to].filter(Boolean).join(' → ')}</b>
              ) : null}
              <div className="ckp-day-meta">
                {km(day.distanceKm) ? <span>{km(day.distanceKm)}</span> : null}
                {dplus(day.elevationM) ? <span>{dplus(day.elevationM)}</span> : null}
                {day.durationText ? <span>{day.durationText}</span> : null}
                {day.weather ? <span>{day.weather}</span> : null}
              </div>
              {day.note ? <p className="ckp-day-note">{day.note}</p> : null}
              {day.overnight ? <span className="ckp-day-overnight">Nuit · {day.overnight}</span> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default CarnetEtapesPane;
