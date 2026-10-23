import type { compasUnitsFr } from './compas-units.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas.units` (DE). Même forme que `compas-units.fr.ts`. */
export const compasUnitsDe: Shape<typeof compasUnitsFr> = {
  units: {
    atPoint: '{altitude} bei {distance}',
    maxMin: 'Höchster Punkt {max}, tiefster {min} ({source})',
    away: '{distance} entfernt',
    freezingAt: '{temp} auf {altitude}',
    carriesOf: 'trägt {weight} von {capacity}',
    ofCapacity: 'von {capacity}',
    distanceTrack: '{distance} vom Weg',
    distanceStage: '{distance} von der Etappe',
    waterRule:
      'Faustregel: {perHour} pro Gehstunde, {perHourHot} über {temp} (Vorhersage für diesen Tag). Eine Quelle aus OpenStreetMap kann versiegt sein: Prüfen Sie sie, bevor Sie sich darauf verlassen.',
  },
};
