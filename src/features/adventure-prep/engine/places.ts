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
import { publishPartial } from './partialBus';
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
  /**
   * CLE INTERNE de deduplication. Ce n'est PAS une reference de catalogue :
   * elle existe seulement pour qu'un meme point ne soit pas attribue deux
   * fois dans un meme programme. Elle ne doit jamais etre publiee.
   */
  readonly id: string;
  /**
   * Identifiant REEL dans le catalogue d'origine, quand la source en fournit
   * un. `null` quand elle n'en fournit pas : une source OSM rend un nom et
   * des coordonnees, jamais un identifiant. Aucun identifiant ne doit etre
   * SYNTHETISE - une valeur fabriquee se lit comme une reference cliquable
   * qui ne mene nulle part.
   */
  readonly catalogId?: string | null;
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
  /**
   * Identifiant REEL du catalogue d origine, quand la source en fournit un.
   * `null` ou absent sinon. transporter cette valeur est ce qui permet de
   * rattacher une etape a un lieu sans repasser par une recherche par nom.
   */
  readonly catalogId?: string | null;
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
    // La cle interne ci-dessus se deduit des coordonnees : elle reste
    // LOCALE. L identite PUBLIEE, elle, ne vaut que si la source l a fournie.
    catalogId: textOrNull(poi.id),
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
    // `!== false` affirmait la confiance de la base sur tous les points qui
    // n en parlaient pas. L absence d information se dit : elle vaut `false`.
    isVerifiable: poi.is_verified === true,
  };
}

/** Categories compatibles avec chaque type d'etape. */
export function kindCategories(kind: ItineraryStepKind): readonly string[] {
  switch (kind) {
    case 'nuit':
      // 'poi' est la categorie de REPLI d'un lieu inconnu. La garder ici en
      // faisait un joker : n'importe quelle boutique devenait un hebergement.
      return ['refuge', 'camping', 'stay'];
    case 'arret':
      return ['viewpoint', 'col', 'summit', 'waterfall'];
    case 'ravitaillement':
      return ['water', 'food'];
    case 'repos':
      // Une pause se fait quelque part : un belvedere, un col, un point de vue
      // rencontre sur le parcours. Laisser `repos` sans categorie rendait la
      // pause DEFINITIVEMENT introuvable, donc chaque journee portant une
      // pause restait « a verifier » — distance, denivele et duree compris.
      return ['viewpoint', 'col'];
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
 * Les articles francais, et eux seuls.
 *
 * Le redacteur ecrit « refuge Grands Mulets » ; la source reelle ecrit
 * « Refuge des Grands Mulets ». Ces deux noms designent le meme refuge, et les
 * mettre en equivalence n invente rien : c est une regle de correspondance,
 * comme l accent ou la casse. Les mots-lieux ne sont pas concernes.
 */
const ARTICLES: ReadonlySet<string> = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'au', 'aux',
]);

/**
 * Le nom comparable, ARTICLES RETIRES.
 *
 * Passe par `normalizePlaceName` : un seul etat d entrees, donc une seule
 * definition de « comparable ». Retirer un article ne peut qu elargir
 * l appariement, jamais le restreindre.
 */
export function normalizePlaceKey(value: string): string {
  return normalizePlaceName(value)
    .split(' ')
    .filter((mot) => !ARTICLES.has(mot))
    .join(' ');
}

/**
 * Sous cette longueur, un mot ne prouve rien.
 *
 * Mesure sur le massif de Chamonix : "Aiguille du Midi" et "Aiguille des
 * Glaciers" partagent "aiguille" et designent deux sommets differents. Un mot
 * long ne suffit donc pas a prouver qu on parle du meme lieu ; il en faut deux.
 */
const SIGNIFICANT_WORD = 4;

/**
 * Le pluriel seul ne distingue pas un lieu.
 *
 * Le redacteur ecrit "Grand Mulets" la ou le geocodeur repond "Refuge des
 * Grands Mulets" : c est le meme refuge, a une lettre pres. On retire donc le
 * `s` final, mais seulement au-dela de quatre lettres, sans quoi "midi", "pic",
 * "lac" et "tour" se videraient de leur fin et Fincheraient par designer le
 * meme sommet.
 */
function sansPluriel(mot: string): string {
  return mot.length > SIGNIFICANT_WORD && mot.endsWith('s') ? mot.slice(0, -1) : mot;
}

/**
 * Les mots d un nom qui portent assez de sens pour prouver une identite.
 *
 * Les articles sont deja retires en amont, donc il ne reste que des mots
 * pleins. Le pluriel est rabattu, parce que "grands" et "grand" nomment la
 * meme chose.
 */
