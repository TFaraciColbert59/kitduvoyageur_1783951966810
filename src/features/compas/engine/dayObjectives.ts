/**
 * Compas — séjour de randonnée sur une base : un objectif RÉEL par journée (fonctions pures, testées).
 *
 * Quand une zone de randonnée ne porte pas assez de lieux où dormir pour un itinéraire de village en
 * village (la zone de Zakopane : un seul bourg à distance d'étape), les journées restaient toutes sur la
 * base, vides. Ici on reste sur une base (un lieu où dormir réel) et chaque jour reçoit un objectif lu
 * sur la carte autour d'elle : sommet, lac, refuge, col, point de vue. Aucun lieu n'est inventé :
 * un objectif est un objet OpenStreetMap nommé, ou un refuge déjà trouvé parmi les lieux de la zone.
 * La distance du jour est une estimation ANNONCÉE (vol d'oiseau × 2 × détour à pied), jamais une mesure.
 *
 * Même entrée → même résultat. Aucune I/O ici (`server/stagePoiLookup.ts` lit la carte).
 */

import { distanceKm } from './places';
import { RANK, profileFor } from './activityProfile';
import { LEG_DETOUR, estimatedLegKm } from './legDistance';
import { withinExtent, type AreaPlace, type ItineraryInput } from './itinerary';
import { overpassUsable } from './stagePois';

export type ObjectiveKind = 'peak' | 'lake' | 'hut' | 'pass' | 'viewpoint';

export interface DayObjective {
  /** Identifiant OSM (« n123 », « w456 ») : sert aussi à départager. */
  id: string;
  name: string;
  kind: ObjectiveKind;
  lat: number;
  lon: number;
  eleM: number | null;
  /** Objet relié à Wikipédia ou Wikidata : un lieu connu passe avant un sommet anonyme. */
  notable: boolean;
}

export interface PickedObjective extends DayObjective {
  /** Distance à vol d'oiseau de la base (km). */
  crowKm: number;
  /** Aller-retour estimé (km, au dixième) : vol d'oiseau × 2 × détour à pied. */
  roundTripKm: number;
  /** Dénivelé positif minimal (m) : différence d'altitude avec la base, quand les deux sont connues. */
  ascentM: number | null;
}

/** Rayon (km) autour de la base où l'on cherche les objectifs : un jour de marche aller, avec de la marge. */
export const OBJECTIVE_RADIUS_KM = 11;
/** Un objectif plus près de la base que cela n'est pas une journée. */
const MIN_CROW_KM = 1.5;
/** Deux objectifs de deux jours différents sont à plus de cette distance l'un de l'autre. */
const MIN_APART_KM = 1.5;

/* ---------- Lecture d'OpenStreetMap (Overpass) ---------- */

const PER_CATEGORY: Array<{ filter: string; cap: number }> = [
  // Les sommets reliés à Wikidata d'abord : une zone de montagne en compte des centaines, les connus passent avant.
  { filter: '["natural"="peak"]["name"]["wikidata"]', cap: 60 },
  { filter: '["natural"="peak"]["name"]', cap: 120 },
  { filter: '["natural"="saddle"]["name"]', cap: 50 },
  { filter: '["mountain_pass"="yes"]["name"]', cap: 30 },
  { filter: '["natural"="water"]["water"~"^(lake|pond|reservoir)$"]["name"]', cap: 50 },
  { filter: '["tourism"="viewpoint"]["name"]', cap: 40 },
  { filter: '["tourism"="alpine_hut"]["name"]', cap: 30 },
];

/** Requête Overpass des objectifs de journée autour d'un lieu : une requête, un plafond par nature. */
export function buildObjectivesQuery(center: { lat: number; lon: number }, radiusKm = OBJECTIVE_RADIUS_KM): string {
  const around = `(around:${Math.round(radiusKm * 1000)},${center.lat.toFixed(5)},${center.lon.toFixed(5)})`;
  const parts = PER_CATEGORY.map((c) => `nwr${c.filter}${around};out center tags ${c.cap};`);
  return `[out:json][timeout:25];${parts.join('')}`;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};

function kindOf(tags: Record<string, unknown>): ObjectiveKind | null {
  if (tags.natural === 'peak') return 'peak';
  if (tags.natural === 'saddle' || tags.mountain_pass === 'yes') return 'pass';
  if (tags.natural === 'water') return 'lake';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'alpine_hut') return 'hut';
  return null;
}

/**
 * Réponse Overpass → objectifs : nommés (jamais un nom inventé), position valide, sans doublon
 * (même identifiant, ou même nom et même nature à moins d'un kilomètre). Réponse coupée : liste vide.
 */
