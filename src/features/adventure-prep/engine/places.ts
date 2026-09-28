/**
 * Lieux reels du preparateur.
 *
 * Une etape sans nom de lieu n est pas une etape : c est une intention. Ce
 * module rattache donc chaque intention a un point d interet REEL — issu de la
 * base du projet — plutot que de laisser « Pause nature » flotter sans lieu.
 *
 * Ce qu'il ne fait jamais : inventer un lieu, un prix ou une position. Un
 * candidat incomplet est refuse, un prix absent reste « a verifier », et le
 * modele d origine n est jamais modifie.
 */

import { haversineKm, type GeoPoint } from './routing';
import {
  PRICE_TO_CHECK,
  type DayNote,
  type ItineraryModel,
  type ItineraryStep,
  type ItineraryStepKind,
  type PlaceRef,
} from '../types';

/** Ce qu'on sait d'un point d'interet, et rien de plus. */
export interface PlaceCandidate {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly lat: number;
  readonly lon: number;
  readonly description: string | null;
  readonly region: string | null;
  readonly country: string | null;
  /** Prix par nuit tel que stocke ; `null` si la base n'en dit rien. */
  readonly pricePerNight: number | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly isVerifiable: boolean;
}

// L inventaire transmis au proposeur : le NOM et la CATEGORIE, rien d autre.
//
// Volontairement plus pauvre que `PlaceCandidate`. Le proposeur n a pas besoin
// de coordonnees — il ne les invente pas, il recopie — mais il a besoin de
// savoir que Lac Blanc est de l eau et Refuge du Gouter un refuge, sinon il
// les interchangeable et propose une nuit sur un lac.
export interface PlaceInventory {
  readonly name: string;
  readonly category: string;
  // Position REELLE, quand la source la fournit. Elle n est jamais recopiee par
  // le modele - le schema de sortie ne contient aucun champ de coordonnee -
  // mais elle lui permet d ordonner le parcours du bon sens : sans elle, il
  // enchainait un sommet et un hameau comme s ils etaient voisins.
  readonly lat?: number | null;
  readonly lon?: number | null;
}

const KNOWN_CATEGORIES = new Set([
  'refuge',
  'camping',
  'stay',
  'summit',
  'col',
  'viewpoint',
  'water',
  'waterfall',
  'food',
  'transport',
  'poi',
]);

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Convertit un point d'interet brut. Refuse ce qui n'a pas de nom ou pas de
 * position : un lieu non situe ne peut ni apparaitre sur la carte, ni recevoir
 * une distance.
 */
