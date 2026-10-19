/**
 * Compas — liens partenaires pertinents pour CE voyage.
 *
 * Le hub charge tous les liens actifs quand le voyage n'a pas de pays de
 * destination : un voyage dans le Vercors se voyait proposer « Hôtels à
 * Chamonix » et « Katmandou et Pokhara ». Un lien attaché à un lieu ne
 * s'affiche que si ce lieu est celui du voyage ; sans pays connu, seuls les
 * liens génériques (sans pays ni destination) restent.
 *
 * Même dans le bon pays, un lien d'un lieu précis (« Hôtels à Chamonix ») ne
 * convient qu'à un voyage qui va à ce lieu : le Vercors n'est pas Chamonix
 * (constat C-004, phase 7). Un lien d'échelle pays (« France ») reste.
 */

export interface AffiliateLinkPlace {
  country_code?: string | null;
  destination_name?: string | null;
}

const plain = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Le nom du lieu du lien est-il celui d'un pays (« France »), pas d'un lieu précis ? */
function isCountryScale(destination: string, countryCode: string | null): boolean {
  if (!countryCode) return false;
  try {
    const names = [new Intl.DisplayNames(['fr'], { type: 'region' }).of(countryCode), new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode)];
    return names.some((n) => n && plain(n) === plain(destination));
  } catch {
    return false;
  }
}

/** Le lieu du lien est-il celui du voyage (même nom, ou l'un commence par l'autre) ? */
function samePlace(linkPlace: string, tripPlace: string): boolean {
  const a = plain(linkPlace);
  const b = plain(tripPlace);
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

export function relevantAffiliateLinks<T extends AffiliateLinkPlace>(
  links: readonly T[],
  tripCountryCode: string | null | undefined,
  tripPlace?: string | null
): T[] {
  const country = tripCountryCode?.trim().toUpperCase() || null;
  return links.filter((link) => {
    const linkCountry = link.country_code?.trim().toUpperCase() || null;
    const place = link.destination_name?.trim() || null;
    if (!country) return linkCountry === null && !place;
    if (linkCountry !== null && linkCountry !== country) return false;
    // Un lieu précis : seulement si c'est celui du voyage.
    if (place && !isCountryScale(place, linkCountry ?? country)) return Boolean(tripPlace) && samePlace(place, tripPlace as string);
    return true;
  });
}
