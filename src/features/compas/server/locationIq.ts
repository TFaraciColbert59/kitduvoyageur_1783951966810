import 'server-only';

/**
 * LocationIQ (offre gratuite : 5 000 requêtes par jour, 2 par seconde ; usage
 * commercial autorisé avec un lien visible vers locationiq.com, vérifié le
 * 8 octobre, `docs/compas/SERVICES-GRATUITS.md`). Même moteur et mêmes
 * données que Nominatim (OpenStreetMap), dont le serveur public interdit le
 * trafic régulier d'une application : avec la clé `LOCATIONIQ_API_KEY`, les
 * appels Nominatim du Compas passent par LocationIQ ; sans elle, rien ne change.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/';
const LOCATIONIQ = 'https://eu1.locationiq.com/v1/';

export function locationIqKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = env.LOCATIONIQ_API_KEY?.trim();
  return k ? k : null;
}

/**
 * L'adresse LocationIQ d'une requête Nominatim (`search` ou `reverse`), ou
 * null si ce n'en est pas une. Paramètres identiques ; `format=json` (LocationIQ
 * ne connaît pas `jsonv2`) et la clé en plus.
 */
export function locationIqUrl(nominatimUrl: string, key: string): string | null {
  if (!nominatimUrl.startsWith(NOMINATIM)) return null;
  const url = new URL(nominatimUrl);
  const path = url.pathname.replace(/^\/+/, '');
  if (path !== 'search' && path !== 'reverse') return null;
  const params = new URLSearchParams(url.search);
  params.set('format', 'json');
  params.set('key', key);
  return `${LOCATIONIQ}${path}?${params.toString()}`;
}

/**
 * Les lignes LocationIQ dans la forme `jsonv2` que lit `parseNominatim` : le
 * nom (absent du format `json`), la catégorie et le type d'adresse.
 */
export function normalizeLocationIq(payload: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(payload) ? payload : payload && typeof payload === 'object' ? [payload] : [];
  return (rows as Array<Record<string, unknown>>).map((r) => {
    const details = (r.namedetails ?? {}) as Record<string, unknown>;
    const first = typeof r.display_name === 'string' ? r.display_name.split(',')[0]?.trim() : '';
    const name =
      (typeof r.name === 'string' && r.name.trim()) ||
      (typeof details.name === 'string' && details.name.trim()) ||
      first ||
      '';
    return {
      ...r,
      name,
      category: r.category ?? r.class,
      addresstype: r.addresstype ?? r.type,
    };
  });
}
