/**
 * Mesures reelles du parcours : le kilometrage et la meteo.
 *
 * Ces deux grandeurs ne s inv-entent pas, elles se mesurent :
 *   - la distance vient d OSRM, sur le RESEAU ROUTIER, jour par jour ;
 *   - la meteo vient d Open-Meteo, sur les DATES REELLES de l aventure.
 *
 * Module PUR comme le reste du moteur : le reseau est injecte, jamais importe.
 * Une source qui ne repond pas ne produit ni zero ni moyenne : elle laisse la
 * mesure a `null`, et l ecran assume « a verifier ».
 */

import { applyRouting, routeItinerary, type RoutingDeps } from './routing';
import { dateRange, type DayWeather } from './weather';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/** Un point de mesure de la meteo : la position a interroger. */
export interface WeatherAnchor {
  readonly lat: number;
  readonly lon: number;
}

/**
 * Preleve la prevision pour une liste de dates deja calculees.
 *
 * L'ancre est passee par l'appelant plutot que recalculee ici : c'est lui qui
 * a tranche du point de depart, et une seule decision doit governer la
 * selection comme la requete.
 */
export type WeatherFetcher = (
  dates: readonly string[],
  signal: AbortSignal | undefined,
  anchor: WeatherAnchor,
) => Promise<readonly DayWeather[] | null>;

export interface MeasurementDeps {
  readonly route: RoutingDeps;
  readonly weather: WeatherFetcher;
}

/**
 * Le point d ancrage de la meteo.
 *
 * On privilegie le depart saisi : c est ce que l utilisateur a choisi. Sinon
 * on prend la premiere etape reellement situee. Sans aucun des deux, on ne
 * demande rien au fournisseur plutot que de lui faire deviner un point.
 */
export function weatherAnchor(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
): WeatherAnchor | null {
  const origin = draft.route.origin;
  if (origin) return { lat: origin.lat, lon: origin.lon };
  const located = model.steps.find((step) => step.lat !== null && step.lon !== null);
  if (!located || located.lat === null || located.lon === null) return null;
  return { lat: located.lat, lon: located.lon };
}

/**
 * L'ancre meteo de CHAQUE journee, indexee comme `perDay`.
 *
 * Une journee vit dans un lieu et un autre : interroger la meteo du depart
 * pour les trois jours afficherait trois fois la meme prevision. Apres le
 * premier jour, chaque jour est donc ancre sur sa premiere etape SITUEE, et
 * seulement a defaut sur l'ancre du voyage. Sans aucun point de reference,
 * l'element reste `null` : on ne demande rien plutot que de faire deviner.
 */
export function dayWeatherAnchors(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
): (WeatherAnchor | null)[] {
  const fallback = weatherAnchor(draft, model);
  return Array.from({ length: Math.max(0, Math.trunc(model.days)) }, (_vide, index) => {
    // Le premier jour ne se discuss pas : on est encore au depart choisi, et
    // c est la SEULE decision que l utilisateur a prise lui-meme. Lui preferer
    // une etape du programme reviendrait a substituer une proposition a son
    // choix.
    if (index === 0) return fallback;
    const first = model.steps.find(
      (step) => step.day === index + 1 && step.lat !== null && step.lon !== null,
    );
    if (!first || first.lat === null || first.lon === null) return fallback;
    return { lat: first.lat, lon: first.lon };
  });
}

/**
 * Rattache la meteo mesuree au modele, jour par jour, sur les dates reelles.
 *
 * Un tableau de prevision incomplet est refuse en entier : aligner la serie
 * sur les jours serait faire dire a la journee 1 la meteo d une autre date.
 */
export function applyWeather(
  model: ItineraryModel,
  startDate: string | null,
  fetched: readonly DayWeather[] | null,
): ItineraryModel {
  if (!fetched || fetched.length !== model.days) return model;
  return applyDayWeather(model, startDate, Array.from({ length: model.days }, () => fetched));
}

/**
 * Rattache a chaque journee LA serie mesuree pour cette journee-la.
 *
 * `perDay[i]` est la reponse obtenue pour le jour i+1, ou `null` quand rien
 * n'a ete mesure. Le rattachement se fait par DATE REELLE et jamais par rang
 * dans le tableau : une serie reponse dans le desordre ne doit pas decaler
 * les journees.
 */
export function applyDayWeather(
  model: ItineraryModel,
  startDate: string | null,
  perDay: readonly (readonly DayWeather[] | null)[],
): ItineraryModel {
  const dates = dateRange(startDate, model.days);
  if (!dates) return model;
  return {
    ...model,
    weather: dates.map((date, index) => {
      const fetched = perDay[index] ?? null;
      return fetched?.find((day) => day.date === date) ?? null;
    }),
  };
}

/** Une ancre, et les index des journees qu'elle couvre. */
interface WeatherGroup {
  readonly anchor: WeatherAnchor;
  readonly days: readonly number[];
}

/**
 * Regroupe les journees qui partagent la meme ancre.
 *
 * Trois journees au meme refuge ne doivent pas etre interrogees trois fois :
 * une seule requete couvre les trois, et la reponse est partagee.
 */
