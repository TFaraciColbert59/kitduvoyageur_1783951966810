import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale, type Locale } from './locale';

/**
 * Locale de la requête en cours (action serveur, route), résolue comme le layout racine :
 * cookie `lkdv_locale`, puis `Accept-Language`, puis `fr`. Toujours `fr` tant que l'anglais
 * n'est pas activé (`NEXT_PUBLIC_I18N_EN_ENABLED`).
 *
 * C'est la LANGUE DE L'INTERFACE choisie par la personne, jamais sa nationalité ni sa résidence :
 * elle peut servir à écrire les consignes de l'IA dans cette langue (PLAN-100 6.2) sans rien
 * apprendre à l'IA sur le voyageur. Hors requête (script, test), `fr`.
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    return resolveLocale({
      cookie: cookieStore.get(LOCALE_COOKIE)?.value,
      acceptLanguage: headerStore.get('accept-language'),
    });
  } catch {
    return DEFAULT_LOCALE;
  }
}
