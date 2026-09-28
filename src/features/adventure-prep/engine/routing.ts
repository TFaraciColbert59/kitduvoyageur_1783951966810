/**
 * Routage reel du preparateur.
 *
 * Regle inviolable : une distance affichee est une distance MESUREE sur le
 * reseau du mode de deplacement reel, ou `null`. Le vol d'oiseau n'est jamais
 * presente comme une distance de parcours, et une panne du routeur ne devient
 * jamais « 0 km ».
 *
 * P0.22 : le profil etait fige sur le reseau routier. Un trajet de marche
 * etait donc annonce en 12 min de voiture — 2 h 07 mesurees a pied sur les
 * MEMES points. Le mode n'est plus une option d'affichage : c'est une entree
 * du calcul, et il remonte jusqu'a la query du fournisseur.
 *
 * Trois fournisseurs libres, sans cle, appeler cote navigateur via /api/route :
 *   - OSRM       : reseau routier, pour `voiture` ;
 *   - Valhalla    : pieton et velo, sur le graphe pedestre ;
 *   - Open-Meteo : altitude reelle de chaque point du trace, donc le denivele.
 *
 * Ce module separe strictement le calcul pur (testable, deterministe) de
 * l'appel reseau (injecte), pour que la logique reste verifiable hors ligne.
 */

import type { ItineraryModel, ItineraryStep, MetricsContext } from '../types';

export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
}

/**
 * Mode de deplacement reellement mesure.
 *
 * Ces trois valeurs sont le SEUL vocabulaire du routage. Un profil qui n'est
 * pas dans cette liste n'est pas un mode, c'est une faute de frappe : il doit
 * etre refuse, jamais remplace par un defaut silencieux, car un defaut
 * silencieux afficherait encore des kilometres de voiture.
 */
export type TravelMode = 'pieton' | 'velo' | 'voiture';

export const TRAVEL_MODES: readonly TravelMode[] = ['pieton', 'velo', 'voiture'];

/**
 * Le mode de mesure deduit du contexte du parcours.
 *
 * `terrain` et `sejour` sont des parcours ou l'on se deplace sur place : ils
 * sont donc mesures sur le graphe pedestre. `voyage` est un trajet d'un point a
 * un autre : il est mesure sur le reseau routier.
 *
 * Limite CONNUE et assumee : `velo` est accepte partout (contrat, route,
 * routeur, tests) mais pas encore produit ici, parce que le modele ne porte que
 * `metricsContext` et non la selection d'activites. Un parcours velo est donc
 * mesure comme un parcours pieton : moins faux qu'en voiture, encore faux.
 * Le reste est trace dans la checklist, pas ici.
 */
export function travelModeFor(context: MetricsContext): TravelMode {
  return context === 'voyage' ? 'voiture' : 'pieton';
}

/** Un troncon tel que renvoye par OSRM : la mesure, jamais une estimation. */
export interface RouteLeg {
  readonly distanceKm: number;
  readonly durationMin: number;
  /** Trace reel, au format OSRM : `[lon, lat]`. */
  readonly geometry: readonly (readonly [number, number])[];
  /**
   * Denivele positif, en metres, quand le fournisseur sait le mesurer.
   *
   * Facultatif parce que tous les fournisseurs ne le savent pas : OSRM et
   * Valhalla ne le donnent pas, seul BRouter — moteur de randonnee — expose un
   * denivele reel. `undefined` veut dire « non mesure », jamais « plat ».
   */
  readonly ascentM?: number;
}

/** Ce qu'une journee sait reellement de son trajet. */
export interface DayRoute {
  readonly distanceKm: number;
  readonly durationMin: number;
  readonly geometry: readonly (readonly [number, number])[];
  readonly elevGainM: number | null;
  readonly elevLossM: number | null;
}

/** Resultat complet du routage, indexe comme le modele. */
export interface RoutingResolution {
  /** Une entree par journee, index 0 = jour 1. `null` = journee non routee. */
  readonly perDay: readonly (DayRoute | null)[];
  /** Troncon d'arrivee de chaque etape situee, pour le detail de la fiche. */
  readonly legByStepId: Readonly<Record<string, RouteLeg>>;
  /**
   * Etapes situees vers lesquelles AUCUN deplacement n'existe : la premiere
   * de chaque journee routee. On y commence, donc le trajet vers ce point est
   * nul — un fait du chainon, pas une donnee manquante.
   *
   * Sans ce registre, la premiere etape de chaque jour gardait `durationMin`
   * a `null`, alors que `activityMin` n'accepte une valeur que si TOUTES les
   * etapes du jour en ont une : la journee entiere et le total restaient donc
   * « a verifier » sur chaque parcours reellement genere.
   */
  readonly zeroTravelStepIds?: ReadonlySet<string>;
}

