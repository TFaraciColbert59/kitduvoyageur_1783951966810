/**
 * Compas — traducteur des textes CALCULÉS par le moteur (PLAN-100 6.1).
 *
 * Même rôle que `compasT` (`compasI18n.ts`) mais sans aucune dépendance au reste du
 * moteur : `format.ts`, `period.ts` ou `kitRules.ts` peuvent l'importer sans cycle.
 * La locale vient de l'appelant (`useTranslation().locale`, `getRequestLocale()`),
 * `'fr'` par défaut : sans elle, le texte est le français d'avant.
 */

import { translations } from '@/lib/i18n/translations';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { t as translate, type TranslationKey, type TranslationVars } from '@/lib/i18n/translate';

export type EngineT = (key: TranslationKey, vars?: TranslationVars) => string;

/** Traducteur pur pour une locale (français par défaut). */
export function engineT(locale: Locale = DEFAULT_LOCALE): EngineT {
  const dict = translations[locale] ?? translations[DEFAULT_LOCALE];
  return (key, vars) => translate(dict, key, vars);
}