function motsSignificatifs(cle: string): ReadonlySet<string> {
  const mots = cle
    .split(' ')
    .filter((mot) => mot.length >= SIGNIFICANT_WORD)
    .map(sansPluriel);
  return new Set(mots);
}

/**
 * Le nombre de mots significatifs que deux noms partagent, ou 0.
 *
 * Le seuil de DEUX est ce qui distingue cette passe des precedentes : un seul
 * mot commun prouve une famille de noms, pas un lieu. Deux prouveront que
 * "Grand Mulets" et "Refuge des Grands Mulets" designent le meme refuge.
 */
function motsCommuns(cibleKey: string, nomKey: string): number {
  const a = motsSignificatifs(cibleKey);
  const b = motsSignificatifs(nomKey);
  // Un seul des deux cotes etant pauvre en mots, l accord ne prouve rien.
  if (a.size < 2 || b.size < 2) return 0;
  let commun = 0;
  for (const mot of a) if (b.has(mot)) commun += 1;
  return commun;
}

/**
 * Le lieu partage au moins DEUX mots significatifs avec l etape, ou `null`.
 *
 * Cinquieme et derniere passe, celle qui rapporte le plus de succes : sans elle,
 * « Grand Mulets » ne trouvait pas « Refuge des Grands Mulets » — les deux
 * noms ne se contiennent pas, ne s'egalent pas, et l etape restait donc sans
 * position, donc sans chaine a router, donc sans kilometre.
 *
 * Elle ne peut qu AJOUTER une correspondance la ou les quatre precedentes ont
 * rendu `null`, jamais en déplacer une : elle ne s'execute qu' apres elles.
 * Le plus long nom gagne, comme dans toutes les autres passes : c'est le lieu
 * le plus precis, donc le moins d'inference.
 */
function meilleurParMotsCommuns(
  candidates: readonly PlaceCandidate[],
  cibleKey: string,
): PlaceCandidate | null {
  let best: PlaceCandidate | null = null;
  let bestLength = 0;
  for (const candidate of candidates) {
    const nomKey = normalizePlaceKey(candidate.name);
    if (nomKey.length < MIN_MATCH) continue;
    if (motsCommuns(cibleKey, nomKey) < 2) continue;
    const longueur = normalizePlaceName(candidate.name).length;
    if (longueur > bestLength) {
      best = candidate;
      bestLength = longueur;
    }
  }
  return best;
}

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
  if (best !== null) return best;

  // Les deux passes ci-dessus comparent des noms ou un article manque a
  // l un des deux. C est le cas du redacteur ET celui du geocodeur, qui
  // renvoie « Refuge des Grands Mulets » la ou le modele ecrivait « refuge
  // Grands Mulets ». Sans ce passage, le lieu reste introuvable alors que les
  // deux noms designent la meme montagne.
  const cibleKey = normalizePlaceKey(text);
  if (cibleKey.length < MIN_MATCH) return null;

  for (const candidate of candidates) {
    if (normalizePlaceKey(candidate.name) === cibleKey) return candidate;
  }

  for (const candidate of candidates) {
    const nomKey = normalizePlaceKey(candidate.name);
    if (nomKey.length < MIN_MATCH) continue;
    if (cibleKey.includes(nomKey) && nomKey.length > bestLength) {
      best = candidate;
      bestLength = nomKey.length;
    }
  }
  if (best !== null) return best;
  return meilleurParMotsCommuns(candidates, cibleKey);
}

/**
 * Une etape sans lieu Recoit AUCUNE position.
 *
 * Cette fonction existe parce que la confiance ne doit pas reposer sur une
 * validation a posteriori : si aucune source reelle ne place l intention,
 * aucune coordonnee ne doit subsister. Elle est aussi le seul endroit ou une
 * position peut disparaitre, donc le seul a tester.
 */
/**
 * Une etape RATTACHEE a un lieu.
 *
 * Ce type etait un PANSEMENT : `ItineraryStep` ne declarait pas `placeId`,
 * et cette intersection locale servait a le porter a sa place. Le modele
 * porte desormais le champ, et `tsc` oblige chaque producteur a le
 * declarer. L intersection n a plus rien a ajouter.
 *
 * Conserve en alias : les appelants et les tests nomment encore ce type,
 * et les renommer ne fermerait aucun ecart reel.
 */
export type BoundItineraryStep = ItineraryStep;

/** Un programme dont chaque etape porte son identite de lieu. */
export type BoundItineraryModel = ItineraryModel;

function unlocated(step: ItineraryStep, placeId: string | null = null): BoundItineraryStep {
  return { ...step, lat: null, lon: null, placeId };
}

