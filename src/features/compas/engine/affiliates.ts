/**
 * Compas — liens partenaires pertinents pour CE voyage.
 *
 * Le hub charge tous les liens actifs quand le voyage n'a pas de pays de
 * destination : un voyage dans le Vercors se voyait proposer « Hôtels à
 * Chamonix » et « Katmandou et Pokhara ». Un lien attaché à un lieu ne
 * s'affiche que si ce lieu est celui du voyage ; sans pays connu, seuls les
 * liens génériques (sans pays ni destination) restent.
 */

export interface AffiliateLinkPlace {
  country_code?: string | null;
  destination_name?: string | null;
}

export function relevantAffiliateLinks<T extends AffiliateLinkPlace>(
  links: readonly T[],
  tripCountryCode: string | null | undefined
): T[] {
  const country = tripCountryCode?.trim().toUpperCase() || null;
  return links.filter((link) => {
    const linkCountry = link.country_code?.trim().toUpperCase() || null;
    if (country) return linkCountry === null || linkCountry === country;
    return linkCountry === null && !link.destination_name?.trim();
  });
}