export function parseObjectives(payload: unknown): DayObjective[] {
  if (!overpassUsable(payload)) return [];
  const elements = (payload as { elements: unknown[] }).elements as Array<Record<string, unknown>>;
  const out: DayObjective[] = [];
  for (const el of elements) {
    const tags = (el.tags && typeof el.tags === 'object' ? el.tags : {}) as Record<string, unknown>;
    const kind = kindOf(tags);
    const name = typeof tags.name === 'string' ? tags.name.trim().slice(0, 80) : '';
    if (!kind || !name) continue;
    const center = (el.center && typeof el.center === 'object' ? el.center : {}) as Record<string, unknown>;
    const lat = num(el.lat) ?? num(center.lat);
    const lon = num(el.lon) ?? num(center.lon);
    const rawId = num(el.id);
    if (lat == null || lon == null || rawId == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const id = `${typeof el.type === 'string' ? el.type[0] : 'n'}${rawId}`;
    if (out.some((o) => o.id === id || (o.name === name && o.kind === kind && distanceKm(o, { lat, lon }) < 1))) continue;
    out.push({ id, name, kind, lat, lon, eleM: num(tags.ele) != null ? Math.round(num(tags.ele) as number) : null, notable: tags.wikidata != null || tags.wikipedia != null });
  }
  return out;
}

/** Les refuges déjà trouvés parmi les lieux de la zone sont aussi des objectifs (aucune requête de plus). */
export function objectivesFromHuts(places: readonly AreaPlace[]): DayObjective[] {
  return places
    .filter((p) => p.kind === 'hut' && p.name.trim() !== '')
    .map((p) => ({ id: p.id, name: p.name.trim(), kind: 'hut' as const, lat: p.lat, lon: p.lon, eleM: p.eleM, notable: false }));
}

/** Fusionne des listes d'objectifs : un même lieu (même nom à moins de 400 m) n'est gardé qu'une fois, le mieux renseigné d'abord. */
export function mergeObjectives(lists: ReadonlyArray<readonly DayObjective[]>): DayObjective[] {
  const out: DayObjective[] = [];
  for (const o of lists.flat()) {
    const twin = out.findIndex((q) => q.id === o.id || (q.name === o.name && distanceKm(q, o) < 0.4));
    if (twin < 0) out.push(o);
    else if (out[twin].eleM == null && o.eleM != null) out[twin] = { ...out[twin], eleM: o.eleM, notable: out[twin].notable || o.notable };
  }
  return out;
}

/* ---------- Choix de la base ---------- */

/**
 * La base du séjour : un lieu où dormir réel, jamais un camping ni un refuge. Une ville ou un village dit
 * (`startAt`) est la base ; sinon le lieu le plus important près du centre de la zone, dans l'emprise.
 * Null quand la zone n'a aucun lieu où dormir (aucune base inventée : l'appelant se replie).
 */
export function pickStayBase(input: {
  places: readonly AreaPlace[];
  center: { lat: number; lon: number };
  radiusKm: number;
  extent?: ItineraryInput['extent'];
  startAt?: { name: string; lat: number; lon: number } | null;
}): { name: string; lat: number; lon: number; id: string | null; eleM: number | null } | null {
  const lodging = input.places.filter((p) => p.kind !== 'camp' && p.kind !== 'hut');
  if (input.startAt) {
    const s = input.startAt;
    const same = lodging.find((p) => p.name === s.name && distanceKm(p, s) <= 3);
    return { name: s.name, lat: s.lat, lon: s.lon, id: same?.id ?? null, eleM: same?.eleM ?? null };
  }
  let top: AreaPlace | null = null;
  let topScore = -Infinity;
  for (const p of lodging) {
    const d = distanceKm(input.center, p);
    if (d > input.radiusKm * 1.15 || !withinExtent(p, input.extent ?? null)) continue;
    // Une base de séjour est un lieu où l'on trouve à dormir et à manger : le rang administratif compte plus que pour une étape.
    const pop = p.population && p.population > 0 ? Math.min(1, Math.log10(p.population) / 6) : 0;
    const s = RANK[p.kind] * 0.6 + pop - 2 * (d / Math.max(1, input.radiusKm));
    if (s > topScore + 1e-9 || (Math.abs(s - topScore) <= 1e-9 && top && p.id < top.id)) {
      top = p;
      topScore = s;
    }
  }
  return top ? { name: top.name, lat: top.lat, lon: top.lon, id: top.id, eleM: top.eleM } : null;
}

/* ---------- Choix d'un objectif par jour ---------- */

const KIND_WEIGHT: Record<ObjectiveKind, number> = { peak: 2, lake: 2, hut: 2, pass: 1.4, viewpoint: 1 };

function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const angleApart = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Un objectif par jour, au plus (moins s'il n'y a pas assez de lieux dans la fenêtre de marche). Fenêtre :
 * de 1,5 km à une journée de marche aller (barème de l'activité, ou distance du jour dite, divisée par deux
 * pour l'aller-retour, ramenée à vol d'oiseau). Choix glouton et déterministe : notoriété, altitude gagnée,
 * distance proche de la cible ; deux objectifs voisins ou dans la même direction ne se suivent pas si autre
 * chose existe. Rendus du plus court au plus long (on monte en puissance au fil du séjour).
 */
export function pickDayObjectives(input: {
  base: { lat: number; lon: number; eleM: number | null; name?: string };
  objectives: readonly DayObjective[];
  days: number;
  activity: string;
  /** Distance du jour dite (km de terrain, aller-retour compris). */
  targetKmPerDay?: number | null;
}): PickedObjective[] {
  const prof = profileFor(input.activity);
  const detour = LEG_DETOUR.marche;
  const targetTerrain = input.targetKmPerDay ?? prof.dayKm[1];
  const maxTerrain = input.targetKmPerDay ? input.targetKmPerDay * 1.4 : prof.dayKm[2];
  const targetCrow = targetTerrain / (2 * detour);
  // Marge de 30 % : le détour réel d'un sentier est au moins celui du barème, jamais mesuré ici.
  const maxCrow = (maxTerrain * 1.3) / (2 * detour);
  const baseName = (input.base.name ?? '').trim().toLowerCase();
  const pool = input.objectives
    .map((o) => ({ o, d: distanceKm(input.base, o) }))
    .filter(({ o, d }) => d >= MIN_CROW_KM && d <= maxCrow && o.name.trim().toLowerCase() !== baseName)
    .sort((a, b) => (a.o.id < b.o.id ? -1 : 1));
  const chosen: Array<{ o: DayObjective; d: number }> = [];
  const want = Math.max(0, Math.floor(input.days));
  while (chosen.length < want && pool.length) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    pool.forEach(({ o, d }, i) => {
      let s = KIND_WEIGHT[o.kind] + (o.notable ? 1.5 : 0);
      if (o.eleM != null && input.base.eleM != null) s += Math.min(1.5, Math.max(0, o.eleM - input.base.eleM) / 600);
      s += 1.5 * (1 - Math.min(1.5, Math.abs(d - targetCrow) / Math.max(1, targetCrow)));
      for (const c of chosen) {
        if (c.o.kind === o.kind) s -= 0.7;
        if (angleApart(bearingDeg(input.base, o), bearingDeg(input.base, c.o)) < 30) s -= 0.8;
      }
      if (s > bestScore + 1e-9) {
        bestScore = s;
        bestIdx = i;
      }
    });
    if (bestIdx < 0) break;
    const [pick] = pool.splice(bestIdx, 1);
    chosen.push(pick);
    // Jamais deux jours sur le même sommet ou à côté (même croupe, même lac).
    for (let i = pool.length - 1; i >= 0; i -= 1) if (distanceKm(pool[i].o, pick.o) < MIN_APART_KM) pool.splice(i, 1);
  }
  return chosen
    .sort((a, b) => a.d - b.d || (a.o.id < b.o.id ? -1 : 1))
    .map(({ o, d }) => ({
      ...o,
      crowKm: Math.round(d * 10) / 10,
      roundTripKm: estimatedLegKm(2 * d, 'marche') ?? 0,
      ascentM:
        o.eleM != null && input.base.eleM != null && o.eleM - input.base.eleM >= 50 ? Math.round((o.eleM - input.base.eleM) / 10) * 10 : null,
    }));
}

/* ---------- Ce que vaut le séjour ---------- */

export type BaseStayState = 'complete' | 'base_only' | 'source_silent';

/**
 * L'état d'un séjour sur base :
 *  - `complete` : au moins `min(jours, 3)` objectifs réels (tous les jours, ou presque) ;
 *  - `source_silent` : moins que cela ET la carte n'a pas répondu (Overpass muet) : la zone n'est pas jugée, le
 *    calcul sera rejoué ;
 *  - `base_only` : moins que cela alors que la carte a répondu : la base est posée, les journées sans objectif
 *    sont à compléter (la zone n'est pas dite « pauvre » : `poor_zone` reste aux itinéraires de lieu en lieu).
 */
export function baseStayState(picked: number, days: number, mapAnswered: boolean): BaseStayState {
  if (picked >= Math.min(Math.max(1, days), 3)) return 'complete';
  return mapAnswered ? 'base_only' : 'source_silent';
}
