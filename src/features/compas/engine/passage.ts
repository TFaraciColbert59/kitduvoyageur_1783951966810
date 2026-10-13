/**
 * Compas — heure de passage à chaque étape (onglet « Quand », fonction pure).
 *
 * Une heure de passage est une ESTIMATION calculée, jamais une donnée posée à
 * la place de la personne :
 *
 *   heure de départ du jour  +  temps pour atteindre l'étape
 *
 * - `trip_steps.start_time` est l'heure de PASSAGE de l'étape elle-même (roadbook), saisie
 *   dans l'itinéraire : une étape qui en porte une la GARDE telle quelle (ni additionnée à
 *   la distance de l'étape, ni arrondie), et elle devient le point de départ des estimations
 *   des étapes suivantes qui n'en ont pas ;
 * - sinon, l'estimation part de l'heure de départ du jour que la personne tape pour simuler ;
 *   il n'existe aucune heure par défaut : sans heure notée avant elle ni départ, l'étape est
 *   « non renseignée » ;
 * - le temps vient de la distance cumulée depuis le départ du jour :
 *     · à pied (randonnée, trek, bivouac, mixte) : DIN 33466 au pas du plus lent du
 *       groupe (`walkingMinutes`), pauses +15 % — le même calcul que « Départ conseillé » ;
 *     · course, trail, vélo, eau : distance ÷ vitesse type de l'activité (pauses comprises) ;
 *     · toute autre activité : aucune allure connue, donc aucune heure ;
 * - le lever et le coucher du soleil ne servent qu'à dire si le passage tombe de nuit.
 *
 * Distance de l'étape inconnue ou nulle : cette étape et les suivantes du jour restent
 * « non renseignées » (on ne comble jamais par une distance supposée).
 */

import { activitySpeedKmh } from './projectContext';
import { clockMinutes, daylightClock, formatClock } from './sun';
import { walkingMinutes, type Pace } from './weather';
import { safeTimeZone } from './zone';

/** Pauses comptées en plus du temps de marche (comme « Départ conseillé »). */
export const PAUSE_FACTOR = 1.15;
/** Pas d'arrondi de l'heure affichée : une estimation ne prétend pas à la minute. */
export const ROUND_MIN = 5;

/** Activités faites à pied : temps DIN 33466. */
const ON_FOOT = new Set(['hiking', 'trekking', 'bivouac', 'mixed']);
/** Activités mesurées par une vitesse type (course, trail, vélo, eau). */
const BY_SPEED = new Set(['running', 'trail', 'cycling', 'water']);

export interface PassageStepInput {
  id: string;
  title: string;
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
  /** Heure de passage NOTÉE sur l'étape « HH:MM » (ou « HH:MM:SS ») ; absente ou illisible : étape à estimer. */
  startTime?: string | null;
}

/** Ce qui manque pour dire une heure, par ordre de priorité. */
export type PassageMissing = 'allure' | 'depart' | 'distance';
export type PassageLight = 'avant-lever' | 'jour' | 'apres-coucher';

export interface StepPassage {
  id: string;
  title: string;
  /** « HH:MM » (heure locale du lieu, arrondie à 5 min), null quand une donnée manque. */
  time: string | null;
  /** Le passage a lieu le lendemain du départ (étape de nuit). */
  nextDay: boolean;
  /** Minutes écoulées depuis le départ du jour (pauses comprises), null sans heure. */
  sinceStartMin: number | null;
  /** Pourquoi il n'y a pas d'heure. */
  missing: PassageMissing | null;
  /** « note » : heure saisie sur l'étape, gardée telle quelle ; « estime » : calculée ; null sans heure. */
  source: 'note' | 'estime' | null;
  /** D'où part l'estimation : le départ du jour, ou l'heure notée d'une étape précédente. Null pour une heure notée ou absente. */
  from: { kind: 'depart' | 'etape'; time: string; title?: string } | null;
  /** Position par rapport au soleil, null quand l'heure ou le soleil est inconnu. */
  light: PassageLight | null;
}

export interface PassageInput {
  activity: string | null;
  /** Départ du jour « HH:MM » (ou « HH:MM:SS »), null s'il n'est pas renseigné. */
  departure: string | null;
  steps: ReadonlyArray<PassageStepInput>;
  /** Allure à plat du plus lent du groupe (km/h), null si inconnue (4 km/h pour la marche). */
  flatSpeedKmh: number | null;
  pace: Pace;
  /** Lever et coucher du jour « HH:MM » (heure locale), null s'ils sont inconnus. */
  sunrise?: string | null;
  sunset?: string | null;
}

/** L'allure de l'activité : à pied (DIN), vitesse type (km/h), ou aucune. */
export function passageModel(activity: string | null): 'pied' | { kmh: number } | null {
  if (activity == null) return null;
  if (ON_FOOT.has(activity)) return 'pied';
  if (BY_SPEED.has(activity)) {
    const kmh = activitySpeedKmh(activity);
    return kmh != null && kmh > 0 ? { kmh } : null;
  }
  return null;
}

const round = (min: number) => Math.round(min / ROUND_MIN) * ROUND_MIN;

