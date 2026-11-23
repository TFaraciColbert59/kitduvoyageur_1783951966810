/**
 * Météo au point et à l'heure de passage de chaque jour (7.4). Pur : le serveur lit MET Norway (`getCompasWeather`),
 * ce module choisit l'heure la plus proche du passage et dit l'écart, l'heure du relevé et l'horizon.
 *
 * Règles « rien d'inventé » : hors de l'horizon de prévision, ou sans prévision, la valeur est INCONNUE (jamais une
 * moyenne présentée comme prévision) ; une heure choisie à plus de 90 minutes du passage est dite approximative
 * (MET Norway passe au pas de 6 h au-delà de 2,5 jours).
 */
import type { HourCondition } from '@/features/compas/engine/weather';
import { SOURCE_WEATHER } from './provenance';

/** Point et heure de passage d'une journée, tels que la page les envoie au serveur. */
export interface DayPassage {
  readonly day: number;
  /** Date locale de la journée (AAAA-MM-JJ). */
  readonly dateIso: string;
  readonly lat: number;
  readonly lon: number;
  /** Heure locale de passage (HH:mm). */
  readonly passageLocal: string;
  readonly timezone: string;
  /** D'où vient l'heure : « milieu de journée » (départ + moitié de la durée) ou « départ » si la durée est inconnue. */
  readonly basis: 'midday' | 'departure';
}

export type PassageWeatherStatus = 'ok' | 'out_of_horizon' | 'unavailable';

export interface PassageWeather {
  readonly day: number;
  readonly status: PassageWeatherStatus;
  readonly passageLocal: string;
  readonly basis: DayPassage['basis'];
  /** Heure retenue (« AAAA-MM-JJTHH:MM », locale) ; `null` sans prévision. */
  readonly hourLocal: string | null;
  /** Écart entre l'heure retenue et le passage, en minutes (valeur absolue). */
  readonly deltaMin: number | null;
  /** Vrai quand l'écart dépasse 90 min : la valeur décrit un créneau voisin. */
  readonly approximate: boolean;
  readonly tempC: number | null;
  readonly precipPct: number | null;
  readonly precipMm: number | null;
  readonly windKmh: number | null;
  readonly gustKmh: number | null;
  readonly code: number | null;
  /** Dernier jour couvert par la prévision (AAAA-MM-JJ). */
  readonly horizon: string | null;
  /** Instant de lecture de la source (ISO) ; `null` quand rien n'a été lu. */
  readonly fetchedAt: string | null;
  readonly source: string;
  readonly reason: string | null;
}

export const APPROXIMATE_AFTER_MIN = 90;

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/** Heure de prévision la plus proche du passage ; `null` si la journée n'a aucune heure lisible. */
export function pickPassageHour(
  hours: readonly HourCondition[],
  dateIso: string,
  passageLocal: string,
): { hour: HourCondition; deltaMin: number } | null {
  const target = minutesOf(passageLocal);
  if (target == null) return null;
  let best: { hour: HourCondition; deltaMin: number } | null = null;
  for (const h of hours) {
    if (!h.time.startsWith(dateIso)) continue;
    const t = minutesOf(h.time.slice(11, 16));
    if (t == null) continue;
    const d = Math.abs(t - target);
    if (!best || d < best.deltaMin) best = { hour: h, deltaMin: d };
  }
  return best;
}

export function passageWeatherOf(
  passage: DayPassage,
  forecast: { readonly hours: readonly HourCondition[] } | null,
  context: { readonly horizon: string | null; readonly fetchedAt: string | null },
): PassageWeather {
  const base = {
    day: passage.day,
    passageLocal: passage.passageLocal,
    basis: passage.basis,
    horizon: context.horizon,
    fetchedAt: context.fetchedAt,
    source: SOURCE_WEATHER,
  } as const;
  const none = (status: PassageWeatherStatus, reason: string): PassageWeather => ({
    ...base,
    status,
    hourLocal: null,
    deltaMin: null,
    approximate: false,
    tempC: null,
    precipPct: null,
    precipMm: null,
    windKmh: null,
    gustKmh: null,
    code: null,
    reason,
  });
  if (!forecast) {
    return context.horizon && passage.dateIso > context.horizon
      ? none('out_of_horizon', `Au-delà de la prévision (jusqu’au ${context.horizon}) : météo inconnue pour ce jour.`)
      : none('unavailable', 'Aucune prévision lue pour ce lieu et ce jour.');
  }
  const hit = pickPassageHour(forecast.hours, passage.dateIso, passage.passageLocal);
  if (!hit) return none('unavailable', 'La prévision de ce jour ne donne aucune heure lisible.');
  const h = hit.hour;
  return {
    ...base,
    status: 'ok',
    hourLocal: h.time,
    deltaMin: hit.deltaMin,
    approximate: hit.deltaMin > APPROXIMATE_AFTER_MIN,
    tempC: h.tempC,
    precipPct: h.precipPct,
    precipMm: h.precipMm,
    windKmh: h.windKmh,
    gustKmh: h.gustKmh,
    code: h.code,
    reason: null,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Ajoute des minutes à une heure « HH:mm » (borné dans la journée). */
export function addMinutesToClock(hhmm: string, minutes: number): string | null {
  const t = minutesOf(hhmm);
  if (t == null || !Number.isFinite(minutes)) return null;
  const total = Math.min(23 * 60 + 59, Math.max(0, Math.round(t + minutes)));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
