/**
 * Informations d'une page de jour — dérivées de la donnée réelle seulement.
 *
 * Chaque valeur vient d'un champ lu en base (jour, étapes, moments, points GPS,
 * totaux). Une valeur absente rend `null` ; l'affichage écrit alors un tiret
 * cadratin, jamais un zéro ni une estimation. Aucune phrase : des libellés et
 * des valeurs, rien d'autre.
 */

import { formatElevation, formatKm } from './format';
import type { CarnetDay, CarnetDetail, CarnetEtapeDay, CarnetMomentItem } from './types';

/** Valeur absente d'une ligne d'information : un tiret, jamais un zéro. */
export const INFO_MISSING = '—';

const ONE_DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const THREE_DECIMALS = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * Allure réelle d'un jour : durée divisée par la distance parcourue.
 * `null` dès qu'une des deux valeurs manque — aucune allure n'est inventée à
 * partir de la seule durée.
 */
export function formatPace(durationS: number | null, distanceKm: number | null): string | null {
  if (durationS === null || distanceKm === null) return null;
  if (!Number.isFinite(durationS) || !Number.isFinite(distanceKm)) return null;
  if (durationS <= 0 || distanceKm <= 0) return null;
  const minutesPerKm = durationS / 60 / distanceKm;
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) return null;
  return `${ONE_DECIMAL.format(minutesPerKm)} min/km`;
}

/** `44,942 · 5,420` — une coordonnée réelle, trois décimales, virgule française. */
export function formatCoord(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${THREE_DECIMALS.format(lat)} · ${THREE_DECIMALS.format(lng)}`;
}

export interface DayPlaces {
  from: string | null;
  to: string | null;
}

/**
 * Départ et arrivée d'un jour.
 *
 * La source nommée est l'étape déclarée du carnet (`groupe_etapes`, même
 * `jour_numero`) ; quand elle manque, la coordonnée réelle du premier et du
 * dernier point GPS du jour prend le relais. Sans étape ni point, `null`.
 */
export function dayPlaces(day: CarnetDay, etapes: CarnetEtapeDay[]): DayPlaces {
  const etape = etapes.find((entry) => entry.dayNumber === day.index) ?? null;
  const first = day.points[0] ?? null;
  const last = day.points.length > 1 ? day.points[day.points.length - 1] : null;

  return {
    from: etape?.from ?? (first ? formatCoord(first.lat, first.lng) : null),
    to: etape?.to ?? (last ? formatCoord(last.lat, last.lng) : null),
  };
}

/**
 * Distance cumulée depuis le départ jusqu'au jour affiché inclus.
 * Seules les distances réellement connues s'additionnent ; sans aucune valeur,
 * `null` (et non `0 km`).
 */
export function cumulativeDistanceKm(days: CarnetDay[], dayIndex: number): number | null {
  let total: number | null = null;
  for (const day of days) {
    if (day.index > dayIndex) continue;
    if (day.distanceKm === null) continue;
    total = (total ?? 0) + day.distanceKm;
  }
  return total;
}

export interface DayInfoRow {
  key: string;
  label: string;
  value: string;
}

/** Ligne d'information : la valeur réelle, ou le tiret si elle manque. */
function row(key: string, label: string, value: string | null): DayInfoRow {
  return { key, label, value: value ?? INFO_MISSING };
}

/**
 * Lignes d'information de la page affichée.
 *
 * Jour : allure, activité, départ, arrivée, cumul depuis le départ. Le Résumé
 * porte les totaux du carnet — jours, moments, dénivelé cumulé, distance totale.
 * « Activité » reste vide tant qu'aucune colonne réelle ne la porte : la ligne
 * affiche un tiret plutôt qu'un type de sortie supposé.
 */
export function dayInfoRows(detail: CarnetDetail, day: CarnetDay | null): DayInfoRow[] {
  if (!day) {
    const summary = detail.summary ?? { distanceKm: null, elevationM: null, days: 0, moments: 0 };
    const days = summary.days > 0 ? summary.days : detail.days.length;
    return [
      row('days', 'Jours', days > 0 ? String(days) : null),
      row('moments', 'Moments', summary.moments > 0 ? String(summary.moments) : null),
      /* Même total que la rangée de statistiques de la carte : le total du
         carnet, le `summary` des jours en relais. Jamais deux D+ différents. */
      row('elevation', 'D+ cumulé', formatElevation(detail.elevationM ?? summary.elevationM)),
      row('distance', 'Distance totale', formatKm(detail.distanceKm ?? summary.distanceKm)),
    ];
  }

  const places = dayPlaces(day, detail.etapes);
  const cumulative = cumulativeDistanceKm(detail.days, day.index);

  return [
    row('pace', 'Allure', formatPace(day.durationS, day.distanceKm)),
    /* La ligne Activité n'apparaît que si une source réelle existe un jour :
       une ligne toujours vide encombre plus qu'elle n'informe. */
    ...((detail as { activity?: string | null }).activity
      ? [row('activity', 'Activité', (detail as { activity?: string | null }).activity ?? null)]
      : []),
    row('from', 'Départ', places.from),
    row('to', 'Arrivée', places.to),
    row('cumulative', 'Depuis le départ', formatKm(cumulative)),
  ];
}

export interface DayMomentRow {
  id: string;
  /** `18:30`, ou le tiret quand le moment n'a pas d'heure réelle. */
  time: string;
  /** Lieu réel du moment, ou le tiret. */
  place: string;
  /** `J2` sur la liste du Résumé, `null` sur la liste d'un jour. */
  day: string | null;
}

/**
 * Liste des moments d'une page : heure et lieu, jamais de phrase.
 * `withDay` préfixe chaque ligne de son numéro de jour — utile sur le Résumé,
 * où les moments de plusieurs jours se suivent.
 */
export function momentRows(moments: CarnetMomentItem[], withDay: boolean): DayMomentRow[] {
  return moments.map((moment) => ({
    id: moment.id,
    time: moment.time ?? INFO_MISSING,
    place: moment.place ?? INFO_MISSING,
    day: withDay ? `J${moment.dayNumber}` : null,
  }));
}
