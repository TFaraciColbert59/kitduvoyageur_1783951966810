/**
 * Meteo par journee — le seul module qui transforme une prevision en quelque
 * chose d'affichable. Il ne decide rien : il expose la mesure, et `null` la
 * laisse Vilao pour ce qu elle est, une information absente.
 */

import { weatherLabel } from '@/features/materiel/services/getWeather';

export interface DayWeather {
  /** ISO `YYYY-MM-DD`, celle de l aventure — jamais celle du jour courant. */
  readonly date: string;
  readonly tMaxC: number | null;
  readonly tMinC: number | null;
  readonly precipMm: number | null;
  readonly precipProbPct: number | null;
  readonly windMaxKmh: number | null;
  readonly code: number | null;
  /** Libelle lisible, derive du code WMO. */
  readonly label: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Les dates des journees de l aventure. `T12:00:00` ancre le jour calendaire :
 * sans cela, un fuseau отриerait la premiere journee d un jour.
 */
export function dateRange(startIso: string | null, days: number): string[] | null {
  if (!startIso || !ISO_DATE.test(startIso) || !Number.isFinite(days) || days < 1) return null;
  const start = new Date(`${startIso}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Array.from({ length: Math.trunc(days) }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

/** Index par date : la recherche d'un jour est un acces direct. */
export function weatherByDate(days: readonly DayWeather[]): ReadonlyMap<string, DayWeather> {
  return new Map(days.map((day) => [day.date, day]));
}

/** La meteo d une journee, ou `null` si le fournisseur ne la couvre pas. */
export function weatherForDay(
  index: ReadonlyMap<string, DayWeather>,
  date: string | null,
): DayWeather | null {
  if (!date) return null;
  return index.get(date) ?? null;
}

/**
 * Journee humide : pluie annoncee, averses, orage, ou vent qui rend la
 * sortie hasardeuse. Sans donnee, on ne conclut rien.
 */
export function isWetDay(day: DayWeather | null): boolean {
  if (!day) return false;
  if ((day.precipMm ?? 0) >= 1) return true;
  if ((day.precipProbPct ?? 0) >= 60) return true;
  if (day.code !== null && (day.code >= 51 || day.code === 95 || day.code === 96 || day.code === 99)) {
    return true;
  }
  return (day.windMaxKmh ?? 0) >= 60;
}

/** Phrase courte pour une carte de jour : jamais de nombre invente. */
export function weatherHeadline(day: DayWeather | null): string {
  if (!day) return 'Météo indisponible';
  const bits: string[] = [day.label];
  if (day.tMaxC !== null && day.tMinC !== null) {
    bits.push(`${Math.round(day.tMinC)}° / ${Math.round(day.tMaxC)}°`);
  }
  if (day.precipProbPct !== null) bits.push(`${Math.round(day.precipProbPct)} % de pluie`);
  return bits.join(' · ');
}

export interface WeatherParts {
  // Le ciel, seul sur sa ligne : « Partiellement nuageux » tient dans la
  // largeur d'un telephone, la phrase complete non.
  readonly condition: string;
  // Les mesures, sur la ligne suivante. Vide quand rien n est mesure : une
  // ligne vide se lit comme un oubli, alors qu elle dit « rien a afficher ».
  readonly measures: string;
}

// La meteo d'un jour, coupee en deux lignes qui ne cassent pas.
export function weatherParts(day: DayWeather | null): WeatherParts {
  if (!day) return { condition: 'Météo indisponible', measures: '' };
  const bits: string[] = [];
  if (day.tMaxC !== null && day.tMinC !== null) {
    bits.push(`${Math.round(day.tMinC)}° / ${Math.round(day.tMaxC)}°`);
  }
  if (day.precipProbPct !== null) bits.push(`${Math.round(day.precipProbPct)} % de pluie`);
  return { condition: day.label, measures: bits.join(' · ') };
}

export { weatherLabel };