/**
 * Rayon maximal de rattachement, en kilometres.
 *
 * Aligne sur `GEOCODE_REACH_KM` (placeGeocode) : le programme ne rattache
 * un point que s il est proche de ce que la personne a reellement choisi. Au
 * dela, « rattacher quand meme » produisait une journee entiere de mesures
 * calculees a des centaines de kilometres du parcours demande.
 */
export const NEAREST_REACH_KM = 25;

/** Le point retenu, et la distance a vol d'oiseau qui l a fait retenir. */
export interface ScoredPlace {
  readonly candidate: PlaceCandidate;
  /** Distance REELE mesuree, jamais une distance de route ni une duree. */
  readonly distanceKm: number;
}

/**
 * Place le point le plus proche ET compatible, par rapport au dernier point
 * connu. Le parcours avance : on ne revient pas en arriere chercher un refuge
 * deja depasse.
 *
 * Cette fonction est PUBLIEE, et son resultat garde la mesure qui l a decide.
 * Rendre un candidat nu faisait disparaitre la seule donnee verifiable de
 * l operation : l ecran affichait la meme confiance pour un point a 200 m et
 * pour un point a 180 km.
 */
export function nearestCompatible(
  candidates: readonly PlaceCandidate[],
  used: ReadonlySet<string>,
  from: GeoPoint,
  kind: ItineraryStepKind,
  reachKm: number = NEAREST_REACH_KM,
): ScoredPlace | null {
  // Un curseur non fini (pas de depart choisi) rend `haversineKm` NaN, et
  // `NaN < Infinity` est vrai : le PREMIER candidat aurait ete retenu sur
  // un calcul sans valeur. On refuse donc des deux cotes.
  if (!Number.isFinite(reachKm) || reachKm <= 0) return null;
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lon)) return null;

  const allowed = new Set(kindCategories(kind));
  let best: ScoredPlace | null = null;
  for (const candidate of candidates) {
    if (used.has(candidate.id)) continue;
    if (!allowed.has(candidate.category)) continue;
    const km = haversineKm(from, point(candidate));
    if (!Number.isFinite(km) || km > reachKm) continue;
    if (!best || km < best.distanceKm) {
      best = { candidate, distanceKm: km };
    }
  }
  return best;
}

function applyCandidate(
  step: ItineraryStep,
  candidate: PlaceCandidate,
): BoundItineraryStep {
  // Le prix ne survit QUE s'il est celui du lieu qui vient d'etre pose. La
  // version precedente conservait `step.price` quand la base n avait aucun
  // prix pour ce refuge : une nuit affichait alors le prix plausible de la
  // proposition d'avant, pour un lieu qui ne l'a jamais annonce.
  const nuit = step.kind === 'nuit';
  const prixConnu = nuit && candidate.pricePerNight !== null;
  const price = prixConnu
    ? { amount: candidate.pricePerNight, currency: 'EUR' as const, state: 'propose' as const }
    : nuit
      ? PRICE_TO_CHECK
      : step.price;

  return {
    ...step,
    placeName: candidate.name,
    // Le titre affiche devient le nom du lieu reel. C'est ce qui supprime la
    // repetition « Eau et ravitaillement » / « Ravitaillement et eau » : deux
    // etapes qui portent le nom de leur lieu ne peuvent pas se confondre.
    title: candidate.name,
    lat: candidate.lat,
    lon: candidate.lon,
    placeId: candidate.catalogId ?? null,
    price,
    // AUCUN detail de prix n’est produit ici, MEME quand le montant est
    // connu. `PriceBreakdown` exige `perPerson` ET `groupTotal` : la base ne
    // dit pas si `price_per_night` est par personne, par chambre ou par tente,
    // et le moteur ne connait pas la taille du groupe. Les recopier sur le
    // montant affiche « 75 € pour 3 personnes » — un nombre qu’aucune
    // source ne porte. Le montant reste dans `price`, avec son etat honnete :
    // la ligne « à vérifier » disparait, la donnee reste.
    priceBreakdown: nuit ? null : step.priceBreakdown,
  };
}

/**
 * Rattache les etapes compatibles a des lieux reels.
 *
 * Les deux trajets extremes gardent les lieux que la personne a choisis : on
 * ne remplace jamais sa destination par un point d'interet trouve plus proche.
 *
 * Chaque etape rendue porte un `placeId` EXPLICITE : l'identifiant de
 * catalogue du lieu, ou `null`. Le champ existe deja sur `PlaceRef` pour les
 * lieux choisis par la personne ; il etait simplement jete, alors qu'il
 * etait la seule identite REELLE disponible dans la fonction.
 */
