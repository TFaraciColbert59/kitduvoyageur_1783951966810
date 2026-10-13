/**
 * Compas — bases multiples à l'échelle d'un pays (PLAN-100 4.5). Module PUR :
 * aucune I/O, même entrée → même résultat, au mètre près.
 *
 * Un voyage dans un pays entier (ou une très grande région) ne se fait pas
 * depuis un seul lieu, et à pied ou à vélo on n'y va pas d'une étape à l'autre
 * (c'est le rôle des grands itinéraires, plan 3.7). On choisit donc plusieurs
 * BASES, une par groupe de jours, parmi les lieux RÉELS que la carte ou le
 * référentiel ont donnés pour la zone (jamais une liste écrite à la main) :
 *
 * - classées par notoriété : la nature de lieu que l'activité préfère
 *   (`profileFor(activity).prefer`) et la population (échelle logarithmique) ;
 *   la régularité des pas ne fait que départager des chaînes voisines ;
 * - deux bases consécutives sont à une distance de TRAJET raisonnable pour le
 *   moyen qui les relie : celui de l'activité si c'est un véhicule (road trip,
 *   van), sinon la voiture d'un séjour sur base (à pied et à vélo, le
 *   changement de base se fait en véhicule) ; bornes = une journée de ce
 *   moyen, du barème de l'activité, ramenée à vol d'oiseau ;
 * - sans retour en arrière : la chaîne avance toujours le long de l'axe
 *   principal du pays (programmation dynamique, optimum exact, pas un tirage).
 *
 * Le nombre de bases vient du séjour par base de l'activité (`baseStay`) ;
 * quand la carte ne permet pas autant de bases (pays étroit, lieux rares),
 * on en pose moins et on le dit au lieu d'en inventer.
 */
import type { StageMove } from './autofill';
import type { AreaPlace, AreaPlaceKind } from './itinerary';
import { BASE, baseStay, profileFor, type Profile } from './activityProfile';
import { along, mainAxis } from './axis';
import { distanceKm } from './places';

/**
 * Au-delà de ce rayon (km), une zone est « un pays » : plusieurs bases, pas une.
 * Valeur historique du serveur (`PLANNED_MAX_KM`) : le planificateur d'étapes
 * à pied sait faire un massif, pas davantage.
 */
export const COUNTRY_SCALE_KM = 150;

/**
 * À partir de cette durée (jours), un voyage dans tout un pays prend deux bases
 * au moins : une semaine dans un seul lieu n'est pas un voyage dans un pays.
 * Même règle que celle appliquée aux propositions de l'IA (`wideStay`).
 */
export const WIDE_STAY_FROM_DAYS = 5;

/**
 * Bases au plus. Plafond historique du planificateur (`planBase`), repris tel quel et
 * NON SOURCÉ : il garde un voyage lisible à l'écran, mais six bases pour soixante jours
 * font dix jours par base (le séjour par base n'est plus alors celui de l'activité).
 */
export const MAX_COUNTRY_BASES = 6;

/**
 * Marge sur le rayon de la zone : un lieu un peu au-delà du cercle compte encore (le cercle d'un
 * pays est un rayon de carte, pas une frontière). Même marge de 10 % que le reste du planificateur.
 */
const ZONE_MARGIN = 1.1;

/**
 * Part de `minKm` dont une base avance au moins sur l'axe du pays par rapport à la précédente :
 * la moitié, pour que deux bases non consécutives (deux pas) soient à `minKm` au moins l'une de l'autre.
 */
const MIN_PROGRESS_RATIO = 0.5;

/**
 * Lieux étudiés au plus (les mieux classés) : borne le calcul. La chaîne
 * optimale coûte `bases × lieux²` distances, soit ~540 000 pour 6 × 300.
 */
export const COUNTRY_POOL_MAX = 300;

/**
 * Poids d'un lieu dit par la personne : plus qu'aucun écart de notoriété (une capitale
 * vaut 3 + 7 points au plus, un bourg inconnu 0 à 3), donc une envie réalisable est retenue.
 */
export const WAYPOINT_BONUS = 10;

/** Un lieu dit tombe sur un lieu de la carte à moins de cette distance (km), comme dans `planMoving`. */
const WAYPOINT_SNAP_KM = 3;

export interface CountryBasesInput {
  /** Lieux réels de la zone (déjà limités au pays par l'appelant). */
  places: readonly AreaPlace[];
  days: number;
  activity: string;
  /** Centre et rayon de la zone : seuls les lieux à moins de 110 % du rayon comptent (`ZONE_MARGIN`). */
  anchor: { lat: number; lon: number; radiusKm: number };
  /** Lieux dits par la personne, déjà retrouvés sur la carte. */
  waypoints?: ReadonlyArray<{ name: string; lat: number; lon: number }>;
}

export interface CountryBase {
  name: string;
  lat: number;
  lon: number;
  /** Identifiant du lieu de la carte ; null pour un lieu dit hors des lieux lus. */
  placeId: string | null;
  kind: AreaPlaceKind;
  /** Jours passés à cette base (la somme des bases fait le voyage). */
  days: number;
  /** Distance à vol d'oiseau depuis la base d'avant (km, arrondie) ; null pour la première. */
  legKm: number | null;
}

