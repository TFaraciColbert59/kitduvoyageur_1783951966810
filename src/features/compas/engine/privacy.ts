import { samePlaceName, type CompasPlace } from './places';

/**
 * La position de la personne n'est jamais transmise exacte à un service tiers
 * (plan 2.10, RGPD) : 0,01° près, soit environ un kilomètre, assez pour
 * chiffrer un trajet, trop peu pour désigner un domicile.
 */
export function coarsePosition(
  p: { lat: number; lon: number } | null
): { lat: number; lon: number } | null {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  return { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 };
}

/** Ce que `positionBase` lit d'un lieu de la carte. */
export type BasePlace = Pick<
  CompasPlace,
  'name' | 'lat' | 'lon' | 'countryCode' | 'country' | 'locality' | 'settlement'
>;

export interface PositionBase {
  name: string;
  lat: number;
  lon: number;
  countryCode: string | null;
  country: string | null;
  kind: 'town';
  /**
   * `commune` : le centre de la commune, tel que la carte le donne. `approximatif` : aucune
   * commune retrouvée sur la carte, la base garde le point arrondi à ~1 km (jamais plus fin).
   */
  basis: 'commune' | 'approximatif';
}

/**
 * La base d'un séjour sans lieu dit (plan 2.10) : LA COMMUNE, pas le point GPS. Ce qui s'écrit
 * sur le voyage (nom, coordonnées de l'étape de chaque jour, ancre de la carte et de la météo)
 * est le nom et le centre de la commune que la carte donne à l'endroit où se trouve la
 * personne ; son point, même arrondi, n'est gardé que si la carte ne nomme aucune commune.
 *
 * - `commune` : le centre de la commune retrouvée par son nom (lieu habité du même nom, près du point) ;
 * - sinon `here` si la carte a répondu par un lieu habité (village, ville) : c'est déjà un centre ;
 * - sinon le point arrondi à 0,01°, nommé par la localité lue à l'adresse ou « Autour de toi ».
 */
export function positionBase(
  at: { lat: number; lon: number },
  here: BasePlace | null,
  commune: BasePlace | null
): PositionBase | null {
  const coarse = coarsePosition(at);
  if (!coarse) return null;
  // `here` n'est un centre que s'il est lui-même la commune (un quartier ou un hameau de la
  // commune n'est pas « la commune » : alors seul `commune`, retrouvée par son nom, vaut).
  const hereIsCommune =
    Boolean(here?.settlement) && (!here?.locality || samePlaceName(here.name, here.locality));
  const centre = commune ?? (hereIsCommune ? here : null);
  if (centre && Number.isFinite(centre.lat) && Number.isFinite(centre.lon)) {
    return {
      name: centre.name,
      lat: centre.lat,
      lon: centre.lon,
      countryCode: centre.countryCode ?? here?.countryCode ?? null,
      country: centre.country ?? here?.country ?? null,
      kind: 'town',
      basis: 'commune',
    };
  }
  return {
    name: here?.locality ?? here?.name ?? 'Autour de toi',
    lat: coarse.lat,
    lon: coarse.lon,
    countryCode: here?.countryCode ?? null,
    country: here?.country ?? null,
    kind: 'town',
    basis: 'approximatif',
  };
}
