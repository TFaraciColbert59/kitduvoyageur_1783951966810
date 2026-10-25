import type { compasUnitsFr } from './compas-units.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas.units` (IT). Même forme que `compas-units.fr.ts`. */
export const compasUnitsIt: Shape<typeof compasUnitsFr> = {
  units: {
    atPoint: '{altitude} a {distance}',
    maxMin: 'Punto più alto {max}, più basso {min} ({source})',
    away: 'a {distance}',
    freezingAt: '{temp} a {altitude}',
    carriesOf: 'porta {weight} su {capacity}',
    ofCapacity: 'su {capacity}',
    distanceTrack: 'a {distance} dal tracciato',
    distanceStage: 'a {distance} dalla tappa',
    waterRule:
      'Regola indicativa: {perHour} per ora di cammino, {perHourHot} sopra {temp} (previsione di quel giorno). Una sorgente di OpenStreetMap può essere secca: la verifichi prima di contarci.',
  },
};