export interface CountryBasesPlan {
  bases: CountryBase[];
  /** Moyen des changements de base. */
  move: StageMove;
  /** Bases voulues (jours ÷ séjour par base) ; `bases.length` si la carte n'en permet pas autant. */
  wanted: number;
}

/** Distances d'un changement de base (km à vol d'oiseau) et moyen, pour une activité. */
export interface TransferLegs {
  move: StageMove;
  minKm: number;
  targetKm: number;
  maxKm: number;
}

/**
 * Le changement de base d'une activité. Un road trip ou un van se déplace avec
 * son propre barème. À pied, à vélo, en séjour : une journée de VOITURE d'un
 * séjour sur base (`BASE`), car on ne marche ni ne pédale d'une base à l'autre
 * à l'échelle d'un pays. Bornes = barème du jour de ce véhicule × son
 * coefficient vol d'oiseau : min (changer de base pour moins n'a pas de sens),
 * cible, max (la journée de route la plus longue).
 */
export function transferLegs(activity: string): TransferLegs {
  const prof = profileFor(activity);
  const vehicle: Profile = prof.move === 'voiture' ? prof : BASE;
  return {
    move: vehicle.move,
    minKm: vehicle.dayKm[0] * vehicle.crow,
    targetKm: vehicle.dayKm[1] * vehicle.crow,
    maxKm: vehicle.dayKm[2] * vehicle.crow,
  };
}

/**
 * Bases voulues pour `days` jours : un séjour de `baseStay(activity)` jours par
 * base, deux au moins dès une semaine entière dans un pays (`WIDE_STAY_FROM_DAYS`),
 * `MAX_COUNTRY_BASES` au plus ; une seule sous deux jours ou si le voyage est
 * trop court pour deux séjours.
 */
export function countryBaseCount(activity: string, days: number): number {
  const stay = baseStay(activity);
  if (!Number.isInteger(days) || days < 2) return 1;
  if (days < stay * 2 && days < WIDE_STAY_FROM_DAYS) return 1;
  return Math.min(MAX_COUNTRY_BASES, Math.max(2, Math.ceil(days / stay)));
}

/** `days` jours répartis sur `count` bases, le plus également possible (les premières bases d'abord). */
export function spreadDays(days: number, count: number): number[] {
  const out = new Array<number>(count).fill(0);
  // Le jour i (de 0) est à la base ⌊i × count ÷ days⌋ : division d'entiers, exacte aux bornes (14 jours sur 6 bases : le 8e jour ouvre la 4e).
  for (let i = 0; i < days; i += 1) out[Math.min(count - 1, Math.floor((i * count) / days))] += 1;
  return out;
}

/**
 * Garder le pays de la destination : un lieu d'un autre pays connu est écarté
 * (Espagne dans le carré d'un Portugal). Un lieu sans pays connu reste.
 * Différent de `keepHomeCountry`, qui garde les deux versants d'une frontière
 * pour un massif : ici la destination EST un pays.
 */
export function keepCountry<T extends { countryCode?: string | null }>(places: readonly T[], countryCode: string | null | undefined): T[] {
  if (!countryCode) return [...places];
  return places.filter((p) => !p.countryCode || p.countryCode === countryCode);
}

/**
 * Notoriété d'un lieu pour une activité : la nature que l'activité préfère (0 à 3, le barème de
 * `profileFor`) + le logarithme décimal de la population (3 pour mille habitants, 6 pour un million).
 * Échelle logarithmique : une capitale passe devant une préfecture, deux villes voisines en taille
 * restent proches.
 */
function notoriety(p: AreaPlace, prof: Profile): number {
  return (prof.prefer[p.kind] ?? 0) + Math.log10(Math.max(1, p.population ?? 1));
}

/**
 * Poids de la régularité du pas (par changement de base) face à la notoriété : faible, pour qu'elle
 * ne départage que des chaînes de notoriété voisine. Un facteur 2,5 de population (0,4 point) pèse
 * plus que la meilleure régularité sur quatre changements de base (4 × 0,1).
 */
const STEP_WEIGHT = 0.1;

interface Candidate {
  place: AreaPlace;
  score: number;
  /** Position le long de l'axe principal du pays (km). */
  t: number;
}

/** Régularité du pas : `STEP_WEIGHT` à la distance cible, 0 à un écart d'une cible entière. */
function stepFit(km: number, targetKm: number): number {
  return STEP_WEIGHT * (1 - Math.min(1, Math.abs(km - targetKm) / targetKm));
}

/** Écart sous lequel deux totaux sont égaux : le premier trouvé reste (ordre fixe, jamais de hasard). */
const EPS = 1e-9;

