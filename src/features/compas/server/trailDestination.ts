import 'server-only';
import { normalizeTrailRef, trailRefIn } from '../engine/geoTrails';
import type { CompasPlace } from '../engine/places';
import { geoTrailsEnabled, referentialTrail } from './geoTrails';
import { lookupReverse } from './placeLookup';

/**
 * Un code de sentier dit (« GR34 », « le GR 7 en 8 jours ») → la destination tirée du
 * référentiel `geo_trails` : le CENTRE du tracé, son emprise, son nom (sinon sa référence),
 * et le pays lu à ce centre sur la carte (`lookupReverse`, le même géocodage que les autres
 * lieux). Le sentier reste une envie : seule la destination en vient.
 *
 * Null (l'appelant garde alors `trailRegion` puis la recherche par nom, comme avant) quand
 * l'interrupteur `COMPAS_GEO_TRAILS` est éteint (le référentiel n'est alors pas consulté),
 * sans code de sentier, référence inconnue, base muette, ou pays introuvable au centre :
 * rien n'est deviné.
 */
export async function trailDestination(
  said: string,
  /** Référence déjà lue dans la phrase (`set_destination.trail`) : prime sur `said`. */
  saidRef?: string | null
): Promise<CompasPlace | null> {
  if (!geoTrailsEnabled()) return null;
  const ref = (saidRef ? normalizeTrailRef(saidRef) : null) ?? trailRefIn(said);
  if (!ref) return null;
  const trail = await referentialTrail(ref);
  if (!trail) return null;
  const at = await lookupReverse(trail.lat, trail.lon).catch(() => null);
  if (!at?.countryCode) return null;
  return {
    name: (trail.name ?? trail.ref ?? ref).slice(0, 80),
    lat: trail.lat,
    lon: trail.lon,
    countryCode: at.countryCode,
    country: at.country,
    // Ni pays ni région : un lieu naturel étendu, comme un massif ; l'étiquette dit ce que c'est.
    kind: 'other',
    landmark: true,
    // Ordre de `CompasPlace.extent` : [ouest, nord, est, sud].
    extent: [trail.west, trail.north, trail.east, trail.south],
    osmTag: 'route=hiking',
  };
}
