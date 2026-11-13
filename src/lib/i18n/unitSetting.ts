/**
 * unitSetting.ts — Le réglage d'unités de la personne (PLAN-100 6.3).
 *
 * Il n'est PAS stocké côté serveur : la carte « Langue et unités » du compte
 * (réglages du Compte) l'écrit dans ce navigateur, clé
 * `user_account_settings_v1`, champ `unitSystem` (`'metric'` | `'imperial'`). Ce module
 * le relit sans jamais lever d'exception (navigation privée, stockage bloqué, JSON abîmé) :
 * illisible ou absent, il n'y a pas de réglage explicite et la région de la langue décide
 * (`measurePrefsFor`). `null` (option « Automatique ») retire explicitement le champ.
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

/** Ancienne clé locale écrite par la première carte Paramètres. */
const LEGACY_UNIT_STORAGE_KEY = 'lkdv_units';

export interface AccountSettings {
  language?: Locale;
  unitSystem?: UnitSystem;
  firstDayOfWeek?: IsoWeekday;
  [key: string]: unknown;
}

/** Enregistrement de réglages du navigateur, ou `null` (absent, bloqué, JSON abîmé). */
export function readAccountSettings(): AccountSettings | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AccountSettings)
      : null;
  } catch {
    return null;
  }
}

/**
 * Fusionne un réglage dans l'enregistrement local sans écraser les autres
 * champs (langue, premier jour de semaine, futurs réglages). `null` retire la
 * clé : c'est la façon de revenir aux conventions de région.
 */
export function writeAccountSettings(patch: {
  language?: Locale;
  unitSystem?: UnitSystem | null;
  firstDayOfWeek?: IsoWeekday;
}): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = readAccountSettings() ?? {};
    const next: AccountSettings = { ...current };
    if (patch.language !== undefined) next.language = patch.language;
    if (patch.firstDayOfWeek !== undefined) next.firstDayOfWeek = patch.firstDayOfWeek;
    if (patch.unitSystem === null) delete next.unitSystem;
    else if (patch.unitSystem !== undefined) next.unitSystem = patch.unitSystem;
    window.localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(next));
    // La clé historique ne doit pas ressusciter un choix que la personne vient
    // de remplacer (notamment « Automatique »).
    if (patch.unitSystem !== undefined) {
      window.localStorage.removeItem(LEGACY_UNIT_STORAGE_KEY);
    }
  } catch {
    // stockage bloqué : le cookie reste le miroir serveur
  }
  if (patch.unitSystem !== undefined && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNIT_SETTING_EVENT));
  }
}


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

/** Retire le cookie d'unités : le serveur retombe sur la région de la langue. */
export function clearUnitCookie(): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${UNIT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // cookies bloqués : rien à retirer
  }
}

/**
 * Applique le réglage d'unités de la carte « Langue et unités » : enregistrement
 * local (source de l'interface), cookie miroir pour le serveur, puis événement
 * pour que Compas, Explorer et les autres surfaces se mettent à jour sans
 * rechargement. `null` revient aux conventions de la région.
 */
export function writeUnitSystem(system: UnitSystem | null): void {
  writeAccountSettings({ unitSystem: system });
  if (system === null) clearUnitCookie();
  else writeUnitCookie(system);
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
    const fromSettings = parseUnitSystem(window.localStorage.getItem(ACCOUNT_SETTINGS_KEY));
    if (fromSettings) return fromSettings;
    // Reprise des navigateurs qui ont connu l'ancienne clé, sans migration.
    const legacy = window.localStorage.getItem(LEGACY_UNIT_STORAGE_KEY);
    return legacy === 'metric' || legacy === 'imperial' ? legacy : null;
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
