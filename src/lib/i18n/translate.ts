/**
 * translate.ts — Interpolation et pluriels i18n LKDV (pur, sans React).
 *
 * Les clés sont des chemins pointés (`progression.pointsLifetime`) typés à
 * partir du dictionnaire FR via `TranslationKey`. Une clé absente est
 * retournée telle quelle (jamais d'exception) pour rester observable en test.
 */

import type { Locale } from './locale';
import type { TranslationKeys } from './translations/fr';

type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

/** Chemin pointé valide vers une chaîne du dictionnaire. */
export type TranslationKey = Leaves<TranslationKeys>;

export type TranslationVars = Record<string, string | number>;

export type PluralForms = {
  /** Forme utilisée pour la catégorie CLDR `one`. */
  one: string;
  /** Forme utilisée pour toute autre catégorie (dont `other`). */
  other: string;
};

/** Remplace `{var}` par sa valeur ; un placeholder inconnu reste intact. */
export function interpolate(
  template: string,
  vars?: TranslationVars
): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : placeholder
  );
}

/** Lit une chaîne du dictionnaire par chemin pointé, `null` si absente. */
export function getTranslation(
  dict: TranslationKeys,
  key: string
): string | null {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

/** Traduit une clé avec interpolation optionnelle. */
export function t(
  dict: TranslationKeys,
  key: TranslationKey,
  vars?: TranslationVars
): string {
  const template = getTranslation(dict, key);
  if (template === null) return key;
  return interpolate(template, vars);
}

const pluralRulesCache = new Map<Locale, Intl.PluralRules>();

/**
 * Pluriel via `Intl.PluralRules` avec deux formes documentées `one | other`.
 * CLDR : FR → 0 et 1 sont `one` ; EN → 1 est `one`, 0 est `other`.
 * Toute catégorie non-`one` (other, many, few…) retombe sur `other`.
 */
export function plural(
  locale: Locale,
  count: number,
  forms: PluralForms
): string {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules.select(count) === 'one' ? forms.one : forms.other;
}