/**
 * Une heure de passage par étape du jour, dans l'ordre. Une étape qui porte une heure notée la garde
 * telle quelle. Les autres sont estimées sur la distance cumulée depuis le dernier point connu : la
 * dernière heure notée avant elles, sinon le départ du jour ; la dernière étape d'un jour sans heure
 * notée retombe sur le temps de marche du jour (`CompasDayPlan.walkMin` × 1,15).
 */
export function stepPassages(input: PassageInput): StepPassage[] {
  const model = passageModel(input.activity);
  const departure = clockMinutes(input.departure);
  const rise = clockMinutes(input.sunrise);
  const set = clockMinutes(input.sunset);

  /** Position par rapport au soleil ; le lendemain, lever et coucher sont ceux du jour de départ : rien n'est comparable. */
  const lightAt = (at: number, nextDay: boolean): PassageLight | null =>
    rise == null || set == null || nextDay
      ? null
      : at > set
        ? 'apres-coucher'
        : at < rise
          ? 'avant-lever'
          : 'jour';

  /** Le dernier point connu (départ, puis chaque heure notée) et ce qui s'est ajouté depuis. */
  let base: { minutes: number; kind: 'depart' | 'etape'; title?: string } | null =
    departure != null ? { minutes: departure, kind: 'depart' } : null;
  let km = 0;
  let gain = 0;
  let loss = 0;
  let broken = false;

  return input.steps.map((step): StepPassage => {
    const noted = clockMinutes(step.startTime);
    if (noted != null) {
      // Un fait, pas une estimation : jamais arrondie, jamais ajoutée à la distance de l'étape.
      base = { minutes: noted, kind: 'etape', title: step.title };
      km = 0;
      gain = 0;
      loss = 0;
      broken = false;
      return {
        id: step.id,
        title: step.title,
        time: formatClock(noted),
        nextDay: false,
        sinceStartMin: null,
        missing: null,
        source: 'note',
        from: null,
        light: lightAt(noted, false),
      };
    }
    const known =
      step.distanceKm != null && Number.isFinite(step.distanceKm) && step.distanceKm > 0;
    if (!known) broken = true;
    const none = (missing: PassageMissing): StepPassage => ({
      id: step.id,
      title: step.title,
      time: null,
      nextDay: false,
      sinceStartMin: null,
      missing,
      source: null,
      from: null,
      light: null,
    });
    if (!broken) {
      km += step.distanceKm as number;
      gain += step.gainM ?? 0;
      loss += step.lossM ?? 0;
    }
    if (model == null) return none('allure');
    if (base == null) return none('depart');
    if (broken) return none('distance');

    const moving =
      model === 'pied'
        ? (walkingMinutes({
            distanceKm: km,
            gainM: gain,
            lossM: loss,
            flatSpeedKmh: input.flatSpeedKmh,
            pace: input.pace,
          }) ?? 0) * PAUSE_FACTOR
        : (km / model.kmh) * 60;
    const at = round(base.minutes + moving);
    const nextDay = at >= 1440;
    return {
      id: step.id,
      title: step.title,
      time: formatClock(at),
      nextDay,
      sinceStartMin: Math.round(moving),
      missing: null,
      source: 'estime',
      from: {
        kind: base.kind,
        time: formatClock(base.minutes),
        ...(base.title ? { title: base.title } : {}),
      },
      light: lightAt(at, nextDay),
    };
  });
}

/** Phrase d'une étape sans heure : ce qui manque, en mots. */
export const MISSING_TEXT: Record<PassageMissing, string> = {
  allure: 'pas d’allure connue pour cette activité',
  depart: 'heure de départ',
  distance: 'distance de l’étape',
};

/**
 * Lever et coucher locaux du jour : la prévision (« HH:MM » ou ISO) si elle les
 * donne, sinon le calcul astronomique au point et à la date de l'étape, à l'heure du
 * fuseau DE CE JOUR (`timeZone`, retrouvé par le serveur depuis le point du jour : un
 * itinéraire peut traverser des fuseaux). null quand rien ne permet de les dire (étape
 * sans point ni date, jour ou nuit polaire, fuseau du jour inconnu ou illisible : on ne
 * devine pas avec le fuseau d'une autre étape).
 */
export function dayLightClock(
  forecast: { sunrise?: string | null; sunset?: string | null } | null | undefined,
  at: { lat: number | null; lon: number | null; date: string | null },
  timeZone: string | null
): { sunrise: string; sunset: string } | null {
  const rise = clockMinutes(forecast?.sunrise);
  const set = clockMinutes(forecast?.sunset);
  if (rise != null && set != null && set > rise)
    return { sunrise: formatClock(rise), sunset: formatClock(set) };
  if (at.lat == null || at.lon == null || !Number.isFinite(at.lat) || !Number.isFinite(at.lon))
    return null;
  if (!at.date || !/^\d{4}-\d{2}-\d{2}/.test(at.date)) return null;
  const zone = safeTimeZone(timeZone);
  if (!zone) return null;
  const sun = daylightClock(at.lat, at.lon, at.date, zone);
  // Jour ou nuit polaire, date impossible : pas de lever ni de coucher, donc pas de « de nuit ».
  return clockMinutes(sun.sunrise) != null && clockMinutes(sun.sunset) != null
    ? { sunrise: sun.sunrise as string, sunset: sun.sunset as string }
    : null;
}
