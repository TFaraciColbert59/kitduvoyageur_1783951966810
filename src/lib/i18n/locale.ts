/**
 * locale.ts — Locale runtime LKDV (isomorphe : serveur, client, tests).
 *
 * FR est la langue source et le défaut. L'ANGLAIS N'EST PAS ACTIVÉ tant que
 * toutes les surfaces accessibles ne sont pas traduites : tant que
 * `NEXT_PUBLIC_I18N_EN_ENABLED !== '1'`, la locale résolue est toujours `fr`
 * (aucun mélange FR/EN possible sur une route servie).
 * Lorsque l'activation est explicitement activée, la locale est résolue dans
 * cet ordre :
 *   1. cookie `lkdv_locale` (choix explicite de l'utilisateur) ;
 *   2. en-tête `Accept-Language` ;
 *   3. DEFAULT_LOCALE (`fr`).
 * Aucune dépendance, aucun provider : ce module reste importable côté serveur.
 */

export type Locale = 'fr' | 'en';

export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALES = ['fr', 'en'] as const satisfies readonly Locale[];

export const LOCALE_COOKIE = 'lkdv_locale';

/** Durée de persistance du cookie : 1 an. */
export const LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const INTL_LOCALES: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

/** Balise BCP-47 utilisée par Intl (dates, nombres, monnaies, pluriels). */
export function toIntlLocale(locale: Locale): string {
  return INTL_LOCALES[locale];
}

export function isLocale(value: unknown): value is Locale {
  return value === 'fr' || value === 'en';
}

/**
 * Normalise une balise (`en`, `en-US`, `fr_CA`…) vers une locale supportée.
 * Retourne `null` si la langue n'est pas supportée.
 */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/**
 * Résout `Accept-Language` en respectant les facteurs de qualité (`q=`).
 * Ex. `en-US,en;q=0.9,fr;q=0.8` → `en` ; langue inconnue → `null`.
 */
export function parseAcceptLanguage(
  header: string | null | undefined
): Locale | null {
  if (!header) return null;

  const entries = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      let quality = 1;
      for (const param of params) {
        const match = param.trim().match(/^q=([0-9.]+)$/i);
        if (match) quality = Number(match[1]);
      }
      return { tag, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    const locale = normalizeLocale(entry.tag);
    if (locale) return locale;
  }
  return null;
}

export interface LocaleInput {
  /** Valeur brute du cookie `lkdv_locale`. */
  cookie?: string | null;
  /** Valeur brute de l'en-tête `Accept-Language`. */
  acceptLanguage?: string | null;
}

/**
 * L'anglais n'est activable que par une décision explicite de build/déploiement.
 * Tant qu'il ne l'est pas, aucune surface servie ne peut basculer en anglais :
 * le mélange FR/EN est impossible.
 */
export function isEnglishEnabled(): boolean {
  return process.env.NEXT_PUBLIC_I18N_EN_ENABLED === '1';
}

/**
 * Résout la locale courante. Accepte soit l'objet `{ cookie, acceptLanguage }`,
 * soit une chaîne brute (cookie d'abord, en-tête ensuite) pour les appels simples.
 * Retourne toujours `fr` tant que l'anglais n'est pas explicitement activé.
 */
export function resolveLocale(
  input?: LocaleInput | string | null
): Locale {
  if (!isEnglishEnabled()) return DEFAULT_LOCALE;

  if (typeof input === 'string') {
    return (
      normalizeLocale(input) ?? parseAcceptLanguage(input) ?? DEFAULT_LOCALE
    );
  }
  return (
    normalizeLocale(input?.cookie) ??
    parseAcceptLanguage(input?.acceptLanguage) ??
    DEFAULT_LOCALE
  );
}

/** Lit la valeur d'un cookie dans un en-tête Cookie (client `document.cookie`). */
export function readCookie(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (!cookieHeader || !name) return null;
  const prefix = `${name}=`;
  const part = cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(prefix));
  if (!part) return null;
  const raw = part.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Sérialise le cookie de locale : SameSite=Lax, 1 an, racine du site. */
export function serializeLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
