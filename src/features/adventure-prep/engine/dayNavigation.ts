/**
 * Navigation de jour et point de passage — la geometrie des deux gestes que
 * l'utilisateur fait sur le parcours.
 *
 * Balayer pour changer de jour, maintenir la carte pour poser un point de
 * passage : les deux sont des intentions, pas de l'etat. Ce module les
 * transforme en decisions PURES, et l'ecran se contente de les appliquer au
 * store. Rien ici ne mesure, n'invente de coordonnee, ni ne sort du perimetre
 * du voyage.
 *
 * Regle de honnetete la plus importante : poser un point change le trace, donc
 * les mesures de la journee ne valent plus rien. Elles tombent a `null`
 * (« à vérifier ») et attendent une remesure sur le reseau routier. Laisser
 * l'ancienne distance affichee ferait passer un itineraire perime pour un
 * itineraire verifie.
 */

import { PRICE_TO_CHECK } from '../types';
import type { ItineraryModel, ItineraryStep } from '../types';
import type { DayWeather } from './weather';

/* ------------------------------------------------------------------ */
/* Perimetre jour                                                      */
/* ------------------------------------------------------------------ */

/** Une journee du programme, avec ses etapes dans l ordre du parcours. */
export interface ProgrammeDay {
  readonly day: number;
  readonly steps: readonly ItineraryStep[];
}

/**
 * Jour reellement affiche, apres validation de la selection.
 *
 * La bottom bar et l ecran lisent le MEME store, mais une selection peut
 * devenir orpheline : jour supprime, changement de programme, retour en
 * amont. Un `focusDay` hors programme ne doit donc jamais produire un ecran
 * vide — il retombe sur la vue Ensemble, qui affiche tout le parcours.
 */
export function resolveActiveDay(days: number, focusDay: number | null): number | null {
  if (!Number.isInteger(days) || days < 1) return null;
  if (focusDay === null || !Number.isInteger(focusDay)) return null;
  return focusDay >= 1 && focusDay <= days ? focusDay : null;
}

/**
 * Le programme, decoupe en journees REELLEMENT peuplees.
 *
 * Une journee sans etape n apparait pas : afficher « Jour 2 » suivi d un vide
 * ferait croire a un programme incomplet alors que le parcours ne prevoit rien
 * ce jour-la. Les etapes sont triees par `order`, qui est la seule numerotation
 * de parcours — `day` seul ne garantit rien sur l ordre d affichage.
 */
export function programmeByDay(
  model: Pick<ItineraryModel, 'days' | 'steps'>,
  focused: number | null,
): ProgrammeDay[] {
  const out: ProgrammeDay[] = [];
  for (let day = 1; day <= model.days; day += 1) {
    if (focused !== null && day !== focused) continue;
    const steps = model.steps
      .filter((step) => step.day === day)
      .sort((a, b) => a.order - b.order);
    if (steps.length === 0) continue;
    out.push({ day, steps });
  }
  return out;
}

/**
 * Perimetre de lecture des mesures.
 *
 * La carte, le programme et les metriques doivent parler de la MEME portee,
 * sinon l ecran afficherait « 18,4 km » a cote d un programme couvrant 42,7 km.
 */
export function measureScope(activeDay: number | null): {
  readonly scope: 'jour' | 'aventure';
  readonly day: number | undefined;
} {
  return activeDay === null ? { scope: 'aventure', day: undefined } : { scope: 'jour', day: activeDay };
}

/* ------------------------------------------------------------------ */
/* Balayage                                                            */
/* ------------------------------------------------------------------ */

/** Effet d'un geste, une fois la question « est-ce un balayage ? » tranchee. */
export type SwipeIntent = 'suivant' | 'precedent';

/** Deplacement horizontal minimal, en pixels CSS. */
const SWIPE_THRESHOLD_PX = 48;

