'use client';

import React from 'react';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetDayRow } from './CarnetDayRow';

export interface CarnetEtapesPaneProps {
  detail: CarnetDetail;
}

/** Étapes réelles du carnet, dans la ligne de jour commune (56 px). */
export function CarnetEtapesPane({ detail }: CarnetEtapesPaneProps) {
  if (detail.etapes.length === 0) {
    return <p className="ckp-pane-empty">Aucune étape enregistrée.</p>;
  }

  return (
    <div className="ckp-pane">
      <div className="ckp-daylist">
        {detail.etapes.map((day) => (
          <CarnetDayRow key={day.id} day={day} />
        ))}
      </div>
    </div>
  );
}

export default CarnetEtapesPane;
