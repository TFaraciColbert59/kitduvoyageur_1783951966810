/**
 * Nuits, eau, ravitaillement et repli d'une étape (6.3, 6.6, 6.10) : traduction des lieux RÉELS lus dans
 * OpenStreetMap (mêmes lieux que le tiroir « Jour » du Compas v5) vers les contrats de l'itinéraire.
 * Module pur. Aucune nuit n'est inventée : sans lieu réel, la nuit est « à trouver » ; un prix n'existe que
 * comme repère du barème du Compas, et il est dit comme tel.
 */
import { poiLabel, type RoutePoi } from '@/features/compas/engine/routePois';
import { rankStayOptions, stayPriceHint } from '@/features/compas/v5/engine/stayOptions';
import type { V5StayKind, V5StayOption } from '@/features/compas/v5/types';
import type { BailoutCandidate } from './insights/bailout';
import type { OvernightCandidate } from './insights/stageSplit';
import { projectOnTrack, round1, type TrackVertex } from './insights/shared';
import type { CollaborativeRoutePoint, OvernightPlace, WaterObservation } from './types';

/** Source affichée à côté de chaque lieu. */
export const PLACES_SOURCE = 'OpenStreetMap (Overpass), contributeurs OpenStreetMap, ODbL';

const TYPE_OF_KIND: Record<V5StayKind, OvernightPlace['type']> = {
  refuge: 'refuge',
  camping: 'camp',
  bivouac: 'bivouac',
  hebergement: 'gite',
};

export const STAY_KIND_LABEL: Record<V5StayKind, string> = {
  refuge: 'Refuge ou abri',
  camping: 'Camping',
  bivouac: 'Bivouac',
  hebergement: 'Hébergement',
};

/** Le lieu retenu pour la nuit, tel que le moteur le garde (position, source, repère de barème). */
export function overnightFromStay(option: V5StayOption, nowIso: string): OvernightPlace {
  return {
    id: option.id,
    name: option.name,
    type: TYPE_OF_KIND[option.kind],
    lat: option.lat,
    lon: option.lon,
    bookingStatus: 'unknown',
    provenance: option.id.startsWith('noted:') ? 'Saisie voyageur' : 'OpenStreetMap',
    lastVerifiedAt: nowIso,
    priceHint: option.price
      ? { perPerson: option.price.perPerson, currency: option.price.currency, basis: option.price.basis, asOf: option.price.asOf }
      : null,
  };
}

/** Nuit notée à la main (nom saisi par la personne) : pas de position propre, donc celle de l'arrivée. */
export function overnightFromNote(
  name: string,
  type: OvernightPlace['type'],
  arrival: { lat: number; lon: number },
  nowIso: string,
): OvernightPlace {
  const kind: V5StayKind = type === 'refuge' || type === 'hut' ? 'refuge' : type === 'camp' ? 'camping' : type === 'bivouac' ? 'bivouac' : 'hebergement';
  const price = stayPriceHint(kind, null);
  return {
    id: `noted:${name.trim()}`,
    name: name.trim().slice(0, 120),
    type,
    lat: arrival.lat,
    lon: arrival.lon,
    bookingStatus: 'unknown',
    provenance: 'Saisie voyageur',
    lastVerifiedAt: nowIso,
    priceHint: price ? { perPerson: price.perPerson, currency: price.currency, basis: price.basis, asOf: price.asOf } : null,
  };
}

/** Nuits possibles près de l'arrivée d'une étape, classées comme le Compas v5 (`rankStayOptions`). */
export function nightOptionsFor(args: {
  arrival: { lat: number; lon: number } | null;
  pois: readonly RoutePoi[];
  noted: string | null;
  party: number;
  countryCode?: string | null;
  limit?: number;
}): V5StayOption[] {
  return rankStayOptions({
    arrival: args.arrival,
    pois: args.pois,
    noted: args.noted,
    party: args.party,
    nights: null,
    countryCode: args.countryCode ?? null,
    limit: args.limit,
  });
}

