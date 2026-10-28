'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MAX_CAPSULE = 6;

/**
 * Choix du jour sur la carte. Jusqu'à 6 jours : sous-capsule de 30 px (une
 * cellule par jour, même grammaire que `DrawerShell`). Au-delà : « ‹ J7 › ».
 */
export function CarnetDaySelector({
  total,
  active,
  onChange,
}: {
  total: number;
  active: number;
  onChange: (day: number) => void;
}) {
  if (total <= 1) return null;

  if (total > MAX_CAPSULE) {
    return (
      <div className="lkdv-tr-daystep" role="group" aria-label="Jour affiché">
        <button type="button" aria-label="Jour précédent" disabled={active <= 1} onClick={() => onChange(active - 1)}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <output aria-live="polite">J{active}</output>
        <button type="button" aria-label="Jour suivant" disabled={active >= total} onClick={() => onChange(active + 1)}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="ig-tabs-float lkdv-drawer-secondary">
      <div className="ig-tabs" role="tablist" aria-label="Jour affiché" style={{ '--n': total } as React.CSSProperties}>
        <span className="ig-th lens" aria-hidden="true" style={{ transform: `translateX(${(active - 1) * 100}%)` }} />
        {Array.from({ length: total }, (_, index) => {
          const day = index + 1;
          return (
            <button key={day} type="button" role="tab" aria-selected={day === active} aria-label={`Jour ${day}`} onClick={() => onChange(day)}>
              <span aria-hidden="true">{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CarnetDaySelector;
