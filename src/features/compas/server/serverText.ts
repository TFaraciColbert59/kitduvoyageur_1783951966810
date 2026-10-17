/**
 * Compas — messages des actions serveur dans la langue de la personne (PLAN-100 6.1).
 *
 * CONCEPTION RETENUE (tranchée le 2026-10-17) : la traduction se fait CÔTÉ SERVEUR, à la
 * source du message, dans la langue de la requête (`getRequestLocale` : cookie
 * `lkdv_locale`, puis `Accept-Language`, puis `fr` ; toujours `fr` tant que l'anglais n'est
 * pas activé). L'action renvoie toujours `{ success: false, error: string }` : aucun
 * appelant ni composant ne change, `res.error` / `st.blocked` s'affichent tels quels.
 *
 * Écartée : un `errorCode` stable traduit par le client. Elle obligeait à toucher chaque
 * point d'affichage (écran, tiroirs, flux « Où », kit, Résa…) et laissait le texte
 * français de chaque action en double (code + texte) ; les notes de la préparation, faites
 * de données (lieux, distances), ne se réduisent pas à un code. Côté serveur, un seul
 * fichier par action change et le français reste celui du dictionnaire FR, identique à
 * l'ancien texte en dur (les tests existants le vérifient).
 *
 * Règles :
 *  - un message est une clé `compas.server.…` (dictionnaire `compas-server.fr.ts` / `.en.ts`) ;
 *    données en emplacements `{var}`, pluriels par `serverPlural` (Intl.PluralRules) ;
 *  - un message de validation zod est écrit comme une CLÉ dans le schéma, traduit par
 *    `serverIssue` ; un texte qui n'est pas une clé (autre module) passe tel quel : repli ;
 *  - hors requête (test, script), la langue est `fr` : le français d'avant.
 *  - journaux serveur (`console.*`, `reportServerError`) et données rangées en base (titres,
 *    libellés de dépenses) ne passent pas par ici : ils restent en français.
 */

import { getRequestLocale } from '@/lib/i18n/serverLocale';
import { toIntlLocale, type Locale } from '@/lib/i18n/locale';
import { fromPlace, toPlace } from '../engine/itinerary';
import { formatNumber } from '@/lib/i18n/format';
import { translations } from '@/lib/i18n/translations';
import {
  getTranslation,
  plural,
  t as translate,
  type TranslationKey,
  type TranslationVars,
} from '@/lib/i18n/translate';

/** Clé d'un message serveur du Compas. */
export type CompasServerKey = Extract<TranslationKey, `compas.server.${string}`>;

/** Traducteur lié à une locale, pour une action qui écrit plusieurs messages. */
export interface ServerT {
  locale: Locale;
  (key: CompasServerKey, vars?: TranslationVars): string;
  /** Pluriel : `{count}` reçoit le nombre formaté pour la locale. */
  plural: (
    count: number,
    one: CompasServerKey,
    other: CompasServerKey,
    vars?: TranslationVars
  ) => string;
  /** Nombre décimal tel qu'il est déjà arrondi : « 2,5 » en français, « 2.5 » en anglais. */
  decimal: (value: number) => string;
  /** Provenance d'un lieu : « de Sarlat », « du Truel » / « from Sarlat ». */
  from: (name: string) => string;
  /** Destination d'un trajet : « à Périgueux », « aux Vans » / « to Périgueux ». */
  to: (name: string) => string;
  /** Emplacement d'une base : « à Masouri », « au Truel » / « in Masouri ». */
  at: (name: string) => string;
  /** Énumération : « a, b et c » / « a, b and c » (Intl.ListFormat). */
  list: (items: string[]) => string;
  /** Nom du mois (1 à 12) : « février » / « February ». */
  month: (month: number) => string;
}

/** Message dans une locale donnée (pur). */
export function serverMessage(
  locale: Locale,
  key: CompasServerKey,
  vars?: TranslationVars
): string {
  return translate(translations[locale] ?? translations.fr, key, vars);
}

/** Pluriel `…One` / `…Other` choisi par Intl.PluralRules, `{count}` formaté (pur). */
export function serverPlural(
  locale: Locale,
  count: number,
  one: CompasServerKey,
  other: CompasServerKey,
  vars?: TranslationVars
): string {
  const key = plural(locale, count, { one, other }) as CompasServerKey;
  return serverMessage(locale, key, {
    ...vars,
    count: formatNumber(count, { useGrouping: false }, locale),
  });
}

/** Vrai pour une clé qui existe dans le dictionnaire `compas.server`. */
export function isServerKey(value: unknown): value is CompasServerKey {
  return (
    typeof value === 'string' &&
    value.startsWith('compas.server.') &&
    getTranslation(translations.fr, value) !== null
  );
}

/**
 * Message de validation (zod) : une clé du Compas est traduite ; un texte libre (venu d'un
 * autre module) passe tel quel ; rien du tout donne le message de repli.
 */
export function serverIssue(
  locale: Locale,
  message: string | undefined,
  fallback: CompasServerKey
): string {
  if (!message) return serverMessage(locale, fallback);
  return isServerKey(message) ? serverMessage(locale, message) : message;
}

/** Traducteur pur pour une locale. */
export function serverTFor(locale: Locale): ServerT {
  const t = ((key: CompasServerKey, vars?: TranslationVars) =>
    serverMessage(locale, key, vars)) as ServerT;
  t.locale = locale;
  t.plural = (count, one, other, vars) => serverPlural(locale, count, one, other, vars);
  // Le français d'avant écrivait `String(x).replace('.', ',')` : gardé tel quel.
  t.decimal = (value) => (locale === 'fr' ? String(value).replace('.', ',') : String(value));
  t.from = (name) => (locale === 'fr' ? fromPlace(name) : `from ${name.trim()}`);
  t.to = (name) => (locale === 'fr' ? toPlace(name) : `to ${name.trim()}`);
  t.at = (name) => (locale === 'fr' ? toPlace(name) : `in ${name.trim()}`);
  t.list = (items) =>
    new Intl.ListFormat(toIntlLocale(locale), { style: 'long', type: 'conjunction' }).format(items);
  t.month = (month) =>
    new Intl.DateTimeFormat(toIntlLocale(locale), { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2001, (month - 1 + 12) % 12, 15))
    );
  return t;
}

/** Traducteur dans la langue de la requête en cours. */
export async function serverT(): Promise<ServerT> {
  return serverTFor(await getRequestLocale());
}

/** Un message dans la langue de la requête en cours. */
export async function serverText(key: CompasServerKey, vars?: TranslationVars): Promise<string> {
  return serverMessage(await getRequestLocale(), key, vars);
}

/** Échec d'une action, dans la langue de la requête en cours. */
export async function actionError(
  key: CompasServerKey,
  vars?: TranslationVars
): Promise<{ success: false; error: string }> {
  return { success: false, error: await serverText(key, vars) };
}

/** Échec d'une action sur un message de validation (zod) : voir `serverIssue`. */
export async function issueError(
  message: string | undefined,
  fallback: CompasServerKey
): Promise<{ success: false; error: string }> {
  return { success: false, error: serverIssue(await getRequestLocale(), message, fallback) };
}