export function toCandidate(raw: unknown): PlaceCandidate | null {
  const poi = raw as Record<string, unknown> | null;
  if (!poi || typeof poi !== 'object') return null;

  const name = textOrNull(poi.name);
  const lat = numberOrNull(poi.lat);
  const lng = numberOrNull(poi.lng ?? poi.lon);
  if (name === null || lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const tags = (poi.tags ?? {}) as Record<string, unknown>;
  const category = textOrNull(poi.category);
  const price =
    numberOrNull(poi.price_per_night) ?? numberOrNull(tags.price_per_night);

  return {
    id: textOrNull(poi.id) ?? `${name}:${lat}:${lng}`,
    name,
    category: category && KNOWN_CATEGORIES.has(category) ? category : 'poi',
    lat,
    lon: lng,
    description: textOrNull(poi.description) ?? textOrNull(poi.details),
    region: textOrNull(poi.region),
    country: textOrNull(poi.country),
    pricePerNight: price,
    phone: textOrNull(poi.phone),
    website: textOrNull(poi.website),
    isVerifiable: poi.is_verified !== false,
  };
}

/** Categories compatibles avec chaque type d'etape. */
export function kindCategories(kind: ItineraryStepKind): readonly string[] {
  switch (kind) {
    case 'nuit':
      return ['refuge', 'camping', 'stay', 'poi'];
    case 'arret':
      return ['viewpoint', 'col', 'summit', 'waterfall', 'poi'];
    case 'ravitaillement':
      return ['water', 'food', 'poi'];
    case 'repos':
      // Une pause se fait quelque part : un belvedere, un col, un point de vue
      // rencontre sur le parcours. Laisser `repos` sans categorie rendait la
      // pause DEFINITIVEMENT introuvable, donc chaque journee portant une
      // pause restait « a verifier » — distance, denivele et duree compris.
      return ['viewpoint', 'col', 'poi'];
    case 'trajet':
      return [];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Attribution                                                         */
/* ------------------------------------------------------------------ */

const point = (candidate: PlaceCandidate): GeoPoint => ({ lat: candidate.lat, lon: candidate.lon });

/**
 * Nom comparable : casse, accents, apostrophes et ponctuation disparaissent.
 *
 * « Plan de l'Aiguille » et « plan de l aiguille » doivent designer le meme
 * refuge. C est une regle de correspondance, pas une comparaison de chaines :
 * une base reelle et une reponse de modele ne s ecriront jamais de meme facon.
 */
export function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2018\u2019`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** En dessous de cette longueur, une correspondance n est pas un nom de lieu. */
const MIN_MATCH = 4;

/**
 * Le lieu REEL que l etape cite, ou `null`.
 *
 * L egalite exacte passe d abord : « Lac Blanc » designe Lac Blanc, et non
 * « Bivouac Lac Blanc ». L enclenchement ne vient qu ensuite, parce qu un
 * redacteur ecrit volontiers « Refuge du Plan de l'Aiguille » en supprimant
 * l article. Le plus long nom gagne : c est le lieu le plus precis, donc le
 * moins d inference.
 */
export function matchNamedPlace(
  candidates: readonly PlaceCandidate[],
  text: string | null,
): PlaceCandidate | null {
  if (text === null || text.trim() === '') return null;
  const cible = normalizePlaceName(text);
  if (cible.length < MIN_MATCH) return null;

  for (const candidate of candidates) {
    if (normalizePlaceName(candidate.name) === cible) return candidate;
  }

  let best: PlaceCandidate | null = null;
  let bestLength = 0;
  for (const candidate of candidates) {
    const nom = normalizePlaceName(candidate.name);
    if (nom.length < MIN_MATCH) continue;
    if (cible.includes(nom) && nom.length > bestLength) {
      best = candidate;
      bestLength = nom.length;
    }
  }
  return best;
}

/**
 * Une etape sans lieu Recoit AUCUNE position.
 *
 * Cette fonction existe parce que la confiance ne doit pas reposer sur une
 * validation a posteriori : si aucune source reelle ne place l intention,
 * aucune coordonnee ne doit subsister. Elle est aussi le seul endroit ou une
 * position peut disparaitre, donc le seul a tester.
 */
function unlocated(step: ItineraryStep): ItineraryStep {
  return { ...step, lat: null, lon: null };
}

/**
 * Place le point le plus proche ET compatible, par rapport au dernier point
 * connu. Le parcours avance : on ne revient pas en arriere chercher un refuge
 * deja depasse.
 */
function nearestCompatible(
  candidates: readonly PlaceCandidate[],
  used: ReadonlySet<string>,
  from: GeoPoint,
  kind: ItineraryStepKind,
): PlaceCandidate | null {
  const allowed = new Set(kindCategories(kind));
  let best: PlaceCandidate | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (used.has(candidate.id)) continue;
    if (!allowed.has(candidate.category)) continue;
    const km = haversineKm(from, point(candidate));
    if (km < bestKm) {
      bestKm = km;
      best = candidate;
    }
  }
  return best;
}

function applyCandidate(
  step: ItineraryStep,
  candidate: PlaceCandidate,
): ItineraryStep {
  const priced = step.kind === 'nuit' && candidate.pricePerNight !== null;
  return {
    ...step,
    placeName: candidate.name,
    // Le titre affiche devient le nom du lieu reel. C'est ce qui supprime la
    // repetition « Eau et ravitaillement » / « Ravitaillement et eau » : deux
    // etapes qui portent le nom de leur lieu ne peuvent pas se confondre.
    title: candidate.name,
    lat: candidate.lat,
    lon: candidate.lon,
    price: priced
      ? { amount: candidate.pricePerNight, currency: 'EUR', state: 'propose' }
      : step.price,
  };
}

/**
 * Rattache les etapes compatibles a des lieux reels.
 *
 * Les deux trajets extremes gardent les lieux que la personne a choisis : on
 * ne remplace jamais sa destination par un point d'interet trouve plus proche.
 */
export function assignPlaces(
  model: ItineraryModel,
  candidates: readonly PlaceCandidate[],
  origin: PlaceRef | null,
  destination: PlaceRef | null,
): ItineraryModel {
  const ordered = [...model.steps].sort((a, b) => a.day - b.day || a.order - b.order);
  const trajets = ordered.filter((step) => step.kind === 'trajet');
  const firstTrajetId = trajets[0]?.id ?? null;
  const lastTrajetId = trajets[trajets.length - 1]?.id ?? null;

  // Le premier trajet de CHAQUE journee. Sur un voyage de trois jours, le
  // modele ouvre chaque journee par un deplacement : sans ancrage, la
  // deuxieme journee n aurait aucun point de depart, donc aucune distance.
  const firstTrajetByDay = new Map<number, string>();
  for (const step of ordered) {
    if (step.kind !== 'trajet') continue;
    if (!firstTrajetByDay.has(step.day)) firstTrajetByDay.set(step.day, step.id);
  }

  const used = new Set<string>();
  let cursor: GeoPoint = origin
    ? { lat: origin.lat, lon: origin.lon }
    : { lat: NaN, lon: NaN };
  let hasCursor = origin !== null;

  const steps = ordered.map((step) => {
    if (step.kind === 'trajet') {
      if (step.id === firstTrajetId) {
        if (!origin) return unlocated(step);
        cursor = { lat: origin.lat, lon: origin.lon };
        hasCursor = true;
        return { ...step, placeName: origin.name, lat: origin.lat, lon: origin.lon };
      }
      if (step.id === lastTrajetId) {
        if (!destination) return unlocated(step);
        return {
          ...step,
          placeName: destination.name,
          lat: destination.lat,
          lon: destination.lon,
        };
      }
      // Journee 2 et suivantes : on repart du point ou la journee precedente
      // s est arretee. C est une continuite, pas une invention : le point vient
      // lui-meme de la base ou de la personne.
      if (firstTrajetByDay.get(step.day) === step.id && hasCursor) {
        return { ...step, lat: cursor.lat, lon: cursor.lon };
      }
      return unlocated(step);
    }

    if (!hasCursor) return unlocated(step);

    // Le lieu CITE prime sur le lieu le plus proche. Sans cela, un refuge
    // demande a 8 km se voyait remplacer par un point de vue a 2 km, et le
    // parcours affichait un autre nom que celui de l invitation.
    const cited = step.placeName !== null && step.placeName.trim() !== '';
    const named = matchNamedPlace(candidates, cited ? step.placeName : step.title);
    if (named && !used.has(named.id)) {
      used.add(named.id);
      cursor = point(named);
      return applyCandidate(step, named);
    }
    // Un lieu nomme que la base ne contient pas n est pas un lieu : aucune
    // position ne peut lui etre donnee. Le rattacher au point le plus proche
    // afficherait un autre nom que celui demande, et la distance mesuree ne
    // serait celle de rien. L intention devient une note.
    if (cited && named === null) return unlocated(step);
    // Un lieu nomme et deja visite ne recoit pas la meme position deux fois :
    // l intention est DEPLACEE vers un autre lieu real et compatible. Si la
    // journee n en offre aucun, elle devient une note - honnete, et non un
    // aller-retour au meme point qui ferait mentir la distance.
    const candidate = nearestCompatible(candidates, used, cursor, step.kind);
    if (!candidate) return unlocated(step);
    used.add(candidate.id);
    cursor = point(candidate);
    return applyCandidate(step, candidate);
  });

  return demoteOrphans({ ...model, steps });
}

/**
 * Une etape sans position n est pas une etape : c est une intention.
 *
 * La laisser dans `steps` casse toute la journee : `routeItinerary` n accepte
 * un trajet que si TOUTES les etapes sont situees, et `applyActivityDurations`
 * n additionne que si TOUTES ont une duree. Une seule intention non rattachee
 * suffisait donc a faire passer distance, denivele et duree a « a verifier ».
 *
 * On la retire donc de la liste et on la garde en note : la personne voit ce
 * qu elle a demande, sans qu un lieu soit invente pour la faire exister.
 */
function demoteOrphans(model: ItineraryModel): ItineraryModel {
  const steps: ItineraryStep[] = [];
  const notes: DayNote[] = [];

  for (const step of model.steps) {
    if (step.lat !== null && step.lon !== null) {
      steps.push(step);
      continue;
    }
    notes.push({
      day: step.day,
      kind: step.kind,
      title: step.title,
      reason: step.reason,
    });
  }

  return { ...model, steps, notes: [...(model.notes ?? []), ...notes] };
}

/* ------------------------------------------------------------------ */
/* Budget                                                             */
/* ------------------------------------------------------------------ */

/**
 * Budget d'une journee. Volontairement strict : si une seule etape n'a pas de
 * prix connu, le total serait une somme partielle presentee comme le budget
 * du jour — ce que l'utilisateur lirait comme un nombre fiable.
 */
export function dayBudget(model: ItineraryModel, day: number): number | null {
  const steps = model.steps.filter((step) => step.day === day);
  if (steps.length === 0) return null;
  let total = 0;
  for (const step of steps) {
    if (step.price.amount === null) return null;
    total += step.price.amount;
  }
  return Math.round(total * 100) / 100;
}

export { PRICE_TO_CHECK };
