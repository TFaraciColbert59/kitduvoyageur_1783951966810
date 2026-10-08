/**
 * Identité du site auprès des services ouverts (plan 1.8).
 *
 * MET Norway, Nominatim, Photon, Overpass et Valhalla demandent un User-Agent
 * qui nomme l'application et donne un moyen de la joindre ; MET Norway répond
 * 403 sans lui. Le contact est le site en production : avant ce module, des
 * appels annonçaient `lekitduvoyageur.fr` ou `kitduvoyageur.fr`, qui ne sont pas
 * nos domaines.
 */
export const SITE_CONTACT_URL = 'https://koosmoweb.fr';

/** `kitduvoyageur/1.0 (+https://koosmoweb.fr)`, ou avec l'usage : `(Compas; +https://koosmoweb.fr)`. */
export function appUserAgent(purpose?: string): string {
  return `kitduvoyageur/1.0 (${purpose ? `${purpose}; ` : ''}+${SITE_CONTACT_URL})`;
}