/** Lieux de nuit réels pour `proposeStageSplit` : hébergements, refuges et campings relevés. */
export function overnightCandidatesFrom(pois: readonly RoutePoi[]): OvernightCandidate[] {
  const out: OvernightCandidate[] = [];
  for (const p of pois) {
    const type: OvernightPlace['type'] | null =
      p.category === 'refuge' ? 'refuge' : p.category === 'camping' ? 'camp' : p.category === 'hebergement' ? 'gite' : null;
    if (!type) continue;
    out.push({ id: `osm:${p.id}`, name: poiLabel(p), type, lat: p.lat, lon: p.lon });
  }
  return out;
}

/** Points d'eau relevés, jamais présentés comme « disponibles » : état et potabilité inconnus. */
export function waterObservationsFrom(pois: readonly RoutePoi[], fetchedAtIso: string): WaterObservation[] {
  return pois
    .filter((p) => p.category === 'water')
    .map((p) => ({
      id: `osm:${p.id}`,
      name: poiLabel(p),
      lat: p.lat,
      lon: p.lon,
      status: 'unknown' as const,
      potableClaim: 'unknown' as const,
      observedAt: fetchedAtIso,
      source: 'osm' as const,
    }));
}

export interface SupplyStop {
  readonly id: string;
  readonly name: string;
  readonly kind: 'commerce' | 'resto';
  /** Distance au tracé de l'étape (km). */
  readonly offsetKm: number;
  /** Position le long de l'étape depuis son début (km). */
  readonly alongKm: number;
}

/** Commerces et restaurants relevés à moins de `maxOffsetKm` du tracé de l'étape, dans l'ordre du parcours. */
export function suppliesAlong(
  vertices: readonly TrackVertex[],
  pois: readonly RoutePoi[],
  maxOffsetKm = 1,
): SupplyStop[] {
  if (vertices.length < 2) return [];
  const out: SupplyStop[] = [];
  for (const p of pois) {
    if (p.category !== 'commerce' && p.category !== 'resto') continue;
    const proj = projectOnTrack(vertices, p.lat, p.lon);
    if (proj && proj.offsetKm <= maxOffsetKm) {
      out.push({ id: `osm:${p.id}`, name: poiLabel(p), kind: p.category, offsetKm: Math.round(proj.offsetKm * 100) / 100, alongKm: round1(proj.alongKm) });
    }
  }
  return out.sort((a, b) => a.alongKm - b.alongKm || a.id.localeCompare(b.id));
}

/**
 * Sorties possibles : arrêts de gare ou de bus (transport) et parkings (accès routier), tels que relevés.
 * Les routes elles-mêmes ne sont pas relevées ici : un parking est le repère d'accès routier le plus fiable.
 */
export function bailoutCandidatesFrom(pois: readonly RoutePoi[]): BailoutCandidate[] {
  const out: BailoutCandidate[] = [];
  for (const p of pois) {
    if (p.category !== 'transport' && p.category !== 'parking') continue;
    out.push({ id: `osm:${p.id}`, name: poiLabel(p), kind: p.category === 'transport' ? 'transport_stop' : 'road', lat: p.lat, lon: p.lon });
  }
  return out;
}

/** Points à interroger pour une étape : l'arrivée (nuit) et quelques jalons du tracé (eau, ravitaillement, sorties). */
export function samplePointsAlong(
  vertices: readonly TrackVertex[],
  count: number,
): { lat: number; lon: number }[] {
  if (vertices.length === 0 || count <= 0) return [];
  const total = vertices[vertices.length - 1].km;
  if (vertices.length === 1 || total <= 0) return [{ lat: vertices[0].lat, lon: vertices[0].lon }];
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const target = count === 1 ? total : (total * (i + 1)) / count;
    const v = vertices.find((x) => x.km >= target) ?? vertices[vertices.length - 1];
    out.push({ lat: v.lat, lon: v.lon });
  }
  return out;
}

export function pointCoords(p: Pick<CollaborativeRoutePoint, 'lat' | 'lon'> | undefined | null): { lat: number; lon: number } | null {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: p.lat, lon: p.lon } : null;
}
