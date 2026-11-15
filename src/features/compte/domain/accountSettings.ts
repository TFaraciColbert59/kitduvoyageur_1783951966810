/**
 * Contrat O01 — Réglages de compte, langue, unités sportives et notifications sportives
 * (K7.07, S6.20, S6.21).
 *
 * Invariants :
 * - Changer l'unité d'affichage ne modifie JAMAIS la valeur canonique stockée (SI : m, s, kg/g, °C).
 * - Les préférences d'unités synchronisent `user_account_settings_v1`, le cookie
 *   `lkdv_units` et l'événement `lkdv:unit-setting` (`UNIT_SETTING_EVENT`).
 * - Les langues non activées par drapeau de build restent explicitement marquées
 *   indisponibles pour éviter tout mélange FR/EN sur une route servie.
 */

import { enabledLocales, LOCALES, type Locale } from '@/lib/i18n/locale';
import {
  ACCOUNT_SETTINGS_KEY,
  UNIT_SETTING_EVENT,
  writeUnitCookie,
} from '@/lib/i18n/unitSetting';
import type { UnitSystem } from '@/lib/i18n/region';

export type PaceUnit = 'min_km' | 'min_mi' | 'kmh' | 'mph';
export type ElevationUnit = 'm' | 'ft';
export type TemperatureUnit = 'c' | 'f';
export type WeightUnit = 'kg_g' | 'lb_oz';
export type WeekStartChoice = 'monday' | 'sunday';

export interface SportUnitsPreferences {
  unitSystem: UnitSystem;
  paceUnit: PaceUnit;
  elevationUnit: ElevationUnit;
  temperatureUnit: TemperatureUnit;
  weightUnit: WeightUnit;
  firstDayOfWeek: WeekStartChoice;
}

export const DEFAULT_METRIC_SPORT_UNITS: SportUnitsPreferences = {
  unitSystem: 'metric',
  paceUnit: 'min_km',
  elevationUnit: 'm',
  temperatureUnit: 'c',
  weightUnit: 'kg_g',
  firstDayOfWeek: 'monday',
};

export const DEFAULT_IMPERIAL_SPORT_UNITS: SportUnitsPreferences = {
  unitSystem: 'imperial',
  paceUnit: 'min_mi',
  elevationUnit: 'ft',
  temperatureUnit: 'f',
  weightUnit: 'lb_oz',
  firstDayOfWeek: 'sunday',
};

export function defaultsForUnitSystem(system: UnitSystem): SportUnitsPreferences {
  return system === 'imperial'
    ? { ...DEFAULT_IMPERIAL_SPORT_UNITS }
    : { ...DEFAULT_METRIC_SPORT_UNITS };
}

export function normalizeSportUnitsPreferences(
  input: Partial<SportUnitsPreferences> | null | undefined,
): SportUnitsPreferences {
  const base = defaultsForUnitSystem(input?.unitSystem === 'imperial' ? 'imperial' : 'metric');
  return {
    unitSystem: base.unitSystem,
    paceUnit:
      input?.paceUnit === 'min_km' ||
      input?.paceUnit === 'min_mi' ||
      input?.paceUnit === 'kmh' ||
      input?.paceUnit === 'mph'
        ? input.paceUnit
        : base.paceUnit,
    elevationUnit:
      input?.elevationUnit === 'm' || input?.elevationUnit === 'ft'
        ? input.elevationUnit
        : base.elevationUnit,
    temperatureUnit:
      input?.temperatureUnit === 'c' || input?.temperatureUnit === 'f'
        ? input.temperatureUnit
        : base.temperatureUnit,
    weightUnit:
      input?.weightUnit === 'kg_g' || input?.weightUnit === 'lb_oz'
        ? input.weightUnit
        : base.weightUnit,
    firstDayOfWeek:
      input?.firstDayOfWeek === 'monday' || input?.firstDayOfWeek === 'sunday'
        ? input.firstDayOfWeek
        : base.firstDayOfWeek,
  };
}

export function readSportUnitsPreferences(): SportUnitsPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_METRIC_SPORT_UNITS };
  try {
    const rawJson = window.localStorage?.getItem(ACCOUNT_SETTINGS_KEY);
    if (rawJson) {
      const parsed = JSON.parse(rawJson) as Partial<SportUnitsPreferences>;
      return normalizeSportUnitsPreferences(parsed);
    }
    const legacy = window.localStorage?.getItem('lkdv_units');
    return defaultsForUnitSystem(legacy === 'imperial' ? 'imperial' : 'metric');
  } catch {
    return { ...DEFAULT_METRIC_SPORT_UNITS };
  }
}

export function writeSportUnitsPreferences(
  next: Partial<SportUnitsPreferences>,
): SportUnitsPreferences {
  const current = readSportUnitsPreferences();
  const merged = normalizeSportUnitsPreferences({ ...current, ...next });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(merged));
      window.localStorage?.setItem('lkdv_units', merged.unitSystem);
    } catch {
      /* stockage bloqué (navigation privée) */
    }
    writeUnitCookie(merged.unitSystem);
    try {
      window.dispatchEvent(new Event(UNIT_SETTING_EVENT));
    } catch {
      /* ignore */
    }
  }
  return merged;
}

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.280839895;
const OUNCES_PER_GRAM = 0.0352739619;
const POUNDS_PER_KG = 2.2046226218;

