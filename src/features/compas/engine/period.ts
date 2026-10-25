/**
 * Meilleure période quand aucune date n'est donnée.
 *
 * Règles prudentes et explicables (saison, hémisphère, latitude, altitude,
 * activité, fréquentation), jamais une prévision. Les tropiques dépendent
 * d'une saison sèche locale : connue par pays (table), sinon aucune période
 * plutôt qu'une fausse certitude. La période retenue est toujours affichée et
 * modifiable (« Quand »).
 */

import { toIntlLocale, type Locale } from '@/lib/i18n/locale';
import type { TranslationKey } from '@/lib/i18n/translate';
import { engineT } from './engineI18n';

export interface PeriodInput {
  activity: string | null;
  lat: number | null;
  /** Code pays ISO (tropiques : saison sèche connue par pays). */
  countryCode?: string | null;
  /** Altitude maximale connue (m), si mesurée. */
  maxAltitudeM?: number | null;
  /** Aujourd'hui (AAAA-MM-JJ). */
  today: string;
  days: number;
  /**
   * Normales mensuelles de précipitations (mm/jour, janvier → décembre, NASA
   * POWER 2001-2020) : servent seulement aux tropiques absents de la table.
   */
  normals?: { precip: number[] } | null;
}

export interface BestPeriod {
  /** 1-12 */
  month: number;
  start: string;
  end: string;
  why: string;
}

// Format français des mois (celui d'avant) ; l'anglais passe par Intl.
const MONTH_FR = 'janvier février mars avril mai juin juillet août septembre octobre novembre décembre'.split(' '); // i18n-ok

/** Nom du mois (1-12) : « juillet », « July ». */
export function monthName(m: number, locale: Locale = 'fr'): string {
  const i = (m - 1 + 12) % 12;
  if (locale === 'fr') return MONTH_FR[i];
  return new Intl.DateTimeFormat(toIntlLocale(locale), { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, i, 15))
  );
}