function groupByAnchor(anchors: readonly (WeatherAnchor | null)[]): WeatherGroup[] {
  const groups = new Map<string, WeatherGroup>();
  for (const [index, anchor] of anchors.entries()) {
    if (!anchor) continue;
    const key = `${anchor.lat.toFixed(4)},${anchor.lon.toFixed(4)}`;
    const dejaVu = groups.get(key);
    groups.set(key, dejaVu ? { anchor, days: [...dejaVu.days, index] } : { anchor, days: [index] });
  }
  return [...groups.values()];
}

/**
 * Interroge UNE FOIS chaque ancre distincte, puis reassemble par journee.
 *
 * Un groupe qui echoue n'entraine pas les autres : ses journees restent
 * `null` — « meteo indisponible » — et les autres gardent leur mesure. C'est
 * toute la difference entre une absence, que l'ecran assume, et une valeur
 * empruntee a une autre journee, qui serait une invention.
 */
export async function measureDayWeather(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  weather: WeatherFetcher,
  signal?: AbortSignal,
): Promise<ItineraryModel> {
  const dates = dateRange(draft.calendar.startDate, model.days);
  if (!dates) return model;
  const perDay: (readonly DayWeather[] | null)[] = new Array(dates.length).fill(null);
  for (const group of groupByAnchor(dayWeatherAnchors(draft, model))) {
    if (signal?.aborted) break;
    let fetched: readonly DayWeather[] | null = null;
    try {
      const aDemander = group.days
        .map((index) => dates[index])
        .filter((date): date is string => Boolean(date));
      fetched = await weather(aDemander, signal, group.anchor);
    } catch {
      fetched = null;
    }
    if (!fetched) continue;
    for (const index of group.days) perDay[index] = fetched;
  }
  if (signal?.aborted) return model;
  return applyDayWeather(model, draft.calendar.startDate, perDay);
}

/**
 * Enchaine routage puis meteo. Chaque etape est independante : un routage
 * muet n empeche pas la meteo, et l inverse est vrai aussi.
 */
export async function measureItinerary(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  deps: MeasurementDeps,
  signal?: AbortSignal,
): Promise<ItineraryModel> {
  // Un parcours deja annule ne part pas sur le reseau : les deps reelles
  // rejettent immediatement, autant ne pas leur demander.
  if (signal?.aborted) return model;

  // 1. Kilometrage routier et denivele, jour par jour.
  let routed = model;
  try {
    routed = await routeItinerary(model, deps.route, signal);
  } catch {
    routed = model;
  }
  if (signal?.aborted) return routed;

  // 2. Meteo des dates reelles, a l ancre de CHAQUE journee.
  return measureDayWeather(draft, routed, deps.weather, signal);
}

/* ------------------------------------------------------------------ */
/* Assemblage des phases de mesure                                      */
/* ------------------------------------------------------------------ */

/**
 * Une phase de mesure : elle recoit le modele deja construit et en rend un
 * nouveau, mesure ou pas. C'est ce decoupage qui permet au rail de cocher
 * `trace` et `meteo` chacune APRES son propre travail, plutot que d'annoncer
 * deux phases d'un coup a la fin.
 */
export type MeasurementRunner = (
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  signal: AbortSignal,
) => Promise<ItineraryModel>;

export interface MeasurementRunners {
  readonly trace: MeasurementRunner;
  readonly weather: MeasurementRunner;
}

/**
 * Le cas sans reseau : le serveur, les tests et le rendu statique. Les deux
 * runners sont alors des identites, donc le modele garde ses `null` — ce qui
 * est la seule reponse honnete quand personne n'a mesure quoi que ce soit.
 */
export const NO_MEASUREMENTS: MeasurementRunners = {
  trace: async (_draft, model) => model,
  weather: async (_draft, model) => model,
};

/** Convertit des dependances reelles en deux phases independantes. */
export function measurementRunners(deps: MeasurementDeps): MeasurementRunners {
  return {
    trace: async (_draft, model, signal) => {
      try {
        return await routeItinerary(model, deps.route, signal);
      } catch {
        return model;
      }
    },
    weather: async (draft, model, signal) => {
      return measureDayWeather(draft, model, deps.weather, signal);
    },
  };
}

/**
 * Enchaine les DEUX phases de mesure sur le meme signal.
 *
 * `measureItinerary` fait la meme chose a partir de dependances, mais l'ecran
 * et le store recoivent des runners : c'est ce que `browserMeasurementRunners`
 * produit. Un run coupe entre les deux phases s'arrete la : interroger la meteo
 * d'un parcours dont le trace n'a jamais ete mesure reviendrait a afficher la
 * meteo d'un trajet qui n'existe pas.
 */
export async function measureWithRunners(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  runners: MeasurementRunners,
  signal: AbortSignal,
): Promise<ItineraryModel> {
  if (signal.aborted) return model;
  const traced = await runners.trace(draft, model, signal);
  if (signal.aborted) return traced;
  return runners.weather(draft, traced, signal);
}

/** Re-export pratique : le trace d une journee, pour la carte du jour. */
export { applyRouting };