/** Collaborateurs injectes : le reseau se teste avec des doublures. */
export interface RoutingDeps {
  /**
   * Trace des points dans l'ordre, sur le reseau du mode demande ; `null`
   * quand la source ne repond pas, ou quand son trace n'atteint pas le lieu.
   */
  route: (
    points: readonly GeoPoint[],
    mode: TravelMode,
    signal?: AbortSignal,
  ) => Promise<RouteLeg[] | null>;
  /** Altitude reelle, alignee sur les points ; `null` si la source echoue. */
  elevation: (
    points: readonly (readonly [number, number])[],
    signal?: AbortSignal,
  ) => Promise<readonly (number | null)[] | null>;
}

/* ------------------------------------------------------------------ */
/* Geometrie pure                                                      */
/* ------------------------------------------------------------------ */

/** Rayon terrestre moyen, en km. Suffisant pour un controle de coherence. */
const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Distance orthodromique, en km. Sert de garde-fou, jamais d'affichage. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface LegTotals {
  readonly distanceKm: number;
  readonly durationMin: number;
}

export function legTotals(legs: readonly RouteLeg[]): LegTotals {
  return legs.reduce<{ distanceKm: number; durationMin: number }>(
    (acc, leg) => ({
      distanceKm: acc.distanceKm + leg.distanceKm,
      durationMin: acc.durationMin + leg.durationMin,
    }),
    { distanceKm: 0, durationMin: 0 },
  );
}

export interface ElevationProfile {
  readonly gainM: number | null;
  readonly lossM: number | null;
}

/**
 * Denivele d'un profil altimetrique, par seuil AVEC hysteresis.
 *
 * Le bruit de mesure ne doit pas compter comme une montee, mais une vraie
 * montee ne doit pas etre amputee de son point de depart. On accumule donc la
 * pente en cours dans un tampon : des qu'elle atteint le seuil, la montee est
 * comptee en entier, tampon compris. Une descente confirmee annule le tampon.
 *
 * Un seul point manquant invalide tout le profil : sous-estimer le denivele
 * serait pire que de dire « a verifier ».
 */
export function elevationProfile(
  elevations: readonly (number | null)[],
  thresholdM = 10,
): ElevationProfile {
  if (elevations.length < 2) return { gainM: null, lossM: null };
  let gain = 0;
  let loss = 0;
  let pendingRise = 0;
  for (let index = 1; index < elevations.length; index += 1) {
    const from = elevations[index - 1];
    const to = elevations[index];
    if (from === null || from === undefined || to === null || to === undefined) {
      return { gainM: null, lossM: null };
    }
    const delta = to - from;
    if (delta >= 0) {
      pendingRise += delta;
      if (pendingRise >= thresholdM) {
        gain += pendingRise;
        pendingRise = 0;
      }
    } else if (-delta >= thresholdM) {
      loss += -delta;
      pendingRise = 0;
    } else {
      // Pente faible : elle annule le bruit accumule sans reductions.
      pendingRise = Math.max(0, pendingRise + delta);
    }
  }
  return { gainM: gain, lossM: loss };
}

/* ------------------------------------------------------------------ */
/* Application au modele (pur, immuable)                              */
/* ------------------------------------------------------------------ */

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function located(step: ItineraryStep): GeoPoint | null {
  if (step.lat === null || step.lon === null) return null;
  return { lat: step.lat, lon: step.lon };
}

function sumKnown(values: readonly (number | null)[]): number | null {
  if (values.length === 0) return null;
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((acc, value) => acc + (value as number), 0);
}

/**
 * Ecrit le routage mesure dans le modele. Renvoie un NOUVEAU modele : la
 * regle d'immuabilite vaut aussi pour les moteurs purs.
 */
