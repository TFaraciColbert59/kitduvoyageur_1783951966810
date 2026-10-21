import 'server-only';
import { cookies, headers } from 'next/headers';
import type { Locale } from './locale';
import { measurePrefsFor, type MeasurePrefs } from './region';
import { UNIT_COOKIE, parseUnitCookie, regionTagFor } from './unitSetting';

/**
 * Unités d'affichage de la requête en cours (PLAN-100 6.3), pour les textes que le SERVEUR écrit
 * ou rend (titres rangés en base, messages) : le réglage explicite de la carte « Paramètres »
 * (cookie `lkdv_units`), sinon la région de la langue de l'interface, lue dans `Accept-Language`
 * seulement si cette balise parle la langue du site (même règle que le navigateur). Hors
 * requête (script, test) : la région de la locale seule. La même règle que `useCompasUnits`.
 */
export async function getRequestUnits(locale: Locale): Promise<MeasurePrefs> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const system = parseUnitCookie(cookieStore.get(UNIT_COOKIE)?.value);
    const first = headerStore.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim() || null;
    return measurePrefsFor(regionTagFor(locale, first), system);
  } catch {
    return measurePrefsFor(locale, null);
  }
}
