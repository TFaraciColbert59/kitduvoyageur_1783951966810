/**
 * Compas — grandes îles à pied (PLAN-100 4.5). Module PUR : aucune I/O, même
 * entrée → même zone.
 *
 * Une grande île (Sardaigne, Corse, Crète, Sicile…) n'est ni un massif ni un
 * pays : à pied, on ne la traverse pas en voiture d'étape en étape, et son
 * centre géométrique n'est presque jamais là où l'on randonne (Sicile : une
 * plaine près d'Enna). On cherche donc LE massif de l'île, à partir des seuls
 * lieux habités que la carte ou le référentiel ont rendus avec leur altitude :
 * la zone est celle où les lieux sont, ensemble, les plus au-dessus du niveau
 * ordinaire de l'île. Aucun nom de massif n'est écrit ici ni deviné : sans
 * altitudes, sans lieu dit par la personne, on ne choisit rien (null).
 */
import { lonDelta, wrapLon } from './longitude';
import { planningZoneKm, type AreaPlace } from './itinerary';
import { distanceKm } from './places';

/** Natures OSM d'une île (`place=island`) qu'une destination peut porter. */
const ISLAND_KINDS: ReadonlySet<string> = new Set(['island', 'islet']);
const ISLAND_TAG = /^place=(island|islet)$/;

/**
 * La destination est-elle une île ? Par sa nature (Nominatim et Geoapify rendent
 * « island »), ou par son étiquette OSM gardée avec l'ancre (Photon range une
 * île sous « other » : l'étiquette `place=island` est alors la seule trace).
 */
export function isIslandAnchor(anchor: { kind?: string | null; osmTag?: string | null }): boolean {
  return ISLAND_KINDS.has(anchor.kind ?? '') || ISLAND_TAG.test(anchor.osmTag ?? '');
}

/**
 * Altitudes connues qu'il faut au moins pour parler du relief d'une île :
 * la même borne que `keepHighlands` (en dessous, la médiane ne veut rien dire).
 */
export const ISLAND_MIN_RELIEF_PLACES = 10;

/** Natures de lieux habités qui disent où est le massif (ni refuge, ni camping). */
const SETTLEMENT = new Set<AreaPlace['kind']>(['city', 'town', 'village', 'hamlet']);

/** Un lieu dont l'altitude est connue. */
type Known = AreaPlace & { eleM: number };

export interface IslandZoneInput {
  /** Lieux réels de l'île, avec l'altitude quand elle est lue. */
  places: readonly AreaPlace[];
  /** L'île : son centre et la demi-diagonale de son emprise (km). */
  island: { lat: number; lon: number; halfExtentKm: number };
  activity: string;
  days: number;
  /** Lieu dit par la personne, déjà retrouvé sur l'île : la zone s'y centre. */
  near?: { name?: string; lat: number; lon: number } | null;
}

export interface IslandZone {
  /** Centre de la zone (un point de recherche, pas forcément un lieu). */
  center: { lat: number; lon: number };
  /** Rayon de la zone (km) : celui d'un voyage à pied dans un lieu naturel, jamais plus de 48. */
  radiusKm: number;
  /** Le lieu de la carte le plus proche du centre : nomme le choix à l'écran. */
  around: string | null;
  /** Altitude du lieu le plus haut de la zone (m), si une altitude est connue. */
  highestM: number | null;
  /** Lieux habités de la zone dont l'altitude est connue. */
  places: number;
  why: 'altitude' | 'lieu dit';
}

/** Altitude au-dessus de laquelle un lieu compte pour le massif : la médiane des lieux de l'île (comme `keepHighlands`). */
function medianEle(eles: readonly number[]): number {
  const sorted = [...eles].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * La zone où randonner sur une grande île, ou null (île qui tient dans sa propre
 * zone, relief inconnu). Le rayon est celui que le planificateur donnerait à un
 * lieu naturel sans emprise (`planningZoneKm`) : le reste du calcul ne change pas.
 */
export function pickIslandZone(input: IslandZoneInput): IslandZone | null {
  const radiusKm = planningZoneKm({ activity: input.activity, days: input.days, halfExtentKm: null, settlement: false });
  // Une île qui tient dans une zone n'a pas de massif à choisir : le centre convient.
  if (!(input.island.halfExtentKm > radiusKm)) return null;

  const onIsland = input.places.filter((p) => SETTLEMENT.has(p.kind) && distanceKm(input.island, p) <= input.island.halfExtentKm * 1.1);
  const nearest = (c: { lat: number; lon: number }) => {
    let top: AreaPlace | null = null;
    let topKm = Infinity;
    for (const p of onIsland) {
      const d = distanceKm(c, p);
      if (d < topKm || (d === topKm && top && p.id < top.id)) {
        top = p;
        topKm = d;
      }
    }
    return top?.name ?? null;
  };
  const known = onIsland.filter((p): p is Known => p.eleM != null && Number.isFinite(p.eleM));
  const inZone = (c: { lat: number; lon: number }) => known.filter((p) => distanceKm(c, p) <= radiusKm);
  const highest = (c: { lat: number; lon: number }) => inZone(c).reduce<number | null>((m, p) => (m == null || p.eleM > m ? p.eleM : m), null);

  // La personne a dit un lieu de l'île : c'est lui, le reste de l'île n'est pas son voyage.
  if (input.near && distanceKm(input.island, input.near) <= input.island.halfExtentKm * 1.1) {
    const center = { lat: input.near.lat, lon: input.near.lon };
    return {
      center,
      radiusKm,
      around: input.near.name ?? nearest(center),
      highestM: highest(center),
      places: inZone(center).length,
      why: 'lieu dit',
    };
  }

  if (known.length < ISLAND_MIN_RELIEF_PLACES) return null;
  const ordinary = medianEle(known.map((p) => p.eleM));
  // Chaque lieu au-dessus du niveau ordinaire de l'île est un centre possible ; sa zone vaut la somme de
  // ce que ses lieux dépassent ce niveau : plusieurs lieux hauts ensemble font un massif, un seul n'en fait pas.
  let top: { center: Known; score: number } | null = null;
  const candidates = [...known].filter((p) => p.eleM > ordinary).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const c of candidates) {
    const score = inZone(c).reduce((t, p) => t + Math.max(0, p.eleM - ordinary), 0);
    if (!top || score > top.score + 1e-9 || (Math.abs(score - top.score) <= 1e-9 && c.eleM > top.center.eleM)) top = { center: c, score };
  }
  if (!top) return null;

  // Le centre de la zone : le barycentre des lieux hauts qu'elle réunit, pas le seul lieu de départ du calcul.
  const members = inZone(top.center).filter((p) => p.eleM > ordinary);
  const weight = (p: Known) => p.eleM - ordinary;
  const total = members.reduce((t, p) => t + weight(p), 0);
  const lat = members.reduce((t, p) => t + p.lat * weight(p), 0) / total;
  const lon = wrapLon(top.center.lon + members.reduce((t, p) => t + lonDelta(top!.center.lon, p.lon) * weight(p), 0) / total);
  const center = { lat, lon };
  return { center, radiusKm, around: nearest(center), highestM: highest(center), places: inZone(center).length, why: 'altitude' };
}