/** Convertisseurs purs d'affichage : ne modifient jamais la valeur stockée. */
export function formatDistanceDisplay(
  meters: number | null | undefined,
  unitSystem: UnitSystem,
): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  if (unitSystem === 'imperial') {
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(miles >= 10 ? 1 : 2)} mi`;
  }
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatElevationDisplay(
  meters: number | null | undefined,
  elevationUnit: ElevationUnit,
): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  if (elevationUnit === 'ft') {
    return `${Math.round(meters * FEET_PER_METER)} ft`;
  }
  return `${Math.round(meters)} m`;
}

export function formatPaceOrSpeedDisplay(
  speedMps: number | null | undefined,
  paceUnit: PaceUnit,
): string {
  if (speedMps === null || speedMps === undefined || !Number.isFinite(speedMps) || speedMps <= 0) {
    return '—';
  }
  if (paceUnit === 'kmh') {
    return `${(speedMps * 3.6).toFixed(1)} km/h`;
  }
  if (paceUnit === 'mph') {
    return `${((speedMps * 3600) / METERS_PER_MILE).toFixed(1)} mph`;
  }
  const unitMeters = paceUnit === 'min_mi' ? METERS_PER_MILE : 1000;
  const secPerUnit = unitMeters / speedMps;
  const mins = Math.floor(secPerUnit / 60);
  const secs = Math.round(secPerUnit % 60);
  const adjustedMins = secs === 60 ? mins + 1 : mins;
  const adjustedSecs = secs === 60 ? 0 : secs;
  return `${adjustedMins}:${String(adjustedSecs).padStart(2, '0')} ${paceUnit === 'min_mi' ? '/mi' : '/km'}`;
}

export function formatTemperatureDisplay(
  celsius: number | null | undefined,
  temperatureUnit: TemperatureUnit,
): string {
  if (celsius === null || celsius === undefined || !Number.isFinite(celsius)) return '—';
  if (temperatureUnit === 'f') {
    return `${Math.round((celsius * 9) / 5 + 32)} °F`;
  }
  return `${Math.round(celsius)} °C`;
}

export function formatWeightDisplay(
  grams: number | null | undefined,
  weightUnit: WeightUnit,
): string {
  if (grams === null || grams === undefined || !Number.isFinite(grams)) return '—';
  if (weightUnit === 'lb_oz') {
    const kg = grams / 1000;
    if (kg >= 0.5) return `${(kg * POUNDS_PER_KG).toFixed(2)} lb`;
    return `${(grams * OUNCES_PER_GRAM).toFixed(1)} oz`;
  }
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
}

export interface LocaleChoice {
  code: Locale;
  label: string;
  nativeLabel: string;
  enabled: boolean;
}

const LOCALE_LABELS: Record<Locale, { label: string; nativeLabel: string }> = {
  fr: { label: 'Français', nativeLabel: 'Français' },
  en: { label: 'Anglais', nativeLabel: 'English' },
  es: { label: 'Espagnol', nativeLabel: 'Español' },
  de: { label: 'Allemand', nativeLabel: 'Deutsch' },
  it: { label: 'Italien', nativeLabel: 'Italiano' },
};

export function listLocaleChoices(): LocaleChoice[] {
  const active = new Set(enabledLocales());
  return LOCALES.map((code) => ({
    code,
    label: LOCALE_LABELS[code].label,
    nativeLabel: LOCALE_LABELS[code].nativeLabel,
    enabled: active.has(code),
  }));
}

export type SportNotificationPrefKey =
  | 'kudos'
  | 'comments'
  | 'segmentsPr'
  | 'challenges'
  | 'clubEvents'
  | 'gearMileageAlerts'
  | 'activityDigest';

export interface SportNotificationDefinition {
  key: SportNotificationPrefKey;
  label: string;
  description: string;
}

export const SPORT_NOTIFICATION_DEFINITIONS: readonly SportNotificationDefinition[] = [
  {
    key: 'kudos',
    label: 'Kudos et encouragements',
    description: 'Réactions reçues sur tes sorties publiées.',
  },
  {
    key: 'comments',
    label: 'Commentaires sur sorties',
    description: 'Réponses et mentions sur tes traces et carnets.',
  },
  {
    key: 'segmentsPr',
    label: 'Segments et records personnels',
    description: 'Nouveaux temps de référence sur tes montées et parcours suivis.',
  },
  {
    key: 'challenges',
    label: 'Défis et progression saison',
    description: 'Paliers atteints et défis hebdomadaires.',
  },
  {
    key: 'clubEvents',
    label: 'Sorties et événements club',
    description: 'Rappels et changements de parcours des clubs rejoints.',
  },
  {
    key: 'gearMileageAlerts',
    label: 'Alertes usure matériel',
    description: 'Dépassement de seuil kilométrique (chaussures, chaîne, plaquettes).',
  },
  {
    key: 'activityDigest',
    label: 'Récapitulatif hebdomadaire',
    description: 'Synthèse hebdomadaire de distance, dénivelé et sorties.',
  },
] as const;

export function isValidClockTime(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}
