/**
 * unitSetting.ts — Le réglage d'unités de la personne (PLAN-100 6.3).
 *
 * Il n'est PAS stocké côté serveur : la carte « Paramètres » du compte
 * (réglages du Compte) l'écrit dans ce navigateur, clé
 * `user_account_settings_v1`, champ `unitSystem` (`'metric'` | `'imperial'`). Ce module
 * le relit sans jamais lever d'exception (navigation privée, stockage bloqué, JSON abîmé) :
 * illisible ou absent, il n'y a pas de réglage explicite et la région de la langue décide
 * (`measurePrefsFor`).
 *
 * Même onglet : la carte de réglages émet `UNIT_SETTING_EVENT` après l'enregistrement.
 * Autre onglet : l'événement `storage` du navigateur.
 */

import { isLocale, normalizeLocale, type Locale } from './locale';
import {
  measurePrefsFor,
  weekStartFor,
  type IsoWeekday,
  type MeasurePrefs,
  type UnitSystem,
} from './region';

export const ACCOUNT_SETTINGS_KEY = 'user_account_settings_v1';
export const UNIT_SETTING_EVENT = 'lkdv:unit-setting';

/**
 * Miroir du réglage dans un cookie (`lkdv_units` : `metric` ou `imperial`), écrit par la carte
 * « Paramètres » : le serveur (textes rangés en base rendus à l'affichage, messages) connaît ainsi
 * les unités de la personne sans les lire dans le navigateur. Aucune donnée personnelle.
 */
export const UNIT_COOKIE = 'lkdv_units';

/** Valeur d'un cookie d'unités, ou `null` (absent ou inconnu). */
export function parseUnitCookie(raw: string | null | undefined): UnitSystem | null {
  return raw === 'metric' || raw === 'imperial' ? raw : null;
}

/** Écrit le cookie d'unités (navigateur, 1 an). Silencieux si les cookies sont bloqués. */
export function writeUnitCookie(system: UnitSystem): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${UNIT_COOKIE}=${system}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // cookies bloqués : le réglage reste lisible dans le navigateur
  }
}

/** Le système d'unités d'un enregistrement de réglages (JSON), ou `null`. */
export function parseUnitSystem(raw: string | null | undefined): UnitSystem | null {
  if (!raw) return null;
  try {
    const value = (JSON.parse(raw) as { unitSystem?: unknown } | null)?.unitSystem;
    return value === 'metric' || value === 'imperial' ? value : null;
  } catch {
    return null;
  }
}

/** Le premier jour de la semaine d'un enregistrement de réglages (JSON), ou « null ». */
export function parseFirstDay(raw: string | null | undefined): IsoWeekday | null {
  if (!raw) return null;
  try {
    const value = (JSON.parse(raw) as { firstDayOfWeek?: unknown } | null)?.firstDayOfWeek;
    return value === 'monday' ? 1 : value === 'sunday' ? 7 : null;
  } catch {
    return null;
  }
}

/** Le premier jour de la semaine choisi dans ce navigateur (carte « Paramètres »), ou « null ». */
export function readFirstDay(): IsoWeekday | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseFirstDay(window.localStorage.getItem(ACCOUNT_SETTINGS_KEY));
  } catch {
    return null;
  }
}

/** Le réglage explicite enregistré dans ce navigateur, ou `null`. */
export function readUnitSystem(): UnitSystem | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseUnitSystem(window.localStorage.getItem(ACCOUNT_SETTINGS_KEY));
  } catch {
    return null;
  }
}

/** Écoute les changements du réglage (cet onglet et les autres). */
export function subscribeUnitSystem(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === ACCOUNT_SETTINGS_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(UNIT_SETTING_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(UNIT_SETTING_EVENT, onChange);
  };
}

/**
 * Unités d'affichage pour la langue du site, le réglage explicite et la langue du
 * navigateur. La balise du navigateur (`en-GB`) ne sert que si elle parle la langue du
 * site : elle apporte la région, que la locale seule (`en` → `en-US`) ne dit pas.
 * Le réglage explicite l'emporte toujours, en entier.
 */
export function unitPrefsFor(
  locale: Locale,
  system: UnitSystem | null,
  browserTag?: string | null
): MeasurePrefs {
  return measurePrefsFor(regionTagFor(locale, browserTag), system);
}

/**
 * Balise qui porte la région d'affichage : celle du navigateur si elle parle la langue du
 * site (`en-GB` pour un site en anglais), sinon la langue du site seule.
 */
export function regionTagFor(locale: Locale, browserTag?: string | null): string {
  return browserTag && isLocale(locale) && normalizeLocale(browserTag) === locale
    ? browserTag
    : locale;
}

/** Premier jour de la semaine : le réglage explicite du compte, sinon la région (dimanche aux États-Unis, lundi en France). */
export function weekStartForLocale(
  locale: Locale,
  browserTag?: string | null,
  explicit: IsoWeekday | null = null
): IsoWeekday {
  return explicit ?? weekStartFor(regionTagFor(locale, browserTag));
}
