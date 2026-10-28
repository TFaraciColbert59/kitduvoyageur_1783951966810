/**
 * Contenu des trois volets du drawer Statistiques quand une page de **jour**
 * est active.
 *
 * Le volet d'un jour ne parle que de ce jour : sa distance, son allure, son
 * départ, son arrivée, son cumul, son D+ et ses points GPS. Aucun total de
 * carnet, aucune plage de dates, aucune moyenne : ces valeurs restent au
 * Résumé. Une donnée absente du jour rend `null` — l'affichage écrit alors un
 * tiret, jamais la valeur du carnet en repli.
 */

import { formatDayLabel, formatDuration } from './format';
import { cumulativeDistanceKm, dayPlaces, formatPace } from './dayinfo';
import type { CarnetDay, CarnetDetail } from './types';

export interface DayDrawerStats {
  /** Distance réelle du jour, `null` sous deux points GPS. */
  distanceKm: number | null;
  /** Allure réelle : durée ÷ distance du jour, `null` si l'une manque. */
  pace: string | null;
  /** Départ du jour : étape déclarée, sinon premier point GPS. */
  from: string | null;
  /** Arrivée du jour : étape déclarée, sinon dernier point GPS. */
  to: string | null;
  /** Distance cumulée depuis le départ, jour affiché inclus. */
  cumulativeKm: number | null;
  /** D+ réel du jour. */
  elevationM: number | null;
  /** Nombre de points GPS du jour, `0` quand le jour n'en porte aucun. */
  gpsPoints: number;
  /** Numéro du jour tel que le carnet le numérote. */
  dayNumber: number;
  /** `26 sept.` — la date du jour, `null` sans date réelle. */
  date: string | null;
  /** `6 h`, `4 h 30` — durée réelle du jour, `null` sans durée. */
  duration: string | null;
  /**
   * Récit du jour : celui de l'étape déclarée quand elle en porte un ; sinon
   * le récit global du carnet, affiché une seule fois.
   */
  story: string | null;
}

export function dayDrawerStats(detail: CarnetDetail, day: CarnetDay): DayDrawerStats {
  const etape = detail.etapes.find((entry) => entry.dayNumber === day.index) ?? null;
  const places = dayPlaces(day, detail.etapes);

  return {
    distanceKm: day.distanceKm,
    pace: formatPace(day.durationS, day.distanceKm),
    from: places.from,
    to: places.to,
    /* Le cumul additionne les seules distances réelles des jours précédents :
       le jour affiché n'emprunte jamais le total du carnet. */
    cumulativeKm: cumulativeDistanceKm(detail.days, day.index),
    elevationM: day.elevationM,
    gpsPoints: day.points.length,
    dayNumber: day.index,
    date: formatDayLabel(day.date),
    duration: formatDuration(day.durationS) ?? etape?.durationText ?? null,
    story: etape?.note ?? detail.description ?? null,
  };
}