export function assignPlaces(
  model: ItineraryModel,
  candidates: readonly PlaceCandidate[],
  origin: PlaceRef | null,
  destination: PlaceRef | null,
): BoundItineraryModel {
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

  // D3 — la geometrie est PUBLIEE etape par etape, des qu elle est vraie.
  //
  // Une seule passe finale ne laisse rien dessiner : la carte restait figee
  // pendant toute l'affectation des lieux, puis sautait d'un coup a la fin.
  // Chaque etape localisee est donc publiee aussitot, dans l'ordre ou le
  // parcours la produit. Le modele publie ne porte QUE des etapes avec une
  // position reelle : une intention non rattachee n'est pas un point, et la
  // publier dessinerait un trace qui n'existe pas. Aucune anticipation, donc
  // aucune position inventee — le trace peut se corriger ensuite, ce qui est
  // honnete ; il ne peut pas etre fabrique, ce qui ne le serait pas.
  const localisees: ItineraryStep[] = [];
  const steps = ordered.map((step) => {
    const next = ((): ItineraryStep => {
    if (step.kind === 'trajet') {
      if (step.id === firstTrajetId) {
        if (!origin) return unlocated(step);
        cursor = { lat: origin.lat, lon: origin.lon };
        hasCursor = true;
        return {
          ...step,
          placeName: origin.name,
          lat: origin.lat,
          lon: origin.lon,
          // La personne a choisi ce lieu : son identifiant est REEL.
          placeId: origin.id,
        };
      }
      if (step.id === lastTrajetId) {
        // Le dernier trajet vise l arrivee en aller simple, le DEPART en
        // boucle : la regle que derivent deja route.shape et que pose
        // buildItinerary. Sans ce choix, une boucle perdait son Retour — le
        // destination etant null, cette etape revenait sans position, donc
        // sans distance ni meteo, et le titre « Boucle du Mont-Blanc »
        // restait une promesse que rien ne mesurait.
        const cible = destination ?? origin;
        if (!cible) return unlocated(step);
        return {
          ...step,
          placeName: cible.name,
          lat: cible.lat,
          lon: cible.lon,
          placeId: cible.id,
        };
      }
      // Journee 2 et suivantes : on repart du point ou la journee precedente
      // s est arretee. C est une continuite, pas une invention : le point vient
      // lui-meme de la base ou de la personne.
      if (firstTrajetByDay.get(step.day) === step.id && hasCursor) {
        // Continuite, pas un lieu choisi : le curseur vient d'une position
        // deja ecrite plus haut, son identifiant y est deja porte. On ne le
        // recopie donc pas ici — il n'appartient pas a cette etape.
        return { ...step, lat: cursor.lat, lon: cursor.lon, placeId: null };
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
    const scored = nearestCompatible(candidates, used, cursor, step.kind);
    if (!scored) return unlocated(step);
    used.add(scored.candidate.id);
    cursor = point(scored.candidate);
    return applyCandidate(step, scored.candidate);
    })();
    if (next.lat !== null && next.lon !== null) {
      localisees.push(next);
      publishPartial({ ...model, steps: [...localisees] });
    }
    return next;
  });

  return demoteOrphans({ ...model, steps }) as BoundItineraryModel;
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
/**
 * Budget d une journee, DECOMPOSE.
 *
 * Le contrat est honnete par construction : `known` ne contient que des prix
 * reellement ports par une etape, et `unknownCount` dit combien d etapes du
 * jour en restent a verifier. L ecran peut donc afficher
 * « 75 € connus · 3 étapes à vérifier » — ce qui est un fait — au lieu
 * d effacer l information, ou pire, de presenter une somme partielle comme
 * le total du jour.
 */
export interface DayBudget {
  /** Somme des seuls prix connus, a l arrondi centime. */
  known: number;
  /** Étapes du jour dont le prix n est pas connu. */
  unknownCount: number;
  /** Étapes du jour qui portent un prix. */
  pricedCount: number;
  /** Vrai quand toutes les etapes ont un prix : `known` est alors le total. */
  complete: boolean;
  /** Vrai quand aucune etape n a de prix : il n y a rien a presenter. */
  none: boolean;
}

export function dayBudget(model: ItineraryModel, day: number): DayBudget {
  const steps = model.steps.filter((step) => step.day === day);
  if (steps.length === 0) {
    return { known: 0, unknownCount: 0, pricedCount: 0, complete: false, none: true };
  }
  let known = 0;
  let unknownCount = 0;
  let pricedCount = 0;
  for (const step of steps) {
    if (step.price.amount === null) {
      unknownCount += 1;
    } else {
      pricedCount += 1;
      known += step.price.amount;
    }
  }
  return {
    known: Math.round(known * 100) / 100,
    unknownCount,
    pricedCount,
    complete: unknownCount === 0,
    none: pricedCount === 0,
  };
}

export { PRICE_TO_CHECK };