/**
 * Un balayage de jour doit-etre franchement horizontal.
 *
 * Le programme de l'etape 2 est une liste verticale : sans ce rapport, un
 * scroll normal declenche un changement de jour et l'utilisateur perd le fil
 * de la journee qu'il sedangait de lire. Le seuil de 48 px vient de la taille
 * cible tactile : en dessous, le geste n'est pas distingue d'un tap.
 */
const HORIZONTAL_DOMINANCE = 2;

/**
 * Le sens du geste, ou `null` si ce n'est pas un balayage de jour.
 *
 * Convention d'interface : balayer vers la DROITE fait avancer, vers la
 * GAUCHE recule — le meme sens que le carrousel horizontal du systeme. Les
 * valeurs non finies ne sont pas des gestes : elles rendent `null` plutot que
 * de faire basculer l'ecran sur une valeur fantaisiste.
 */
export function swipeIntent(dx: number, dy: number): SwipeIntent | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return null;
  // Le geste doit avoir un axe dominant net : un diagonale 100/90 est un
  // defilement diagonal, pas un changement de jour.
  if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return null;
  return dx > 0 ? 'suivant' : 'precedent';
}

/**
 * Le jour a afficher apres le geste.
 *
 * `null` = vue ensemble. Le rail des jours est un CARRousel ferme :
 * « Ensemble » fait partie de la boucle au meme titre qu un jour. Balayer a
 * droite depuis le dernier jour revient donc sur l ensemble, et balayer a
 * gauche depuis l ensemble ouvre le dernier jour. Aucun geste ne finit sur une
 * impasse, et aucun ne produit un jour hors programme.
 */
export function dayAfterSwipe(
  current: number | null,
  days: number,
  intent: SwipeIntent | null,
): number | null {
  if (!intent) return current;
  if (!Number.isInteger(days) || days < 1) return null;

  // Etat incoherent (voyage raccourci entre deux gestes) : on retablit la vue
  // ensemble et on NE NAVIGUE PAS. Replacer un jour fantome par un jour specimen
  // enchainerait deux consequences pour un seul geste de l'utilisateur.
  if (current !== null && (!Number.isInteger(current) || current < 1 || current > days)) {
    return null;
  }

  // Le rail est un carrousel ferme : « Ensemble » fait partie de la boucle au
  // meme titre qu un jour. Aucun geste ne finit donc sur une impasse — on peut
  // toujours aller voir ce qui vient d apparence.
  if (intent === 'suivant') {
    if (current === null) return 1;
    return current >= days ? null : current + 1;
  }
  if (current === null) return days;
  return current <= 1 ? null : current - 1;
}

/* ------------------------------------------------------------------ */
/* Meteo du jour                                                       */
/* ------------------------------------------------------------------ */

/**
 * La meteo mesuree d'une journee.
 *
 * `model.weather` est indexee comme `perDay` : index 0 = jour 1. Un index
 * absent vaut ABSENCE, jamais la meteo d'un autre jour.
 */
export function weatherOfDay(model: ItineraryModel, day: number): DayWeather | null {
  if (!Number.isInteger(day) || day < 1 || day > model.days) return null;
  return model.weather[day - 1] ?? null;
}

/* ------------------------------------------------------------------ */
/* Point de passage                                                    */
/* ------------------------------------------------------------------ */

/** Position posee sur la carte. */
export interface MapCoord {
  readonly lat: number;
  readonly lon: number;
}

/**
 * Une coordonnee est exploitable si elle designe un point reel du globe.
 *
 * Le couple (0, 0) et les axes nuls sont refuses : dans ce modele, un zero
 * n'est jamais une position choisie, c'est une coordonnee absente qui a
 * traverse une base de donnees. Le meme filtre protege `PrepMap` et le
 * moteur : mieux vaut une carte sans point qu'un point au milieu du Gabon.
 */
export function isHonestCoord(coord: MapCoord): boolean {
  const { lat, lon } = coord;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 || lon === 0) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/** Un identifiant qui ne peut pas ecraser une etape deja presente. */
function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

