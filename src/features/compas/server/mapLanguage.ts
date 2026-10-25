/**
 * Langue des recherches de lieux (PLAN-100 6.4) : la LANGUE DE L'INTERFACE (`getRequestLocale`),
 * transmise à Photon (`lang`), à Nominatim ou LocationIQ (`accept-language`) et à Geoapify (`lang`),
 * pour que les noms reviennent dans la langue du voyageur. Le français reste le régime d'avant.
 */

/**
 * Langues acceptées par le Photon public (photon.komoot.io). Vérifié le 17 octobre 2026 : une autre
 * valeur rend 400 « Language is not supported. Supported are: default, de, en, fr » (`it` compris,
 * bien que la documentation générale de Photon en cite d'autres pour les instances maison).
 */
const PHOTON_LANGS = new Set(['default', 'de', 'en', 'fr']);

/** La langue à demander à Photon : la langue de l'interface si le serveur public la connaît, sinon `default` (noms locaux). */
export function photonLang(lang: string): string {
  const l = lang.trim().toLowerCase();
  return PHOTON_LANGS.has(l) ? l : 'default';
}

/**
 * Clé de cache d'une recherche dans cette langue : la clé française est celle d'avant, À
 * L'IDENTIQUE (les entrées déjà partagées, mémoire et `geo_cache`, restent servies) ; une autre
 * langue préfixe la clé (`en:v3:8:lyon`), jamais confondue avec une clé française.
 */
export function languageCacheKey(key: string, lang: string): string {
  return lang === 'fr' ? key : `${lang}:${key}`;
}
