import type { compasUnitsFr } from './compas-units.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas.units` (ES). Même forme que `compas-units.fr.ts`. */
export const compasUnitsEs: Shape<typeof compasUnitsFr> = {
  units: {
    atPoint: '{altitude} a {distance}',
    maxMin: 'Punto más alto {max}, más bajo {min} ({source})',
    away: 'a {distance}',
    freezingAt: '{temp} a {altitude}',
    carriesOf: 'lleva {weight} de {capacity}',
    ofCapacity: 'de {capacity}',
    distanceTrack: 'a {distance} del trazado',
    distanceStage: 'a {distance} de la etapa',
    waterRule:
      'Referencia: {perHour} por hora de marcha, {perHourHot} por encima de {temp} (previsión de ese día). Una fuente de OpenStreetMap puede estar seca: compruébela antes de contar con ella.',
  },
};