/**
 * Les bases d'un voyage à l'échelle d'un pays, ou null sans lieu réel. La chaîne
 * retenue maximise la notoriété cumulée (plus la régularité des pas) sous trois
 * contraintes : chaque changement de base fait entre `minKm` et `maxKm` à vol
 * d'oiseau, avance d'au moins `minKm / 2` le long de l'axe du pays (jamais de
 * retour en arrière, deux bases non consécutives restent donc à `minKm` l'une
 * de l'autre), et le nombre de bases ne dépasse pas `countryBaseCount`.
 */
export function pickCountryBases(input: CountryBasesInput): CountryBasesPlan | null {
  if (!Number.isInteger(input.days) || input.days < 1) return null;
  const prof = profileFor(input.activity);
  const legs = transferLegs(input.activity);
  const wanted = countryBaseCount(input.activity, input.days);

  // Lieux où l'on peut loger, dans la zone, du mieux classé au moins bien (identifiant en dernier recours).
  const inZone = input.places.filter(
    (p) => p.kind !== 'camp' && p.kind !== 'hut' && distanceKm(input.anchor, p) <= input.anchor.radiusKm * ZONE_MARGIN
  );
  const ranked = inZone
    .map((place) => ({ place, score: notoriety(place, prof) }))
    .sort((a, b) => b.score - a.score || (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0));

  // Une envie dite compte plus que tout rang : sur le lieu de la carte tout proche, sinon sur son propre point.
  const pool: Array<{ place: AreaPlace; score: number }> = ranked.slice(0, COUNTRY_POOL_MAX).map((r) => ({ ...r }));
  for (const w of input.waypoints ?? []) {
    if (distanceKm(input.anchor, w) > input.anchor.radiusKm * ZONE_MARGIN) continue;
    let near: { place: AreaPlace; score: number } | null = null;
    let nearKm = Infinity;
    for (const c of pool) {
      const d = distanceKm(c.place, w);
      if (d <= WAYPOINT_SNAP_KM && d < nearKm) {
        near = c;
        nearKm = d;
      }
    }
    if (near) near.score += WAYPOINT_BONUS;
    else
      pool.push({
        place: { id: `w:${w.name}`, name: w.name, lat: w.lat, lon: w.lon, kind: 'village', population: null, eleM: null },
        score: WAYPOINT_BONUS,
      });
  }
  if (!pool.length) return null;

  // Axe principal du pays, calculé sur le même ensemble quel que soit l'ordre d'entrée.
  const axis = mainAxis(pool.map((c) => c.place));
  const cands: Candidate[] = pool
    .map((c) => ({ place: c.place, score: c.score, t: along(axis, c.place) }))
    .sort((a, b) => a.t - b.t || (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0));
  const P = cands.length;
  const minStep = legs.minKm * MIN_PROGRESS_RATIO;

  // best[c][j] : meilleur total d'une chaîne de c bases qui finit en j ; from[c][j] : la base d'avant.
  const best: number[][] = Array.from({ length: wanted + 1 }, () => new Array<number>(P).fill(-Infinity));
  const from: number[][] = Array.from({ length: wanted + 1 }, () => new Array<number>(P).fill(-1));
  for (let j = 0; j < P; j += 1) best[1][j] = cands[j].score;
  // Toutes les paires : 300 lieux × 6 bases font ~225 000 distances, quelques dizaines de millisecondes.
  for (let c = 2; c <= wanted; c += 1) {
    for (let j = 0; j < P; j += 1) {
      for (let i = j - 1; i >= 0; i -= 1) {
        // Avancer d'au moins `minStep` sur l'axe (jamais de retour en arrière) depuis une chaîne déjà possible.
        if (cands[j].t - cands[i].t < minStep || best[c - 1][i] === -Infinity) continue;
        const km = distanceKm(cands[i].place, cands[j].place);
        if (km < legs.minKm || km > legs.maxKm) continue;
        const total = best[c - 1][i] + cands[j].score + stepFit(km, legs.targetKm);
        if (total > best[c][j] + EPS) {
          best[c][j] = total;
          from[c][j] = i;
        }
      }
    }
  }

  // Le plus de bases possible (jusqu'à `wanted`), puis le meilleur total, puis la position la plus en amont de l'axe.
  let count = wanted;
  let end = -1;
  for (; count >= 1; count -= 1) {
    let top = -Infinity;
    for (let j = 0; j < P; j += 1) {
      if (best[count][j] > top + EPS) {
        top = best[count][j];
        end = j;
      }
    }
    if (top > -Infinity) break;
  }
  if (count < 1 || end < 0) return null;

  const chain: Candidate[] = [];
  let at = end;
  for (let c = count; c >= 1; c -= 1) {
    chain.unshift(cands[at]);
    at = from[c][at];
  }
  const stays = spreadDays(input.days, chain.length);
  return {
    move: legs.move,
    wanted,
    bases: chain.map((c, k) => ({
      name: c.place.name,
      lat: c.place.lat,
      lon: c.place.lon,
      placeId: c.place.id.startsWith('w:') ? null : c.place.id,
      kind: c.place.kind,
      days: stays[k],
      legKm: k === 0 ? null : Math.round(distanceKm(chain[k - 1].place, c.place)),
    })),
  };
}
