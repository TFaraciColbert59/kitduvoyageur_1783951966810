/**
 * Identité du site auprès des services ouverts (plan 1.8).
 *
 * MET Norway, Nominatim, Photon, Overpass et Valhalla demandent un User-Agent
 * qui nomme l'application et donne un moyen de la joindre ; MET Norway répond
 * 403 sans lui. Le contact doit répondre : avant ce module, des appels annonçaient
 * `lekitduvoyageur.fr` ou `kitduvoyageur.fr`, qui ne sont pas nos domaines, et
 * `koosmoweb.fr` a cessé d'exister le 13 octobre (plus de résolution DNS).
 *
 * Contact = `APP_CONTACT_URL` quand il est posé (le domaine de production définitif,
 * à décider), sinon l'adresse de production que Vercel garde au projet, qui répond.
 */
const DEFAULT_CONTACT_URL = 'https://kitduvoyageur-1783951966810-ruddy.vercel.app';

function contactUrl(raw: string | undefined): string {
  if (!raw) return DEFAULT_CONTACT_URL;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' ? url.origin : DEFAULT_CONTACT_URL;
  } catch {
    return DEFAULT_CONTACT_URL;
  }
}

export const SITE_CONTACT_URL = contactUrl(process.env.APP_CONTACT_URL);

/** L'hôte du contact (`X-Client-Id` demandé par le Valhalla de FOSSGIS). */
export const SITE_CONTACT_HOST = new URL(SITE_CONTACT_URL).host;

/** `kitduvoyageur/1.0 (+https://…)`, ou avec l'usage : `(Compas; +https://…)`. */
export function appUserAgent(purpose?: string): string {
  return `kitduvoyageur/1.0 (${purpose ? `${purpose}; ` : ''}+${SITE_CONTACT_URL})`;
}