/** Mois conseillé dans l'hémisphère nord (le sud est décalé de six mois). */
function northernMonth(input: PeriodInput): { month: number; why: TranslationKey } | null {
  const act = input.activity ?? '';
  const lat = Math.abs(input.lat ?? 45);
  const high = (input.maxAltitudeM ?? 0) >= 1800;
  if (act === 'ski') return { month: 2, why: 'compas.engine.period.ski' };
  if (act === 'beach') return { month: 6, why: 'compas.engine.period.beach' };
  if (act === 'citytrip' || act === 'cultural')
    return { month: 5, why: 'compas.engine.period.city' };
  if (act === 'water') return { month: 7, why: 'compas.engine.period.water' };
  if (lat >= 58) return { month: 7, why: 'compas.engine.period.farNorth' };
  if (act === 'mountaineering') return { month: 7, why: 'compas.engine.period.mountaineering' };
  if (high || lat >= 50) return { month: 9, why: 'compas.engine.period.high' };
  if (lat <= 38) return { month: 4, why: 'compas.engine.period.south' };
  return { month: 6, why: 'compas.engine.period.default' };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addDays(isoDate: string, n: number): string {
  const t = Date.parse(`${isoDate}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Prochaine occurrence du mois conseillé (au moins 3 semaines devant, pour
 * avoir le temps de préparer), départ le 1er samedi du mois.
 */
/**
 * Tropiques : la saison sèche, pays par pays (sources : climats généraux,
 * conseillée par les offices de tourisme), le mois le plus sûr au cœur de
 * cette saison. Un pays absent de la table : le mois le plus sec des normales
 * NASA POWER 2001-2020 au point même (`driestMonth`), sinon aucune période
 * plutôt qu'une fausse certitude. Aucune ligne n'est ajoutée à la main.
 */
const TROPICAL_DRY: Record<string, { month: number; why: TranslationKey }> = {
  PE: { month: 6, why: 'compas.engine.period.dry.andesMaySep' },
  BO: { month: 6, why: 'compas.engine.period.dry.andesMaySep' },
  EC: { month: 7, why: 'compas.engine.period.dry.andesJunSep' },
  CO: { month: 1, why: 'compas.engine.period.dry.decMar' },
  VN: { month: 3, why: 'compas.engine.period.dry.vietnam' },
  TH: { month: 1, why: 'compas.engine.period.dry.coolNovFeb' },
  KH: { month: 1, why: 'compas.engine.period.dry.coolNovFeb' },
  LA: { month: 1, why: 'compas.engine.period.dry.coolNovFeb' },
  MM: { month: 1, why: 'compas.engine.period.dry.coolNovFeb' },
  IN: { month: 12, why: 'compas.engine.period.dry.coolNovMar' },
  LK: { month: 2, why: 'compas.engine.period.dry.southWestDecApr' },
  PH: { month: 2, why: 'compas.engine.period.dry.decMay' },
  ID: { month: 7, why: 'compas.engine.period.dry.maySep' },
  KE: { month: 8, why: 'compas.engine.period.dry.longJunOct' },
  TZ: { month: 8, why: 'compas.engine.period.dry.longJunOct' },
  UG: { month: 7, why: 'compas.engine.period.dry.junAug' },
  RW: { month: 7, why: 'compas.engine.period.dry.junSep' },
  MG: { month: 9, why: 'compas.engine.period.dry.aprNov' },
  MX: { month: 2, why: 'compas.engine.period.dry.novApr' },
  CR: { month: 2, why: 'compas.engine.period.dry.decApr' },
  GT: { month: 2, why: 'compas.engine.period.dry.novApr' },
  BZ: { month: 2, why: 'compas.engine.period.dry.decApr' },
  NI: { month: 2, why: 'compas.engine.period.dry.decApr' },
  PA: { month: 2, why: 'compas.engine.period.dry.janApr' },
  CU: { month: 3, why: 'compas.engine.period.dry.beforeCyclones' },
  DO: { month: 3, why: 'compas.engine.period.dry.beforeCyclones' },
  JM: { month: 3, why: 'compas.engine.period.dry.beforeCyclones' },
  SN: { month: 1, why: 'compas.engine.period.dry.lessHot' },
  ET: { month: 11, why: 'compas.engine.period.dry.greenStart' },
  RE: { month: 10, why: 'compas.engine.period.dry.coolWalk' },
  MU: { month: 10, why: 'compas.engine.period.dry.mild' },
  PF: { month: 7, why: 'compas.engine.period.dry.mayOct' },
  OM: { month: 12, why: 'compas.engine.period.dry.mildWinter' },
};

/** Raison affichée quand le mois vient des normales (et non de la table). */
export const NORMALS_WHY = engineT('fr')('compas.engine.period.normals');

/** Latitude entre les tropiques (|lat| < 23,5°) : saisons sèche et humide, pas d'hiver. */
export function isTropical(lat: number | null | undefined): boolean {
  return lat != null && Math.abs(lat) < 23.5;
}

/** La période suit la saison sèche : tropiques, hors ski. */
function drySeason(input: Pick<PeriodInput, 'activity' | 'lat'>): boolean {
  return isTropical(input.lat) && input.activity !== 'ski';
}

/**
 * Désert : moins de 0,5 mm/jour en moyenne sur l'année. Ses rares pluies
 * tombent souvent l'hiver ; le « trimestre le plus sec » y serait le plein
 * été, jamais un bon conseil.
 */
const ARID_MEAN_MM_PER_DAY = 0.5;

function dryRow(countryCode: string | null | undefined): { month: number; why: TranslationKey } | null {
  return TROPICAL_DRY[(countryCode ?? '').toUpperCase()] ?? null;
}

/**
 * Tropiques hors de la table : seules les normales climatiques peuvent dire
 * la saison sèche (le serveur ne les demande que dans ce cas).
 */
export function needsDryNormals(input: Pick<PeriodInput, 'activity' | 'lat' | 'countryCode'>): boolean {
  return drySeason(input) && !dryRow(input.countryCode);
}

/**
 * Mois (1-12) au centre de la fenêtre de trois mois la plus sèche, en boucle
 * sur l'année (décembre-janvier-février compte). À égalité, le premier.
 */
export function driestMonth(precip: number[]): number {
  let best = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 12; i += 1) {
    const sum = precip[(i + 11) % 12] + precip[i] + precip[(i + 1) % 12];
    if (sum < bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  return best + 1;
}

/** Douze valeurs lisibles, sinon rien : aucune normale n'est comblée. */
function usableNormals(normals: PeriodInput['normals']): number[] | null {
  const p = normals?.precip;
  return Array.isArray(p) && p.length === 12 && p.every((v) => Number.isFinite(v) && v >= 0) ? p : null;
}

/** Normales d'un climat aride (moyenne annuelle sous le seuil) : aucune saison sèche à en tirer. */
function arid(precip: number[]): boolean {
  return precip.reduce((t, v) => t + v, 0) / 12 < ARID_MEAN_MM_PER_DAY;
}

export function bestPeriod(input: PeriodInput, locale: Locale = 'fr'): BestPeriod | null {
  const tropical = drySeason(input);
  // La table garde la priorité ; hors d'elle, le mois le plus sec des normales
  // NASA POWER ; sans normales lisibles, ou en désert, aucune période plutôt
  // qu'une supposition.
  const normals = tropical ? usableNormals(input.normals) : null;
  const precip = normals && !arid(normals) ? normals : null;
  const dry = tropical
    ? (dryRow(input.countryCode) ??
      (precip ? { month: driestMonth(precip), why: 'compas.engine.period.normals' as const } : null))
    : null;
  if (tropical && !dry) return null;
  const north = dry ? null : northernMonth(input);
  if (!dry && !north) return null;
  const south = (input.lat ?? 45) < 0;
  // La saison sèche est déjà donnée dans le calendrier du pays (pas de décalage austral).
  const month = dry ? dry.month : south ? ((north!.month + 5) % 12) + 1 : north!.month;
  const minStart = addDays(input.today, 21);
  let year = Number(input.today.slice(0, 4));
  let start = iso(year, month, 1);
  for (let i = 0; i < 2; i += 1) {
    const first = Date.parse(`${start}T12:00:00Z`);
    const dow = new Date(first).getUTCDay();
    start = addDays(start, (6 - dow + 7) % 7);
    // Un samedi plus tard dans le même mois (jusqu'au 22) plutôt qu'un an d'attente.
    while (start < minStart && Number(start.slice(8, 10)) <= 15) start = addDays(start, 7);
    if (start >= minStart) break;
    year += 1;
    start = iso(year, month, 1);
  }
  return {
    month,
    start,
    end: addDays(start, Math.max(1, input.days) - 1),
    why: engineT(locale)(dry ? dry.why : north!.why),
  };
}
