'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetEmpty } from '../CarnetStates';
import { CarnetDayRow } from './CarnetDayRow';

export interface CarnetEtapesPaneProps {
  detail: CarnetDetail;
}

/** Étapes réelles du carnet, dans la ligne de jour commune (48 px). */
export function CarnetEtapesPane({ detail }: CarnetEtapesPaneProps) {
  if (detail.etapes.length === 0) {
    return <CarnetEmpty icon={<Icon name="route" size={32} aria-hidden="true" />} label="Aucune étape" />;
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