/** Mesures devenues fausses : le trace n'est plus celui qui a ete mesure. */
const UNMEASURED = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
} as const;

/** Lieu REEL choisi dans une liste, rattache a un point de passage. */
export interface WaypointPlace {
  readonly name: string;
  /** Identifiant de catalogue quand la source en fournit un. */
  readonly catalogId?: string | null;
}

/** Le libelle honnete d'un point de passage : une position, pas un nom de lieu. */
export const WAYPOINT_TITLE = 'Point de passage';
export const WAYPOINT_REASON = 'Ajouté depuis la carte';

/**
 * Pose un point de passage et renvoie un NOUVEAU modele.
 *
 * Le point s'insere entre les etapes qui l'encadrent (`afterOrder`, la
 * dernière de la journee par defaut) puis la journee est renumerotee de 1 a N :
 * les ordres restent contigus, donc le tri et la carte ne peuvent pas produire
 * deux etapes de meme rang.
 *
 * Les mesures de la journee et le total du parcours retombent a `null`. Elles
 * ne sont pas « approximatives » : elles decrivent un trace qui n'existe plus.
 * `measureItinerary` les remettra a jour sur le reseau routier reel.
 */
export function insertWaypoint(
  model: ItineraryModel,
  coord: MapCoord,
  day: number,
  afterOrder?: number,
  seedId?: string,
  place?: WaypointPlace,
): ItineraryModel {
  if (!isHonestCoord(coord)) return model;
  if (!Number.isInteger(day) || day < 1 || day > model.days) return model;

  const taken = new Set(model.steps.map((step) => step.id));
  const daySteps = model.steps
    .filter((step) => step.day === day)
    .sort((a, b) => a.order - b.order);

  // Insertion apres la derniere etape connue quand l'appelant ne precise pas,
  // ou apres la derniere reellement presente si l'ordre demande depasse.
  const requested = afterOrder ?? (daySteps.length || 1);
  const anchor = Math.min(Math.max(1, Math.trunc(requested)), Math.max(1, daySteps.length));
  const base = seedId ?? `point-j${day}`;
  // Lieu choisi dans la liste geolocalisee, ou absent pour un point nu.
  const lieu = place?.name.trim() ? place.name.trim() : null;
  const catalogId = place?.catalogId?.trim() ? place.catalogId.trim() : null;

  const waypoint: ItineraryStep = {
    id: uniqueId(base, taken),
    day,
    order: anchor + 1,
    kind: 'arret',
    title: WAYPOINT_TITLE,
    // Un point pose a la main n'a pas de nom de lieu, et l'ecran affiche
    // « à vérifier » plutot que d'inventer une adresse.
    // porte le sien.
    placeName: lieu,
    // L'identifiant ne vient que de la source. Jamais de cle synthetique :
    // elle se lirait comme une reference de catalogue qui ne mène nulle part.
    placeId: catalogId,
    startTime: null,
    durationMin: null,
    reason: WAYPOINT_REASON,
    price: PRICE_TO_CHECK,
    state: 'propose',
    kept: false,
    icon: 'map-pin',
    lat: coord.lat,
    lon: coord.lon,
  };

  const others = model.steps.filter((step) => step.day !== day);
  const renumbered = [...daySteps, waypoint]
    .sort((a, b) => {
      if (a.id === waypoint.id) return -1;
      if (b.id === waypoint.id) return 1;
      return a.order - b.order;
    })
    .map((step, index) => (step.order === index + 1 ? step : { ...step, order: index + 1 }));

  const perDay = model.perDay.map((totals, index) =>
    index === day - 1 ? { ...UNMEASURED } : totals,
  );

  return {
    ...model,
    steps: [...others, ...renumbered],
    perDay,
    // Le total du parcours ne vaut plus lui non plus : il incluait l'ancien
    // trace. Aucune valeur n'est reaffichee tant que la remesure n'a pas eu lieu.
    totals: { ...UNMEASURED },
  };
}
