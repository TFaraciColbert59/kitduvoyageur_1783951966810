import type { compasUnitsFr } from './compas-units.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas.units` (EN). Même forme que `compas-units.fr.ts`. */
export const compasUnitsEn: Shape<typeof compasUnitsFr> = {
  units: {
    atPoint: '{altitude} at {distance}',
    maxMin: 'Highest point {max}, lowest {min} ({source})',
    away: '{distance} away',
    freezingAt: '{temp} at {altitude}',
    carriesOf: 'carrying {weight} of {capacity}',
    ofCapacity: 'of {capacity}',
    distanceTrack: '{distance} from the track',
    distanceStage: '{distance} from the stage',
    waterRule:
      'Rule of thumb: {perHour} per hour of walking, {perHourHot} above {temp} (that day’s forecast). An OpenStreetMap spring may have run dry, so check before relying on it.',
  },
};