export function applyRouting(
  model: ItineraryModel,
  resolution: RoutingResolution,
): ItineraryModel {
  const perDay = model.perDay.map((totals, index) => {
    const route = resolution.perDay[index];
    if (!route) return totals;
    return {
      ...totals,
      distanceKm: round(route.distanceKm, 2),
      movingMin: route.durationMin,
      elevGainM: route.elevGainM,
      elevLossM: route.elevLossM,
    };
  });

  const zeroTravel = resolution.zeroTravelStepIds ?? new Set<string>();
  const steps = model.steps.map((step) => {
    const leg = resolution.legByStepId[step.id];
    // Un point de depart de journee ne se rejoint pas : sa duree de trajet
    // vaut zero, et c'est mesure — pas suppose. Absent du registre (journee non
    // routee), l etape reste a verifier.
    if (!leg) return zeroTravel.has(step.id) ? { ...step, durationMin: 0 } : step;
    return { ...step, durationMin: leg.durationMin };
  });

  const totals = {
    distanceKm: sumKnown(perDay.map((day) => day.distanceKm)),
    movingMin: sumKnown(perDay.map((day) => day.movingMin)),
    elevGainM: sumKnown(perDay.map((day) => day.elevGainM)),
    elevLossM: sumKnown(perDay.map((day) => day.elevLossM)),
    activityMin: sumKnown(perDay.map((day) => day.activityMin)),
  };

  return { ...model, steps, perDay, totals };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

interface ChainNode {
  readonly point: GeoPoint;
  readonly stepId: string;
}

// Deux points a moins d un metre sont le meme point. Le seuil n est pas
// arbitraire : la source de lieux travaille a 1e-4 de degres pres, soit
// environ 11 metres. Un pas plus petit ne distingue pas deux lieux, et un
// troncon de longueur nulle n a pas de route.
function samePoint(a: GeoPoint, b: GeoPoint): boolean {
  const metersLat = Math.abs(a.lat - b.lat) * 111_320;
  const metersLon =
    Math.abs(a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return metersLat < 1 && metersLon < 1;
}

function dayChains(model: ItineraryModel): ChainNode[][] {
  const chains: ChainNode[][] = Array.from({ length: model.days }, () => []);
  const byDay = new Map<number, ItineraryStep[]>();
  for (const step of model.steps) {
    const bucket = byDay.get(step.day);
    if (bucket) bucket.push(step);
    else byDay.set(step.day, [step]);
  }
  for (const [day, steps] of byDay) {
    if (day < 1 || day > model.days) continue;
    const chain: ChainNode[] = [];
    for (const step of [...steps].sort((a, b) => a.order - b.order)) {
      const point = located(step);
      if (!point) continue;
      const previous = chain[chain.length - 1];
      if (previous && samePoint(previous.point, point)) continue;
      chain.push({ point, stepId: step.id });
    }
    chains[day - 1] = chain;
  }
  return chains;
}

function stepIdsByDay(model: ItineraryModel): string[][] {
  const ids: string[][] = Array.from({ length: model.days }, () => []);
  for (const step of [...model.steps].sort((a, b) => a.day - b.day || a.order - b.order)) {
    if (step.day < 1 || step.day > model.days) continue;
    if (located(step) === null) continue;
    ids[step.day - 1].push(step.id);
  }
  return ids;
}

// Nombre d'etapes declarees pour une journee, situees ou non.
function stepsOnDay(model: ItineraryModel, day: number): number {
  let count = 0;
  for (const step of model.steps) if (step.day === day) count += 1;
  return count;
}

// La duree d'activite d'une journee, deduite de ses etapes.
//
// `activityMin` ne vaut que si TOUTES les etapes du jour ont une duree : une
// somme partielle se lirait comme la duree de la journee. Le routage vient
// d'ecrire la duree REELLE des deplacements sur l'etape d arrivee ; les autres
// portent la duree d'activite proposee. C'est la somme des deux qui est la
// duree d'activite de la journee.
export function applyActivityDurations(model: ItineraryModel): ItineraryModel {
  const perDay = model.perDay.map((totals, index) => {
    const day = index + 1;
    const steps = model.steps.filter((step) => step.day === day);
    if (steps.length === 0) return totals;
    let total = 0;
    for (const step of steps) {
      if (step.durationMin === null || !Number.isFinite(step.durationMin)) return totals;
      total += step.durationMin;
    }
    return { ...totals, activityMin: Math.round(total) };
  });

  return {
    ...model,
    perDay,
    totals: { ...model.totals, activityMin: sumKnown(perDay.map((day) => day.activityMin)) },
  };
}

/**
 * Route le modele journee par journee. Une journee qui n'a pas deux points
 * situes, ou dont le routeur ne repond pas, reste a verifier : elle n'est ni
 * comptee a zero, ni completee par une distance approchee.
 */
export async function routeItinerary(
  model: ItineraryModel,
  deps: RoutingDeps,
  signal?: AbortSignal,
): Promise<ItineraryModel> {
  // Le mode se deduit UNE fois pour tout le parcours : c'est la meme
  // intention de deplacement du premier au dernier jour.
  const mode = travelModeFor(model.metricsContext);
  const chains = dayChains(model);
  const ids = stepIdsByDay(model);
  const perDay: (DayRoute | null)[] = [];
  const legByStepId: Record<string, RouteLeg> = {};
  const zeroTravelStepIds = new Set<string>();

  for (let index = 0; index < chains.length; index += 1) {
    const chain = chains[index];
    if (chain.length < 2) {
      // Zero PROUVE, pas un zero par defaut. Si toutes les etapes de la
      // journee sont situees et qu'il n'en reste qu'une, il n'y a aucun
      // deplacement a mesurer entre deux points : la distance est nulle par
      // construction. Des qu'une etape n'est pas situee, en revanche, on ne
      // sait pas ou la personne passe : la journee reste entierement a
      // verifier, et avec elle le total, plutot que de sous-estimer.
      const allLocated = ids[index].length === stepsOnDay(model, index + 1);
      // Une intention NON RATTACHEE compte aussi comme un manque : le jour
      // peut n avoir plus qu'un point parce que le reste n a pas ete trouve,
      // pas parce qu il n y avait rien a faire. « 0 km » mentirait alors.
      const complete = !(model.notes ?? []).some((note) => note.day === index + 1);
      // Le denivele suit la meme regle que la distance : entre un point et
      // lui-meme on ne monte ni on ne descend. Laisser `null` ici annulait le
      // denivele TOTAL via `sumKnown`, meme quand les autres journees
      // portaient une donnee reellement mesuree — le preparateur affichait
      // alors « a verifier » sur un total dont toutes les journees avaient
      // repondu. Un jour NON mesure, lui, reste `null` : rien n est invente.
      if (chain.length === 1 && allLocated && complete) {
        // Journee PROUVEE sans deplacement : la distance nulle est mesuree, et
        // son unique etape n a donc rien a trajetner non plus.
        perDay.push({ distanceKm: 0, durationMin: 0, geometry: [], elevGainM: 0, elevLossM: 0 });
        zeroTravelStepIds.add(chain[0].stepId);
      } else {
        perDay.push(null);
      }
      continue;
    }

    // La chaine est deja dedoublonnee : le routeur ne recoit jamais deux
    // points identiques a la suite, et donc ne peut pas repondre NoSegment sur
    // un troncon de longueur nulle.
    const legs = await deps.route(
      chain.map((node) => node.point),
      mode,
      signal,
    );
    if (!legs || legs.length === 0) {
      perDay.push(null);
      continue;
    }

    const totals = legTotals(legs);
    const geometry = legs.flatMap((leg) => [...leg.geometry]);
    // Le troncon N aboutit sur le point N+1 : c est l etape qui porte la
    // duree routiere mesuree. Les points repetes ayant ete retires, l index
    // suit directement la chaine.
    const dayIds = chain.map((node) => node.stepId);
    // Le point de depart du chainon ne se rejoint pas depuis un point
    // precedent : on y commence. Le routage etant reussi, ce zero est PROUVE.
    if (dayIds[0]) zeroTravelStepIds.add(dayIds[0]);
    legs.forEach((leg, legIndex) => {
      const stepId = dayIds[legIndex + 1];
      if (stepId) legByStepId[stepId] = leg;
    });

    const elevations = geometry.length > 0 ? await deps.elevation(geometry, signal) : null;
    const profile = elevations ? elevationProfile(elevations) : { gainM: null, lossM: null };

    perDay.push({
      distanceKm: round(totals.distanceKm, 2),
      durationMin: Math.round(totals.durationMin),
      geometry,
      elevGainM: profile.gainM === null ? null : Math.round(profile.gainM),
      elevLossM: profile.lossM === null ? null : Math.round(profile.lossM),
    });
  }

  return applyActivityDurations(applyRouting(model, { perDay, legByStepId, zeroTravelStepIds }));
}
